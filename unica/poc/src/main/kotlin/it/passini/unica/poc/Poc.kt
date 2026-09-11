package it.passini.unica.poc

import it.passini.unica.data.Conversation
import it.passini.unica.data.Inbox
import it.passini.unica.data.Source
import it.passini.unica.notif.NotificationRules
import java.time.Instant
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter

/**
 * Proof of concept for the one claim Unica rests on: that the stream of notifications the
 * two messengers actually post can be folded into a single, correct, de-duplicated inbox.
 *
 * It replays a morning's traffic — ordinary chats, a group, the junk both apps post, and
 * the full replay Android performs whenever the listener reconnects — through the app's
 * own `Inbox` and `NotificationRules`, then prints the inbox that comes out and checks it.
 *
 * Run with:  ./gradlew -p poc run
 */

private val morning = Instant.parse("2026-09-12T07:30:00Z").toEpochMilli()
private fun at(minutes: Long) = morning + minutes * 60_000
private val clock = DateTimeFormatter.ofPattern("HH:mm").withZone(ZoneOffset.UTC)
private fun hhmm(t: Long) = clock.format(Instant.ofEpochMilli(t))

private val mamma = directChat(
    "WhatsApp · Mamma", WHATSAPP, "Mamma",
    listOf(Line("Mamma", "Ciao! A che ora arrivate domenica?", at(1))),
)

/** The same chat a minute later: WhatsApp re-posts the old line together with the new one. */
private val mammaAgain = directChat(
    "WhatsApp · Mamma (ri-postata)", WHATSAPP, "Mamma",
    listOf(
        Line("Mamma", "Ciao! A che ora arrivate domenica?", at(1)),
        Line("Mamma", "Ho fatto la torta", at(3)),
    ),
)

private val giulia = directChat(
    "Signal · Giulia", SIGNAL, "Giulia",
    listOf(Line("Giulia", "Hai visto la circolare della scuola?", at(5))),
)

private val classe = groupChat(
    "WhatsApp · Classe 3ªB", WHATSAPP, "Classe 3ªB",
    listOf(
        Line("Elena", "Domani porto io i bicchieri", at(6)),
        Line("Marco", "Io i tovaglioli", at(7)),
        Line("Elena", "Manca qualcuno per la torta?", at(8)),
    ),
)

private val giuliaAgain = directChat(
    "Signal · Giulia (ri-postata)", SIGNAL, "Giulia",
    listOf(
        Line("Giulia", "Hai visto la circolare della scuola?", at(5)),
        Line("Giulia", "Ok allora ci sentiamo dopo", at(14)),
    ),
)

private val junk = listOf(
    noise("WhatsApp · servizio in corso", WHATSAPP, "Controllo nuovi messaggi…", isOngoing = true),
    noise("WhatsApp · riepilogo", WHATSAPP, "5 messaggi da 3 chat", isGroupSummary = true),
    noise("Signal · servizio", SIGNAL, "Signal è in esecuzione", category = "service"),
    noise("Telegram · un messaggio", "org.telegram.messenger", "Luca"),
)

fun main() {
    val listener = Listener()
    val checks = Checks()

    section("1. Arrivano le notifiche")
    listOf(mamma, mammaAgain, giulia, classe).forEach { posted ->
        val added = listener.onPosted(posted)
        val count = if (added.size == 1) "1 nuovo messaggio" else "${added.size} nuovi messaggi"
        println("   ${posted.label.padEnd(34)} → $count")
    }

    section("2. Il rumore che le due app pubblicano")
    junk.forEach { listener.onPosted(it) }
    listener.ignored.forEach { println("   scartata: $it") }
    checks.expect("il rumore non entra in casella", listener.conversations.size == 3)

    section("3. Android riconnette il listener e ripropone tutto")
    val before = listener.conversations
    val replayed = listener.onReconnect(listOf(mammaAgain, giulia, classe))
    println("   ripropone 3 notifiche già viste → ${replayed.size} nuovi messaggi (nessuno)")
    checks.expect("una riproposta non duplica nulla", replayed.isEmpty())
    checks.expect("e non tocca nemmeno la lista", listener.conversations === before)

    section("4. Si apre Mamma, si risponde, e intanto arriva altro")
    val mammaId = Conversation.idFor(WHATSAPP, "Mamma")
    listener.onChatOpened(mammaId)
    listener.onReplySent(mammaId, "Arriviamo verso le 11", at(12))
    listener.onPosted(giuliaAgain)
    println("   risposta inviata tramite l'azione della notifica di WhatsApp")

    section("5. La casella unica")
    renderInbox(listener)

    section("6. La chat aperta")
    renderChat(listener, mammaId)

    section("7. Verifiche")
    runChecks(listener, checks, mammaId)
    checks.report()
}

