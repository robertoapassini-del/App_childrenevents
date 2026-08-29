/**
 * French is the source language: the jokes are written here first, and English is
 * written natively in en.ts rather than translated, because "desperate parent" puns
 * do not survive a literal crossing.
 *
 * The tone: a friend who has also been up since 05:40, not a municipal noticeboard.
 */
export const fr = {
  appName: "Ouistiti",
  tagline: "Où sortir avec les ouistitis ?",

  // --- Navigation ---
  nav: {
    map: "Carte",
    add: "Ajouter",
    language: "English",
    backToMap: "Retour à la carte",
  },

  // --- Filters ---
  filters: {
    heading: "Filtrer",
    ages: "Âge",
    infant: "Bébés",
    infantHint: "0–12 mois",
    toddler: "Petits",
    toddlerHint: "1–3 ans",
    preschool: "Grands",
    preschoolHint: "3–5 ans",
    setting: "Où",
    indoor: "Dedans",
    outdoor: "Dehors",
    when: "Quand",
    today: "Aujourd'hui",
    weekend: "Ce week-end",
    openNow: "Ouvert maintenant",
    all: "Tout",
    reset: "Tout effacer",
    nearMe: "Près de moi",
  },

  list: {
    count: "{count} sortie",
    countPlural: "{count} sorties",
  },

  // --- Kinds ---
  kind: {
    EVENT: "Événement",
    RECURRING: "Chaque semaine",
    PLACE: "Lieu",
  },

  // --- Trust badges ---
  verification: {
    OFFICIAL: "Officiel",
    OFFICIAL_HINT: "Publié par le lieu ou la Ville.",
    COMMUNITY_VERIFIED: "Confirmé par des parents",
    COMMUNITY_VERIFIED_HINT:
      "Au moins deux parents l'ont confirmé sur place.",
    UNVERIFIED: "À confirmer",
    UNVERIFIED_HINT: "Personne n'est encore passé vérifier.",
  },

  // --- Status reporting ---
  status: {
    heading: "Vous y êtes ?",
    subheading: "Un tap, et tout le monde est au courant.",
    stillHappening: "Ça a lieu",
    crowded: "C'est plein",
    cancelled: "Annulé",
    thanks: "Merci ! C'est noté.",
    verifiedThanks: "Merci ! Vous étiez sur place, ça compte double.",
    tooSoon: "Vous venez déjà de nous le dire. Repassez dans une demi-heure.",
    failed: "Raté. Réessayez dans un instant ?",
    locating: "On regarde où vous êtes…",
    noLocation:
      "Sans position, on garde quand même votre avis — il compte juste un peu moins.",
    lastSeen: "Vu il y a {time}",
    reportCount: "{count} retour cette heure",
    reportCountPlural: "{count} retours cette heure",
  },

  // --- Activity card & detail ---
  activity: {
    free: "Gratuit",
    dropIn: "Sans inscription",
    bookingRequired: "Sur inscription",
    indoor: "En intérieur",
    outdoor: "En plein air",
    alwaysOpen: "Toujours ouvert",
    openNow: "Ouvert maintenant",
    closedNow: "Fermé",
    today: "Aujourd'hui",
    tomorrow: "Demain",
    cancelled: "Annulé",
    cancelledNote:
      "Des parents sur place nous ont dit que c'était annulé.",
    directions: "Y aller",
    share: "Partager",
    linkCopied: "Lien copié !",
    source: "Vu sur",
    weatherWarning: "Le temps ne s'y prête pas trop.",
    nextSession: "Prochaine fois",
  },

  // --- Empty and loading states, where the app earns its personality ---
  empty: {
    noResults: "Rien à l'horizon.",
    noResultsHint: "Enlevez un filtre, ou repliez-vous sur un café.",
    noResultsNearby: "Rien dans le coin.",
    noResultsNearbyHint: "Essayez d'élargir la carte.",
    loading: "On réveille les ouistitis…",
    mapLoading: "On déplie la carte…",
    error: "Ça a coincé.",
    errorHint: "On a probablement marché sur un Duplo. Réessayez ?",
  },

  // --- Add / ingestion ---
  add: {
    title: "Ajouter une sortie",
    subtitle: "Collez un lien. On s'occupe du reste — ou presque.",
    linkLabel: "Lien de l'événement",
    linkPlaceholder: "https://www.facebook.com/events/…",
    linkHint:
      "Facebook, Eventbrite, le site d'un lieu… tout ce que vous avez sous la main.",
    parseLink: "Analyser le lien",
    parsing: "On déchiffre…",
    textLabel: "Ou collez le texte de l'événement",
    textPlaceholder:
      "Copiez le texte depuis Facebook et collez-le ici : titre, date, lieu, âges…",
    parseText: "Analyser le texte",
    manualEntry: "Saisir à la main",
    facebookWall:
      "Facebook ne nous laisse pas lire cette page sans compte. Copiez le texte de l'événement et collez-le ci-dessous — ça marche très bien.",
    partialResult:
      "On a trouvé une partie des infos. Vérifiez ce qui est surligné avant d'enregistrer.",
    noApiKey:
      "L'analyse automatique est désactivée (pas de clé API). Vous pouvez tout saisir à la main juste en dessous.",
    checkThis: "À vérifier",
    preview: "Vérifiez avant d'envoyer",
    save: "Publier",
    saving: "On publie…",
    saved: "C'est en ligne. Merci !",
    kindQuestion: "C'est quoi ?",
    kindEventHint: "Une date précise",
    kindRecurringHint: "Chaque semaine",
    kindPlaceHint: "Un lieu, tout le temps",
  },

  // --- Form fields ---
  field: {
    title: "Titre",
    description: "Description",
    venueName: "Lieu",
    address: "Adresse",
    postalCode: "NPA",
    city: "Ville",
    startsAt: "Début",
    endsAt: "Fin",
    ageRange: "Âges",
    ageMin: "De (mois)",
    ageMax: "À (mois)",
    price: "Prix (CHF)",
    isFree: "Gratuit",
    dropIn: "Sans inscription",
    setting: "Intérieur / extérieur",
    weeklyHours: "Horaires",
    required: "Ce champ est obligatoire.",
    invalidUrl: "Ce lien n'a pas l'air valide.",
  },

  // --- Weather ---
  weather: {
    GOOD: "Parfait pour dehors",
    MARGINAL: "Dehors, mais couvrez-les",
    POOR: "Plutôt un plan B",
  },

  // --- Days ---
  weekday: {
    mon: "Lundi",
    tue: "Mardi",
    wed: "Mercredi",
    thu: "Jeudi",
    fri: "Vendredi",
    sat: "Samedi",
    sun: "Dimanche",
  },

  // --- Relative time ---
  time: {
    justNow: "à l'instant",
    minutes: "{count} min",
    hours: "{count} h",
    days: "{count} j",
  },

  a11y: {
    mapLabel: "Carte des sorties",
    closeDetail: "Fermer",
    openDetail: "Voir le détail de {title}",
    filterGroup: "Filtres",
    ageGroupLegend: "Code couleur par âge",
  },
} as const;

/**
 * Widen the leaves to `string` while keeping the key structure intact. `as const`
 * above pins every French value to its own literal type, which is what we want for
 * autocomplete — but a Dictionary demanding the literal string "Carte" would make
 * an English translation a type error. This keeps the useful half of that: a key
 * missing from en.ts still fails the build.
 */
type WidenLeaves<T> = {
  [K in keyof T]: T[K] extends string ? string : WidenLeaves<T[K]>;
};

export type Dictionary = WidenLeaves<typeof fr>;
