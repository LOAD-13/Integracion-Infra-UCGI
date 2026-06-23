# DialFlow CRM — Design System extraído del prototipo

Fuente: `dialflow-crm-frontend/project/DialFlow CRM.dc.html` (1390 líneas, Claude Design HTML/CSS/JS DSL con `sc-if`/`sc-for`/`{{ }}`).
Objetivo: implementar en **React 18 + Tailwind 3.4 + shadcn/ui + lucide-react** dentro de `services/crm-frontend/`. NO copiar el DSL; copiar el **resultado visual**.

Brand assets ya copiados aquí: `dialflow-icon.png`, `dialflow-logo.png`, `dialflow-logo-trim.png`.

---

## 1. Tokens (CSS vars)

Definidos en el `.df-root` del prototipo. Tema **claro únicamente** — el dark mode se descartó explícitamente en la sesión (Joaquín ya lo había quitado en Claude Design). NO implementar variantes `dark:` en Tailwind.

```css
/* Superficies + texto */
--bg: #e8edf3;            /* fondo de la app fuera de cards */
--surface: #ffffff;       /* cards, headers, panels */
--surface-2: #f4f7fb;     /* hover suave, inputs, chips secundarios */
--surface-3: #e9eef5;     /* skeletons, tracks */
--border: #e1e7f0;        /* divisores normales */
--border-strong: #cdd7e4; /* contornos de popovers / modales */
--text: #13243a;          /* texto principal */
--text-muted: #5a6b81;    /* texto secundario, labels */
--text-dim: #8a98ab;      /* placeholders, captions, tiempos */

/* Rail (sidebar navy) */
--rail-grad: linear-gradient(185deg, #0e2c50 0%, #0a1f3a 100%);
--rail-line: rgba(255,255,255,.09);
--rail-text: #a9b9cf;
--rail-strong: #ffffff;

/* Navy (botón primario, links activos) */
--navy: #0f3056;
--navy-soft: rgba(15,48,86,.08);

/* Brand cyan (acento, links de marca, foco) */
--brand: #15a8c8;
--brand-bright: #28c2e2;       /* hover/light accents */
--brand-ink: #0c7c97;           /* texto sobre brand-soft */
--brand-soft: rgba(21,168,200,.13);

/* Call / Hang (CTA telefónicos) */
--accent-call: #16a34a;
--accent-call-soft: rgba(22,163,74,.13);
--accent-hang: #e23b54;
--accent-hang-soft: rgba(226,59,84,.11);

/* Estados de agente */
--st-available: #16a34a;   /* verde Disponible */
--st-break:     #e0930b;   /* ámbar En descanso */
--st-busy:      #ef6c2e;   /* naranja Ocupado / post-llamada */
--st-dnd:       #e23b54;   /* rojo No molestar */
--st-offline:   #94a3b8;   /* gris Desconectado */

/* Sombras y foco */
--shadow: 0 14px 40px rgba(13,37,66,.16);
--ring:   rgba(21,168,200,.42);

/* Layout */
--side-w: 248px;   /* expandido */
/* .df-collapsed { --side-w: 74px; } */
```

**Mapeo a `index.css` shadcn (HSL):** generar las CSS vars `--primary`, `--primary-foreground`, `--background`, etc. usando estos valores. Sugerencia:
- `--background` ← `#e8edf3` / `--foreground` ← `#13243a`
- `--primary` (CTA navy) ← `#0f3056`
- `--accent` (brand cyan) ← `#15a8c8`
- `--destructive` ← `#e23b54`
- Conservar las extra: `--accent-call`, `--accent-hang`, `--st-*` como tokens custom en `tailwind.config.ts` bajo `theme.extend.colors`.

---

## 2. Tipografía

3 familias cargadas desde Google Fonts:

```html
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Hanken+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
```

| Rol | Familia | Uso |
|---|---|---|
| Display | **Space Grotesk** (500/600/700) | Títulos de página, headers de cards, KPI values grandes, brand "DialFlow". Clase `.ff-display`. |
| Body | **Hanken Grotesk** (400/500/600/700) | Default de toda la app. `body { font-family: 'Hanken Grotesk', system-ui, sans-serif; }` |
| Mono | **JetBrains Mono** (400/500/600) | Teléfonos, números, IDs, kbd, contadores de llamada, ⌘K. Clase `.ff-mono`. |

**Escala tipográfica observada:**

| Token | px | Uso típico |
|---|---|---|
| caption | 9.5–11 | letter-spacing tracking, labels uppercase, kbd, ejes de chart |
| small  | 11–12 | texto secundario, dim, hints |
| body   | 13–14 (default 14) | texto normal, inputs |
| label  | 12 / weight 700 + uppercase + tracking .4–.5 | labels de form, headers de tabla |
| heading sm | 14.5–16 | títulos de card, modal headers |
| heading md | 18–19 | titulo de página (header) |
| display lg | 23–33 | KPI values (28–32), login hero (33) |

`letter-spacing`: títulos display `-.3px` a `-.6px` (apretado); labels uppercase `+.4px` a `+1.5px` (espaciado). `line-height: 1.45` body, `1.16–1.3` títulos.

