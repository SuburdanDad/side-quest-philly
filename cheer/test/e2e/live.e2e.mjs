// Live end-to-end check: three browser "phones" plus scripted voters against the
// local Supabase stack (supabase/local: real Supabase Postgres, GoTrue anonymous
// auth, PostgREST) and a production build of the app.
//
//   supabase/local/up.sh                      # stack + migrations + .env.local
//   npm run build && npx next start -p 3024   # build AFTER .env.local exists
//   npm run test:e2e:live                     # resets the e2e-practice meet, runs
//
// Env: E2E_APP (default http://localhost:3024), E2E_OUT (screenshot dir).
import { createRequire } from "node:module";
import { execFileSync, execSync } from "node:child_process";
import { readFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CHEER = new URL("../..", import.meta.url).pathname.replace(/\/$/, "");
const OUT = process.env.E2E_OUT ?? join(tmpdir(), "judgey-e2e");
mkdirSync(OUT, { recursive: true });
const require = createRequire(import.meta.url);
const PW = process.env.PW ?? join(execSync("npm root -g").toString().trim(), "playwright");
const { chromium, devices } = require(PW);
const pg = require(`${CHEER}/node_modules/pg`);
const { createClient } = await import(`${CHEER}/node_modules/@supabase/supabase-js/dist/index.mjs`);

const APP = process.env.E2E_APP ?? "http://localhost:3024";
const MEET = "e2e-practice";
const OP_CODE = "e2e-operator-code";
const KEY = readFileSync(`${CHEER}/.env.local`, "utf8").match(/PUBLISHABLE_KEY=(.*)/)[1].trim();
const db = new pg.Client(process.env.JUDGEY_LOCAL_DB ?? "postgres://postgres:judgey-local-db@localhost:54322/postgres");
await db.connect();
const q = async (sql, args = []) => (await db.query(sql, args)).rows;

// Fresh practice meet: the demo roster, first routine scheduled 6 minutes ago.
await q("delete from public.meets where id = $1", [MEET]);
const meetStart = new Date(Math.floor((Date.now() - 6 * 60_000) / 60_000) * 60_000).toISOString();
const sql = execFileSync("node", ["--experimental-strip-types", "--no-warnings", "scripts/import-meet.ts",
  "--demo", "--start", meetStart, "--meet", MEET, "--name", "Judgey E2E Practice", "--operator-code", OP_CODE],
  { cwd: CHEER, stdio: ["ignore", "pipe", "ignore"] }).toString();
await db.query(sql);

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function eventually(fn, ms = 25_000) {
  const end = Date.now() + ms;
  let last;
  while (Date.now() < end) {
    try {
      last = await fn();
      if (last) return last;
    } catch (e) {
      last = e;
    }
    await sleep(500);
  }
  return false;
}

// Mat 1 running order for the practice meet.
const mat1 = await q(
  `select team_id, team_name, division from routines where meet_id = $1 and mat = '1' order by scheduled_at, team_id collate "C"`,
  [MEET],
);
const [first, second, third, fourth] = mat1;
console.log("mat 1:", mat1.slice(0, 4).map((r) => r.team_name).join(", "));

const browser = await chromium.launch();
const phone = async (label, options = {}) => {
  const ctx = await browser.newContext({ ...devices["iPhone 13"], ...options });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  return { ctx, page, errors, label };
};
const A = await phone("parent");
// No service worker for the fan: step 8 proves in-app navigation works offline on its own.
const B = await phone("fan", { serviceWorkers: "block" });
const C = await phone("operator");

// 1. Parent checks in for the first team via a QR link; ETA renders.
await A.page.goto(`${APP}/?meet=${MEET}&src=qr`);
await A.page.getByRole("button", { name: new RegExp(first.team_name) }).first().click();
await A.page.getByRole("button", { name: /Let's go/ }).click();
await A.page.waitForURL("**/meet");
check("parent sees their team's card after local-first check-in",
  !!(await eventually(() => A.page.getByText(first.team_name, { exact: false }).first().isVisible())));
await A.page.screenshot({ path: `${OUT}/1-parent-myteam.png`, fullPage: true });

// 2. Fan checks in "just here to cheer" from the group chat link.
await B.page.goto(`${APP}/?meet=${MEET}&src=groupchat`);
await B.page.getByRole("button", { name: /just here to cheer/i }).click();
await B.page.waitForURL("**/meet");

// Background sync reaches the server.
check("both check-ins synced to fans table", !!(await eventually(async () =>
  (await q(`select count(*)::int n from fans where meet_id = $1`, [MEET]))[0].n === 2)));
const fanA = (await q(`select home_team_ids, ever_home_team_ids from fans where meet_id=$1 and home_team_ids <> '{}'`, [MEET]))[0];
check("parent's home team stored server-side", fanA?.home_team_ids?.[0] === first.team_id, JSON.stringify(fanA));
check("visits recorded with first-touch src", !!(await eventually(async () => {
  const rows = await q(`select src from visits where meet_id=$1 order by src`, [MEET]);
  return rows.map((r) => r.src).join(",") === "groupchat,qr";
})));

// 3. Both tap the up-next team on Mat 1; the crowd confirms the start.
for (const P of [A, B]) await P.page.goto(`${APP}/meet/mats?mat=1`);
const tapBtn = (P) => P.page.getByRole("button", { name: `${first.team_name} just took the mat` });
await eventually(() => tapBtn(A).isEnabled());
await tapBtn(A).click();
check("first tap shows 'waiting for another fan'",
  !!(await eventually(() => A.page.getByText("Sent! Waiting for another fan").isVisible())));
await eventually(() => tapBtn(B).isEnabled());
await tapBtn(B).click();
const start = await eventually(async () =>
  (await q(`select started_at, source, confirmations from routine_starts where meet_id=$1 and team_id=$2`, [MEET, first.team_id]))[0]);
check("two phones confirm the start (crowd source)", start?.source === "crowd" && start?.confirmations === 2, JSON.stringify(start));
check("parent's phone flips to 'On the mat' within one poll",
  !!(await eventually(() => A.page.getByText("On the mat").first().isVisible(), 25_000)));
await A.page.screenshot({ path: `${OUT}/2-parent-mats-confirmed.png`, fullPage: true });

// 4. Fan votes; parent is blocked from voting for their own team.
const voteUrl = (team) => `${APP}/meet/vote?team=${encodeURIComponent(team.team_id)}`;
await B.page.goto(voteUrl(first));
await B.page.getByRole("radio", { name: "5 stars" }).click();
await B.page.getByRole("button", { name: "Best Stunts" }).click();
await B.page.getByRole("button", { name: /Send my cheer/ }).click();
check("fan's vote accepted", !!(await eventually(() => B.page.getByText(/Your cheer is in/i).isVisible())));
await B.page.screenshot({ path: `${OUT}/3-fan-voted.png` });
const tally = (await q(`select votes, star_sum, stunts from judgey_private.team_tallies where meet_id=$1 and team_id=$2`, [MEET, first.team_id]))[0];
check("tally counted server-side", tally?.votes === 1 && tally?.star_sum === 5 && tally?.stunts === 1, JSON.stringify(tally));
await A.page.goto(voteUrl(first));
check("parent sees the own-team block", !!(await eventually(() => A.page.getByText(/you think they.re perfect/i).isVisible())));
await A.page.goto(`${APP}/meet/vote/${first.team_id}`);
check("old /meet/vote/<team> links redirect to /meet/vote?team=",
  !!(await eventually(() => A.page.url().endsWith(`/meet/vote?team=${first.team_id}`))), A.page.url());

// 5. Server enforces rules even when the UI is bypassed (direct RPC with a fresh anonymous identity).
const bot = async () => {
  const sb = createClient("http://localhost:54321", KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await sb.auth.signInAnonymously();
  if (error) throw error;
  return sb;
};
const g = await bot();
const far = await g.rpc("tap_mat", { p_meet: MEET, p_team: fourth.team_id });
check("griefer tap on a far-ahead routine rejected", far.data?.reason === "not-next" || far.data?.reason === "too-early", JSON.stringify(far.data));
const noCheckin = await g.rpc("cast_ballot", { p_meet: MEET, p_team: first.team_id, p_stars: 5 });
check("ballot without check-in rejected", noCheckin.data?.reason === "not-checked-in", JSON.stringify(noCheckin.data));
await g.rpc("check_in", { p_meet: MEET, p_home_team_ids: [] });
const half = await g.rpc("cast_ballot", { p_meet: MEET, p_team: first.team_id, p_stars: 4.5 });
check("4.5 stars rejected as invalid", half.data?.reason === "invalid", JSON.stringify(half.data));
const direct = await g.from("ballots").insert({ meet_id: MEET, team_id: first.team_id, user_id: "00000000-0000-0000-0000-000000000000", stars: 5, cast_at: new Date().toISOString() });
check("direct table insert denied", !!direct.error, direct.error?.code);
const peek = await g.from("ballots").select("*").eq("meet_id", MEET);
check("cannot read other people's ballots", !peek.error && peek.data.length === 0, `rows=${peek.data?.length}`);
const tallyPeek = await g.schema("judgey_private").from("team_tallies").select("*");
check("private schema unreachable", !!tallyPeek.error, tallyPeek.error?.code);

// 6. Operator claims the code (stripped from the URL) and starts the next routine.
await C.page.goto(`${APP}/?meet=${MEET}&op=${OP_CODE}`);
check("operator code stripped from the URL", !!(await eventually(() => !C.page.url().includes("op="))), C.page.url());
await C.page.getByRole("button", { name: /just here to cheer/i }).click();
await C.page.waitForURL("**/meet");
check("operator claimed server-side", !!(await eventually(async () =>
  (await q(`select count(*)::int n from judgey_private.meet_operators where meet_id=$1`, [MEET]))[0].n === 1)));
await C.page.goto(`${APP}/meet/mats?mat=1`);
check("operator controls visible", !!(await eventually(() => C.page.getByRole("button", { name: "Start now" }).first().isVisible())));
const opRow = (team) => C.page.locator("li", { hasText: team.team_name });
check("Start now is disabled on a routine that already has a start",
  await opRow(first).getByRole("button", { name: "Start now" }).isDisabled());
await opRow(first).getByRole("button", { name: "Clear" }).click();
check("Clear asks for a second tap naming the team",
  !!(await eventually(() => opRow(first).getByRole("button", { name: `Tap again to clear ${first.team_name}'s start` }).isVisible())));
await sleep(4500);
check("the armed Clear cancels itself after 4 s",
  (await opRow(first).getByRole("button", { name: "Clear" }).isVisible()) &&
  (await q(`select count(*)::int n from routine_starts where meet_id=$1 and team_id=$2`, [MEET, first.team_id]))[0].n === 1);
await opRow(fourth).getByRole("button", { name: "Start now" }).click();
await sleep(1000);
check("Start now on a far-ahead routine needs a second tap (nothing written yet)",
  (await opRow(fourth).getByRole("button", { name: `Tap again to start ${fourth.team_name} now` }).isVisible()) &&
  (await q(`select count(*)::int n from routine_starts where meet_id=$1 and team_id=$2`, [MEET, fourth.team_id]))[0].n === 0);
await sleep(4500);
const startNow = async (team) => {
  await C.page.locator("li", { hasText: team.team_name }).getByRole("button", { name: "Start now" }).click();
  return eventually(async () =>
    (await q(`select source from routine_starts where meet_id=$1 and team_id=$2`, [MEET, team.team_id]))[0]);
};
await startNow(second);
const opStart = await eventually(async () =>
  (await q(`select source from routine_starts where meet_id=$1 and team_id=$2`, [MEET, second.team_id]))[0]);
check("operator start stored", opStart?.source === "operator", JSON.stringify(opStart));
await B.page.goto(`${APP}/meet/mats?mat=1`);
check("fan sees the operator's start within one poll",
  !!(await eventually(async () => (await B.page.getByText(second.team_name).count()) > 0 &&
    (await B.page.locator("text=Vote").count()) >= 1, 25_000)));
await C.page.screenshot({ path: `${OUT}/4-operator-mats.png`, fullPage: true });

// 7. Bots vote for the first four routines, then windows close and Youth 2 reveals.
await startNow(third);
await startNow(fourth);
await eventually(async () => (await q(`select count(*)::int n from routine_starts where meet_id=$1`, [MEET]))[0].n >= 4);
const stars = { [first.team_id]: 5, [second.team_id]: 4, [third.team_id]: 3, [fourth.team_id]: 5 };
let accepted = 0;
for (let i = 0; i < 12; i++) {
  const sb = await bot();
  await sb.rpc("check_in", { p_meet: MEET, p_home_team_ids: [] });
  for (const r of [first, second, third, fourth]) {
    const res = await sb.rpc("cast_ballot", {
      p_meet: MEET, p_team: r.team_id, p_stars: i % 3 === 0 ? stars[r.team_id] - (stars[r.team_id] > 1 ? 1 : 0) : stars[r.team_id],
      p_awards: i % 2 ? ["spirit"] : ["stunts"],
    });
    if (res.data?.ok) accepted++;
  }
}
check("48 bot ballots accepted inside the windows", accepted === 48, `accepted=${accepted}`);
// Close all four windows (as if 15 minutes passed).
await q(`update routine_starts set started_at = started_at - interval '15 minutes', confirmed_at = confirmed_at - interval '15 minutes' where meet_id=$1 and team_id = any($2)`,
  [MEET, [first, second, third, fourth].map((r) => r.team_id)]);
const lateBot = await bot();
await lateBot.rpc("check_in", { p_meet: MEET, p_home_team_ids: [] });
const late = await lateBot.rpc("cast_ballot", { p_meet: MEET, p_team: first.team_id, p_stars: 5 });
check("ballot after the window rejected", late.data?.reason === "window-closed", JSON.stringify(late.data));
const snap = await createClient("http://localhost:54321", KEY, { auth: { persistSession: false } }).rpc("meet_snapshot", { p_meet: MEET });
const board = snap.data?.board;
check("Youth 2 revealed with a top-half board", board?.revealedDivisions?.includes(first.division) && board.top.length === 2,
  JSON.stringify(board?.top));
await A.page.goto(`${APP}/meet/favorites`);
check("parent's Favorites shows the board and their recap",
  !!(await eventually(async () => (await A.page.getByText(/fans cheered for/i).count()) > 0, 25_000)));
await A.page.screenshot({ path: `${OUT}/5-parent-favorites.png`, fullPage: true });

// 8. Offline: the last known running order stays on screen, with an offline chip,
// and every in-app navigation (tabs, mat cards, a Vote link) still works.
const fifth = mat1[4];
await startNow(fifth); // an open voting window, so the fan has a Vote link
await B.page.goto(`${APP}/meet/mats?mat=1`);
await eventually(() => B.page.getByText(first.team_name).first().isVisible());
await eventually(async () => (await B.page.getByRole("link", { name: "Vote" }).count()) > 0);
await B.page.getByRole("link", { name: "My Team" }).click(); // visit each tab once online (prefetches settle)
await B.page.waitForURL("**/meet");
await sleep(2000);
await B.ctx.setOffline(true);
check("offline: last known times stay and the chip says so", !!(await eventually(async () =>
  (await B.page.getByText(/offline/i).count()) > 0 && (await B.page.getByText(/On the mats/i).first().isVisible()), 40_000)));
const notBlank = async (P) => !P.page.url().startsWith("chrome-error") && (await P.page.locator("nav a").count()) === 3;
for (const [tab, path, text] of [
  ["Mats", "/meet/mats", first.team_name],
  ["Favorites", "/meet/favorites", "Shout-outs"],
  ["My Team", "/meet", "On the mats"],
  ["Mats", "/meet/mats", first.team_name],
]) {
  await B.page.getByRole("link", { name: tab, exact: true }).click();
  check(`offline: ${tab} tab opens from the cache`, !!(await eventually(async () =>
    new URL(B.page.url()).pathname === path && (await notBlank(B)) &&
    (await B.page.getByText(text).first().isVisible()), 15_000)), B.page.url());
}
await B.page.getByRole("link", { name: "Vote" }).first().click();
check("offline: a Vote link opens the vote screen", !!(await eventually(async () =>
  B.page.url().includes("/meet/vote?team=") && (await notBlank(B)) &&
  (await B.page.getByRole("heading", { level: 1 }).first().isVisible()), 15_000)), B.page.url());
await B.page.screenshot({ path: `${OUT}/6-fan-offline.png` });
await B.ctx.setOffline(false);

// 9. Offline app shell (service worker): load once online, then reload with no signal.
const D = await phone("returning fan");
await D.page.goto(`${APP}/?meet=${MEET}&src=qr`);
await D.page.getByRole("button", { name: new RegExp(second.team_name) }).first().click();
await D.page.getByRole("button", { name: /Let's go/ }).click();
await D.page.waitForURL("**/meet");
const swReady = await eventually(() => D.page.evaluate(async () => {
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg?.active) return false;
  const pages = await caches.open("judgey-pages-v1");
  return (await pages.keys()).length >= 5;
}), 30_000);
check("service worker installed and the app shell cached", !!swReady);
await D.page.getByRole("link", { name: "Mats", exact: true }).click(); // the running order lands in the cache
await D.page.waitForURL("**/meet/mats");
await eventually(() => D.page.getByText(second.team_name).first().isVisible());
await D.ctx.setOffline(true);
let reloadError = "";
await D.page.reload().catch((e) => (reloadError = String(e)));
check("offline reload renders the cached running order with the offline chip", !!(await eventually(async () =>
  (await notBlank(D)) && (await D.page.getByText(second.team_name).first().isVisible()) &&
  (await D.page.getByText(/offline/i).count()) > 0, 40_000)), reloadError);
for (const [tab, path] of [["My Team", "/meet"], ["Favorites", "/meet/favorites"], ["Mats", "/meet/mats"]]) {
  await D.page.getByRole("link", { name: tab, exact: true }).click();
  check(`offline after reload: ${tab} tab works`, !!(await eventually(async () =>
    new URL(D.page.url()).pathname === path && (await notBlank(D)), 15_000)), D.page.url());
}
await D.page.goto(voteUrl(fifth)).catch(() => {});
check("offline after reload: the vote page opens", !!(await eventually(async () =>
  (await notBlank(D)) && (await D.page.getByText(fifth.team_name).first().isVisible()), 15_000)), D.page.url());
await D.page.screenshot({ path: `${OUT}/7-offline-reload-vote.png` });
await D.ctx.setOffline(false);

// 10. Cross-meet links: after a while on a live meet, "Try the demo meet" really switches.
await D.page.goto(`${APP}/meet`);
await sleep(3000); // prefetches of /?meet=<live> settle
await D.page.getByRole("link", { name: /Change teams/ }).click();
await D.page.waitForURL(`**/?meet=${MEET}`);
await D.page.getByRole("link", { name: /Try the demo meet/ }).click();
check("'Try the demo meet' opens the demo after time on a live meet", !!(await eventually(async () =>
  (await D.page.getByText("Demo meet").first().isVisible()) && D.page.url().includes("winter-classic-2026"), 15_000)),
  D.page.url());

// After an offline reload the router has no prefetched payloads, so Next logs this and
// falls back to a full navigation, which the service worker serves (checked in step 9).
// Only the service-worker phone may log it: phone B (no service worker) must not.
const swFallback = (p, e) => p === D && /Failed to fetch RSC payload/.test(e);
const pageErrors = [A, B, C, D].flatMap((p) => p.errors.filter((e) => !swFallback(p, e)).map((e) => `${p.label}: ${e}`))
  .filter((e) => !/Failed to load resource|ERR_INTERNET_DISCONNECTED|net::/.test(e));
check("no unexpected page errors", pageErrors.length === 0, pageErrors.slice(0, 3).join(" | "));
await browser.close();
await db.end();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
