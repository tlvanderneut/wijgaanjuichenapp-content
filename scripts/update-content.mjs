import { readFile, writeFile } from "node:fs/promises";

const API_URL = "https://api.football-data.org/v4/competitions/WC/matches?season=2026";
const token = process.env.FOOTBALL_DATA_API_KEY;
const fixture = process.env.FOOTBALL_DATA_FIXTURE;
const outputPath = process.env.CONTENT_OUTPUT || "data/wk-2026.json";
if (!token && !fixture) throw new Error("FOOTBALL_DATA_API_KEY ontbreekt.");

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));
const routeTemplates = await readJson("data/routes.json");
const editorial = await readJson("data/editorial.json");
const manual = await readJson("data/manual-overrides.json");

let payload;
if (fixture) {
  payload = await readJson(fixture);
} else {
  const response = await fetch(API_URL, { headers: { "X-Auth-Token": token } });
  if (!response.ok) throw new Error(`football-data.org gaf HTTP ${response.status}.`);
  payload = await response.json();
}

const names = {
  NED: "Nederland", JPN: "Japan", SWE: "Zweden", TUN: "Tunesië",
  ARG: "Argentinië", AUS: "Australië", AUT: "Oostenrijk", BEL: "België",
  BIH: "Bosnië en Herzegovina", BRA: "Brazilië", CAN: "Canada", CHE: "Zwitserland",
  CIV: "Ivoorkust", COL: "Colombia", CPV: "Kaapverdië", CRO: "Kroatië",
  CZE: "Tsjechië", COD: "DR Congo", ECU: "Ecuador", EGY: "Egypte",
  ENG: "Engeland", ESP: "Spanje", FRA: "Frankrijk", GER: "Duitsland",
  GHA: "Ghana", HAI: "Haïti", IRN: "Iran", IRQ: "Irak", JOR: "Jordanië",
  KOR: "Zuid-Korea", MAR: "Marokko", MEX: "Mexico", NOR: "Noorwegen",
  NZL: "Nieuw-Zeeland", PAN: "Panama", PAR: "Paraguay", POL: "Polen",
  POR: "Portugal", QAT: "Qatar", KSA: "Saoedi-Arabië", SCO: "Schotland",
  SEN: "Senegal", SRB: "Servië", TUR: "Turkije", UKR: "Oekraïne",
  URU: "Uruguay", USA: "Verenigde Staten", UZB: "Oezbekistan", RSA: "Zuid-Afrika"
};

const flags = {
  NED: "nl", JPN: "jp", SWE: "se", TUN: "tn", ARG: "ar", AUS: "au",
  AUT: "at", BEL: "be", BIH: "ba", BRA: "br", CAN: "ca", CHE: "ch",
  CIV: "ci", COL: "co", CPV: "cv", CRO: "hr", CZE: "cz", COD: "cd",
  ECU: "ec", EGY: "eg", ENG: "gb-eng", ESP: "es", FRA: "fr", GER: "de",
  GHA: "gh", HAI: "ht", IRN: "ir", IRQ: "iq", JOR: "jo", KOR: "kr",
  MAR: "ma", MEX: "mx", NOR: "no", NZL: "nz", PAN: "pa", PAR: "py",
  POR: "pt", QAT: "qa", KSA: "sa", SCO: "gb-sct", SEN: "sn", TUR: "tr",
  URU: "uy", USA: "us", UZB: "uz", RSA: "za"
};

const stageLabels = {
  GROUP_STAGE: "Groepswedstrijd",
  LAST_32: "Laatste 32",
  ROUND_OF_32: "Laatste 32",
  LAST_16: "Achtste finale",
  ROUND_OF_16: "Achtste finale",
  QUARTER_FINALS: "Kwartfinale",
  SEMI_FINALS: "Halve finale",
  THIRD_PLACE: "Troostfinale",
  FINAL: "Finale"
};