---

## 3. Componentes reusables

Para cada uno: nombre React sugerido, descripción, props mínimas, tokens. **No** se reproduce código React aquí — es spec para implementar.

### 3.1 `<AppShell>`
Layout maestro: rail izquierdo + main column (header + main scroll) + softphone dock abajo. Toda página autenticada usa este wrapper.

**Estructura:**
```
+----------------------------------------------+
| <Sidebar/>     | <Header/>                    |
|                | <Main scrollable>            |
|   (rail)       |   {children}                 |
|                |                              |
|----------------+------------------------------|
| <SoftphoneDock/> (full width, sticky bottom)  |
+----------------------------------------------+
```

Tokens: `--bg`, `--surface`, `--border`.

### 3.2 `<Sidebar>` (navy rail)
- Ancho 248px expandido, 74px colapsado, transición .16s.
- 3 zonas verticales: brand (64px, logo+texto), nav scrollable (items con icono+label+badge+barrita activa), footer (StatusSelector + UserChip + LogoutButton).
- Item activo: `background: rgba(255,255,255,.1)`, `color: #fff`, `box-shadow: inset 3px 0 0 var(--brand-bright)` (barrita cyan izquierda), icono en `var(--brand-bright)`.
- Item inactivo: fondo transparente, hover `rgba(255,255,255,.07)`, color `var(--rail-text)`, icono `var(--rail-text)`.
- Sección label "OPERACIÓN": tracking 1.5, opacity .7, padding 8px 12px.
- Badge: pill `rgba(255,255,255,.12)` color `--rail-strong`, mono 11px, padding 1px 8px, border-radius 20px.

**Props:** `items: NavItem[]` (label, icon, to, badge?), `collapsed`, `onToggleCollapse`, `currentPath`, `agentStatus` (para el chip), `user`, `onLogout`, `onChangeStatus`.

### 3.3 `<Header>`
Altura 64px, `background: var(--surface)`, `border-bottom: 1px solid var(--border)`, padding 0 22px.

Contenido (de izquierda a derecha):
1. **Botón toggle sidebar** — 34×34, border 1px var(--border), icon Menu (lucide), hover bg surface-2.
2. **Breadcrumb + Title** — dos líneas: breadcrumb 11px `var(--text-dim)` font-weight 600, título 18px Space Grotesk 700 letter-spacing -.3.
3. **Search trigger** (⌘K) — margin-left auto, 38px alto, min-width 250px, `background: var(--surface-2)`, border 1px var(--border), border-radius 10px. Contenido: lucide Search 16px + "Buscar cliente, acción…" + kbd "⌘K".
4. **Notif button** — 38×38 cuadrado mismo estilo, lucide Bell, badge: dot 7×7 `var(--accent-hang)` con border 1.5px `var(--surface)` en top:8 right:9 cuando hay nuevas.
5. **Role switch** — 38px alto, padding 0 13px, lucide ArrowLeftRight 15px + label "Agente"/"Administrador". *Mantener este toggle: el profe pidió que el admin pueda ver y cambiar.*

### 3.4 `<KpiCard>` (dashboard + metrics)
```
border: 1px solid var(--border)
border-radius: 14px
background: var(--surface)
padding: 17px 18px
gap: 11px
shadow: 0 1px 2px rgba(13,37,66,.04)
```
Estructura:
- Row 1: label (12.5px muted weight 600) + icon-chip (32×32, border-radius 9px, `background: var(--navy-soft)`, `color: var(--navy)`).
- Row 2: value 30px Space Grotesk 700 letter-spacing -.5 line-height 1.
- Row 3: delta 12px weight 600 con color contextual (`var(--accent-call)` si positivo, `var(--text-muted)` si neutro, `var(--accent-hang)` si negativo).

### 3.5 `<CardPanel>` (panel con header + contenido)
Card raíz: `background: var(--surface)`, `border: 1px solid var(--border)`, `border-radius: 16px`, `shadow: 0 1px 2px rgba(13,37,66,.04)`, `overflow: hidden`.

Header: padding 16px 18px, border-bottom 1px var(--border), display flex justify-between align-center. Lado izquierdo:
- **Barrita brand** vertical 4×18 border-radius 4px `var(--brand)`.
- **Título** Space Grotesk 15px weight 700.
- Chip opcional (count, status) mono 12px border-radius 20px padding 2px 9px.

Lado derecho: indicador "En vivo" — dot 8×8 verde con `animation: df-pulse 1.6s infinite` + label 12px muted 600.

### 3.6 `<DataTable>` con skeleton + empty state
Wrapper: card 14px radius, surface, border, shadow sutil, overflow hidden.

**Header de tabla:** grid columns dinámicas, padding 12px 18px, border-bottom border, font 11px weight 700 letter-spacing .5 uppercase color `var(--text-dim)`.

**Row:** mismo grid, padding 12-13px 18px, border-bottom border, align-items center, hover `background: var(--surface-2)`, cursor pointer.

**Skeleton row:** mismo layout pero hijos `.df-skel` (linear-gradient + animation `df-shimmer 1.25s infinite linear`). Implementar como `<Skeleton />` shadcn con keyframes equivalentes.

