package it.passini.unica.data

import android.content.Context
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.io.File

/**
 * The merged inbox, held in memory and mirrored to a JSON file in the app's private
 * storage. Nothing leaves the device: Unica has no network permission at all.
 *
 * Notifications are re-posted by both messengers every time a chat gets a new message,
 * and they carry the last few messages each time, so ingestion is idempotent: messages
 * are keyed by (timestamp, sender, text) and merged rather than appended.
 */
object MessageStore {

    private const val FILE_NAME = "inbox.json"
    private const val MAX_MESSAGES_PER_CONVERSATION = 200
    private const val MAX_CONVERSATIONS = 100
    private const val SAVE_DEBOUNCE_MS = 750L

    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val lock = Any()

    private var file: File? = null
    private var saveJob: Job? = null

    private val _conversations = MutableStateFlow<List<Conversation>>(emptyList())
    val conversations: StateFlow<List<Conversation>> = _conversations.asStateFlow()

    /** Safe to call more than once; the first call wins. */
    fun init(context: Context) {
        synchronized(lock) {
            if (file != null) return
            file = File(context.applicationContext.filesDir, FILE_NAME)
        }
        scope.launch { restore() }
    }

    private fun restore() {
        val stored = file?.takeIf { it.exists() }?.runCatching {
            json.decodeFromString<List<Conversation>>(readText())
        }?.getOrNull() ?: return
        // Anything ingested while the file was being read wins over the stored copy.
        if (_conversations.value.isEmpty()) _conversations.value = stored.sortedByDescending { it.lastTimestamp }
    }

    fun messageId(timestamp: Long, sender: String, text: String): String =
        "$timestamp|$sender|${text.hashCode()}"

    /**
     * Merges one notification's worth of messages into its conversation.
     * Returns true when at least one message was genuinely new.
     */
    fun ingest(
        source: Source,
        packageName: String,
        title: String,
        isGroup: Boolean,
        incoming: List<Message>,
        isActiveChat: Boolean,
    ): Boolean {
        if (incoming.isEmpty()) return false
        val id = Conversation.idFor(packageName, title)
        var added = false

        _conversations.mutate { current ->
            val existing = current.firstOrNull { it.id == id }
                ?: Conversation(id, source, packageName, title, isGroup)

            val known = existing.messages.mapTo(HashSet()) { it.id }
            val fresh = incoming.filter { known.add(it.id) }
            added = fresh.isNotEmpty()
            if (!added) return@mutate current

            val merged = (existing.messages + fresh)
                .sortedBy { it.timestamp }
                .takeLast(MAX_MESSAGES_PER_CONVERSATION)

            val updated = existing.copy(
                title = title,
                isGroup = isGroup,
                messages = merged,
                unread = if (isActiveChat) 0 else existing.unread + fresh.count { !it.outgoing },
            )
            (current.filterNot { it.id == id } + updated)
                .sortedByDescending { it.lastTimestamp }
                .take(MAX_CONVERSATIONS)
        }
        return added
    }

    fun markRead(conversationId: String) {
        _conversations.mutate { current ->
            if (current.none { it.id == conversationId && it.unread > 0 }) return@mutate current
            current.map { if (it.id == conversationId) it.copy(unread = 0) else it }
        }
    }

    fun clear() {
        saveJob?.cancel()
        _conversations.value = emptyList()
        scope.launch { file?.delete() }
    }

    /** Mutates the flow and schedules a debounced write; every write goes through here. */
    private fun MutableStateFlow<List<Conversation>>.mutate(block: (List<Conversation>) -> List<Conversation>) {
        synchronized(lock) {
            val next = block(value)
            if (next === value) return
            value = next
        }
        scheduleSave()
    }

    private fun scheduleSave() {
        saveJob?.cancel()
        saveJob = scope.launch {
            delay(SAVE_DEBOUNCE_MS)
            val target = file ?: return@launch
            runCatching { target.writeText(json.encodeToString(_conversations.value)) }
        }
    }
}