const stageOrder = [
  "LAST_32", "ROUND_OF_32", "LAST_16", "ROUND_OF_16",
  "QUARTER_FINALS", "SEMI_FINALS", "FINAL", "THIRD_PLACE"
];

const venuePlaces = {
  "AT&T Stadium": ["Dallas", "VS"],
  "NRG Stadium": ["Houston", "VS"],
  "Arrowhead Stadium": ["Kansas City", "VS"],
  "Estadio BBVA": ["Monterrey", "Mexico"],
  "Gillette Stadium": ["Foxborough", "VS"],
  "Hard Rock Stadium": ["Miami", "VS"],
  "MetLife Stadium": ["New York / New Jersey", "VS"],
  "Mercedes-Benz Stadium": ["Atlanta", "VS"]
};

const formatDate = (value) => new Intl.DateTimeFormat("nl-NL", {
  weekday: "short", day: "numeric", month: "long", timeZone: "Europe/Amsterdam"
}).format(new Date(value));
const formatTime = (value) => new Intl.DateTimeFormat("nl-NL", {
  hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Europe/Amsterdam"
}).format(new Date(value));

const teamCode = (team) => team?.tla || "";
const teamName = (team) => names[teamCode(team)] || team?.shortName || team?.name || "Tegenstander volgt";
const teamFlag = (team) => flags[teamCode(team)] || "";
const isDutchMatch = (match) => [teamCode(match.homeTeam), teamCode(match.awayTeam)].includes("NED");
const isFinished = (match) => match.status === "FINISHED";
const isScheduled = (match) => ["SCHEDULED", "TIMED", "IN_PLAY", "PAUSED"].includes(match.status);

function didNetherlandsWin(match) {
  if (!isFinished(match)) return null;
  const dutchAtHome = teamCode(match.homeTeam) === "NED";
  if (match.score?.winner === "HOME_TEAM") return dutchAtHome;
  if (match.score?.winner === "AWAY_TEAM") return !dutchAtHome;
  return null;
}

function genericProfile(team) {
  const code = teamCode(team);
  const name = teamName(team);
  return editorial.profiles[code] || {
    name,
    nickname: code ? "Tegenstander van Oranje" : "Wordt nog bepaald",
    flag: teamFlag(team) || "unknown",
    intro: code
      ? `${name} is de volgende tegenstander van Nederland. Dit profiel kan redactioneel worden aangevuld zodra de wedstrijd is bevestigd.`
      : "De tegenstander van Nederland is nog niet bekend. De app werkt dit automatisch bij zodra de koppeling is bevestigd.",
    qualification: {
      title: "Op weg naar het WK",
      stats: [],
      summary: "Wedstrijdgegevens worden automatisch bijgewerkt."
    },
    players: [],
    culture: "",
    history: "",
    sourceLabel: "Bron: football-data.org",
    profileStatus: "fallback"
  };
}

function toPublishedMatch(match, index) {
  const opponent = teamCode(match.homeTeam) === "NED" ? match.awayTeam : match.homeTeam;
  const [city, country] = venuePlaces[match.venue] || [match.venue || "Nog te bepalen", ""];
  const knockout = match.stage !== "GROUP_STAGE";
  return {
    kickoff: match.utcDate,
    endsAt: new Date(new Date(match.utcDate).getTime() + (knockout ? 4 : 3) * 3600000).toISOString(),
    home: teamName(match.homeTeam),
    away: teamName(match.awayTeam),
    homeFlag: teamFlag(match.homeTeam) || "unknown",
    awayFlag: teamFlag(match.awayTeam) || "unknown",
    city,
    country,
    stadium: match.venue || "Nog te bepalen",
    label: match.stage === "GROUP_STAGE"
      ? `Groepswedstrijd ${match.matchday || index + 1}`
      : stageLabels[match.stage] || "WK-wedstrijd",
    matchStatus: isFinished(match) ? "completed" : isScheduled(match) ? "confirmed" : "pending",
    result: match.score?.fullTime?.home !== null && match.score?.fullTime?.home !== undefined
      ? `${match.score.fullTime.home}-${match.score.fullTime.away}`
      : "",
    opponent: genericProfile(opponent)
  };
}

