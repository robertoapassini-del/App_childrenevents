package it.passini.unica

import android.content.Intent
import android.os.Bundle
import android.provider.Settings
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import it.passini.unica.data.ActiveChat
import it.passini.unica.data.Conversation
import it.passini.unica.data.Message
import it.passini.unica.data.MessageStore
import it.passini.unica.notif.ReplyRegistry
import it.passini.unica.notif.UnicaListenerService
import it.passini.unica.ui.ChatScreen
import it.passini.unica.ui.InboxScreen
import it.passini.unica.ui.UnicaTheme

class MainActivity : ComponentActivity() {

    private var listenerEnabled by mutableStateOf(false)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent { UnicaTheme { UnicaRoot(listenerEnabled, ::openNotificationAccessSettings) } }
    }

    override fun onResume() {
        super.onResume()
        // The user grants notification access in system settings, so re-check on every return.
        listenerEnabled = UnicaListenerService.isEnabled(this)
    }

    override fun onPause() {
        super.onPause()
        ActiveChat.open(null)
    }

    private fun openNotificationAccessSettings() {
        runCatching {
            startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS))
        }.onFailure {
            Toast.makeText(this, "Impostazioni non disponibili", Toast.LENGTH_SHORT).show()
        }
    }
}

@Composable
private fun UnicaRoot(listenerEnabled: Boolean, onGrantAccess: () -> Unit) {
    val context = LocalContext.current
    val conversations by MessageStore.conversations.collectAsStateWithLifecycle()
    val repliable by ReplyRegistry.repliable.collectAsStateWithLifecycle()
    var openId by remember { mutableStateOf<String?>(null) }

    val open = conversations.firstOrNull { it.id == openId }

    // A conversation can disappear (cleared store); fall back to the inbox rather than a blank screen.
    LaunchedEffect(openId, open) {
        ActiveChat.open(open?.id)
        if (openId != null && open != null) MessageStore.markRead(open.id)
        if (openId != null && open == null) openId = null
    }

    if (open == null) {
        InboxScreen(
            conversations = conversations,
            listenerEnabled = listenerEnabled,
            onGrantAccess = onGrantAccess,
            onOpen = { openId = it.id },
        )
    } else {
        BackHandler { openId = null }
        ChatScreen(
            conversation = open,
            canReply = open.id in repliable,
            onBack = { openId = null },
            onSend = { text ->
                if (ReplyRegistry.sendReply(context, open.id, text)) {
                    echoOutgoing(open, text)
                } else {
                    Toast.makeText(context, "Invio non riuscito", Toast.LENGTH_SHORT).show()
                }
            },
            onOpenInSourceApp = {
                // The notification's own content intent lands on the exact thread; falling
                // back to the launcher intent at least opens the right app.
                val launcher = { context.packageManager.getLaunchIntentForPackage(open.packageName) }
                val opened = ReplyRegistry.openInSourceApp(context, open.id) ||
                    runCatching { launcher()?.also(context::startActivity) != null }.getOrDefault(false)
                if (!opened) {
                    Toast.makeText(context, "${open.source.label} non disponibile", Toast.LENGTH_SHORT).show()
                }
            },
        )
    }
}

/**
 * Our own sent message never comes back through a notification, so it is recorded
 * locally to keep the thread readable.
 */
private fun echoOutgoing(conversation: Conversation, text: String) {
    val now = System.currentTimeMillis()
    MessageStore.ingest(
        source = conversation.source,
        packageName = conversation.packageName,
        title = conversation.title,
        isGroup = conversation.isGroup,
        incoming = listOf(
            Message(
                id = MessageStore.messageId(now, "", text),
                sender = "",
                text = text,
                timestamp = now,
                outgoing = true,
            )
        ),
        isActiveChat = true,
    )
}
