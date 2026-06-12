import { readFile } from "node:fs/promises";

const file = process.argv[2];
if (!file) throw new Error("Geef een JSON-bestand op.");

const data = JSON.parse(await readFile(file, "utf8"));
const requiredText = (value) => typeof value === "string" && value.trim().length > 0;
const validDate = (value) => requiredText(value) && Number.isFinite(new Date(value).getTime());

if (data.schemaVersion !== 1 || !validDate(data.updatedAt)) throw new Error("Ongeldige schemaVersion of updatedAt.");
if (!Array.isArray(data.matches) || data.matches.length === 0) throw new Error("Minimaal één wedstrijd is verplicht.");
if (!Array.isArray(data.routes)) throw new Error("routes moet een lijst zijn.");

for (const match of data.matches) {
  const fields = ["home", "away", "homeFlag", "awayFlag", "city", "label"];
  if (!validDate(match.kickoff) || !validDate(match.endsAt)) throw new Error("Ongeldige wedstrijdtijd.");
  if (fields.some((field) => !requiredText(match[field]))) throw new Error(`Onvolledige wedstrijd: ${match.label || "onbekend"}`);
  if (!match.opponent || !requiredText(match.opponent.name) || !requiredText(match.opponent.intro)) {
    throw new Error(`Tegenstanderprofiel ontbreekt: ${match.label}`);
  }
}

for (const route of data.routes) {
  if (!requiredText(route.title) || !requiredText(route.color) || !Array.isArray(route.games) || route.games.length === 0) {
    throw new Error("Ongeldige route.");
  }
}

console.log(`Geldig: ${data.matches.length} wedstrijden en ${data.routes.length} routes.`);
