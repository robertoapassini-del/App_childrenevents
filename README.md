# Il Sentiero — POC escursioni su carta Swisstopo (stile Terra di Mezzo)

Web app in un solo file (`index.html`, nessuna build) da aprire sul telefono:

- **Carta Swisstopo** (pixelkarte + sentieri escursionistici SwissTLM3D) via WMTS, con tinta "pergamena", vignettatura, rosa dei venti e cornice in stile mappa del Signore degli Anelli.
- **Posizione GPS** in tempo reale ("Tu sei qui"), con cerchio di precisione e quota.
- **Itinerario sui sentieri** dalla posizione attuale alla meta (cercata per nome o toccata sulla carta): BRouter profilo `hiking-mountain`, fallback Valhalla, fallback linea retta.
- **Profilo altimetrico** dal DTM di swisstopo (`api3.geo.admin.ch/rest/services/profile.json`).
- **Stime**: distanza e tempo che mancano, ora di arrivo, dislivello residuo in salita/discesa, velocità di ascensione nominale ed effettiva, **con e senza bambini** (fasce 3–5, 6–9, 10–13 anni), acqua persa per sudore per persona e per tutta la compagnia in base alla temperatura (letta da Open‑Meteo, modificabile).
- Ricalcolo automatico se ci si allontana più di 200 m dal sentiero.

## Come aprirla sul telefono

Il GPS nel browser funziona solo su **HTTPS**. Opzioni:

1. **GitHub Pages** (consigliato). Il workflow `.github/workflows/pages.yml` pubblica il repo ad ogni push.
   Su GitHub: *Settings → Pages → Source: GitHub Actions*. Sui piani gratuiti Pages richiede che il repo sia **pubblico**
   (*Settings → General → Danger zone → Change visibility*). L'app sarà su
   `https://robertoapassini-del.github.io/App_childrenevents/`.
2. **Qualsiasi hosting statico** (Netlify Drop, Vercel, Cloudflare Pages): basta caricare `index.html` e `manifest.webmanifest`.
3. **Test in locale** dal PC: `npx serve .` e apri `http://localhost:3000` (su localhost il GPS è permesso).
   Dal telefono via LAN il GPS non è disponibile: usa il pulsante ⚑ per fissare la partenza a mano.

Una volta aperta, "Aggiungi alla schermata Home" la installa come app (manifest PWA incluso).

## Metodo di stima

- Tempo: metodo SAC / DIN 33466. Adulti 4,2 km/h in piano, 300 m/h in salita, 500 m/h in discesa; il maggiore tra tempo orizzontale e verticale più metà del minore.
  Bambini: 3–5 anni 2 km/h · 150 m/h (+20 % soste), 6–9 anni 3 km/h · 200 m/h (+20 %), 10–13 anni 3,6 km/h · 260 m/h (+10 %). La compagnia va al passo del più lento.
- Acqua: ≈0,5 L/h per adulto (0,28–0,40 per i bambini) più 0,06 L ogni 100 m di salita (0,035–0,05 per i bambini), aumentata del 4,5 % per ogni grado sopra i 20 °C e ancora sopra i 28 °C.
- Dislivello: sommato con isteresi di 4 m per non contare il rumore del DTM.

Sono stime indicative per un POC, non consigli medici o alpinistici.

## Servizi esterni usati

| Servizio | Uso | Chiave |
|---|---|---|
| `wmts.geo.admin.ch` | tile carta e sentieri | no |
| `api3.geo.admin.ch` | ricerca località, profilo altimetrico | no |
| `brouter.de` | routing escursionistico | no |
| `valhalla1.openstreetmap.de` | routing di riserva | no |
| `api.open-meteo.com` | temperatura attuale | no |
| `cdnjs` / Google Fonts | Leaflet 1.9.4, font | no |
