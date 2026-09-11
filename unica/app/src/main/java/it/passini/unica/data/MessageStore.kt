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
 * The merged inbox: [Inbox]'s rules wrapped in the state and storage a running app needs.
 * Nothing leaves the device — Unica has no network permission at all — so "storage" is a
 * JSON file in the app's private directory.
 */
object MessageStore {

    private const val FILE_NAME = "inbox.json"
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
        if (_conversations.value.isEmpty()) {
            _conversations.value = stored.sortedByDescending { it.lastTimestamp }
        }
    }

    fun messageId(timestamp: Long, sender: String, text: String): String =
        Inbox.messageId(timestamp, sender, text)

    /** Returns true when at least one message was genuinely new. */
    fun ingest(
        source: Source,
        packageName: String,
        title: String,
        isGroup: Boolean,
        incoming: List<Message>,
        isActiveChat: Boolean,
    ): Boolean {
        var added = false
        _conversations.mutate { current ->
            val result = Inbox.ingest(current, source, packageName, title, isGroup, incoming, isActiveChat)
            added = result.added.isNotEmpty()
            result.conversations
        }
        return added
    }

    fun markRead(conversationId: String) {
        _conversations.mutate { Inbox.markRead(it, conversationId) }
    }

    fun clear() {
        saveJob?.cancel()
        _conversations.value = emptyList()
        scope.launch { file?.delete() }
    }

    /**
     * Mutates the flow and schedules a debounced write; every write goes through here.
     * [Inbox] hands back the list it was given when nothing changed, so an unchanged
     * ingest costs no recomposition and no disk write.
     */
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
