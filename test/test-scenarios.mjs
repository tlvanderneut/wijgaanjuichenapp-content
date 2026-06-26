import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const temp = await mkdtemp(join(tmpdir(), "wijgaanjuichen-scenarios-"));
const team = (tla, name) => ({ tla, name, shortName: name });
const NED = team("NED", "Netherlands");
const JPN = team("JPN", "Japan");
const SWE = team("SWE", "Sweden");
const TUN = team("TUN", "Tunisia");
const BRA = team("BRA", "Brazil");
const FRA = team("FRA", "France");
const ESP = team("ESP", "Spain");

function match({
  date, stage, status = "SCHEDULED", home = NED, away = BRA,
  winner = null, homeGoals = null, awayGoals = null, venue = "Estadio BBVA", matchday
}) {
  return {
    utcDate: date,
    stage,
    status,
    matchday,
    venue,
    homeTeam: home,
    awayTeam: away,
    score: {
      winner,
      fullTime: { home: homeGoals, away: awayGoals }
    }
  };
}

const groupScheduled = [
  match({ date: "2026-06-14T20:00:00Z", stage: "GROUP_STAGE", away: JPN, venue: "AT&T Stadium", matchday: 1 }),
  match({ date: "2026-06-20T17:00:00Z", stage: "GROUP_STAGE", away: SWE, venue: "NRG Stadium", matchday: 2 }),
  match({ date: "2026-06-25T23:00:00Z", stage: "GROUP_STAGE", home: TUN, away: NED, venue: "Arrowhead Stadium", matchday: 3 })
];
const groupFinished = groupScheduled.map((game) => ({
  ...game,
  status: "FINISHED",
  score: { winner: teamCode(game.homeTeam) === "NED" ? "HOME_TEAM" : "AWAY_TEAM", fullTime: { home: 2, away: 1 } }
}));

function teamCode(value) {
  return value?.tla || "";
}

const round32Scheduled = match({
  date: "2026-06-30T03:00:00Z", stage: "LAST_32", away: BRA
});
const round32Won = match({
  date: "2026-06-30T03:00:00Z", stage: "LAST_32", away: BRA,
  status: "FINISHED", winner: "HOME_TEAM", homeGoals: 2, awayGoals: 1
});
const round32Lost = match({
  date: "2026-06-30T03:00:00Z", stage: "LAST_32", away: BRA,
  status: "FINISHED", winner: "AWAY_TEAM", homeGoals: 1, awayGoals: 2
});
const round16Won = match({
  date: "2026-07-04T17:00:00Z", stage: "LAST_16", away: FRA, venue: "NRG Stadium",
  status: "FINISHED", winner: "HOME_TEAM", homeGoals: 1, awayGoals: 0
});
const quarterWon = match({
  date: "2026-07-09T20:00:00Z", stage: "QUARTER_FINALS", away: ESP, venue: "Gillette Stadium",
  status: "FINISHED", winner: "HOME_TEAM", homeGoals: 3, awayGoals: 2
});
const semifinalWon = match({
  date: "2026-07-14T19:00:00Z", stage: "SEMI_FINALS", away: BRA,
  status: "FINISHED", winner: "HOME_TEAM", homeGoals: 2, awayGoals: 0
});
const semifinalLost = match({
  date: "2026-07-14T19:00:00Z", stage: "SEMI_FINALS", away: BRA,
  status: "FINISHED", winner: "AWAY_TEAM", homeGoals: 0, awayGoals: 1
});
const finalWon = match({
  date: "2026-07-19T19:00:00Z", stage: "FINAL", away: FRA, venue: "MetLife Stadium",
  status: "FINISHED", winner: "HOME_TEAM", homeGoals: 2, awayGoals: 1
});
const finalLost = match({
  date: "2026-07-19T19:00:00Z", stage: "FINAL", away: FRA, venue: "MetLife Stadium",
  status: "FINISHED", winner: "AWAY_TEAM", homeGoals: 1, awayGoals: 2
});
const thirdWon = match({
  date: "2026-07-18T21:00:00Z", stage: "THIRD_PLACE", away: ESP, venue: "Hard Rock Stadium",
  status: "FINISHED", winner: "HOME_TEAM", homeGoals: 2, awayGoals: 0
});
const thirdLost = match({
  date: "2026-07-18T21:00:00Z", stage: "THIRD_PLACE", away: ESP, venue: "Hard Rock Stadium",
  status: "FINISHED", winner: "AWAY_TEAM", homeGoals: 0, awayGoals: 2
});

