package it.passini.unica.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import it.passini.unica.data.Source

/** The flag: a small coloured pill naming the app a chat actually lives in. */
@Composable
fun SourceBadge(source: Source, modifier: Modifier = Modifier) {
    Text(
        text = source.label,
        color = Color.White,
        fontSize = 10.sp,
        fontWeight = FontWeight.Medium,
        modifier = modifier
            .clip(RoundedCornerShape(4.dp))
            .background(source.accent)
            .padding(horizontal = 5.dp, vertical = 1.dp),
    )
}

@Composable
fun Avatar(source: Source, title: String, size: Dp = 44.dp) {
    Box(
        contentAlignment = Alignment.Center,
        modifier = Modifier
            .size(size)
            .clip(CircleShape)
            .background(source.accent.copy(alpha = 0.18f)),
    ) {
        Text(
            text = title.firstOrNull()?.uppercase() ?: "?",
            color = source.accent,
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.SemiBold,
        )
    }
}
