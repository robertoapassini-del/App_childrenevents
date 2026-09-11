package it.passini.unica.data

/**
 * Which conversation the user is looking at right now. The notification listener runs in
 * the same process as the UI, so it can check this to avoid raising an unread badge for
 * a chat that is already on screen.
 */
object ActiveChat {
    @Volatile
    private var openId: String? = null

    fun open(conversationId: String?) {
        openId = conversationId
    }

    fun isOpen(conversationId: String): Boolean = openId == conversationId
}
