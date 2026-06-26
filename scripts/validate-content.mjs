import { readFile } from "node:fs/promises";

const file = process.argv[2];
if (!file) throw new Error("Geef een JSON-bestand op.");

const data = JSON.parse(await readFile(file, "utf8"));
const requiredText = (value) => typeof value === "string" && value.trim().length > 0;
const optionalText = (value) => value === undefined || value === null || value === "" || requiredText(value);
const validDate = (value) => requiredText(value) && Number.isFinite(new Date(value).getTime());

if (data.schemaVersion !== 1 || !validDate(data.updatedAt)) throw new Error("Ongeldige schemaVersion of updatedAt.");
const tournamentStatuses = ["active", "awaiting", "eliminated", "completed", "champion"];
if (data.tournamentStatus && !tournamentStatuses.includes(data.tournamentStatus)) throw new Error("Ongeldige tournamentStatus.");
if (!Array.isArray(data.matches) || data.matches.length === 0) throw new Error("Minimaal één wedstrijd is verplicht.");
if (!Array.isArray(data.routes)) throw new Error("routes moet een lijst zijn.");

for (const match of data.matches) {
  const fields = ["home", "away", "homeFlag", "awayFlag", "city", "label"];
  if (!validDate(match.kickoff) || !validDate(match.endsAt)) throw new Error("Ongeldige wedstrijdtijd.");
  if (fields.some((field) => !requiredText(match[field]))) throw new Error(`Onvolledige wedstrijd: ${match.label || "onbekend"}`);
  if (!match.opponent || !requiredText(match.opponent.name) || !requiredText(match.opponent.intro)) {
    throw new Error(`Tegenstanderprofiel ontbreekt: ${match.label}`);
  }
  const stats = match.opponent.qualification?.stats;
  if (!Array.isArray(stats) || !stats.every((stat) => (
    stat && requiredText(String(stat.value)) && requiredText(stat.label)
  ))) {
    throw new Error(`Ongeldige tegenstanderstatistieken: ${match.label}`);
  }
  const players = match.opponent.players || [];
  if (!Array.isArray(players) || !players.every((player) => (
    player && requiredText(player.name) && requiredText(player.detail)
  ))) {
    throw new Error(`Ongeldige spelerslijst: ${match.label}`);
  }
  if (!optionalText(match.opponent.culture) || !optionalText(match.opponent.history)) {
    throw new Error(`Ongeldige tegenstandertekst: ${match.label}`);
  }
}

for (const route of data.routes) {
  if (!requiredText(route.title) || !requiredText(route.color) || !Array.isArray(route.games) || route.games.length === 0) {
    throw new Error("Ongeldige route.");
  }
  const routeItems = [...route.games, ...(route.outcomes || [])];
  for (const game of routeItems) {
    const statuses = ["completed", "confirmed", "pending", "alternate", "eliminated", "unavailable", "champion"];
    const fields = ["round", "date", "time", "place", "opponent"];
    if (fields.some((field) => !requiredText(game[field]))) throw new Error(`Onvolledige ronde: ${game.round || "onbekend"}`);
    if (game.status && !statuses.includes(game.status)) throw new Error(`Ongeldige rondestatus: ${game.status}`);
  }
}

console.log(`Geldig: ${data.matches.length} wedstrijden en ${data.routes.length} routes.`);
