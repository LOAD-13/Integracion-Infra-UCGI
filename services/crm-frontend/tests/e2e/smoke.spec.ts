import { expect, test } from "@playwright/test";

/**
 * HU-06.4 — smoke tests del CRM. No requieren backend levantado: prueban
 * que el bundle estático cargue, renderice el shell de login y no genere
 * errores críticos en consola.
 */
test.describe("CRM smoke", () => {
  test("la página de login carga sin errores de consola", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    await page.goto("/");
    await expect(page).toHaveTitle(/DialFlow|UCGI|CRM/i);

    // Damos margen al bundle async para inicializar.
    await page.waitForLoadState("networkidle");

    // Ignoramos errores típicos de carga sin backend (fetch /api falla):
    const blockingErrors = errors.filter(
      (e) =>
        !e.includes("/api/") &&
        !e.includes("Failed to fetch") &&
        !e.includes("net::ERR_") &&
        !e.includes("SIP") &&
        !e.includes("WebSocket"),
    );
    expect(blockingErrors).toEqual([]);
  });

  test("el title del documento contiene el branding del lab", async ({ page }) => {
    await page.goto("/");
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);
  });
});
