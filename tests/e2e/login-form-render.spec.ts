import { expect, test } from "@playwright/test";

/**
 * HU-06.4 — valida que el form de login del DialFlow renderice todos sus
 * elementos críticos sin necesitar backend. Si el rediseño rompiera alguno
 * de estos selectores, este spec lo atrapa antes del merge.
 */
test.describe("Login form render", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
  });

  test("input de usuario está presente y editable", async ({ page }) => {
    const userInput = page.getByLabel(/usuario|email|user/i).first();
    await expect(userInput).toBeVisible();
    await userInput.fill("agente1");
    await expect(userInput).toHaveValue("agente1");
  });

  test("input de password es type=password", async ({ page }) => {
    const passwordInput = page.getByLabel(/contrase|password/i).first();
    await expect(passwordInput).toBeVisible();
    await expect(passwordInput).toHaveAttribute("type", "password");
  });

  test("botón de submit está visible y habilitado al llenar el form", async ({ page }) => {
    await page.getByLabel(/usuario|email|user/i).first().fill("agente1");
    await page.getByLabel(/contrase|password/i).first().fill("demo1234");

    const submit = page
      .getByRole("button", { name: /entrar|iniciar|login|ingresar/i })
      .first();
    await expect(submit).toBeVisible();
    await expect(submit).toBeEnabled();
  });
});
