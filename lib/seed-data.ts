import type { PrismaClient } from "./generated/prisma/client";
import { startOfZonedDay, zonedParts, zonedTimeToUtc } from "./schedule";
import type { WeeklyHours } from "./enums";

/**
 * Seed data: real Lausanne venues, so the first run looks like the product
 * rather than like a fixture. Coordinates are hand-entered to roughly building
 * level and should be treated as approximate — nothing here has been through a
 * geocoder.
 *
 * Dated events are positioned relative to the moment you seed, so there is
 * always something on today and something this weekend whenever you reset.
 *
 * Lives in lib/ rather than prisma/ because two callers need it: the CLI seed
 * script, and the guarded auto-seed that fills an empty deployed database.
 */

/** Local wall-clock time, N days from today, in Lausanne. */
function at(daysFromToday: number, time: string): Date {
  const day = new Date(
    startOfZonedDay(new Date()).getTime() + daysFromToday * 86_400_000,
  );
  const p = zonedParts(day);
  const [hour, minute] = time.split(":").map(Number);
  return zonedTimeToUtc(p.year, p.month, p.day, hour ?? 0, minute ?? 0);
}

/** Days until the next Saturday (0 if today is Saturday). */
function daysUntilSaturday(): number {
  const order = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
  const index = order.indexOf(zonedParts(new Date()).weekday);
  return index >= 5 ? 0 : 5 - index;
}

const hours = (h: WeeklyHours) => JSON.stringify(h);
const RANGE = (start: string, end: string) => [{ start, end }];

const SAT = daysUntilSaturday();
const SUN = SAT + 1;

type SeedActivity = Parameters<
  PrismaClient["activity"]["create"]
>[0]["data"];