**Empty state:** padding 56px 20px, centrado, gap 13px, ícono cuadrado 64×64 border-radius 18px `var(--surface-2)`, lucide search/inbox dim, título Space Grotesk 15 700, descripción 13 muted max-width 320.

### 3.7 Botones — variantes

| Variante | Background | Color | Hover | Uso |
|---|---|---|---|---|
| `primary-navy` | `var(--navy)` | `#fff` | `filter: brightness(1.12)` | CTA principal: "Crear", "Ingresar", "Guardar" |
| `secondary` | `var(--surface-2)` border 1px `var(--border)` | `var(--text-muted)` o `var(--text)` | border-color `var(--border-strong)` o `var(--brand)` | Acciones secundarias, toggle, search trigger |
| `call` | `var(--accent-call)` | `#fff` | `filter: brightness(1.06)` | "Tomar", "Llamar", "Contestar", "Marcar" |
| `hang` | `var(--accent-hang)` | `#fff` | `filter: brightness(1.06)` | "Colgar", "Rechazar", "Finalizar" |
| `outline-brand` | `var(--brand-soft)` border 1px `var(--brand)` | `var(--brand-ink)` | mantener | "Cambiar a videollamada", chips activos |
| `ghost` | transparent | `var(--text-muted)` | `color: var(--text)` | Links de "Volver", "Marcar leídas" |
| `icon-square` | surface-2 + border | text-muted | border-color border-strong | 34×34 a 46×46, border-radius 9–12px |
| `icon-round` (video overlay) | rgba(255,255,255,.1) sobre dark | `#dce6f2` | rgba(.18) | 52×52 border-radius 50% — solo en overlays oscuros |

Altura estándar: 40px form, 38px header, 46–48px softphone dock activo. Border-radius 9–12px en botones normales, 26px+ en pills.

### 3.8 `<Input>` + `<Label>`
- **Label:** uppercase opcional (`font-size: 12, weight: 700, color: var(--text-muted)`). En forms verticales no uppercase; en data display sí (`text-transform: uppercase; letter-spacing: .4px`).
- **Input:** `height: 40-44px`, `border: 1px solid var(--border)`, `border-radius: 10-11px`, `background: var(--surface-2)`, `color: var(--text)`, `padding: 0 13-14px`, `outline: none`.
- **Focus:** `border-color: var(--brand); box-shadow: 0 0 0 3px var(--ring)`.
- **Textarea:** mismo estilo, `padding: 14px 15px`, `line-height: 1.6`, `resize: vertical`.

### 3.9 `<Chip>` / `<Badge>`
- **Tag de cliente** (`VIP`, `Moroso`, `Nuevo`, etc.): `font-size: 11, weight: 700, border-radius: 6, padding: 2px 8-9px`. Colores definidos en código del prototipo:

```ts
const TAG = {
  VIP:         { bg: 'rgba(224,147,11,.15)', color: '#b9760a' },
  Moroso:      { bg: 'rgba(226,59,84,.13)',  color: '#c4243c' },
  Nuevo:       { bg: 'rgba(21,168,200,.14)', color: '#0c7c97' },
  Reincidente: { bg: 'rgba(124,58,237,.13)', color: '#7338c4' },
  Empresa:     { bg: 'rgba(15,48,86,.1)',    color: '#0f3056' },
  Soporte:     { bg: 'rgba(22,163,74,.13)',  color: '#15803d' },
};
```

- **Outcome badge** (Resuelto / No contestó / Escalado / Venta cerrada / Retornar): mismas reglas, colores:
  - Resuelto: `bg rgba(22,163,74,.13) / color #15803d`
  - No contestó: `bg rgba(148,163,184,.18) / color #647488`
  - Escalado: `bg rgba(224,147,11,.15) / color #b9760a`
  - Venta cerrada: `bg rgba(21,168,200,.14) / color #0c7c97`
  - Retornar: `bg rgba(124,58,237,.13) / color #7338c4`

- **Status dot + label:** dot 8×8 border-radius 50% + texto 12.5 weight 600 muted. Colores `--st-*`.

- **Pill mono** (queue count, ext number): pill `--accent-hang-soft` con color `--accent-hang`, font mono 12 weight 600 border-radius 20.

### 3.10 `<UserAvatar>`
Círculo border-radius 50%, tamaños 30/34/38/50/60/74 según contexto. Background es uno de 7 gradientes `linear-gradient(140deg, ...)` definidos en `AV`:

```ts
const AV = [
  'linear-gradient(140deg,#0f3056,#28c2e2)',
  'linear-gradient(140deg,#5b32c9,#a371f5)',
  'linear-gradient(140deg,#0c6f86,#22c5dd)',
  'linear-gradient(140deg,#9a6206,#e0930b)',
  'linear-gradient(140deg,#8a1238,#e2516f)',
  'linear-gradient(140deg,#136a35,#3fb968)',
  'linear-gradient(140deg,#16386a,#4f87d6)',
];
```