async function runScenario(name, matches, verify) {
  const fixture = join(temp, `${name}-fixture.json`);
  const output = join(temp, `${name}-output.json`);
  await writeFile(fixture, JSON.stringify({ matches }));
  const run = spawnSync(process.execPath, ["scripts/update-content.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      FOOTBALL_DATA_FIXTURE: fixture,
      CONTENT_OUTPUT: output,
      IGNORE_MANUAL_OVERRIDES: "true"
    }
  });
  if (run.status !== 0) throw new Error(`${name}: ${run.stderr || run.stdout}`);
  const data = JSON.parse(await readFile(output, "utf8"));
  verify(data);
  console.log(`Akkoord: ${name}`);
}

const expect = (condition, message) => {
  if (!condition) throw new Error(message);
};
const routeStatus = (data, round) => (
  [...data.routes[0].games, ...(data.routes[0].outcomes || [])]
    .find((game) => game.round === round)?.status
);

await runScenario("group-active", groupScheduled, (data) => {
  expect(data.tournamentStatus === "active", "Groepsfase moet actief zijn.");
  expect(data.routes.length === 2, "Beide groepsroutes moeten zichtbaar zijn.");
});
await runScenario("group-awaiting", groupFinished, (data) => {
  expect(data.tournamentStatus === "awaiting", "Na de groep moet de app wachten.");
});
await runScenario("round32-confirmed", [...groupFinished, round32Scheduled], (data) => {
  expect(routeStatus(data, "Laatste 32") === "confirmed", "Laatste 32 moet bevestigd zijn.");
  expect(routeStatus(data, "Achtste finale") === "pending", "Achtste finale moet open blijven.");
  expect(routeStatus(data, "Finale") === "alternate", "Finale moet een mogelijkheid zijn.");
});
await runScenario("round32-win-awaiting", [...groupFinished, round32Won], (data) => {
  expect(data.tournamentStatus === "awaiting", "Na winst zonder volgende koppeling moet de app wachten.");
  expect(routeStatus(data, "Laatste 32") === "completed", "Laatste 32 moet voltooid zijn.");
});
await runScenario("round32-eliminated", [...groupFinished, round32Lost], (data) => {
  expect(data.tournamentStatus === "eliminated", "Verlies moet uitschakeling opleveren.");
  expect(routeStatus(data, "Laatste 32") === "eliminated", "Verloren ronde moet gemarkeerd zijn.");
  expect(routeStatus(data, "Achtste finale") === "unavailable", "Latere ronde mag niet beschikbaar zijn.");
});
await runScenario("semifinal-won", [...groupFinished, round32Won, round16Won, quarterWon, semifinalWon], (data) => {
  expect(routeStatus(data, "Finale") === "pending", "Finale moet na halvefinalewinst volgen.");
  expect(routeStatus(data, "Troostfinale") === "unavailable", "Troostfinale moet verdwijnen.");
});
await runScenario("semifinal-lost", [...groupFinished, round32Won, round16Won, quarterWon, semifinalLost], (data) => {
  expect(routeStatus(data, "Finale") === "unavailable", "Finale moet na verlies verdwijnen.");
  expect(routeStatus(data, "Troostfinale") === "pending", "Troostfinale moet volgen.");
});
await runScenario("champion", [...groupFinished, round32Won, round16Won, quarterWon, semifinalWon, finalWon], (data) => {
  expect(data.tournamentStatus === "champion", "Finalewinst moet kampioen opleveren.");
});
await runScenario("runner-up", [...groupFinished, round32Won, round16Won, quarterWon, semifinalWon, finalLost], (data) => {
  expect(data.statusTitle.includes("tweede"), "Finaleverlies moet tweede plaats opleveren.");
});
await runScenario("third", [...groupFinished, round32Won, round16Won, quarterWon, semifinalLost, thirdWon], (data) => {
  expect(data.statusTitle.includes("derde"), "Winst troostfinale moet derde plaats opleveren.");
});
await runScenario("fourth", [...groupFinished, round32Won, round16Won, quarterWon, semifinalLost, thirdLost], (data) => {
  expect(data.statusTitle.includes("vierde"), "Verlies troostfinale moet vierde plaats opleveren.");
});
