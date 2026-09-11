# Unica

Una sola casella per Signal e WhatsApp, su Android.

Le due chat restano riconoscibili — ogni conversazione porta la sua etichetta
colorata, blu per Signal e verde per WhatsApp, e si possono filtrare — ma stanno
nello stesso elenco. Si legge e si risponde da lì, senza aprire due app.

## Come funziona (e perché così)

Né Signal né WhatsApp hanno un'API per client di terze parti: non esiste un modo
autorizzato per fare login e leggere le chat. Le librerie che ci provano con
protocolli ricostruiti fanno bannare il numero e si rompono a ogni aggiornamento.

Quello che invece Android offre davvero è il `NotificationListenerService`. Le due
app pubblicano notifiche `MessagingStyle` complete di testo, mittente e azione di
risposta diretta. Unica legge quelle notifiche e, quando si risponde, fa scattare
la stessa azione di risposta che si userebbe tirando giù la tendina.

Quindi il messaggio parte davvero da Signal o da WhatsApp: Unica non tocca i loro
account, non si collega ai loro server, non ha nemmeno il permesso `INTERNET`.

## Cosa non può fare

Sono limiti del meccanismo, non cose da sistemare più avanti:

- **Niente storico.** Si vedono solo i messaggi arrivati da quando Unica è
  installata e attiva. Le chat precedenti restano nelle rispettive app.
- **Solo chi ha scritto per primo.** Si risponde a una conversazione, non si apre
  una conversazione nuova.
- **Serve la notifica.** Una chat silenziata al punto di non produrre notifiche
  non compare.
- **La risposta scade.** L'azione di risposta vive dentro la notifica: se questa
  viene scartata o già gestita altrove, non c'è più niente da attivare. In quel
  caso Unica lo dice e offre il pulsante per aprire l'app giusta, invece di far
  finta di aver inviato.
- **Solo testo.** Foto, audio, allegati e reazioni restano nelle app originali.
- **Solo Android.** iOS non dà a un'app nessun accesso alle notifiche delle altre,
  quindi lì non si può proprio fare.

## Privacy

Quello che Unica ha visto lo tiene in un file JSON nella memoria privata dell'app,
sul telefono. Non esce di lì: l'app non ha accesso alla rete e il backup è
disattivato. Il cestino in alto nell'elenco cancella tutto (le chat originali in
Signal e WhatsApp non vengono toccate).

## Provare senza un telefono

Due cose si possono guardare subito, senza Android SDK e senza installare niente.

**`poc/` — le regole, eseguite davvero.**

```
./gradlew -p poc run
```

Rigioca il traffico di una mattinata — chat normali, un gruppo, il rumore che le due app
pubblicano, e la riproposta completa che Android fa a ogni riconnessione del listener —
attraverso `data/Inbox.kt` e `notif/NotificationRules.kt`, cioè i file dell'app compilati
dal suo stesso albero dei sorgenti, non copie. Stampa la casella che ne esce e la verifica.
È un progetto Gradle separato apposta: gira su una JVM qualsiasi, senza Android.

Le due cose che conta dimostrare sono lì dentro: che i doppioni non entrano (nessuna delle
due app pubblica una notifica per messaggio — ri-pubblicano la stessa con dentro le ultime
righe) e che l'azione di risposta giusta viene riconosciuta fra le altre.

**`demo/index.html` — l'interfaccia, da toccare.**

Si apre in un browser, senza server. A sinistra le notifiche grezze da pubblicare una a
una, a destra il telefono che reagisce. Le regole sono le stesse, riscritte in JavaScript.
Le notifiche però sono scritte a mano: `NotificationListenerService` e `RemoteInput` lì
non esistono.

## Compilare

```
./gradlew assembleDebug
```

L'APK esce in `app/build/outputs/apk/debug/`. Serve l'Android SDK con la
piattaforma 35; `minSdk` è 26.

Dopo l'installazione va concesso l'accesso alle notifiche: l'app apre da sola
*Impostazioni → Notifiche → Accesso alle notifiche*, dove va attivata «Unica».
Senza quel permesso l'elenco resta vuoto.
