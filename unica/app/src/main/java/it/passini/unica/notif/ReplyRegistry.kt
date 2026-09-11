package it.passini.unica.notif

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Bundle
import androidx.core.app.RemoteInput
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * Replying to Signal or WhatsApp from outside means firing the PendingIntent that sits
 * behind the "Reply" action of their own notification. Those intents are live objects:
 * they cannot be serialised, and they die when the notification is dismissed. So this
 * registry is deliberately in-memory only, and the UI has to cope with a conversation
 * that is readable but not currently repliable.
 */
object ReplyRegistry {

    data class LiveReply(
        val notificationKey: String,
        val contentIntent: PendingIntent?,
        val replyIntent: PendingIntent?,
        val remoteInputs: List<RemoteInput>,
        val replyInputKey: String?,
    ) {
        val canReply: Boolean get() = replyIntent != null && replyInputKey != null
    }

    private val byConversation = HashMap<String, LiveReply>()
    private val byKey = HashMap<String, String>()

    private val _repliable = MutableStateFlow<Set<String>>(emptySet())

    /** Conversation ids that currently have a usable reply action. */
    val repliable: StateFlow<Set<String>> = _repliable.asStateFlow()

    @Synchronized
    fun remember(conversationId: String, live: LiveReply) {
        byConversation[conversationId] = live
        byKey[live.notificationKey] = conversationId
        publish()
    }

    /** Called when the source app removes its notification — the intents are gone with it. */
    @Synchronized
    fun forget(notificationKey: String) {
        val conversationId = byKey.remove(notificationKey) ?: return
        if (byConversation[conversationId]?.notificationKey == notificationKey) {
            byConversation.remove(conversationId)
        }
        publish()
    }

    @Synchronized
    fun peek(conversationId: String): LiveReply? = byConversation[conversationId]

    private fun publish() {
        _repliable.value = byConversation.filterValues { it.canReply }.keys.toSet()
    }

    /**
     * Fires the source app's own reply action with [text] filled in.
     * Returns false when there is no live notification to reply through.
     */
    fun sendReply(context: Context, conversationId: String, text: String): Boolean {
        val live = peek(conversationId) ?: return false
        val replyIntent = live.replyIntent ?: return false
        val inputKey = live.replyInputKey ?: return false

        val fillIn = Intent().addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        val results = Bundle().apply { putCharSequence(inputKey, text) }
        RemoteInput.addResultsToIntent(live.remoteInputs.toTypedArray(), fillIn, results)
        RemoteInput.setResultsSource(fillIn, RemoteInput.SOURCE_FREE_FORM_INPUT)

        return runCatching { replyIntent.send(context, 0, fillIn) }.isSuccess
    }

    /** Opens the thread in Signal / WhatsApp itself, for anything Unica cannot do. */
    fun openInSourceApp(context: Context, conversationId: String): Boolean {
        val contentIntent = peek(conversationId)?.contentIntent ?: return false
        return runCatching { contentIntent.send() }.isSuccess
    }
}
