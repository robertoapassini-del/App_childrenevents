package it.passini.unica.notif

import android.app.Notification
import android.content.ComponentName
import android.content.Context
import android.os.Bundle
import android.provider.Settings
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import androidx.core.app.NotificationCompat
import it.passini.unica.data.ActiveChat
import it.passini.unica.data.Conversation
import it.passini.unica.data.Inbox
import it.passini.unica.data.Message
import it.passini.unica.data.MessageStore
import it.passini.unica.data.Source

/**
 * The only bridge that exists. Signal and WhatsApp have no third-party client API, but
 * both post rich MessagingStyle notifications with a direct-reply action, and Android
 * lets a notification listener read those and fire the action. That is enough for a
 * shared inbox: read here, reply through [ReplyRegistry].
 *
 * This class is the Android-side reader only. What counts as a message, what a chat is
 * called and which action can send text are decided by [NotificationRules], which runs
 * anywhere and is exercised by `poc/`.
 *
 * What this cannot do, by construction: see history from before Unica was installed,
 * see chats muted to the point of posting no notification at all, or send to someone who
 * has not written first.
 */
class UnicaListenerService : NotificationListenerService() {

    override fun onCreate() {
        super.onCreate()
        MessageStore.init(this)
    }

    override fun onListenerConnected() {
        // Rebuild the repliable set after a reboot or an app restart: the notifications
        // still on screen carry PendingIntents we lost when the process died.
        runCatching { activeNotifications }.getOrNull()?.forEach { handle(it) }
    }

    override fun onNotificationPosted(sbn: StatusBarNotification) = handle(sbn)

    override fun onNotificationRemoved(sbn: StatusBarNotification) {
        ReplyRegistry.forget(sbn.key)
    }

    private fun handle(sbn: StatusBarNotification) {
        val source = Source.fromPackage(sbn.packageName) ?: return
        val notification = sbn.notification

        val style = runCatching {
            NotificationCompat.MessagingStyle.extractMessagingStyleFromNotification(notification)
        }.getOrNull()

        val posted = NotificationRules.Posted(
            isGroupSummary = notification.flags and Notification.FLAG_GROUP_SUMMARY != 0,
            isOngoing = notification.flags and Notification.FLAG_ONGOING_EVENT != 0,
            category = notification.category,
            conversationTitle = style?.conversationTitle?.toString(),
            contentTitle = notification.extras.getCharSequence(Notification.EXTRA_TITLE)?.toString(),
            isGroupConversation = style?.isGroupConversation == true,
        )

        if (!NotificationRules.isMessage(posted)) return
        val title = NotificationRules.conversationTitle(posted) ?: return

        val messages = extractMessages(style, notification.extras, sbn.postTime)
        if (messages.isEmpty()) return

        val conversationId = Conversation.idFor(sbn.packageName, title)

        ReplyRegistry.remember(conversationId, buildLiveReply(sbn, notification))
        MessageStore.ingest(
            source = source,
            packageName = sbn.packageName,
            title = title,
            isGroup = NotificationRules.isGroup(posted),
            incoming = messages,
            isActiveChat = ActiveChat.isOpen(conversationId),
        )
    }

    private fun extractMessages(
        style: NotificationCompat.MessagingStyle?,
        extras: Bundle,
        postTime: Long,
    ): List<Message> {
        if (style != null && style.messages.isNotEmpty()) {
            return style.messages.mapNotNull { entry ->
                val text = entry.text?.toString()?.trim().orEmpty()
                if (text.isEmpty()) return@mapNotNull null
                // MessagingStyle convention: a null person means the message is the user's own.
                val outgoing = entry.person == null
                val sender = entry.person?.name?.toString()
                    ?: style.user.name?.toString()
                    ?: ""
                Message(
                    id = Inbox.messageId(entry.timestamp, sender, text),
                    sender = sender,
                    text = text,
                    timestamp = entry.timestamp,
                    outgoing = outgoing,
                )
            }
        }

        // Fallback for anything that is not MessagingStyle (older builds, odd forks).
        val text = extras.getCharSequence(Notification.EXTRA_TEXT)?.toString()?.trim().orEmpty()
        if (text.isEmpty()) return emptyList()
        val sender = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString().orEmpty()
        return listOf(
            Message(
                id = Inbox.messageId(postTime, sender, text),
                sender = sender,
                text = text,
                timestamp = postTime,
            )
        )
    }

    private fun buildLiveReply(
        sbn: StatusBarNotification,
        notification: Notification,
    ): ReplyRegistry.LiveReply {
        val actions = (0 until NotificationCompat.getActionCount(notification))
            .map { NotificationCompat.getAction(notification, it) }

        val facts = actions.map { action ->
            NotificationRules.PostedAction(
                hasFreeFormInput = action?.remoteInputs?.any { it.allowFreeFormInput } == true,
                isReplySemantic = action?.semanticAction == NotificationCompat.Action.SEMANTIC_ACTION_REPLY,
            )
        }

        val replyAction = NotificationRules.pickReplyAction(facts)?.let { actions[it] }
        val inputs = replyAction?.remoteInputs?.toList().orEmpty()

        return ReplyRegistry.LiveReply(
            notificationKey = sbn.key,
            contentIntent = notification.contentIntent,
            replyIntent = replyAction?.actionIntent,
            remoteInputs = inputs,
            replyInputKey = inputs.firstOrNull { it.allowFreeFormInput }?.resultKey,
        )
    }

    companion object {
        /** Whether the user has granted notification access in system settings. */
        fun isEnabled(context: Context): Boolean {
            val component = ComponentName(context, UnicaListenerService::class.java)
            val enabled = Settings.Secure.getString(
                context.contentResolver,
                "enabled_notification_listeners",
            ).orEmpty()
            return enabled.split(':').any { ComponentName.unflattenFromString(it) == component }
        }
    }
}
