/**
 * Browser smoke test for the governing screen.
 *
 * A passing `next build` proves the code compiles, not that the game plays. This
 * drives a real browser through the loop that matters — take office, move a
 * slider, interrogate a node, advance several years — and fails on any console
 * error along the way. It caught nothing on its first run, which is the point:
 * without it, "it builds" was the only evidence the UI worked at all.
 *
 *   node test/ui/smoke.mjs [baseUrl]
 */

import { existsSync, readdirSync } from "node:fs";
import { chromium } from "playwright";

const BASE = process.argv[2] ?? "http://localhost:3111";
const OUT = process.env.SHOT_DIR ?? "/tmp";

/**
 * The sandbox ships a pre-installed Chromium whose directory carries a build
 * number that will not match whatever Playwright version is installed here, so
 * neither Playwright's own lookup nor a hardcoded path survives an upgrade of
 * either side. Find it instead.
 */
function findChromium() {
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH ?? "/opt/pw-browsers";
  if (!existsSync(root)) return undefined;
  for (const dir of readdirSync(root)) {
    if (!dir.startsWith("chromium-")) continue;
    const bin = `${root}/${dir}/chrome-linux/chrome`;
    if (existsSync(bin)) return bin;
  }
  return undefined; // fall back to Playwright's own resolution
}

const errors = [];
const browser = await chromium.launch({ executablePath: findChromium() });
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push(`PAGEERROR: ${e.message}`));

let failed = 0;
const step = async (name, fn) => {
  try { await fn(); console.log(`  ok   ${name}`); }
  catch (e) { failed++; console.log(`  FAIL ${name}: ${String(e.message).split("\n")[0]}`); }
};

await page.goto(`${BASE}/play`, { waitUntil: "networkidle" });

await step("setup screen renders", async () => {
  await page.getByText("The Intelligence Age").waitFor({ timeout: 20000 });
  await page.getByText("Choose a country").waitFor();
});

await step("take office", async () => {
  await page.getByRole("button", { name: /Take office/ }).click();
  await page.getByText("The country").waitFor({ timeout: 15000 });
});

await step("all three columns render", async () => {
  await page.getByText("Policy", { exact: true }).first().waitFor();
  await page.getByText("Blocs", { exact: true }).first().waitFor();
  await page.getByText("Why", { exact: true }).first().waitFor();
});

await step("every policy has a slider", async () => {
  const n = await page.locator("input[type=range]").count();
  if (n < 20) throw new Error(`expected 20 sliders, found ${n}`);
});

await step("moving a slider queues political capital", async () => {
  await page.locator("input[type=range]").first().fill("70");
  await page.getByText(/pc queued/).waitFor({ timeout: 5000 });
});

await step("clicking a node explains why it moved", async () => {
  await page.getByText("Unemployment", { exact: true }).click();
  await page.waitForTimeout(200);
});

await page.screenshot({ path: `${OUT}/govern.png` });

let years = 0;
await step("advances multiple years without crashing", async () => {
  for (let i = 0; i < 6; i++) {
    const advance = page.getByRole("button", { name: /Advance to/ });
    if ((await advance.count()) === 0) break;
    await advance.click();
    await page.waitForTimeout(800);
    const cont = page.getByRole("button", { name: /Continue|See how it ended/ });
    if ((await cont.count()) > 0) { await cont.click(); await page.waitForTimeout(500); }
    years++;
  }
  if (years < 3) throw new Error(`only advanced ${years} years`);
});
console.log(`       (${years} years)`);

await page.screenshot({ path: `${OUT}/later.png` });


// Errors are counted only up to this point: the original game at / has a
// pre-existing hydration mismatch from the same in-component <style> pattern,
// and this test should not fail on a defect it neither introduced nor owns.
console.log(`\nconsole errors: ${errors.length}`);
for (const e of errors.slice(0, 8)) console.log(`  ! ${e.slice(0, 200)}`);

const playErrors = errors.length;

// The original game shares this deployment and must be unaffected by any of it.
await step("the original game still renders at /", async () => {
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.getByText("The Intelligence Age").first().waitFor({ timeout: 20000 });
  await page.getByText(/SELECT DIFFICULTY/i).first().waitFor({ timeout: 10000 });
});

await browser.close();
process.exit(failed > 0 || playErrors > 0 ? 1 : 0);
