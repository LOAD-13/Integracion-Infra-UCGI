// scripts/debug-crm-call.mjs
//
// Reproduce el bug "la llamada del CRM se cuelga" sin requerir interacción humana.
// Levanta DOS contextos chromium headless: uno logueado como agente1 (caller)
// y otro como agente2 (callee). El callee acepta automáticamente las llamadas
// entrantes desde el Softphone del CRM. El caller marca a 1002 y observamos si
// la llamada llega a CONFIRMED en ambos lados.
//
// Captura: console.log, frames WSS de SIP, eventos del RTCPeerConnection,
// screenshots al inicio, post-login, post-register, post-dial, en llamada y al
// final.
//
// Uso:
//   docker run --rm --network=host \
//     -v "$PWD/scripts:/scripts" \
//     -v "$PWD/debug-out:/out" \
//     mcr.microsoft.com/playwright:v1.61.0-jammy \
//     node /scripts/debug-crm-call.mjs
import { chromium } from "playwright";
import { mkdirSync, appendFileSync } from "node:fs";
import { join } from "node:path";

const OUT_DIR = "/out";
const CRM_URL = process.env.CRM_URL ?? "https://localhost";
const CALLER_USER = process.env.CRM_CALLER ?? "agente1";
const CALLEE_USER = process.env.CRM_CALLEE ?? "agente2";
const PASSWORD    = process.env.CRM_PASS   ?? "demo1234";
const TARGET      = process.env.CRM_TARGET ?? "1002";

mkdirSync(OUT_DIR, { recursive: true });
mkdirSync(join(OUT_DIR, "screenshots"), { recursive: true });

const ts = () => new Date().toISOString().replace("T", " ").slice(0, 23);
const log = (file, line) => appendFileSync(join(OUT_DIR, file), line + "\n");

const browser = await chromium.launch({
  headless: true,
  args: [
    "--ignore-certificate-errors",
    "--allow-insecure-localhost",
    "--use-fake-ui-for-media-stream",
    "--use-fake-device-for-media-stream",
    "--autoplay-policy=no-user-gesture-required",
    "--disable-features=WebRtcHideLocalIpsWithMdns",
  ],
});

async function newAgent(name, username) {
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width: 1280, height: 800 },
    permissions: ["microphone", "camera"],
  });
  await context.grantPermissions(["microphone", "camera"], { origin: CRM_URL });
  const page = await context.newPage();

  page.on("console", (msg) => {
    log(`console-${name}.log`, `${ts()} [${msg.type()}] ${msg.text()}`);
  });
  page.on("pageerror", (err) => {
    log(`console-${name}.log`, `${ts()} [pageerror] ${err.message}\n${err.stack ?? ""}`);
  });
  page.on("websocket", (ws) => {
    log(`sip-${name}.log`, `${ts()} OPEN ${ws.url()}`);
    ws.on("framesent",     (data) => log(`sip-${name}.log`, `${ts()} >>> SEND\n${truncate(data.payload)}\n`));
    ws.on("framereceived", (data) => log(`sip-${name}.log`, `${ts()} <<< RECV\n${truncate(data.payload)}\n`));
    ws.on("close",         ()     => log(`sip-${name}.log`, `${ts()} CLOSE`));
    ws.on("socketerror",   (err)  => log(`sip-${name}.log`, `${ts()} ERR ${err}`));
  });

  // Hook RTCPeerConnection antes de cualquier navegación.
  await context.addInitScript(() => {
    const original = window.RTCPeerConnection;
    if (!original || original.__ucgiPatched) return;
    const Patched = function (...args) {
      const pc = new original(...args);
      const tag = `pc-${Math.random().toString(36).slice(2, 6)}`;
      console.log(`[RTC ${tag}] created`);
      pc.addEventListener("icecandidate", (e) => {
        console.log(`[RTC ${tag}] icecandidate: ${e.candidate ? e.candidate.candidate : "<null=done>"}`);
      });
      pc.addEventListener("iceconnectionstatechange", () => {
        console.log(`[RTC ${tag}] iceconnectionstate=${pc.iceConnectionState}`);
      });
      pc.addEventListener("connectionstatechange", () => {
        console.log(`[RTC ${tag}] connectionstate=${pc.connectionState}`);
      });
      pc.addEventListener("signalingstatechange", () => {
        console.log(`[RTC ${tag}] signalingstate=${pc.signalingState}`);
      });
      pc.addEventListener("track", (e) => {
        console.log(`[RTC ${tag}] track kind=${e.track.kind} readyState=${e.track.readyState}`);
      });
      const _setLocal = pc.setLocalDescription.bind(pc);
      pc.setLocalDescription = async (desc) => {
        console.log(`[RTC ${tag}] setLocalDescription type=${desc?.type ?? "<inferred>"}`);
        return _setLocal(desc);
      };
      const _setRemote = pc.setRemoteDescription.bind(pc);
      pc.setRemoteDescription = async (desc) => {
        console.log(`[RTC ${tag}] setRemoteDescription type=${desc?.type}`);
        return _setRemote(desc);
      };
      return pc;
    };
    Patched.prototype = original.prototype;
    Patched.__ucgiPatched = true;
    window.RTCPeerConnection = Patched;
  });

  await page.goto(CRM_URL, { waitUntil: "domcontentloaded", timeout: 20_000 });
  await page.fill('input[name="username"], input[type="text"]', username);
  await page.fill('input[name="password"], input[type="password"]', PASSWORD);
  await page.locator('button[type="submit"], button:has-text("Iniciar")').first().click();
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
  await page.screenshot({ path: join(OUT_DIR, "screenshots", `${name}-02-postlogin.png`), fullPage: true });

  // Esperar registro
  const wait = 15_000;
  const start = Date.now();
  let registered = false;
  while (Date.now() - start < wait) {
    const text = await page.locator("body").innerText().catch(() => "");
    if (/Registrad|connected|listo|🟢/i.test(text)) {
      registered = true;
      break;
    }
    await page.waitForTimeout(500);
  }
  log(`console-${name}.log`, `${ts()} [boot] registered=${registered}`);
  await page.screenshot({ path: join(OUT_DIR, "screenshots", `${name}-03-postregister.png`), fullPage: true });

  return { context, page };
}

