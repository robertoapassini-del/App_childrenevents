package it.passini.unica.ui

import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import it.passini.unica.data.Source

/** Each messenger keeps its own accent so a merged list is still readable at a glance. */
val Source.accent: Color
    get() = when (this) {
        Source.SIGNAL -> Color(0xFF3A76F0)
        Source.WHATSAPP -> Color(0xFF25D366)
    }

/**
 * The same two identities, darkened enough to carry white text. WhatsApp's own green is
 * far too light for that — it sits around 2:1 against white — so the badge and the unread
 * pill use these instead of [accent], which stays for tints and large marks.
 */
val Source.badgeFill: Color
    get() = when (this) {
        Source.SIGNAL -> Color(0xFF2E62D4)
        Source.WHATSAPP -> Color(0xFF0E8A44)
    }

private val LightScheme = lightColorScheme(primary = Color(0xFF3A76F0))
private val DarkScheme = darkColorScheme(primary = Color(0xFF9DB9F8))

@Composable
fun UnicaTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit,
) {
    val context = LocalContext.current
    val colors = when {
        Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ->
            if (darkTheme) dynamicDarkColorScheme(context) else dynamicLightColorScheme(context)
        darkTheme -> DarkScheme
        else -> LightScheme
    }
    MaterialTheme(colorScheme = colors, content = content)
}
