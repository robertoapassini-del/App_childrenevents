package it.passini.unica.data

import kotlinx.serialization.Serializable

@Serializable
data class Message(
    val id: String,
    val sender: String,
    val text: String,
    val timestamp: Long,
    /** True for messages we sent from Unica; those are echoed locally, not read back. */
    val outgoing: Boolean = false,
)

@Serializable
data class Conversation(
    val id: String,
    val source: Source,
    val packageName: String,
    val title: String,
    val isGroup: Boolean,
    val messages: List<Message> = emptyList(),
    val unread: Int = 0,
) {
    val lastMessage: Message? get() = messages.lastOrNull()
    val lastTimestamp: Long get() = lastMessage?.timestamp ?: 0L

    companion object {
        fun idFor(packageName: String, title: String): String = "$packageName|$title"
    }
}
