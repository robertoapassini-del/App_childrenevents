package it.passini.unica.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Delete
import androidx.compose.material.icons.outlined.Notifications
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import it.passini.unica.data.Conversation
import it.passini.unica.data.MessageStore
import it.passini.unica.data.Source

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun InboxScreen(
    conversations: List<Conversation>,
    listenerEnabled: Boolean,
    onGrantAccess: () -> Unit,
    onOpen: (Conversation) -> Unit,
) {
    var filter by remember { mutableStateOf<Source?>(null) }
    var confirmClear by remember { mutableStateOf(false) }
    val shown = conversations.filter { filter == null || it.source == filter }

    if (confirmClear) {
        ClearHistoryDialog(
            onDismiss = { confirmClear = false },
            onConfirm = { MessageStore.clear(); confirmClear = false },
        )
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Unica") },
                actions = {
                    if (conversations.isNotEmpty()) {
                        IconButton(onClick = { confirmClear = true }) {
                            Icon(Icons.Outlined.Delete, contentDescription = "Svuota la cronologia")
                        }
                    }
                },
            )
        },
    ) { padding ->
        Column(Modifier.padding(padding).fillMaxSize()) {

            if (!listenerEnabled) {
                PermissionCard(onGrantAccess)
            }

            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
            ) {
                SourceFilterChip("Tutte", filter == null, null) { filter = null }
                Source.entries.forEach { source ->
                    SourceFilterChip(
                        label = source.label,
                        selected = filter == source,
                        accent = source.accent,
                        onClick = { filter = if (filter == source) null else source },
                    )
                }
            }

            if (shown.isEmpty()) {
                EmptyState(listenerEnabled)
            } else {
                LazyColumn(Modifier.fillMaxSize()) {
                    items(shown, key = { it.id }) { conversation ->
                        ConversationRow(conversation) { onOpen(conversation) }
                        HorizontalDivider(Modifier.padding(start = 76.dp))
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SourceFilterChip(
    label: String,
    selected: Boolean,
    accent: Color?,
    onClick: () -> Unit,
) {
    FilterChip(
        selected = selected,
        onClick = onClick,
        label = { Text(label) },
        leadingIcon = if (accent != null) {
            { Box(Modifier.size(10.dp).clip(CircleShape).background(accent)) }
        } else {
            null
        },
    )
}

@Composable
private fun ConversationRow(conversation: Conversation, onClick: () -> Unit) {
    val last = conversation.lastMessage
    val preview = when {
        last == null -> ""
        last.outgoing -> "Tu: ${last.text}"
        conversation.isGroup && last.sender.isNotEmpty() -> "${last.sender}: ${last.text}"
        else -> last.text
    }

    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 12.dp),
    ) {
        Avatar(conversation.source, conversation.title)
        Spacer(Modifier.width(16.dp))

        Column(Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = conversation.title,
                    style = MaterialTheme.typography.titleSmall,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f, fill = false),
                )
                Spacer(Modifier.width(6.dp))
                SourceBadge(conversation.source)
            }
            Text(
                text = preview,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }

        Spacer(Modifier.width(12.dp))
        Column(horizontalAlignment = Alignment.End) {
            Text(
                text = formatListTime(conversation.lastTimestamp),
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            if (conversation.unread > 0) {
                Spacer(Modifier.size(4.dp))
                Text(
                    text = conversation.unread.toString(),
                    color = Color.White,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier
                        .clip(CircleShape)
                        .background(conversation.source.accent)
                        .padding(horizontal = 6.dp, vertical = 1.dp),
                )
            }
        }
    }
}

@Composable
private fun PermissionCard(onGrantAccess: () -> Unit) {
    Card(
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.errorContainer),
        modifier = Modifier.fillMaxWidth().padding(16.dp),
    ) {
        Column(Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Outlined.Notifications, contentDescription = null)
                Spacer(Modifier.width(8.dp))
                Text("Accesso alle notifiche disattivato", style = MaterialTheme.typography.titleSmall)
            }
            Spacer(Modifier.size(8.dp))
            Text(
                "Unica legge i messaggi dalle notifiche di Signal e WhatsApp. " +
                    "Senza questo permesso non può mostrare nulla.",
                style = MaterialTheme.typography.bodyMedium,
            )
            Spacer(Modifier.size(12.dp))
            FilledTonalButton(onClick = onGrantAccess) { Text("Apri le impostazioni") }
        }
    }
}

@Composable
private fun EmptyState(listenerEnabled: Boolean) {
    Box(Modifier.fillMaxSize().padding(32.dp), contentAlignment = Alignment.Center) {
        Text(
            text = if (listenerEnabled) {
                "Nessun messaggio ancora.\nLe chat compaiono qui appena arriva una notifica da Signal o WhatsApp."
            } else {
                "Concedi l'accesso alle notifiche per iniziare."
            },
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

/**
 * Unica keeps a copy of the message text it has seen. Deleting it here deletes it for
 * good — the originals stay untouched inside Signal and WhatsApp.
 */
@Composable
private fun ClearHistoryDialog(onDismiss: () -> Unit, onConfirm: () -> Unit) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Svuotare la cronologia?") },
        text = {
            Text(
                "Cancella i messaggi salvati da Unica su questo telefono. " +
                    "Le chat in Signal e WhatsApp restano come sono."
            )
        },
        confirmButton = { TextButton(onClick = onConfirm) { Text("Svuota") } },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Annulla") } },
    )
}
