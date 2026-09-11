package it.passini.unica

import android.app.Application
import it.passini.unica.data.MessageStore

class UnicaApp : Application() {
    override fun onCreate() {
        super.onCreate()
        MessageStore.init(this)
    }
}
