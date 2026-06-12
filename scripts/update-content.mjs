import { readFile, writeFile } from "node:fs/promises";

const API_URL = "https://api.football-data.org/v4/competitions/WC/matches?season=2026";
const token = process.env.FOOTBALL_DATA_API_KEY;
const fixture = process.env.FOOTBALL_DATA_FIXTURE;
const outputPath = process.env.CONTENT_OUTPUT || "data/wk-2026.json";
if (!token && !fixture) throw new Error("FOOTBALL_DATA_API_KEY ontbreekt.");

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));
const routes = await readJson("data/routes.json");
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
const teamName = (team) => names[teamCode(team)] || team?.shortName || team?.name || "Nog te bepalen";
const teamFlag = (team) => flags[teamCode(team)] || "nl";

function genericProfile(team) {
  const code = teamCode(team);
  const name = teamName(team);
  return editorial.profiles[code] || {
    name,
    nickname: "Tegenstander van Oranje",
    flag: teamFlag(team),
    intro: `${name} is de volgende tegenstander van Nederland. Dit profiel kan redactioneel worden aangevuld zodra de wedstrijd is bevestigd.`,
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

const dutchMatches = payload.matches
  .filter((match) => [teamCode(match.homeTeam), teamCode(match.awayTeam)].includes("NED"))
  .sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate))
  .map((match, index) => {
    const opponent = teamCode(match.homeTeam) === "NED" ? match.awayTeam : match.homeTeam;
    const [city, country] = venuePlaces[match.venue] || [match.venue || "Nog te bepalen", ""];
    const knockout = match.stage !== "GROUP_STAGE";
    return {
      kickoff: match.utcDate,
      endsAt: new Date(new Date(match.utcDate).getTime() + (knockout ? 4 : 3) * 3600000).toISOString(),
      home: teamName(match.homeTeam),
      away: teamName(match.awayTeam),
      homeFlag: teamFlag(match.homeTeam),
      awayFlag: teamFlag(match.awayTeam),
      city,
      country,
      stadium: match.venue || "Nog te bepalen",
      label: match.stage === "GROUP_STAGE"
        ? `Groepswedstrijd ${match.matchday || index + 1}`
        : stageLabels[match.stage] || "WK-wedstrijd",
      opponent: genericProfile(opponent)
    };
  });

if (dutchMatches.length === 0) throw new Error("Geen wedstrijden van Nederland gevonden; bestaande publicatie blijft actief.");

const knockoutMatches = payload.matches.filter((match) => (
  match.stage !== "GROUP_STAGE"
  && [teamCode(match.homeTeam), teamCode(match.awayTeam)].includes("NED")
));

let publishedRoutes = routes;
let routeDescription = "Deze wedstrijden gaan alleen door als Oranje zich plaatst en blijft winnen.";
if (knockoutMatches.length > 0) {
  const confirmed = knockoutMatches
    .filter((match) => !["FINAL", "THIRD_PLACE"].includes(match.stage))
    .map((match) => {
      const opponent = teamCode(match.homeTeam) === "NED" ? match.awayTeam : match.homeTeam;
      const [place] = venuePlaces[match.venue] || [match.venue || "Nog te bepalen"];
      return {
        round: stageLabels[match.stage] || "Knock-outwedstrijd",
        date: formatDate(match.utcDate),
        time: formatTime(match.utcDate),
        place,
        opponent: teamName(opponent)
      };
    });
  publishedRoutes = confirmed.length > 0 ? [{
    title: "Bevestigde route van Nederland",
    color: "orange",
    games: confirmed
  }] : routes;
  routeDescription = "Bevestigde knock-outwedstrijden van Nederland worden automatisch bijgewerkt.";
}

const output = manual.enabled ? {
  schemaVersion: 1,
  updatedAt: new Date().toISOString(),
  phaseLabel: manual.phaseLabel || "WK 2026",
  routeDescription: manual.routeDescription || routeDescription,
  matches: manual.matches.length > 0 ? manual.matches : dutchMatches,
  routes: manual.routes.length > 0 ? manual.routes : publishedRoutes
} : {
  schemaVersion: 1,
  updatedAt: new Date().toISOString(),
  phaseLabel: knockoutMatches.length > 0 ? "Knock-outfase" : "Groep F",
  routeDescription,
  matches: dutchMatches,
  routes: publishedRoutes
};

await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(`Bijgewerkt met ${output.matches.length} wedstrijden en ${output.routes.length} routes.`);