Contenido: iniciales (primeras 2 palabras del nombre, mayúsculas) en blanco, peso 700, tamaño proporcional (12.5 a 26 según diámetro). Sin foto real.

### 3.11 `<SoftphoneDock>` (componente clave)
Sticky bottom, `border-top: 1px solid var(--border)`, `background: var(--surface)`, `box-shadow: 0 -6px 24px rgba(13,37,66,.07)`. **3 estados visuales:**

**Estado A — `idle` (64px):**
- Lado izquierdo: icon-chip 34×34 `var(--navy-soft)` con lucide Headphones + "Softphone" + status row "Registrado · ext. 4021" con dot verde 7×7.
- Lado derecho (margin-left auto): botón secondary "Simular entrante" (lucide PhoneIncoming verde) + botón call "Marcar" (lucide Smartphone).

**Estado B — `ringing-incoming` (96px):**
- Background: `linear-gradient(90deg, var(--accent-call-soft), transparent)`.
- Avatar 54×54 con animation `df-ring 1.3s infinite`.
- Label "LLAMADA ENTRANTE" 12px weight 700 `var(--accent-call)` letter-spacing .5 con dot pulse.
- Nombre Space Grotesk 18 700.
- mono number + reason 12.5.
- Botones: "Rechazar" (hang, 48px) y "Contestar" (call, 48px con `box-shadow: 0 0 0 4px var(--accent-call-soft)`).

**Estado C — `established` o `ringing-outgoing` (96px):**
- Avatar 50×50.
- Phase label (LLAMANDO… / EN LLAMADA / EN ESPERA / VIDEOLLAMADA) 11px 700 color dinámico + nombre 16 + número mono.
- Timer: bloque con bordes laterales `1px var(--border)`, padding 0 16px, height 50, contenido = dot pulse 9×9 + mono 22px weight 600 letter-spacing 1.
- Controles (margin-left auto): mute / hold / video / transfer / Panel button / Colgar. Cuadrados 46×46 border-radius 12, último "Colgar" 46px alto x ancho variable con texto.
- **Estado activo de toggle (mute/hold/video):**
  - Mute on: bg `var(--accent-hang-soft)`, color `var(--accent-hang)`, border `var(--accent-hang)`.
  - Hold on: bg `rgba(224,147,11,.14)`, color `var(--st-break)`, border `var(--st-break)`.
  - Video on: bg `var(--brand-soft)`, color `var(--brand-ink)`, border `var(--brand)`.

### 3.12 `<VideoCallOverlay>`
Modal full-screen z-index 55 con backdrop `rgba(6,14,26,.78)`. Card central 980×600 (max 94vw / 88vh), `background: #0a1626`, border `#1c2c44`, border-radius 20, shadow 0 30px 80px rgba(0,0,0,.6).

Estructura: top bar absolute (badge "EN VIDEOLLAMADA" `#e23b54` con pulse + timer mono pill + minimize button) → stage radial gradient `var(--activeCall.glow)` con avatar 120×120 + name + status → PiP self bottom-right 168×112 border-radius 13 con cámara/off → control bar `#08121f` con mic / cam / share-screen / volume slider / Finalizar (round 52×52 los toggles, pill ancho el end-call).

