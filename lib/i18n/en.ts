import type { Dictionary } from "./fr";

/**
 * Written natively rather than translated. The French copy is full of small jokes
 * that would land as nonsense word-for-word, so this version makes its own — same
 * tone, same brevity, different gags.
 *
 * Typed against the French dictionary, so a key added there fails the build here
 * until it gets an English counterpart. The two can't silently drift apart.
 */
export const en: Dictionary = {
  appName: "Ouistiti",
  tagline: "Where to go with small people",

  nav: {
    map: "Map",
    add: "Add",
    language: "Français",
    backToMap: "Back to the map",
  },

  filters: {
    heading: "Filter",
    ages: "Age",
    infant: "Babies",
    infantHint: "0–12 months",
    toddler: "Toddlers",
    toddlerHint: "1–3 yrs",
    preschool: "Big ones",
    preschoolHint: "3–5 yrs",
    setting: "Where",
    indoor: "Inside",
    outdoor: "Outside",
    when: "When",
    today: "Today",
    weekend: "This weekend",
    openNow: "Open now",
    all: "Everything",
    reset: "Clear all",
    nearMe: "Near me",
  },

  list: {
    count: "{count} outing",
    countPlural: "{count} outings",
  },

  kind: {
    EVENT: "One-off",
    RECURRING: "Every week",
    PLACE: "Place",
  },

  verification: {
    OFFICIAL: "Official",
    OFFICIAL_HINT: "Posted by the venue or the city.",
    COMMUNITY_VERIFIED: "Parent-confirmed",
    COMMUNITY_VERIFIED_HINT: "At least two parents confirmed it on the spot.",
    UNVERIFIED: "Unconfirmed",
    UNVERIFIED_HINT: "Nobody has been past to check yet.",
  },

  status: {
    heading: "Are you there?",
    subheading: "One tap and everyone else knows.",
    stillHappening: "It's on",
    crowded: "It's packed",
    cancelled: "Cancelled",
    thanks: "Thanks — noted.",
    verifiedThanks: "Thanks! You're on site, so that one counts double.",
    tooSoon: "You just told us. Come back in half an hour.",
    failed: "That didn't go through. Try again in a moment?",
    locating: "Working out where you are…",
    noLocation:
      "Without your location we'll still keep this — it just counts for a little less.",
    lastSeen: "Seen {time} ago",
    reportCount: "{count} update in the last hour",
    reportCountPlural: "{count} updates in the last hour",
  },

  activity: {
    free: "Free",
    dropIn: "Just turn up",
    bookingRequired: "Booking needed",
    indoor: "Indoors",
    outdoor: "Outdoors",
    alwaysOpen: "Always open",
    openNow: "Open now",
    closedNow: "Closed",
    today: "Today",
    tomorrow: "Tomorrow",
    cancelled: "Cancelled",
    cancelledNote: "Parents on site told us this was cancelled.",
    directions: "Take me there",
    share: "Share",
    linkCopied: "Link copied!",
    source: "Found on",
    weatherWarning: "The weather isn't really having it.",
    nextSession: "Next time",
  },

  empty: {
    noResults: "Nothing on the horizon.",
    noResultsHint: "Drop a filter, or fall back on coffee.",
    noResultsNearby: "Nothing round here.",
    noResultsNearbyHint: "Try zooming the map out a bit.",
    loading: "Waking the marmosets…",
    mapLoading: "Unfolding the map…",
    error: "That got stuck.",
    errorHint: "We probably stood on a Duplo. Try again?",
  },

  add: {
    title: "Add an outing",
    subtitle: "Paste a link. We'll do the rest — mostly.",
    linkLabel: "Event link",
    linkPlaceholder: "https://www.facebook.com/events/…",
    linkHint: "Facebook, Eventbrite, a venue's own site — whatever you've got.",
    parseLink: "Read the link",
    parsing: "Deciphering…",
    textLabel: "Or paste the event text",
    textPlaceholder:
      "Copy the text from Facebook and paste it here: title, date, place, ages…",
    parseText: "Read the text",
    manualEntry: "Fill it in myself",
    facebookWall:
      "Facebook won't let us read that page without an account. Copy the event text and paste it below — that works well.",
    partialResult:
      "We got some of it. Check anything highlighted before you save.",
    noApiKey:
      "Automatic reading is off (no API key). You can fill everything in by hand just below.",
    checkThis: "Worth checking",
    preview: "Have a look before you post",
    save: "Post it",
    saving: "Posting…",
    saved: "It's live. Thank you!",
    kindQuestion: "What is it?",
    kindEventHint: "One specific date",
    kindRecurringHint: "Every week",
    kindPlaceHint: "A place, all the time",
  },

  field: {
    title: "Title",
    description: "Description",
    venueName: "Venue",
    address: "Address",
    postalCode: "Postcode",
    city: "Town",
    startsAt: "Starts",
    endsAt: "Ends",
    ageRange: "Ages",
    ageMin: "From (months)",
    ageMax: "To (months)",
    price: "Price (CHF)",
    isFree: "Free",
    dropIn: "No booking",
    setting: "Indoors / outdoors",
    weeklyHours: "Opening hours",
    required: "This one's required.",
    invalidUrl: "That link doesn't look right.",
  },

  weather: {
    GOOD: "Good for outside",
    MARGINAL: "Outside, but wrap them up",
    POOR: "Plan B weather",
  },

  weekday: {
    mon: "Monday",
    tue: "Tuesday",
    wed: "Wednesday",
    thu: "Thursday",
    fri: "Friday",
    sat: "Saturday",
    sun: "Sunday",
  },

  time: {
    justNow: "just now",
    minutes: "{count} min",
    hours: "{count} h",
    days: "{count} d",
  },

  a11y: {
    mapLabel: "Map of outings",
    closeDetail: "Close",
    openDetail: "See details for {title}",
    filterGroup: "Filters",
    ageGroupLegend: "Colour key by age",
  },
};