function truncate(payload) {
  if (!payload) return "<empty>";
  const s = typeof payload === "string" ? payload : payload.toString("utf8");
  return s.length > 4000 ? s.slice(0, 4000) + "...<truncated>" : s;
}

// Lanzo callee primero, espero registro, después caller.
console.log("[debug] preparando callee", CALLEE_USER);
const callee = await newAgent("callee", CALLEE_USER);

// Dejamos que MikoPBX caché el contact + qualify exitoso antes de marcar.
await callee.page.waitForTimeout(4000);

console.log("[debug] preparando caller", CALLER_USER);
const caller = await newAgent("caller", CALLER_USER);

// Tras 4s, el caller marca.
await caller.page.waitForTimeout(4000);

console.log("[debug] caller marca", TARGET);
const dialInput = caller.page.locator('input[placeholder*="marc"], input[name*="dial"], input[aria-label*="númer"]').first();
if (await dialInput.count()) {
  await dialInput.fill(TARGET);
  await caller.page.locator('button:has-text("Llamar"), button:has-text("Marcar"), button[aria-label*="Llamar"]').first().click({ timeout: 3000 }).catch(() => {});
}

await caller.page.screenshot({ path: join(OUT_DIR, "screenshots", "caller-04-dialing.png"), fullPage: true });
await callee.page.waitForTimeout(2500);
await callee.page.screenshot({ path: join(OUT_DIR, "screenshots", "callee-04-ringing.png"), fullPage: true });

// Si el callee tiene un botón "Contestar" / "Accept", clickearlo.
const acceptBtn = callee.page.locator('button:has-text("Contestar"), button:has-text("Aceptar"), button[aria-label*="Contestar"]').first();
if (await acceptBtn.count()) {
  log("console-callee.log", `${ts()} [debug] click Contestar`);
  await acceptBtn.click({ timeout: 3000 }).catch(() => {});
}

// Esperar hasta 20s a que la llamada se establezca o se caiga.
await caller.page.waitForTimeout(20_000);
await caller.page.screenshot({ path: join(OUT_DIR, "screenshots", "caller-05-final.png"), fullPage: true });
await callee.page.screenshot({ path: join(OUT_DIR, "screenshots", "callee-05-final.png"), fullPage: true });

await browser.close();
log("console-caller.log", `${ts()} [done]`);
log("console-callee.log", `${ts()} [done]`);