### 3.13 `<DialerSheet>` (right drawer 360px)
Slide-in con `animation: df-slidein .2s ease-out`. Backdrop `rgba(8,18,32,.45)` z-40, drawer z-41.
- Header: "Marcador" + close button.
- Display: caja 58px border-radius 13 surface-2, mono 25 weight 600 letter-spacing 1.
- Grid 3×4 botones (1-9, *, 0, #) — botones 62px alto border-radius 15 surface-2, número mono 23 + sub-letras 9px tracking 1.5.
- Footer: botón call "Llamar" full-width 56 + botón backspace cuadrado 56×56 con lucide Delete.

### 3.14 `<ActiveCallPanel>` (right drawer 420px)
Backdrop z-42, drawer z-43. Aparece sobre el softphone para gestionar la llamada en curso.

- Header: badge "LLAMADA EN CURSO · 02:14" mono + close.
- Body scrollable: avatar 60×60 + nombre + número + tags · botón "Cambiar a videollamada" (outline-brand) · si matched: stats grid 2col (último contacto + cantidad llamadas) + botón "Abrir ficha del cliente" · si NO matched: botón dashed brand "Crear cliente con este número" · notas rápidas textarea · etiquetar resultado (chips outcome).
- Footer: mute + hold + Colgar (call).

### 3.15 `<StatusMenu>` (popover desde sidebar)
Position fixed left:14px bottom:100px, width 238, surface card border-radius 13, padding 7, shadow. Items: row 9px 11px gap 11, dot 10×10 + label 13 weight 600.

### 3.16 `<CommandPalette>` (⌘K)
Backdrop centered top, modal 560 width, surface, border-radius 15. Header: search 19px lucide + input 15px + kbd "ESC". Body: scrollable max-height 50vh, padding 8, agrupado en secciones ("Acciones", "Clientes") con título uppercase 10.5 tracking 1.

Atajo: `⌘K` / `Ctrl+K` toggle; `Escape` cierra. Implementar con shadcn `command`.

### 3.17 `<NewClientDialog>` / `<NewUserDialog>` (modales centrados)
Width 460–480, border-radius 15, max-width 92vw, shadow. Header con título Space Grotesk 16 700 + subtítulo 12.5 dim. Body con form 2col / 1col según campo. Footer derecha: "Cancelar" (secondary) + CTA "Crear" (primary-navy).

Tag selector: chips toggleables (background del TAG cuando sel, surface-2 cuando no sel, border-color transparent vs border).

### 3.18 `<NotificationsPopover>`
Top-right (`top:62 right:118`), width 344, surface card border-radius 14. Header "Notificaciones" + "Marcar leídas" link brand-ink. Lista max-height 340 scrollable, items con icon-chip 32×32 con bg/color contextual + título 13 weight 600 + tiempo 11.5 dim.

### 3.19 `<Toast>` (Sonner)
Position bottom-right, gap 10. Card surface border-radius 12 con `border-left: 3px solid {accent}` (accent-call / brand / st-break / accent-hang según kind). Animation slidein.

### 3.20 `<QueueItem>` (cola de llamadas)
Row padding 13px 18px, border-bottom. De izquierda a derecha: barra prio 4×38 border-radius 4 color por prioridad → avatar surface-2 borde con iniciales → nombre 13.5 700 + mono `number · reason` 12 dim → "en cola" 11 dim + tiempo mono 13 600 (rojo si > 90s) → botón call "Tomar" 8×14 padding.

### 3.21 `<ActivityItem>`
Padding 11 17, border-bottom, icon-chip 30×30 border-radius 9 con bg/color contextual + texto 13 600 + tiempo 11.5 dim + meta mono 12 muted alineado derecha.

### 3.22 `<MetricsBars>` y `<HourLineChart>`
Recharts es el target. Bars verticales agrupadas (entrante brand cyan + saliente navy stacked), line chart con gradiente area + stroke 2.5 brand.

---

## 4. Layouts

### 4.1 App Shell
`display: flex; height: 100vh; flex-direction: column; overflow: hidden`. Top row `flex: 1, display:flex`: Sidebar (fixed width var(--side-w)) + Main (flex: 1, flex-direction: column). Footer: SoftphoneDock (flex: none).

Main: Header 64px + main scroll `padding: 26px 32px`.

### 4.2 Dashboard
- Top: grid `repeat(4, 1fr)` gap 16 → 4 KpiCards.
- Bottom: grid `1.4fr 1fr` gap 20 align-items start → Cola de llamadas (CardPanel + lista QueueItem) | columna derecha: Acciones rápidas (CardPanel + grid `1fr 1fr` 4 botones-card) + Actividad reciente (CardPanel + lista ActivityItem).

### 4.3 Clientes (lista)
- Top row: search input (flex 1, min-width 240) + grupo filtros (4 botones segmented) + botón primary-navy "Nuevo cliente". Gap 12 wrap.
- Tabla: header grid `2.2fr 1.5fr 1.6fr 1fr 110px` → rows mismo grid (Cliente avatar+name+email | Phone mono | Tags chips | Status dot+label | Last contact derecha).
- Footer: "Mostrando X de Y" + paginador inline.

### 4.4 Client Detail
- Botón "Volver a clientes" link ghost arriba.
- Grid `312px 1fr` gap 20 align-items start: panel perfil izquierdo (avatar grande + nombre + company + tags + botones Llamar/Video + lista fields icon+label+value) | tabs container (header tabs Datos/Historial/Notas con indicador brand + content por tab).

### 4.5 Métricas
- Top: grid 4 KpiCard.
- Mid: grid `1.5fr 1fr` → bars chart (días) + outcome bars verticales.
- Bottom: hour line chart full width.

### 4.6 Admin (usuarios)
- Top: 3 stat-cards 13px 18px padding + botón "Crear usuario" primary-navy.
- Tabla grid `2fr 1.4fr 1fr 1fr 100px` (Usuario | Email | Rol chip | Status | Acciones).

---

## 5. Animaciones / microinteracciones

```css
@keyframes df-pulse   { 0%,100%{opacity:1} 50%{opacity:.35} }
@keyframes df-ring    { 0%{transform:scale(1)} 50%{transform:scale(1.05)} 100%{transform:scale(1)} }
@keyframes df-fade    { from{opacity:0} to{opacity:1} }
@keyframes df-in      { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
@keyframes df-slidein { from{transform:translateX(110%)} to{transform:translateX(0)} }
@keyframes df-pop     { from{opacity:0;transform:scale(.96)} to{opacity:1;transform:scale(1)} }
@keyframes df-shimmer { 0%{background-position:-460px 0} 100%{background-position:460px 0} }
```

| Uso | Animation | Duración |
|---|---|---|
| Dot "En vivo" / "EN LLAMADA" | `df-pulse` infinite | 1.4–2.4s |
| Avatar ringing incoming | `df-ring` infinite | 1.3s |
| Fade in de páginas / overlays | `df-fade` | .12–.2s |
| Modal/popover pop-in | `df-in` / `df-pop` | .15–.2s |
| Drawer right (Dialer, ActiveCallPanel) | `df-slidein` | .2s |
| Skeletons | `df-shimmer` | 1.25s |
| Toggle sidebar | `width .16s ease-out` | — |

Transiciones generales: `.1s` para hover de rows, `.12s–.16s` para borders, `.15–.2s` ease-out para entradas. **Sin bouncy, sin animaciones largas.**

---

## 6. Pantallas existentes en el prototipo (`sc-if`)

7 vistas full-page + 9 overlays/modales:

| # | Variable | Vista | Componentes que usa |
|---|---|---|---|
| 1 | `isLogin` | Login con globo Three.js + form | branding, Input, primary-navy button, demo hint card |
| 2 | `isAuthed` | wrapper de todas las demás (AppShell) | Sidebar, Header, Main, SoftphoneDock |
| 3 | `isDashboard` | Workspace del agente | KpiCard×4, CardPanel(Cola)+QueueItem×N, CardPanel(Acciones)+4 botones-card, CardPanel(Actividad)+ActivityItem×N |
| 4 | `isClients` | Lista paginada con search/filtros | Search input, segmented filters, primary-navy CTA, DataTable + skeleton + empty |
| 5 | `isClientDetail` | Ficha con sidebar perfil + tabs | UserAvatar grande, tags, Botones Llamar/Video, fields list, Tabs (Datos grid pairs / Historial CDR rows / Notas textarea autosave) |
| 6 | `isMetrics` | KPIs + 3 charts | KpiCard×4, bars stacked (in/out), outcome bars horizontales, hour line chart |
| 7 | `isAdmin` | Gestión de usuarios | stat-cards×3, primary-navy "Crear usuario", DataTable users |

**Overlays/Modales (z-index distintos):**
| # | Variable | Tipo | Contenido |
|---|---|---|---|
| O1 | `dockIdle/dockIncoming/dockActive` | Estados del SoftphoneDock | (ver §3.11) |
| O2 | `videoOverlayOpen` | Full-screen modal | VideoCallOverlay |
| O3 | `dialerOpen` | Right drawer 360 | DialerSheet |
| O4 | `activePanelOpen` | Right drawer 420 | ActiveCallPanel |
| O5 | `statusMenuOpen` | Popover sobre sidebar | StatusMenu |
| O6 | `commandOpen` | Centered modal | CommandPalette ⌘K |
| O7 | `newUserOpen` | Centered modal 460 | NewUserDialog |
| O8 | `notifOpen` | Top-right popover | NotificationsPopover |
| O9 | `newClientOpen` | Centered modal 480 | NewClientDialog (con tags toggle, status segmented) |
| O10 | `toasts[]` | Bottom-right stack | Toasts variantes ok/info/warn/end |

---

## 7. Pantallas FALTANTES (a diseñar con el mismo lenguaje)

Basadas en el audio del profe (Clase Rene.txt) y la memoria `project_rene_clase_2026_06_22.md`. Todas se construyen sobre AppShell + Header + ComponentesReusables del §3 — NO requieren tokens nuevos.

### 7.1 `AdminSkillsPage` (Habilidades / Routing por skill)
- Top row idéntica a Clientes: search "Buscar skill…" + filtros + botón primary-navy "Nueva skill".
- DataTable con columnas `Nombre | Estrategia (todos-a-mi / round-robin / longest-idle / least-busy) | Agentes asignados (avatars stack +N) | Llamadas en cola actual (mono) | Tiempo prom. espera (mono color condicional) | Acciones`.
- Click en row abre detalle con 2 secciones: "Agentes" (grid de UserAvatar + nombre + toggle) y "Configuración" (form con estrategia + max wait + overflow skill).
- Modal `NewSkillDialog` (mismo estilo NewUserDialog): name + descripción + estrategia (segmented 4 botones) + checkboxes de agentes.

### 7.2 `AdminSipExtensionsPage` (CRUD extensiones SIP)
- Top: 3 stat-cards (Total / Registradas / No registradas — mismo estilo Admin actual) + botón "Nueva extensión".
- DataTable `Ext (mono) | Usuario asignado (avatar+nombre) | Estado registro (dot+label OK/Unreg/Pending) | Codecs negociados (chip mono "opus/ulaw") | manualattributes (chip "default"/"custom") | Acciones`.
- Modal `NewExtensionDialog`: ext (mono input) + assign user (select) + secret (input password generado, copiable) + transport (segmented WSS / UDP) + advanced collapse con webrtc=yes / use_avpf / ice_support / media_encryption (todos toggles ON por default).
- Esto reemplaza progresivamente al `SipExtensionBootstrapper`.

### 7.3 `AdminInboundRoutingPage` (Distribución entrante)
- Lista de "Reglas de entrada": cards arrastrables verticalmente (orden = prioridad).
- Cada card: row con DID/Trunk source (mono) → flecha → Skill destino (chip de marca con icono Skills) → horario (chip "Lun-Vie 09-18" o "24/7") → toggle activo + drag handle + edit/delete icon-square.
- Header: "Reglas de entrada" + botón "Nueva regla".
- Modal `NewInboundRuleDialog`: DID (mono input "+54 9 11 ...") + Skill destino (select con buscador) + Horario (segmented 24/7 / horario laboral / custom con time pickers) + Plan B si no hay agentes (select: voicemail / overflow skill / colgar).

### 7.4 `AdminParkingPage` (Zona de parqueo / IVR)
- 1 card "Configuración general": form con campos `Tiempo en bucle (segundos, default 120)` `Locución inicial (file picker + preview)` `Música de espera (file picker + preview)` `Volumen (range)`.
- 1 CardPanel "Menú post-timeout": header con barrita brand + título "Después de 120s ofrecer…". Cuerpo: lista editable de opciones IVR — DTMF key (mono) + label + acción (devolución de llamada / esperar / colgar / transferir a skill).
- Botón "Probar IVR" (secondary) que genera link de testing y "Guardar" (primary-navy).

### 7.5 `AgentCampaignsPage` (Campañas outbound del agente)
- Top: 3 KpiCard del turno: "Llamadas realizadas / Conectadas / Pendientes en cola".
- Selector de modo: 3 cards horizontales **grandes** (cada una ~280×140 surface-2 border + radius 14 cursor) — al click, ese modo se activa, queda con border `var(--brand)` + bg `var(--brand-soft)`. Las opciones:
  - **Manual** — icon-chip + título "Manual" + sub "Outbound + devolución, sin BD".
  - **Progresiva** — icon-chip + título + sub "Con carga de contactos, dispara 1 a 1".
  - **Predictiva** — icon-chip + título + sub "Algoritmo TMO; dispara N llamadas según historial".
- Cuando hay modo activo, debajo aparece:
  - **Manual**: dialer prominente (mismo DialerSheet pero inline) + last 5 dialed list.
  - **Progresiva**: tabla de contactos cargados (avatar+nombre+phone+last attempt+status) + botón "Siguiente contacto" CTA call que dispara via softphone.
  - **Predictiva**: tabla campaign overview + métricas en tiempo real (TMO actual / llamadas disparadas / abandonment rate) + toggle Start/Stop. Datos vienen del backend.
- **No mostrar** "Predictiva" si el rol no tiene permiso (el admin lo habilita).

### 7.6 CTI cliente automático al conectar
- Cuando `callState === 'established'` y el número matchea cliente, abrir `ActiveCallPanel` (ya existe) automáticamente — eso ya lo hace el prototipo. **Lo nuevo**: cuando NO hay match y el número es desconocido, además del botón "Crear cliente con este número", mostrar bloque "Sugerencias del CRM" con últimas N llamadas del mismo prefijo (heurística simple en backend) — opcional, si llegamos.

---

## 8. Mapeo prototipo → React actual

| Prototipo (`sc-if`) | Página React actual | Acción |
|---|---|---|
| `isLogin` | `src/pages/LoginPage.tsx` | **REDISEÑAR** — split layout con globo Three.js (lazy load) + form. Mantener auth real con bcrypt. |
| `isAuthed` shell | `src/App.tsx` + nuevo `src/layouts/AppShell.tsx` | **CREAR** AppShell que envuelve `<Outlet />`. Mover el routing actual a usar layout. |
| `isDashboard` | `src/pages/DashboardPage.tsx` | **REDISEÑAR COMPLETO** — hoy es plano (sólo KPIs); agregar Cola entrantes + Acciones rápidas + Actividad reciente. Datos mock por ahora (queue endpoint en backlog). |
| `isClients` | `src/pages/ClientsPage.tsx` | **REDISEÑAR** — mantener debounce 300ms + filtros + URL sync. Adoptar look. |
| `isClientDetail` | `src/pages/ClientDetailPage.tsx` | **REDISEÑAR** — adoptar split 312px + tabs (Datos / Historial / Notas). Notas autosave 5s ya existe. |
| (no existe en prototipo; `newClientOpen`) | `src/pages/ClientFormPage.tsx` | **CONVERTIR** a Dialog en `ClientsPage` Y mantener route `/clients/new`+`/clients/:id/edit` para deep-link. Dos modos del mismo componente. |
| `isMetrics` | `src/pages/MetricsPage.tsx` | **REDISEÑAR** — sustituir charts actuales por Recharts con tema DialFlow (bars stacked + outcome horizontal + area chart). |
| `isAdmin` (usuarios) | `src/pages/AdminUsersPage.tsx` | **REDISEÑAR** — adoptar look. Crear `NewUserDialog`. |
| `dockIdle/Incoming/Active` | (nuevo) `src/components/softphone/SoftphoneDock.tsx` | **CREAR** envolviendo `useSip`. Hoy el componente softphone es panel suelto. |
| `videoOverlayOpen` | (nuevo) `src/components/softphone/VideoCallOverlay.tsx` | **CREAR**. Hoy la video surface está en otra parte. |
| `dialerOpen` | (nuevo) `src/components/softphone/DialerSheet.tsx` | **CREAR** con shadcn Sheet. |
| `activePanelOpen` | (nuevo) `src/components/softphone/ActiveCallPanel.tsx` | **CREAR** con shadcn Sheet. |
| `statusMenuOpen` | (nuevo) `src/components/agent/AgentStatusSelector.tsx` | **CREAR** con shadcn Popover. Backend: `PATCH /api/v1/me/status` (TODO). |
| `commandOpen` | (nuevo) `src/components/CommandPalette.tsx` | **CREAR** con shadcn Command + ⌘K listener. |
| `notifOpen` | (nuevo) `src/components/NotificationsPopover.tsx` | **CREAR** con shadcn Popover. Mock por ahora. |
| `toasts` | sonner ya instalable | **CREAR** wrapper con variantes ok/info/warn/end. |
| — | `src/components/Sidebar.tsx` | **CREAR**. |
| — | `src/components/Header.tsx` | **CREAR**. |
| (faltan, audio del profe) | `src/pages/admin/AdminSkillsPage.tsx` | **CREAR** (§7.1) |
| (faltan, audio) | `src/pages/admin/AdminSipExtensionsPage.tsx` | **CREAR** (§7.2) |
| (faltan, audio) | `src/pages/admin/AdminInboundRoutingPage.tsx` | **CREAR** (§7.3) |
| (faltan, audio) | `src/pages/admin/AdminParkingPage.tsx` | **CREAR** (§7.4) |
| (faltan, audio) | `src/pages/AgentCampaignsPage.tsx` | **CREAR** (§7.5) |

**Rutas finales propuestas:**
```
/login
/                           → /dashboard
/dashboard                  (agente y admin)
/clients
/clients/new                (modal sobre /clients pero ruta válida)
/clients/:id
/clients/:id/edit           (modal sobre detail)
/metrics
/campaigns                  (agente) — NUEVO
/admin/users                (admin) — REDISEÑO
/admin/skills               (admin) — NUEVO
/admin/sip-extensions       (admin) — NUEVO
/admin/inbound-routing      (admin) — NUEVO
/admin/parking              (admin) — NUEVO
```

Nav del sidebar:
- Operación: Inicio, Clientes, Métricas, **Campañas** (nuevo).
- Administración (solo si role==='admin'): Usuarios, **Skills**, **Extensiones SIP**, **Routing entrante**, **Parking**.

---

## 9. Componentes shadcn a instalar

Aparte de los ya presentes (badge, button, card, dialog, input, label, table, textarea):

```
npx shadcn@latest add sheet tabs tooltip popover sonner command separator scroll-area skeleton dropdown-menu avatar select switch toggle-group hover-card alert
```

Más `lucide-react` (ya en deps).

Three.js para el globo del login: **lazy import dinámico** (`React.lazy(() => import('./LoginGlobe'))`) para no inflar el bundle inicial.

---

## 10. Decisiones tomadas (sesión 2026-06-22)

- **Sin dark mode.** Sólo tema claro. NO usar variantes `dark:` de Tailwind. Único elemento "oscuro" del visual es el rail navy del Sidebar, que ya es parte del tema claro.

- **Globo Three.js del login con lazy-load.** Implementar `LoginGlobe.tsx` con `React.lazy(() => import('./LoginGlobe'))` para que Three.js sólo se descargue cuando se visita `/login`. Bundle principal queda intacto.

- **Tags de cliente con catálogo gestionable.** Dos tablas nuevas en schema `crm`:
  ```sql
  client_tags(id, name UNIQUE, color_bg, color_text, is_system bool)
  client_tag_assignments(client_id, tag_id, PRIMARY KEY (client_id, tag_id))
  ```
  Seed con los 6 del prototipo (`VIP`, `Moroso`, `Nuevo`, `Reincidente`, `Empresa`, `Soporte`) marcados `is_system=true` para que no se puedan borrar. Pantalla **`AdminTagsPage`** permite al admin crear/editar/eliminar tags propios y elegir colores. Refuerza la narrativa "admin gestiona desde el CRM" del profe.

- **UI con mock + backend en paralelo.** Por cada bloque de funcionalidad nueva se crean migraciones SQL + endpoints Spring + el componente React + tests Vitest mínimos en el mismo PR. Al final del PR-G todo está funcional end-to-end.

- **Click-to-call inverso** (CDR row → softphone outbound): reusar lo existente de HU-04.5.

- **Status del agente:** persistir en `crm.users.agent_status` + `crm.users.status_since`. Endpoint `PATCH /api/v1/me/status`.

- **Cola de llamadas entrantes (`/api/v1/queues/incoming`):** consulta a MikoPBX REST `pbx-status:getActiveCalls`, filtra por estado Ringing, enriquece con datos de cliente si el caller-id matchea.

- **Notificaciones:** tabla `crm.notifications(id, user_id, kind, title, link, created_at, read_at)`. Endpoint `GET /api/v1/notifications?unread=true`. Se generan desde eventos (llamada perdida, nota asignada, nuevo cliente en cartera).

- **Tablas en UI:** shadcn `<Table>` real (semántico/accesible) con la grilla CSS del prototipo aplicada vía className.

- **Branding "DialFlow":** se mantiene como marca del producto. No es atribución a la IA, es la identidad del CRM.