function selectRouteTemplate(firstKnockoutMatch) {
  if (!firstKnockoutMatch) return routeTemplates[0];
  const kickoff = new Date(firstKnockoutMatch.utcDate).getTime();
  const candidates = routeTemplates.map((route) => {
    const first = route.games[0];
    const expected = Date.parse(`2026-${first.date.includes("30") ? "06-30T03:00:00Z" : "06-29T17:00:00Z"}`);
    return { route, difference: Math.abs(kickoff - expected) };
  });
  return candidates.sort((a, b) => a.difference - b.difference)[0].route;
}

function buildKnockoutRoute(knockoutMatches) {
  const sorted = [...knockoutMatches].sort((a, b) => (
    stageOrder.indexOf(a.stage) - stageOrder.indexOf(b.stage)
    || new Date(a.utcDate) - new Date(b.utcDate)
  ));
  const template = selectRouteTemplate(sorted[0]);
  const matchByRound = new Map(sorted.map((match) => [stageLabels[match.stage], match]));
  const semifinal = matchByRound.get("Halve finale");
  const semifinalWon = semifinal ? didNetherlandsWin(semifinal) : null;
  const eliminatedMatch = sorted.find((match) => didNetherlandsWin(match) === false && match.stage !== "SEMI_FINALS");

  const outcomeSlots = [
    { round: "Finale", date: "zo 19 juli", time: "21:00", place: "New York / New Jersey", opponent: "Bij winst in de halve finale" },
    { round: "Troostfinale", date: "za 18 juli", time: "23:00", place: "Miami", opponent: "Bij verlies in de halve finale" }
  ];

  const mapSlot = (slot) => {
    const match = matchByRound.get(slot.round);
    if (match) {
      const opponent = teamCode(match.homeTeam) === "NED" ? match.awayTeam : match.homeTeam;
      const [place] = venuePlaces[match.venue] || [match.venue || slot.place];
      const won = didNetherlandsWin(match);
      return {
        round: slot.round,
        date: formatDate(match.utcDate),
        time: formatTime(match.utcDate),
        place,
        opponent: teamName(opponent),
        status: isFinished(match) ? (won ? "completed" : "eliminated") : "confirmed",
        result: match.score?.fullTime?.home !== null && match.score?.fullTime?.home !== undefined
          ? `${match.score.fullTime.home}-${match.score.fullTime.away}`
          : ""
      };
    }

    if (eliminatedMatch) return { ...slot, status: "unavailable", opponent: "Niet meer van toepassing" };
    if (slot.round === "Finale") {
      return { ...slot, status: semifinalWon === true ? "pending" : semifinalWon === false ? "unavailable" : "alternate" };
    }
    if (slot.round === "Troostfinale") {
      return { ...slot, status: semifinalWon === false ? "pending" : semifinalWon === true ? "unavailable" : "alternate" };
    }
    return { ...slot, status: "pending" };
  };

  return {
    title: eliminatedMatch ? "De route van Nederland" : "Bevestigde route van Nederland",
    color: "orange",
    games: template.games.map(mapSlot),
    outcomes: outcomeSlots.map(mapSlot)
  };
}

