package it.passini.unica.data

/**
 * The merge rules for the unified inbox, deliberately free of Android types so they can
 * be run, replayed and checked on a plain JVM — see `poc/`.
 *
 * The awkward part of reading messages out of notifications is that neither messenger
 * posts one notification per message. Both re-post the *same* notification carrying the
 * last handful of messages every time a chat moves, and Android replays whatever is
 * still on screen whenever the listener reconnects. Ingestion therefore has to be
 * idempotent: the same message seen five times must land once.
 */
object Inbox {

    const val MAX_MESSAGES_PER_CONVERSATION = 200
    const val MAX_CONVERSATIONS = 100

    /**
     * Identity of a message. Notifications carry no message id, so the content itself has
     * to supply one: the same (moment, sender, words) is the same message.
     */
    fun messageId(timestamp: Long, sender: String, text: String): String =
        "$timestamp|$sender|${text.hashCode()}"

    /** [conversations] is the same instance that went in when nothing was new. */
    data class Result(val conversations: List<Conversation>, val added: List<Message>)

    fun ingest(
        current: List<Conversation>,
        source: Source,
        packageName: String,
        title: String,
        isGroup: Boolean,
        incoming: List<Message>,
        isActiveChat: Boolean,
    ): Result {
        if (incoming.isEmpty()) return Result(current, emptyList())

        val id = Conversation.idFor(packageName, title)
        val existing = current.firstOrNull { it.id == id }
            ?: Conversation(id, source, packageName, title, isGroup)

        // HashSet.add returns false for anything already present, which dedupes the
        // incoming batch against history *and* against itself in one pass.
        val known = existing.messages.mapTo(HashSet()) { it.id }
        val fresh = incoming.filter { known.add(it.id) }
        if (fresh.isEmpty()) return Result(current, emptyList())

        val merged = (existing.messages + fresh)
            .sortedBy { it.timestamp }
            .takeLast(MAX_MESSAGES_PER_CONVERSATION)

        val updated = existing.copy(
            title = title,
            isGroup = isGroup,
            messages = merged,
            unread = if (isActiveChat) 0 else existing.unread + fresh.count { !it.outgoing },
        )

        val conversations = (current.filterNot { it.id == id } + updated)
            .sortedByDescending { it.lastTimestamp }
            .take(MAX_CONVERSATIONS)

        return Result(conversations, fresh)
    }

    /** Returns the same instance when there was nothing to clear. */
    fun markRead(current: List<Conversation>, conversationId: String): List<Conversation> {
        if (current.none { it.id == conversationId && it.unread > 0 }) return current
        return current.map { if (it.id == conversationId) it.copy(unread = 0) else it }
    }
}
