# CRM Frontend (UCGI)

Aplicación React 18 + TypeScript + Vite + Tailwind + shadcn/ui que sirve el
panel del agente y el softphone WebRTC del laboratorio UCGI.

## Stack

| Capa | Pieza |
|---|---|
| Framework | React 18, react-router-dom v6 |
| Build | Vite 5 (TypeScript) |
| Estilos | Tailwind 3.4 + tokens shadcn/ui (Slate) |
| Componentes | shadcn/ui (Button, Input, Label, Card) sobre Radix UI |
| Iconos | lucide-react |
| Tests | Vitest 2 + @testing-library/react + jsdom |
| Lint | ESLint 9 (flat config) + typescript-eslint |
| Runtime contenedor | Nginx Alpine (puerto interno **3000**) |

## Scripts

```bash
npm install
npm run dev       # Vite dev server en :5173 con proxy /api → integration-api:8081
npm run build     # Producción → dist/
npm run preview   # Sirve dist/ en :3000 (mismo puerto que el contenedor)
npm test          # Vitest run
npm run lint
```

## Variables de entorno

Inyectadas al build (`VITE_*`):

| Var | Default | Descripción |
|---|---|---|
| `VITE_API_BASE_URL` | `/api` | Base del integration-api. Detrás de Nginx se queda en `/api`. |
| `VITE_SIP_WS_URL` | `wss://localhost:8089/ws` | URL del WebSocket SIP (MikoPBX). Para HU-04.2. |
| `VITE_SIP_DOMAIN` | `localhost` | Dominio SIP para sip.js. Para HU-04.2. |

Se configuran en `.env` (raíz del repo) y compose las pasa como `build args`
al Dockerfile.

## Endpoint que consume el login

`POST {API_BASE}/v1/auth/login` — implementado en `integration-api` (HU-03.5,
IUDCYGI-23). Response shape: `{ accessToken, tokenType, expiresIn, username,
role }`. El `accessToken` (JWT) se guarda solo en memoria (AuthProvider). Al
refrescar el navegador se vuelve a `/login`.

## Estructura

```
src/
  api/         Cliente HTTP tipado contra integration-api.
  auth/        Contexto + provider + hook useAuth.
  components/  shadcn/ui base components.
  lib/         Utilidades (cn helper).
  pages/       LoginPage, DashboardPage (rutas top-level).
  routes/      ProtectedRoute (guard de auth).
  sip/         (reservado para HU-04.2).
  tests/       Specs Vitest.
```

## Test plan (HU-04.1)

- `LoginPage.test.tsx` cubre:
  1. Render con labels accesibles asociados a los inputs.
  2. Happy path — submit con credenciales válidas → fetch POST `/v1/auth/login`
     → AuthProvider almacena la sesión → redirige al panel.
  3. 401 → muestra mensaje accesible con `role="alert"` y no redirige.