function determineTournamentState(groupMatches, knockoutMatches) {
  const final = knockoutMatches.find((match) => match.stage === "FINAL");
  const thirdPlace = knockoutMatches.find((match) => match.stage === "THIRD_PLACE");
  const eliminated = knockoutMatches.find((match) => (
    isFinished(match) && didNetherlandsWin(match) === false && match.stage !== "SEMI_FINALS"
  ));

  if (final && isFinished(final)) {
    return didNetherlandsWin(final)
      ? { status: "champion", title: "Nederland is wereldkampioen!", message: "Oranje heeft de finale gewonnen." }
      : { status: "completed", title: "Nederland eindigt als tweede", message: "Het WK van Oranje is na de finale afgelopen." };
  }
  if (thirdPlace && isFinished(thirdPlace)) {
    return didNetherlandsWin(thirdPlace)
      ? { status: "completed", title: "Nederland eindigt als derde", message: "Oranje sluit het WK af met winst in de troostfinale." }
      : { status: "completed", title: "Nederland eindigt als vierde", message: "Het WK van Oranje is afgelopen." };
  }
  if (eliminated) {
    return { status: "eliminated", title: "Het avontuur van Oranje is geëindigd", message: `${stageLabels[eliminated.stage]} was de laatste wedstrijd van Nederland.` };
  }
  if (knockoutMatches.length > 0) {
    const future = knockoutMatches.some((match) => !isFinished(match));
    return future
      ? { status: "active", title: "Oranje is door!", message: "De volgende knock-outwedstrijd is bevestigd." }
      : { status: "awaiting", title: "Oranje wacht op de volgende tegenstander", message: "De app wordt bijgewerkt zodra de volgende koppeling bekend is." };
  }
  if (groupMatches.length > 0 && groupMatches.every(isFinished)) {
    return { status: "awaiting", title: "De groepsfase is gespeeld", message: "De app wordt bijgewerkt zodra het vervolg van Oranje is bevestigd." };
  }
  return { status: "active", title: "De groepsfase is bezig", message: "" };
}

const dutchApiMatches = payload.matches
  .filter(isDutchMatch)
  .sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate));
if (dutchApiMatches.length === 0) throw new Error("Geen wedstrijden van Nederland gevonden; bestaande publicatie blijft actief.");

const groupMatches = dutchApiMatches.filter((match) => match.stage === "GROUP_STAGE");
const knockoutMatches = dutchApiMatches.filter((match) => match.stage !== "GROUP_STAGE");
const tournament = determineTournamentState(groupMatches, knockoutMatches);
const publishedMatches = dutchApiMatches.map(toPublishedMatch);
const routes = knockoutMatches.length > 0
  ? [buildKnockoutRoute(knockoutMatches)]
  : routeTemplates.map((route) => ({
    ...route,
    games: route.games.map((game) => ({ ...game, status: game.status || "pending" })),
    outcomes: [
      { round: "Finale", date: "zo 19 juli", time: "21:00", place: "New York / New Jersey", opponent: "Bij winst in de halve finale", status: "alternate" },
      { round: "Troostfinale", date: "za 18 juli", time: "23:00", place: "Miami", opponent: "Bij verlies in de halve finale", status: "alternate" }
    ]
  }));

const generated = {
  schemaVersion: 1,
  updatedAt: new Date().toISOString(),
  phaseLabel: knockoutMatches.length > 0 ? "Knock-outfase" : "Groep F",
  tournamentStatus: tournament.status,
  statusTitle: tournament.title,
  statusMessage: tournament.message,
  routeDescription: knockoutMatches.length > 0
    ? "De bevestigde route en alle mogelijke vervolgrondes van Nederland."
    : "Deze wedstrijden gaan alleen door als Oranje zich plaatst en blijft winnen.",
  matches: publishedMatches,
  routes
};

const output = manual.enabled ? {
  ...generated,
  phaseLabel: manual.phaseLabel || generated.phaseLabel,
  tournamentStatus: manual.tournamentStatus || generated.tournamentStatus,
  statusTitle: manual.statusTitle || generated.statusTitle,
  statusMessage: manual.statusMessage || generated.statusMessage,
  routeDescription: manual.routeDescription || generated.routeDescription,
  matches: manual.matches.length > 0 ? manual.matches : generated.matches,
  routes: manual.routes.length > 0 ? manual.routes : generated.routes
} : generated;

await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(`Bijgewerkt: ${output.tournamentStatus}, ${output.matches.length} wedstrijden en ${output.routes.length} routes.`);
