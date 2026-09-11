package it.passini.unica.data

/**
 * The messenger a conversation came from. This is the "flag" that keeps the two
 * inboxes distinguishable once they sit in the same list.
 */
enum class Source(val packageNames: List<String>, val label: String) {
    SIGNAL(listOf("org.thoughtcrime.securesms"), "Signal"),
    WHATSAPP(listOf("com.whatsapp", "com.whatsapp.w4b"), "WhatsApp");

    companion object {
        private val byPackage: Map<String, Source> =
            entries.flatMap { source -> source.packageNames.map { it to source } }.toMap()

        /** Null for every package we do not mirror, which is how notifications get filtered. */
        fun fromPackage(packageName: String): Source? = byPackage[packageName]
    }
}
