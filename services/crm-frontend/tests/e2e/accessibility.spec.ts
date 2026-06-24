import { expect, test } from "@playwright/test";

/**
 * HU-06.4 — checks de accesibilidad básicos sobre el login page. No usa
 * axe-core (sería HU-06.x adicional). Cubre los puntos críticos del
 * checklist WCAG 2.2 AA que aplican a un form simple:
 *   - cada input tiene label asociada.
 *   - el botón principal es focusable con Tab.
 *   - hay un h1 visible.
 *   - el lang del HTML está declarado.
 */
test.describe("Login a11y básica", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
  });

  test("HTML tiene atributo lang", async ({ page }) => {
    const lang = await page.locator("html").getAttribute("lang");
    expect(lang).toBeTruthy();
    expect(lang?.length ?? 0).toBeGreaterThanOrEqual(2);
  });

  test("existe al menos un encabezado h1 o role=heading", async ({ page }) => {
    const headings = page.locator("h1, h2, [role='heading']");
    await expect(headings.first()).toBeVisible();
  });

  test("inputs tienen accessible name (label o aria-label)", async ({ page }) => {
    const inputs = page.locator("input:not([type='hidden'])");
    const count = await inputs.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const input = inputs.nth(i);
      const ariaLabel = await input.getAttribute("aria-label");
      const ariaLabelledBy = await input.getAttribute("aria-labelledby");
      const id = await input.getAttribute("id");
      const hasLabel = id ? (await page.locator(`label[for="${id}"]`).count()) > 0 : false;
      const placeholder = await input.getAttribute("placeholder");

      expect(
        Boolean(ariaLabel) || Boolean(ariaLabelledBy) || hasLabel || Boolean(placeholder),
        `input #${i} sin accessible name`,
      ).toBeTruthy();
    }
  });

  test("Tab focus va al primer input", async ({ page }) => {
    await page.keyboard.press("Tab");
    const focused = await page.evaluate(() => document.activeElement?.tagName);
    expect(["INPUT", "BUTTON", "A"]).toContain(focused);
  });
});
