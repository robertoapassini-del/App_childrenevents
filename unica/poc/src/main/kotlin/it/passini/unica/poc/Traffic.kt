package it.passini.unica.poc

import it.passini.unica.data.Conversation
import it.passini.unica.data.Inbox
import it.passini.unica.data.Message
import it.passini.unica.data.Source
import it.passini.unica.notif.NotificationRules

const val WHATSAPP = "com.whatsapp"
const val SIGNAL = "org.thoughtcrime.securesms"

/** One line of a MessagingStyle notification. A null [sender] is the user's own message. */
data class Line(val sender: String?, val text: String, val at: Long)

/** A posted notification as the listener finds it: platform facts, actions, message lines. */
data class Posted(
    val label: String,
    val pkg: String,
    val facts: NotificationRules.Posted,
    val actions: List<NotificationRules.PostedAction>,
    val lines: List<Line>,
)

private val replyAction = NotificationRules.PostedAction(hasFreeFormInput = true, isReplySemantic = true)
private val markReadAction = NotificationRules.PostedAction(hasFreeFormInput = false, isReplySemantic = false)

/** A one-to-one chat: MessagingStyle sets no conversation title, the contact is the title. */
fun directChat(
    label: String,
    pkg: String,
    contact: String,
    lines: List<Line>,
    actions: List<NotificationRules.PostedAction> = listOf(replyAction, markReadAction),
) = Posted(
    label = label,
    pkg = pkg,
    facts = NotificationRules.Posted(
        isGroupSummary = false,
        isOngoing = false,
        category = "msg",
        conversationTitle = null,
        contentTitle = contact,
        isGroupConversation = false,
    ),
    actions = actions,
    lines = lines,
)

/** A group: MessagingStyle names the conversation, and each line names its own sender. */
fun groupChat(
    label: String,
    pkg: String,
    group: String,
    lines: List<Line>,
    actions: List<NotificationRules.PostedAction> = listOf(markReadAction, replyAction),
) = Posted(
    label = label,
    pkg = pkg,
    facts = NotificationRules.Posted(
        isGroupSummary = false,
        isOngoing = false,
        category = "msg",
        conversationTitle = group,
        contentTitle = group,
        isGroupConversation = true,
    ),
    actions = actions,
    lines = lines,
)

/** Everything the two apps post that is not a message. */
fun noise(
    label: String,
    pkg: String,
    title: String,
    isGroupSummary: Boolean = false,
    isOngoing: Boolean = false,
    category: String? = "msg",
) = Posted(
    label = label,
    pkg = pkg,
    facts = NotificationRules.Posted(
        isGroupSummary = isGroupSummary,
        isOngoing = isOngoing,
        category = category,
        conversationTitle = null,
        contentTitle = title,
        isGroupConversation = false,
    ),
    actions = emptyList(),
    lines = listOf(Line("sistema", title, 0L)),
)

/**
 * Mirrors what `UnicaListenerService.handle()` does on a device, minus the Android calls
 * that read the same values out of a real `Notification`. Everything it decides with, it
 * asks [NotificationRules] and [Inbox] — the app's own code, compiled from the app's own
 * source tree.
 */
class Listener {

    var conversations: List<Conversation> = emptyList()
        private set

    var openChat: String? = null

    val repliable = mutableSetOf<String>()
    val ignored = mutableListOf<String>()

    /** Returns the messages this notification genuinely added to the inbox. */
    fun onPosted(posted: Posted): List<Message> {
        val source = Source.fromPackage(posted.pkg)
        if (source == null) {
            ignored += "${posted.label} (not a messenger we mirror)"
            return emptyList()
        }
        if (!NotificationRules.isMessage(posted.facts)) {
            ignored += "${posted.label} (not a message)"
            return emptyList()
        }
        val title = NotificationRules.conversationTitle(posted.facts)
        if (title == null) {
            ignored += "${posted.label} (names no chat)"
            return emptyList()
        }

        val id = Conversation.idFor(posted.pkg, title)
        if (NotificationRules.pickReplyAction(posted.actions) != null) repliable += id else repliable -= id

        val messages = posted.lines.map { line ->
            Message(
                id = Inbox.messageId(line.at, line.sender.orEmpty(), line.text),
                sender = line.sender.orEmpty(),
                text = line.text,
                timestamp = line.at,
                outgoing = line.sender == null,
            )
        }

        val result = Inbox.ingest(
            current = conversations,
            source = source,
            packageName = posted.pkg,
            title = title,
            isGroup = NotificationRules.isGroup(posted.facts),
            incoming = messages,
            isActiveChat = openChat == id,
        )
        conversations = result.conversations
        return result.added
    }

    /** The user replies from Unica; the source app's action fires and we echo it locally. */
    fun onReplySent(conversationId: String, text: String, at: Long) {
        val conversation = conversations.first { it.id == conversationId }
        val result = Inbox.ingest(
            current = conversations,
            source = conversation.source,
            packageName = conversation.packageName,
            title = conversation.title,
            isGroup = conversation.isGroup,
            incoming = listOf(
                Message(Inbox.messageId(at, "", text), sender = "", text = text, timestamp = at, outgoing = true)
            ),
            isActiveChat = true,
        )
        conversations = result.conversations
    }

    fun onChatOpened(conversationId: String) {
        openChat = conversationId
        conversations = Inbox.markRead(conversations, conversationId)
    }

    /** What Android does on `onListenerConnected`: replay everything still on screen. */
    fun onReconnect(stillOnScreen: List<Posted>): List<Message> =
        stillOnScreen.flatMap { onPosted(it) }
}
