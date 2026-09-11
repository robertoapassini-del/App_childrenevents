package it.passini.unica.ui

import android.text.format.DateUtils
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale

private val timeOfDay = SimpleDateFormat("HH:mm", Locale.getDefault())
private val dayAndMonth = SimpleDateFormat("d MMM", Locale.getDefault())

/** "14:32" today, "ieri" yesterday, "3 mar" before that. */
fun formatListTime(timestamp: Long): String = when {
    timestamp <= 0L -> ""
    DateUtils.isToday(timestamp) -> timeOfDay.format(Date(timestamp))
    isYesterday(timestamp) -> "ieri"
    else -> dayAndMonth.format(Date(timestamp))
}

fun formatBubbleTime(timestamp: Long): String = timeOfDay.format(Date(timestamp))

private fun isYesterday(timestamp: Long): Boolean {
    val yesterday = Calendar.getInstance().apply { add(Calendar.DAY_OF_YEAR, -1) }
    val then = Calendar.getInstance().apply { timeInMillis = timestamp }
    return yesterday.get(Calendar.YEAR) == then.get(Calendar.YEAR) &&
        yesterday.get(Calendar.DAY_OF_YEAR) == then.get(Calendar.DAY_OF_YEAR)
}