const activities: SeedActivity[] = [
  // --- Places: always there, no date, no booking ------------------------------
  {
    kind: "PLACE",
    title: "Place de jeux de Milan",
    titleEn: "Milan Park playground",
    description:
      "Grande place de jeux ombragée dans le parc de Milan : toboggans, bacs à sable et une pataugeoire en été.",
    descriptionEn:
      "Big shaded playground in Milan Park — slides, sandpits, and a paddling pool in summer.",
    venueName: "Parc de Milan",
    address: "Avenue de Milan 20",
    postalCode: "1007",
    lat: 46.5155,
    lng: 6.625,
    alwaysOpen: true,
    ageMinMonths: 6,
    ageMaxMonths: 60,
    isFree: true,
    setting: "OUTDOOR",
    verification: "OFFICIAL",
    sourceType: "SEED",
  },
  {
    kind: "PLACE",
    title: "Vallée de la Jeunesse",
    titleEn: "Vallée de la Jeunesse park",
    description:
      "Le parc de jeux le plus complet de Lausanne : ruisseau, structures en bois, immense pelouse.",
    descriptionEn:
      "Lausanne's most complete play park — a stream, wooden climbing frames, and a huge lawn.",
    venueName: "Vallée de la Jeunesse",
    address: "Vallée de la Jeunesse 1",
    postalCode: "1007",
    lat: 46.5177,
    lng: 6.6033,
    alwaysOpen: true,
    ageMinMonths: 0,
    ageMaxMonths: 60,
    isFree: true,
    setting: "OUTDOOR",
    verification: "OFFICIAL",
    sourceType: "SEED",
  },
  {
    kind: "PLACE",
    title: "Parc de Mon-Repos",
    titleEn: "Mon-Repos park",
    description:
      "Allées plates parfaites pour la poussette, une volière et un petit lac aux canards.",
    descriptionEn:
      "Flat pushchair-friendly paths, an aviary, and a small duck pond.",
    venueName: "Parc de Mon-Repos",
    address: "Avenue de Mon-Repos 2",
    postalCode: "1005",
    lat: 46.5203,
    lng: 6.6438,
    alwaysOpen: true,
    ageMinMonths: 0,
    ageMaxMonths: 60,
    isFree: true,
    setting: "OUTDOOR",
    verification: "OFFICIAL",
    sourceType: "SEED",
  },
  {
    kind: "PLACE",
    title: "Parc de l'Hermitage",
    titleEn: "Hermitage park",
    description:
      "Grandes prairies en pente et vue sur le lac. Prévoir le porte-bébé, ça grimpe.",
    descriptionEn:
      "Sloping meadows with a lake view. Bring the carrier — it's a climb.",
    venueName: "Fondation de l'Hermitage",
    address: "Route du Signal 2",
    postalCode: "1018",
    lat: 46.532,
    lng: 6.6415,
    alwaysOpen: true,
    ageMinMonths: 0,
    ageMaxMonths: 60,
    isFree: true,
    setting: "OUTDOOR",
    verification: "OFFICIAL",
    sourceType: "SEED",
  },
  {
    kind: "PLACE",
    title: "Lac de Sauvabelin",
    titleEn: "Sauvabelin lake",
    description:
      "Le tour du lac en poussette, des canards à nourrir et un petit parc animalier juste à côté.",
    descriptionEn:
      "A pushchair loop around the lake, ducks to feed, and a small animal park next door.",
    venueName: "Lac de Sauvabelin",
    address: "Route du Pavement",
    postalCode: "1018",
    lat: 46.5395,
    lng: 6.6395,
    alwaysOpen: true,
    ageMinMonths: 0,
    ageMaxMonths: 60,
    isFree: true,
    setting: "OUTDOOR",
    verification: "OFFICIAL",
    sourceType: "SEED",
  },
  {
    kind: "PLACE",
    title: "Parc Bourget, Vidy",
    titleEn: "Bourget park, Vidy",
    description:
      "Au bord du lac : places de jeux, grands arbres et de la place pour courir dans tous les sens.",
    descriptionEn:
      "Lakeside: playgrounds, big trees, and room to run in every direction at once.",
    venueName: "Parc Bourget",
    address: "Chemin du Bois-de-Vaux",
    postalCode: "1007",
    lat: 46.5165,
    lng: 6.5875,
    alwaysOpen: true,
    ageMinMonths: 6,
    ageMaxMonths: 60,
    isFree: true,
    setting: "OUTDOOR",
    verification: "OFFICIAL",
    sourceType: "SEED",
  },
  {
    kind: "PLACE",
    title: "Parc de Valency",
    titleEn: "Valency park",
    description: "Place de jeux de quartier, tranquille, avec des bancs à l'ombre.",
    descriptionEn: "Quiet neighbourhood playground with shaded benches.",
    venueName: "Parc de Valency",
    address: "Avenue de Morges 149",
    postalCode: "1004",
    lat: 46.5265,
    lng: 6.6115,
    alwaysOpen: true,
    ageMinMonths: 12,
    ageMaxMonths: 60,
    isFree: true,
    setting: "OUTDOOR",
    verification: "COMMUNITY_VERIFIED",
    sourceType: "SEED",
  },

  // --- Places with opening hours ----------------------------------------------
  {
    kind: "PLACE",
    title: "Espace des Inventions",
    titleEn: "Espace des Inventions",
    description:
      "Musée des sciences à hauteur d'enfant, tout en manipulations. Le coin des tout-petits vaut le détour.",
    descriptionEn:
      "A hands-on science museum built at child height. The under-fives corner is worth the trip.",
    venueName: "Espace des Inventions",
    address: "Vallée de la Jeunesse 1",
    postalCode: "1007",
    lat: 46.5178,
    lng: 6.6036,
    weeklyHours: hours({
      tue: RANGE("14:00", "18:00"),
      wed: RANGE("14:00", "18:00"),
      thu: RANGE("14:00", "18:00"),
      fri: RANGE("14:00", "18:00"),
      sat: RANGE("14:00", "18:00"),
      sun: RANGE("14:00", "18:00"),
    }),
    ageMinMonths: 24,
    ageMaxMonths: 60,
    priceCents: 800,
    setting: "INDOOR",
    verification: "OFFICIAL",
    sourceType: "SEED",
  },
  {
    kind: "PLACE",
    title: "Aquatis Aquarium-Vivarium",
    titleEn: "Aquatis Aquarium-Vivarium",
    description:
      "Le plus grand aquarium d'eau douce d'Europe. Sombre, chaud, et les poissons font le travail.",
    descriptionEn:
      "Europe's largest freshwater aquarium. Dark, warm, and the fish do all the work.",
    venueName: "Aquatis",
    address: "Route de Berne 144",
    postalCode: "1010",
    lat: 46.5395,
    lng: 6.6555,
    weeklyHours: hours({
      mon: RANGE("10:00", "18:00"),
      tue: RANGE("10:00", "18:00"),
      wed: RANGE("10:00", "18:00"),
      thu: RANGE("10:00", "18:00"),
      fri: RANGE("10:00", "18:00"),
      sat: RANGE("10:00", "19:00"),
      sun: RANGE("10:00", "19:00"),
    }),
    ageMinMonths: 18,
    ageMaxMonths: 60,
    priceCents: 1900,
    setting: "INDOOR",
    verification: "OFFICIAL",
    sourceType: "SEED",
  },
  {
    kind: "PLACE",
    title: "Piscine de Mon-Repos",
    titleEn: "Mon-Repos indoor pool",
    description:
      "Bassin couvert avec une pataugeoire chauffée. Le plan B officiel des jours de pluie.",
    descriptionEn:
      "Indoor pool with a heated paddling area. The official rainy-day plan B.",
    venueName: "Piscine de Mon-Repos",
    address: "Avenue du Tribunal-Fédéral 2",
    postalCode: "1005",
    lat: 46.5215,
    lng: 6.6455,
    weeklyHours: hours({
      mon: RANGE("07:00", "20:00"),
      tue: RANGE("07:00", "20:00"),
      wed: RANGE("07:00", "20:00"),
      thu: RANGE("07:00", "20:00"),
      fri: RANGE("07:00", "20:00"),
      sat: RANGE("09:00", "18:00"),
      sun: RANGE("09:00", "18:00"),
    }),
    ageMinMonths: 6,
    ageMaxMonths: 60,
    priceCents: 600,
    setting: "INDOOR",
    verification: "OFFICIAL",
    sourceType: "SEED",
  },
  {
    kind: "PLACE",
    title: "Jardin botanique de Montriond",
    titleEn: "Montriond botanical garden",
    description:
      "Petit, gratuit, plein de recoins. Les allées se font très bien en poussette.",
    descriptionEn:
      "Small, free, full of corners to explore. The paths take a pushchair easily.",
    venueName: "Jardin botanique",
    address: "Place de Milan",
    postalCode: "1007",
    lat: 46.5152,
    lng: 6.627,
    weeklyHours: hours({
      mon: RANGE("10:00", "18:30"),
      tue: RANGE("10:00", "18:30"),
      wed: RANGE("10:00", "18:30"),
      thu: RANGE("10:00", "18:30"),
      fri: RANGE("10:00", "18:30"),
      sat: RANGE("10:00", "18:30"),
      sun: RANGE("10:00", "18:30"),
    }),
    ageMinMonths: 0,
    ageMaxMonths: 60,
    isFree: true,
    setting: "OUTDOOR",
    verification: "OFFICIAL",
    sourceType: "SEED",
  },
  {
    kind: "PLACE",
    title: "Musée Olympique — parc et terrasses",
    titleEn: "Olympic Museum park",
    description:
      "Le parc est libre d'accès : sculptures, escaliers à monter cent fois, et le lac en bas.",
    descriptionEn:
      "The park is free to wander: sculptures, steps to climb a hundred times, and the lake below.",
    venueName: "Musée Olympique",
    address: "Quai d'Ouchy 1",
    postalCode: "1006",
    lat: 46.5085,
    lng: 6.6345,
    alwaysOpen: true,
    ageMinMonths: 12,
    ageMaxMonths: 60,
    isFree: true,
    setting: "OUTDOOR",
    verification: "OFFICIAL",
    sourceType: "SEED",
  },

  // --- Recurring: the weekly rhythm -------------------------------------------
  {
    kind: "RECURRING",
    title: "Ludothèque de Lausanne",
    titleEn: "Lausanne toy library",
    description:
      "On emprunte des jeux comme on emprunte des livres. On peut aussi juste jouer sur place.",
    descriptionEn:
      "Borrow games the way you borrow books — or just stay and play on the spot.",
    venueName: "Ludothèque de Lausanne",
    address: "Rue de Genève 52",
    postalCode: "1004",
    lat: 46.526,
    lng: 6.6218,
    weeklyHours: hours({
      tue: RANGE("15:00", "18:30"),
      wed: RANGE("14:00", "18:00"),
      thu: RANGE("15:00", "18:30"),
      sat: RANGE("09:30", "12:00"),
    }),
    ageMinMonths: 12,
    ageMaxMonths: 60,
    priceCents: 0,
    isFree: true,
    setting: "INDOOR",
    verification: "OFFICIAL",
    sourceType: "SEED",
  },
  {
    kind: "RECURRING",
    title: "Bébés nageurs",
    titleEn: "Baby swimming",
    description:
      "Bassin chauffé à 32°, en petit groupe, avec un parent dans l'eau. Sur inscription.",
    descriptionEn:
      "Water heated to 32°, small groups, one parent in the pool. Booking required.",
    venueName: "Piscine de Mon-Repos",
    address: "Avenue du Tribunal-Fédéral 2",
    postalCode: "1005",
    lat: 46.5215,
    lng: 6.6455,
    weeklyHours: hours({ sat: RANGE("09:00", "10:00") }),
    ageMinMonths: 4,
    ageMaxMonths: 36,
    priceCents: 2500,
    dropIn: false,
    setting: "INDOOR",
    verification: "OFFICIAL",
    sourceType: "SEED",
  },
  {
    kind: "RECURRING",
    title: "L'heure du conte",
    titleEn: "Storytime",
    description:
      "Vingt minutes d'histoires pour les tout-petits. Personne ne vous en voudra si ça finit en cavalcade.",
    descriptionEn:
      "Twenty minutes of stories for little ones. Nobody minds if it ends in a stampede.",
    venueName: "Bibliothèque municipale de Chauderon",
    address: "Place Chauderon 11",
    postalCode: "1003",
    lat: 46.5245,
    lng: 6.625,
    weeklyHours: hours({ wed: RANGE("10:00", "10:30") }),
    ageMinMonths: 18,
    ageMaxMonths: 48,
    isFree: true,
    setting: "INDOOR",
    verification: "OFFICIAL",
    sourceType: "SEED",
  },
  {
    kind: "RECURRING",
    title: "Café-poussettes de Chailly",
    titleEn: "Chailly pushchair café",
    description:
      "Un café, d'autres parents, et un tapis de jeu. Aucune animation, c'est tout l'intérêt.",
    descriptionEn:
      "Coffee, other parents, a play mat. No programme whatsoever — that's the point.",
    venueName: "Maison de quartier de Chailly",
    address: "Avenue de Béthusy 58",
    postalCode: "1012",
    lat: 46.5253,
    lng: 6.6512,
    weeklyHours: hours({ thu: RANGE("09:00", "11:30") }),
    ageMinMonths: 0,
    ageMaxMonths: 36,
    isFree: true,
    setting: "INDOOR",
    verification: "COMMUNITY_VERIFIED",
    sourceType: "SEED",
  },
  {
    kind: "RECURRING",
    title: "Gym parents-enfants",
    titleEn: "Parent & child gym",
    description:
      "Parcours en mousse, trampolines et tunnels. Ils dorment bien après, en principe.",
    descriptionEn:
      "Foam obstacle courses, trampolines, tunnels. They sleep well afterwards. In theory.",
    venueName: "Salle de gym de Prélaz",
    address: "Avenue de Morges 60",
    postalCode: "1004",
    lat: 46.5245,
    lng: 6.6135,
    weeklyHours: hours({ mon: RANGE("09:30", "10:30"), fri: RANGE("09:30", "10:30") }),
    ageMinMonths: 18,
    ageMaxMonths: 48,
    priceCents: 1200,
    dropIn: false,
    setting: "INDOOR",
    verification: "UNVERIFIED",
    sourceType: "FACEBOOK",
    sourceUrl: "https://www.facebook.com/events/1234567890123456/",
  },
  {
    kind: "RECURRING",
    title: "Marché de la Riponne",
    titleEn: "Riponne market",
    description:
      "Mercredi et samedi matin. Bruyant, coloré, et il y a toujours quelqu'un pour offrir un abricot.",
    descriptionEn:
      "Wednesday and Saturday mornings. Loud, colourful, and someone always hands over an apricot.",
    venueName: "Place de la Riponne",
    address: "Place de la Riponne",
    postalCode: "1005",
    lat: 46.523,
    lng: 6.632,
    weeklyHours: hours({ wed: RANGE("08:00", "13:00"), sat: RANGE("08:00", "13:00") }),
    ageMinMonths: 0,
    ageMaxMonths: 60,
    isFree: true,
    setting: "OUTDOOR",
    verification: "OFFICIAL",
    sourceType: "SEED",
  },
  {
    kind: "RECURRING",
    title: "Éveil musical",
    titleEn: "Music discovery",
    description:
      "Comptines, tambourins et un adulte qui chante faux. Quarante minutes, sans inscription.",
    descriptionEn:
      "Nursery rhymes, tambourines, and one adult singing flat. Forty minutes, no booking.",
    venueName: "Maison de quartier sous-gare",
    address: "Avenue Edouard-Dapples 50",
    postalCode: "1006",
    lat: 46.5128,
    lng: 6.6295,
    weeklyHours: hours({ tue: RANGE("10:00", "10:40") }),
    ageMinMonths: 6,
    ageMaxMonths: 36,
    priceCents: 500,
    setting: "INDOOR",
    verification: "COMMUNITY_VERIFIED",
    sourceType: "SEED",
  },

  // --- One-off events, positioned around today --------------------------------
  {
    kind: "EVENT",
    title: "Atelier peinture à doigts",
    titleEn: "Finger-painting workshop",
    description:
      "Tabliers fournis. Prévoyez quand même des habits qui ont déjà vécu.",
    descriptionEn:
      "Aprons provided. Bring clothes that have already had a full life anyway.",
    venueName: "Maison de quartier sous-gare",
    address: "Avenue Edouard-Dapples 50",
    postalCode: "1006",
    lat: 46.5128,
    lng: 6.6295,
    startsAt: at(0, "10:00"),
    endsAt: at(0, "11:30"),
    ageMinMonths: 18,
    ageMaxMonths: 48,
    priceCents: 500,
    setting: "INDOOR",
    verification: "COMMUNITY_VERIFIED",
    sourceType: "FACEBOOK",
    sourceUrl: "https://www.facebook.com/events/2233445566778899/",
  },
  {
    kind: "EVENT",
    title: "Contes au parc",
    titleEn: "Stories in the park",
    description: "Histoires sur l'herbe, en plein air. Annulé s'il pleut.",
    descriptionEn: "Stories on the grass, outdoors. Cancelled if it rains.",
    venueName: "Parc de Mon-Repos",
    address: "Avenue de Mon-Repos 2",
    postalCode: "1005",
    lat: 46.5205,
    lng: 6.644,
    startsAt: at(0, "15:00"),
    endsAt: at(0, "16:00"),
    ageMinMonths: 24,
    ageMaxMonths: 60,
    isFree: true,
    setting: "OUTDOOR",
    verification: "UNVERIFIED",
    sourceType: "FACEBOOK",
    sourceUrl: "https://www.facebook.com/events/3344556677889900/",
  },
  {
    kind: "EVENT",
    title: "Bourse aux jouets",
    titleEn: "Toy swap",
    description:
      "On vend, on achète, on repart avec plus de jouets qu'en arrivant. Comme toujours.",
    descriptionEn:
      "Sell, buy, and leave with more toys than you arrived with. As always.",
    venueName: "Casino de Montbenon",
    address: "Allée Ernest-Ansermet 3",
    postalCode: "1003",
    lat: 46.521,
    lng: 6.6255,
    startsAt: at(SAT, "09:00"),
    endsAt: at(SAT, "13:00"),
    ageMinMonths: 0,
    ageMaxMonths: 60,
    isFree: true,
    setting: "INDOOR",
    verification: "OFFICIAL",
    sourceType: "SEED",
  },
  {
    kind: "EVENT",
    title: "Spectacle de marionnettes",
    titleEn: "Puppet show",
    description:
      "Trente-cinq minutes, dans le noir, avec des loups gentils. Dès 3 ans.",
    descriptionEn:
      "Thirty-five minutes, in the dark, with friendly wolves. From age 3.",
    venueName: "Le Petit Théâtre",
    address: "Place de la Cathédrale 12",
    postalCode: "1005",
    lat: 46.523,
    lng: 6.6355,
    startsAt: at(SAT, "15:00"),
    endsAt: at(SAT, "15:35"),
    ageMinMonths: 36,
    ageMaxMonths: 60,
    priceCents: 1500,
    dropIn: false,
    setting: "INDOOR",
    verification: "OFFICIAL",
    sourceType: "SEED",
  },
  {
    kind: "EVENT",
    title: "Brunch en famille à Vidy",
    titleEn: "Family brunch at Vidy",
    description:
      "Grandes tablées au bord du lac, place de jeux à trois mètres. Prévoir la crème solaire.",
    descriptionEn:
      "Long tables by the lake with a playground three metres away. Bring sun cream.",
    venueName: "Parc Bourget",
    address: "Chemin du Bois-de-Vaux",
    postalCode: "1007",
    lat: 46.5168,
    lng: 6.588,
    startsAt: at(SUN, "10:30"),
    endsAt: at(SUN, "14:00"),
    ageMinMonths: 0,
    ageMaxMonths: 60,
    priceCents: 1200,
    setting: "OUTDOOR",
    verification: "UNVERIFIED",
    sourceType: "FACEBOOK",
    sourceUrl: "https://www.facebook.com/events/4455667788990011/",
  },
  {
    kind: "EVENT",
    title: "Massage bébé — séance découverte",
    titleEn: "Baby massage taster",
    description:
      "Pour les tout-petits qui ne se déplacent pas encore. Tapis et huile fournis.",
    descriptionEn:
      "For babies not yet on the move. Mats and oil provided.",
    venueName: "Espace Prévention",
    address: "Rue du Valentin 12",
    postalCode: "1004",
    lat: 46.5262,
    lng: 6.6338,
    startsAt: at(1, "14:00"),
    endsAt: at(1, "15:15"),
    ageMinMonths: 0,
    ageMaxMonths: 12,
    priceCents: 2000,
    dropIn: false,
    setting: "INDOOR",
    verification: "UNVERIFIED",
    sourceType: "MANUAL",
  },
  {
    kind: "EVENT",
    title: "Chasse aux trésors au Bois de Sauvabelin",
    titleEn: "Treasure hunt in Sauvabelin woods",
    description:
      "Parcours d'une heure en forêt, sur des chemins praticables en poussette tout-terrain.",
    descriptionEn:
      "An hour-long forest trail, on paths that work with an all-terrain pushchair.",
    venueName: "Bois de Sauvabelin",
    address: "Route du Pavement 55",
    postalCode: "1018",
    lat: 46.54,
    lng: 6.64,
    startsAt: at(SUN, "14:00"),
    endsAt: at(SUN, "16:00"),
    ageMinMonths: 30,
    ageMaxMonths: 60,
    isFree: true,
    setting: "OUTDOOR",
    verification: "COMMUNITY_VERIFIED",
    sourceType: "MEETUP",
    sourceUrl: "https://www.meetup.com/lausanne-families/events/301234567/",
  },
  {
    kind: "EVENT",
    title: "Atelier pâte à modeler",
    titleEn: "Play-dough workshop",
    description: "On fabrique la pâte, puis on la démolit. Deux ateliers en un.",
    descriptionEn: "Make the dough, then destroy it. Two workshops for the price of one.",
    venueName: "Bibliothèque municipale de Chauderon",
    address: "Place Chauderon 11",
    postalCode: "1003",
    lat: 46.5246,
    lng: 6.6252,
    startsAt: at(2, "14:30"),
    endsAt: at(2, "16:00"),
    ageMinMonths: 24,
    ageMaxMonths: 60,
    isFree: true,
    setting: "INDOOR",
    verification: "UNVERIFIED",
    sourceType: "WEB",
    sourceUrl: "https://www.lausanne.ch/bibliotheques",
  },
];


