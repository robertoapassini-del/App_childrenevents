package it.passini.unica.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.ExitToApp
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import it.passini.unica.data.Conversation
import it.passini.unica.data.Message

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChatScreen(
    conversation: Conversation,
    canReply: Boolean,
    onBack: () -> Unit,
    onSend: (String) -> Unit,
    onOpenInSourceApp: () -> Unit,
) {
    Scaffold(
        topBar = {
            TopAppBar(
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Indietro")
                    }
                },
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Avatar(conversation.source, conversation.title, size = 32.dp)
                        Spacer(Modifier.width(12.dp))
                        Column {
                            Text(
                                conversation.title,
                                style = MaterialTheme.typography.titleMedium,
                                maxLines = 1,
                            )
                            SourceBadge(conversation.source)
                        }
                    }
                },
                actions = {
                    IconButton(onClick = onOpenInSourceApp) {
                        Icon(
                            Icons.AutoMirrored.Filled.ExitToApp,
                            contentDescription = "Apri in ${conversation.source.label}",
                        )
                    }
                },
            )
        },
    ) { padding ->
        Column(Modifier.padding(padding).fillMaxSize().imePadding()) {
            LazyColumn(
                reverseLayout = true,
                verticalArrangement = Arrangement.spacedBy(6.dp),
                contentPadding = PaddingValues(16.dp),
                modifier = Modifier.weight(1f),
            ) {
                items(conversation.messages.asReversed(), key = { it.id }) { message ->
                    MessageBubble(message, conversation.isGroup)
                }
            }

            HorizontalDivider()
            if (canReply) {
                ReplyBar(onSend)
            } else {
                NoReplyBar(conversation, onOpenInSourceApp)
            }
        }
    }
}

@Composable
private fun MessageBubble(message: Message, isGroup: Boolean) {
    val alignment = if (message.outgoing) Alignment.CenterEnd else Alignment.CenterStart
    val container = if (message.outgoing) {
        MaterialTheme.colorScheme.primaryContainer
    } else {
        MaterialTheme.colorScheme.surfaceVariant
    }

    Box(Modifier.fillMaxWidth(), contentAlignment = alignment) {
        Column(
            modifier = Modifier
                .widthIn(max = 300.dp)
                .clip(RoundedCornerShape(14.dp))
                .background(container)
                .padding(horizontal = 12.dp, vertical = 8.dp),
        ) {
            if (isGroup && !message.outgoing && message.sender.isNotEmpty()) {
                Text(
                    text = message.sender,
                    style = MaterialTheme.typography.labelMedium,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.primary,
                )
            }
            Text(message.text, style = MaterialTheme.typography.bodyMedium)
            Text(
                text = formatBubbleTime(message.timestamp),
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.align(Alignment.End),
            )
        }
    }
}

@Composable
private fun ReplyBar(onSend: (String) -> Unit) {
    var draft by remember { mutableStateOf("") }

    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier
            .fillMaxWidth()
            .navigationBarsPadding()
            .padding(horizontal = 12.dp, vertical = 8.dp),
    ) {
        OutlinedTextField(
            value = draft,
            onValueChange = { draft = it },
            placeholder = { Text("Messaggio") },
            maxLines = 5,
            shape = RoundedCornerShape(22.dp),
            modifier = Modifier.weight(1f),
        )
        IconButton(
            onClick = {
                val text = draft.trim()
                if (text.isNotEmpty()) {
                    onSend(text)
                    draft = ""
                }
            },
            enabled = draft.isNotBlank(),
        ) {
            Icon(Icons.AutoMirrored.Filled.Send, contentDescription = "Invia")
        }
    }
}

/**
 * The reply action lives inside the source app's notification. Once that notification is
 * gone — dismissed, or already answered elsewhere — there is nothing left to fire, and
 * the honest thing is to say so rather than to silently drop the message.
 */
@Composable
private fun NoReplyBar(conversation: Conversation, onOpenInSourceApp: () -> Unit) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier
            .fillMaxWidth()
            .navigationBarsPadding()
            .padding(horizontal = 16.dp, vertical = 10.dp),
    ) {
        Text(
            text = "La notifica di questa chat non è più attiva, quindi non si può rispondere da qui.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.weight(1f),
        )
        TextButton(onClick = onOpenInSourceApp) { Text("Apri ${conversation.source.label}") }
    }
}
