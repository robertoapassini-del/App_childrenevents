package it.passini.unica.notif

/**
 * The decisions taken about a posted notification, expressed over plain values instead of
 * `android.app.Notification`, so they can be replayed on a JVM — see `poc/`.
 *
 * [UnicaListenerService] does the Android-side reading and then asks these rules what to
 * do. That split keeps the fiddly bits — what counts as a message, what a chat is called,
 * which action can actually send text — out of a class that only runs on a device.
 */
object NotificationRules {

    /** What the listener manages to read off one posted notification. */
    data class Posted(
        val isGroupSummary: Boolean,
        val isOngoing: Boolean,
        val category: String?,
        /** MessagingStyle's conversation title: set for groups, null for one-to-one chats. */
        val conversationTitle: String?,
        /** The notification's own title, which for a one-to-one chat is the contact name. */
        val contentTitle: String?,
        val isGroupConversation: Boolean,
    )

    /** One notification action, reduced to the two things that decide if it can reply. */
    data class PostedAction(
        val hasFreeFormInput: Boolean,
        val isReplySemantic: Boolean,
    )

    /**
     * Both apps post plenty that is not a message: "WhatsApp is running", backup progress,
     * and the group summary that only counts unread chats. None of that belongs in an inbox.
     */
    fun isMessage(posted: Posted): Boolean = when {
        posted.isGroupSummary -> false
        posted.isOngoing -> false
        posted.category == CATEGORY_SERVICE -> false
        posted.category == CATEGORY_PROGRESS -> false
        else -> true
    }

    /** Null when the notification names no chat at all, which makes it unusable. */
    fun conversationTitle(posted: Posted): String? =
        (posted.conversationTitle ?: posted.contentTitle)?.trim()?.takeIf { it.isNotEmpty() }

    /**
     * A conversation title is only set by MessagingStyle for group chats, so its presence
     * is a second signal alongside the explicit flag.
     */
    fun isGroup(posted: Posted): Boolean =
        posted.isGroupConversation || posted.conversationTitle != null

    /**
     * Picks the action to fire when replying: it must accept free text, and an action the
     * app itself tagged as "reply" wins over any other text input (Signal's notifications
     * also carry a free-form "mark as read" style action on some versions).
     * Returns null when the notification offers no way to reply.
     */
    fun pickReplyAction(actions: List<PostedAction>): Int? {
        var fallback: Int? = null
        actions.forEachIndexed { index, action ->
            if (!action.hasFreeFormInput) return@forEachIndexed
            if (action.isReplySemantic) return index
            if (fallback == null) fallback = index
        }
        return fallback
    }

    // Mirrors of android.app.Notification constants, repeated here so this file stays
    // compilable off-device. They are part of the platform's public API and do not move.
    const val CATEGORY_SERVICE = "service"
    const val CATEGORY_PROGRESS = "progress"
}