export interface SeedResult {
  counts: Record<string, number>;
}

/**
 * Populate a database with the demo content.
 *
 * `reset: true` clears everything first — that's the CLI's behaviour. The
 * auto-seed path passes false and only ever runs against an empty database, so
 * it can never wipe real submissions.
 */
export async function seedDatabase(
  prisma: PrismaClient,
  { reset = true, log = console.log }: { reset?: boolean; log?: (...args: unknown[]) => void } = {},
): Promise<SeedResult> {
  if (reset) {
    log("Clearing existing data…");
    await prisma.statusReport.deleteMany();
    await prisma.activity.deleteMany();
    await prisma.submitter.deleteMany();
    await prisma.geocodeCache.deleteMany();
    await prisma.weatherCache.deleteMany();
  }

  // Two regulars whose reports have already earned them some credibility, plus
  // a newcomer — enough for all three trust badges to be visible on first load.
  const [claire, samir] = await Promise.all([
    prisma.submitter.create({
      data: { token: "seed-claire", trustScore: 14, verifiedReports: 7 },
    }),
    prisma.submitter.create({
      data: { token: "seed-samir", trustScore: 6, verifiedReports: 3 },
    }),
    prisma.submitter.create({ data: { token: "seed-newcomer" } }),
  ]);

  log(`Creating ${activities.length} activities…`);
  const created = [];
  for (const data of activities) {
    created.push(await prisma.activity.create({ data }));
  }

  // A couple of live reports so the detail card has something to show.
  const painting = created.find((a) => a.title === "Atelier peinture à doigts");
  const cafe = created.find((a) => a.title.startsWith("Café-poussettes"));

  if (painting) {
    await prisma.statusReport.createMany({
      data: [
        {
          activityId: painting.id,
          kind: "STILL_HAPPENING",
          lat: painting.lat + 0.0002,
          lng: painting.lng,
          distanceMeters: 22,
          proximityVerified: true,
          submitterId: claire.id,
        },
        {
          activityId: painting.id,
          kind: "CROWDED",
          lat: painting.lat,
          lng: painting.lng + 0.0004,
          distanceMeters: 31,
          proximityVerified: true,
          submitterId: samir.id,
        },
      ],
    });
  }

  if (cafe) {
    await prisma.statusReport.create({
      data: {
        activityId: cafe.id,
        kind: "STILL_HAPPENING",
        lat: cafe.lat,
        lng: cafe.lng,
        distanceMeters: 8,
        proximityVerified: true,
        submitterId: claire.id,
      },
    });
  }

  const counts = created.reduce<Record<string, number>>((acc, a) => {
    acc[a.kind] = (acc[a.kind] ?? 0) + 1;
    return acc;
  }, {});
  log("Seeded:", counts);
  return { counts };
}