private fun runChecks(listener: Listener, checks: Checks, mammaId: String) {
    val mammaChat = listener.conversations.first { it.id == mammaId }
    val giuliaChat = listener.conversations.first { it.title == "Giulia" }
    val classeChat = listener.conversations.first { it.title == "Classe 3ªB" }

    checks.expect(
        "le due app convivono e restano distinguibili",
        listener.conversations.map { it.source }.toSet() == setOf(Source.SIGNAL, Source.WHATSAPP),
    )
    checks.expect(
        "la più recente sta in cima",
        listener.conversations.first().title == "Giulia",
    )
    checks.expect(
        "il messaggio ri-postato è entrato una volta sola",
        mammaChat.messages.count { it.text.startsWith("Ciao!") } == 1,
    )
    checks.expect(
        "la chat aperta non accumula da leggere",
        mammaChat.unread == 0,
    )
    checks.expect(
        "quella chiusa conta tutto quello che non è stato letto",
        giuliaChat.unread == giuliaChat.messages.count { !it.outgoing },
    )
    checks.expect(
        "la risposta inviata risulta in uscita",
        mammaChat.messages.last().outgoing && mammaChat.messages.last().text.startsWith("Arriviamo"),
    )
    checks.expect(
        "il gruppo è riconosciuto come gruppo",
        classeChat.isGroup && !mammaChat.isGroup && !giuliaChat.isGroup,
    )
    checks.expect(
        "e tiene i nomi dei singoli mittenti",
        classeChat.messages.map { it.sender }.toSet() == setOf("Elena", "Marco"),
    )
    checks.expect(
        "i messaggi di una chat restano in ordine di tempo",
        listener.conversations.all { c -> c.messages.map { it.timestamp } == c.messages.map { it.timestamp }.sorted() },
    )
    checks.expect(
        "segnare come letta una chat già letta non cambia nulla",
        Inbox.markRead(listener.conversations, mammaId) === listener.conversations,
    )
    checks.expect(
        "si può rispondere a tutte e tre",
        listener.repliable == listener.conversations.map { it.id }.toSet(),
    )

    // The reply action is what makes any of this two-way, so pin its selection down.
    val freeForm = NotificationRules.PostedAction(hasFreeFormInput = true, isReplySemantic = false)
    val realReply = NotificationRules.PostedAction(hasFreeFormInput = true, isReplySemantic = true)
    val plain = NotificationRules.PostedAction(hasFreeFormInput = false, isReplySemantic = false)
    checks.expect(
        "fra più campi di testo si sceglie quello marcato come risposta",
        NotificationRules.pickReplyAction(listOf(plain, freeForm, realReply)) == 2,
    )
    checks.expect(
        "senza campo di testo non si finge di poter rispondere",
        NotificationRules.pickReplyAction(listOf(plain, plain)) == null,
    )
}

private fun renderInbox(listener: Listener) {
    val inner = 56
    fun rule(left: String, right: String) = println("   $left${"─".repeat(inner + 2)}$right")
    fun row(text: String) = println("   │ ${pad(text, inner)} │")

    rule("┌", "┐")
    listener.conversations.forEachIndexed { index, c ->
        if (index > 0) rule("├", "┤")
        val last = c.lastMessage
        val preview = when {
            last == null -> ""
            last.outgoing -> "Tu: ${last.text}"
            c.isGroup -> "${last.sender}: ${last.text}"
            else -> last.text
        }
        val right = hhmm(c.lastTimestamp) + if (c.unread > 0) "  ●${c.unread}" else "    "
        row(pad("[${c.source.label}] ${c.title}", inner - right.length) + right)
        row("  $preview")
    }
    rule("└", "┘")
    println("   filtri:  [ Tutte ]  [ Signal ]  [ WhatsApp ]")
}

private fun renderChat(listener: Listener, conversationId: String) {
    val chat = listener.conversations.first { it.id == conversationId }
    println("   ${chat.title}  [${chat.source.label}]")
    chat.messages.forEach { m ->
        val who = if (m.outgoing) "tu" else m.sender
        val indent = if (m.outgoing) "                    " else ""
        println("   $indent${hhmm(m.timestamp)}  $who: ${m.text}")
    }
}

private fun pad(text: String, width: Int) =
    if (text.length <= width) text.padEnd(width) else text.take(width - 1) + "…"

private fun section(title: String) {
    println()
    println("── $title ${"─".repeat((66 - title.length).coerceAtLeast(3))}")
}

private class Checks {
    private var passed = 0
    private var failed = 0

    fun expect(what: String, condition: Boolean) {
        if (condition) {
            passed++
            println("   ok    $what")
        } else {
            failed++
            println("   FALLITA  $what")
        }
    }

    fun report() {
        println()
        println(if (failed == 0) "Tutte le $passed verifiche passate." else "$failed verifiche fallite su ${passed + failed}.")
        if (failed > 0) kotlin.system.exitProcess(1)
    }
}
