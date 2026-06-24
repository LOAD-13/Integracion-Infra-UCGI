# Tests E2E del CRM (Playwright)

**HU asociada:** IUDCYGI-40 (HU-06.4) — Pirámide de pruebas E2E del lab UCGI.

## Suites

| Suite | Archivos | Necesita backend | Duración aproximada |
|---|---|---|---|
| **Estática** (default) | `smoke.spec.ts`, `login-form-render.spec.ts`, `accessibility.spec.ts` | No — corre contra `npm run preview` | 8-15 s |
| **Stack** (`@stack`) | (pendiente, base en `scripts/debug-crm-call.mjs`) | Sí — requiere `make up` previo | 30-60 s |

## Comandos

```bash
# Suite estática (CI verde sin backend):
cd services/crm-frontend
npm run test:e2e

# Reporte HTML después de la corrida:
npx playwright show-report ../../tests/e2e/.report

# Modo UI interactivo:
npx playwright test --ui

# Stack tests (requieren docker compose up):
make up   # desde repo root
cd services/crm-frontend
PLAYWRIGHT_BASE_URL=https://localhost npm run test:e2e -- --project=chromium-stack
```

## Estructura

- `playwright.config.ts` en `services/crm-frontend/` declara los projects (chromium-static + chromium-stack), webServer (npm run preview), reporters html+list.
- Los specs viven en `tests/e2e/` (raíz del repo) para que sean fácilmente referenciables desde docs y CI matrices.
- Cada spec arranca con `await page.goto("/")` y espera `networkidle` para que Vite haya hidratado el árbol React.

## Convenciones

- Selectors por **role + name** (semántica) antes de **data-testid** (acoplamiento).
- Cada spec es independiente — no compartir estado entre tests via globals.
- Para selectors localizables en varios idiomas, regex case-insensitive: `getByLabel(/usuario|email/i)`.
- Para suites stack: marcar con `@stack` en el title del test para que el CI las filtre.

## Hilos sueltos

- HU-09.x sumará un job CI que levanta el compose en docker-in-docker + corre la suite stack.
- HU-06.4.x sumará specs con login real + flujo agente1→agente2 (basado en `debug-crm-call.mjs`).
