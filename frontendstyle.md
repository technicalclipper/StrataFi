# frontendstyle.md — StrataFi Design System

> The visual + interaction spec for StrataFi's frontend. Goal: a **professional, black-themed trading terminal** for fractional land — think Bloomberg Terminal × a modern brokerage (Robinhood/Public/Cabana) × an interactive map (Parcl/Mapbox dashboards). Dense where it matters, calm everywhere else. Read this fully before building any UI. When a choice isn't specified here, choose the more restrained, data-dense, financial-grade option.

---

## 0. North star

StrataFi is a **financial instrument**, not a crypto toy. The UI must feel like money is being moved. That means:
- **Dark, near-black surfaces** with content floating on subtle elevated panels.
- **Data is the hero** — numbers, charts, the map, and live state. Chrome recedes.
- **Green = up / buy, red = down / sell.** Sacred. Never use these two colors for anything else.
- **Tight, tabular, monospaced numerals.** Prices never shift horizontally when they tick.
- **Calm motion.** Fast (120–200ms), purposeful, never bouncy. A trading floor isn't playful.
- **Trust signals everywhere** — verification badges, on-chain tx links, confidence scores.

If it looks like a generic crypto dApp (neon gradients, glassmorphism overload, purple-on-black, glowing buttons), it's wrong. If it looks like a terminal a fund manager would use, it's right.

---

## 1. Color system

All colors as CSS variables on `:root`. Dark theme is the **only** theme (no light mode for v1). Use OKLCH-friendly hex below.

### 1.1 Surfaces (near-black, layered by elevation)
```css
:root {
  /* Backgrounds — darkest at the base, lifting with elevation */
  --bg-base:      #0A0B0D;   /* app background, the void */
  --bg-sunken:    #060708;   /* insets, chart wells, code */
  --surface-1:    #111317;   /* primary panels / cards */
  --surface-2:    #16191E;   /* raised cards, popovers */
  --surface-3:    #1C2026;   /* hover states, active rows */
  --surface-4:    #23282F;   /* tooltips, dropdowns, modals top layer */

  /* Borders & dividers — low contrast, hairline */
  --border-subtle:  #1E2228;  /* default hairline divider */
  --border-default: #2A2F37;  /* card borders */
  --border-strong:  #3A414B;  /* focused inputs, emphasis */

  /* Text */
  --text-primary:   #E8EAED;  /* near-white, primary numbers & headings */
  --text-secondary: #9BA1AC;  /* labels, secondary copy */
  --text-tertiary:  #5E6672;  /* meta, timestamps, disabled */
  --text-inverse:   #0A0B0D;  /* text on bright fills */
}
```

### 1.2 Semantic market colors (THE sacred pair)
```css
:root {
  --up:        #1FCC8B;   /* gains, buy, positive — calm emerald, not neon */
  --up-bg:     rgba(31, 204, 139, 0.10);   /* faint up tint for backgrounds */
  --up-border: rgba(31, 204, 139, 0.30);

  --down:        #FF5C5C;  /* losses, sell, negative — clear but not blood-red */
  --down-bg:     rgba(255, 92, 92, 0.10);
  --down-border: rgba(255, 92, 92, 0.30);

  --flat:      #9BA1AC;    /* unchanged */
}
```
Rules: **green up, red down, always.** Buy actions = up color. Sell actions = down color. Never tint a non-financial element with these. Color-blind safety: never rely on color alone — pair with ▲/▼ glyphs and +/− signs.

### 1.3 Brand & accent (used sparingly)
```css
:root {
  --brand:        #4D7CFE;   /* StrataFi blue — primary actions that aren't buy/sell, links, focus */
  --brand-hover:  #6B92FF;
  --brand-bg:     rgba(77, 124, 254, 0.12);
  --brand-border: rgba(77, 124, 254, 0.35);

  --accent-amber: #F5A623;   /* warnings, "review needed", pending */
  --accent-amber-bg: rgba(245, 166, 35, 0.12);

  --verify:       #1FCC8B;   /* verified badge reuses up-green intentionally */
  --on-chain:     #4D7CFE;   /* "on Mantle" indicators reuse brand blue */
}
```

### 1.4 Map demand heat scale (sequential, dark-safe)
A 5-step scale for demand/yield/ownership overlays. Tuned to read on the dark map:
```css
:root {
  --heat-5: #FF4D4D;  /* very high */
  --heat-4: #FF8A3D;  /* high */
  --heat-3: #F5C518;  /* medium */
  --heat-2: #4D9DE0;  /* low */
  --heat-1: #3A6B8C;  /* very low */
  --heat-0: #2A2F37;  /* unlisted / no data */
}
```

---

## 2. Typography

Trading UIs live and die on the number font. Two families only.

### 2.1 Families
```css
:root {
  /* UI + headings — a clean, slightly technical grotesque (NOT Inter/Roboto) */
  --font-sans: 'Geist', 'Söhne', 'Suisse Intl', -apple-system, system-ui, sans-serif;

  /* Numbers, prices, tickers, addresses, code — tabular monospace, MANDATORY for all numerics */
  --font-mono: 'Geist Mono', 'JetBrains Mono', 'IBM Plex Mono', ui-monospace, monospace;
}
```
- Load via `next/font` (self-hosted, no FOUT). Geist + Geist Mono are free and pair cleanly; acceptable swaps: Söhne/JetBrains Mono, Suisse/IBM Plex Mono. **Do not use Inter, Roboto, Arial, or Space Grotesk.**
- **Every number** (price, %, share count, balance, coordinate, address, tx hash) uses `--font-mono` with `font-variant-numeric: tabular-nums;` so digits don't reflow on tick.

### 2.2 Type scale (compact, terminal-grade)
```css
--text-2xs: 10px;   /* micro labels, table superscripts */
--text-xs:  11px;   /* table meta, timestamps, axis labels */
--text-sm:  12.5px; /* secondary body, dense table cells */
--text-base:14px;   /* default body */
--text-md:  16px;   /* card titles */
--text-lg:  20px;   /* section headers */
--text-xl:  26px;   /* page titles */
--text-2xl: 34px;   /* hero price / portfolio value */
--text-3xl: 48px;   /* rare — landing hero only */
```
- Line-height: 1.2 for numbers/headings, 1.5 for prose.
- Letter-spacing: `-0.01em` on large headings; `0.02em` uppercase micro-labels.
- Weights: 400 body, 500 emphasis/labels, 600 headings & key numbers. Avoid 700+ except the landing hero.
- **Uppercase micro-labels** (`text-2xs`, `letter-spacing: 0.06em`, `--text-tertiary`) for column headers and stat labels — classic terminal feel.

---

## 3. Spacing, radius, elevation

### 3.1 Spacing scale (4px base, tight)
`4, 8, 12, 16, 20, 24, 32, 40, 48, 64`. Default gap inside cards = 12–16px. Dense tables = 8px row padding. Trading UIs are denser than marketing sites — don't over-pad.

### 3.2 Radius (subtle, not bubbly)
```css
--radius-xs: 4px;   /* chips, badges, inputs */
--radius-sm: 6px;   /* buttons, small cards */
--radius-md: 8px;   /* cards, panels */
--radius-lg: 12px;  /* modals, large surfaces */
--radius-full: 999px;
```
Keep it crisp. No 20px+ "pill everything" rounding — that reads consumer-casual, not financial.

### 3.3 Elevation (shadows are subtle on black; rely on surface lift + border)
```css
--shadow-sm: 0 1px 2px rgba(0,0,0,0.4);
--shadow-md: 0 4px 16px rgba(0,0,0,0.5);
--shadow-lg: 0 12px 40px rgba(0,0,0,0.6);
/* Popovers/dropdowns: surface-4 + border-default + shadow-md */
```
On dark UIs, **elevation = lighter surface + hairline border**, with shadow as a secondary cue. Don't use glows.

---

## 4. Layout — the trading terminal shell

### 4.1 App frame
A persistent shell, terminal-style:
```
┌────────────────────────────────────────────────────────────┐
│  TOPBAR (56px) — logo · global search · network pill · wallet │
├──────┬───────────────────────────────────────────┬──────────┤
│ NAV  │              MAIN WORKSPACE                │  CONTEXT  │
│ rail │  (map / detail / portfolio / list)        │  panel    │
│ 64px │                                            │  320px    │
│      │                                            │ (optional)│
├──────┴───────────────────────────────────────────┴──────────┤
│  STATUS BAR (28px) — block #, gas, MNT price, connection dot  │
└────────────────────────────────────────────────────────────┘
```
- **Topbar (56px):** wordmark left; centered command-style global search (`⌘K`); right side = network pill (`● Mantle Sepolia`), MNT balance, wallet address (truncated `0x12…9f3a`) + avatar.
- **Left nav rail (64px, icon-only, expands to 200px on hover):** Map, Portfolio, List Asset, Acquire, Activity, Docs. Active item = brand-left-border + brand-tinted bg.
- **Context panel (right, 320px, collapsible):** contextual — order ticket on a parcel page, AI agent feed on portfolio, offer inbox elsewhere.
- **Status bar (28px, bottom):** live `--font-mono` micro-data — latest block, gas price, MNT/USD, a green/amber connection dot. This single strip sells "this is live and on-chain" instantly.

### 4.2 Grid
12-col, 1440px max content width for dashboards; the map page goes **full-bleed edge to edge**. Gutters 16–24px. Breakpoints: `sm 640 / md 768 / lg 1024 / xl 1280 / 2xl 1536`. Below `lg`, collapse nav rail to a bottom tab bar and stack the context panel into a bottom sheet.

---

## 5. The map (signature feature — get this right)

The map is StrataFi's identity. It must feel like a financial heatmap, not Google Maps.

### 5.1 Base
- **MapLibre GL JS** (free, no token) with a **dark custom style**. Tiles: a dark/positron-style base recolored to match `--bg-base`. Strip noise — hide POIs, labels, most roads; keep water, major roads, and place labels only. Land should be a calm dark canvas so parcels pop.
- Parcels render as **GeoJSON polygon fill + line layers**. Fill color = active overlay metric (demand/yield/ownership) from the heat scale at ~0.55 opacity; line = same hue at full opacity, 1px. Selected parcel: 2px white-ish line (`--text-primary`) + raised fill opacity.

### 5.2 Overlay modes (segmented control, top-left of map)
`Demand · Ownership · Yield` — switching recolors all parcels via the heat scale. Animate the fill-color transition over 200ms. A vertical **legend** sits bottom-left with the 5-step scale + labels.

### 5.3 Map chrome
- **Floating search** top-center (`Search location, parcel ID…`) on a `--surface-2` panel, `--radius-md`, `--shadow-md`.
- **Zoom/recenter controls** bottom-right, minimal square buttons.
- **Hover tooltip**: on parcel hover, a compact `--surface-4` card follows the cursor — parcel ID, price/share (mono), `▲ +x%` demand, shares sold bar. 11px, tight.
- **Click → context panel** slides in from the right with the full parcel summary + a "View parcel" CTA. Don't navigate away on first click; preview in panel, navigate on CTA.
- **Coordinate readout**: tiny mono lat/long in a corner that updates with the cursor — pure terminal flavor.

### 5.4 Performance
Cluster/aggregate parcels at low zoom (use fill opacity by density). Only mount tooltips for the hovered feature. Keep the GeoJSON source updated via `setData`, never re-add layers.

---

## 6. Core components

Build these as reusable React + Tailwind components. All consume the CSS variables above.

### 6.1 Numbers & deltas
- `<Price value mono />` — always mono, tabular-nums, 2 decimals for fiat, dynamic for MNT.
- `<Delta value />` — renders `▲ +2.41%` in `--up` or `▼ −1.10%` in `--down`, mono, with tinted bg chip optional. Zero → `--flat` with `–`.
- **Tick flash:** when a price updates, flash the cell bg `--up-bg`/`--down-bg` for 400ms then fade. Subtle, classic ticker behavior.

### 6.2 Buttons
- **Primary (brand):** `--brand` fill, `--text-inverse`... actually use white text on brand blue; hover `--brand-hover`; `--radius-sm`; 36–40px tall; 500 weight.
- **Buy:** `--up` fill, near-black text. **Sell:** `--down` fill. These are the only green/red buttons.
- **Secondary:** transparent fill, `--border-default` border, `--text-primary`; hover → `--surface-3`.
- **Ghost/icon:** no border, hover `--surface-3`.
- Disabled: `--surface-2` bg, `--text-tertiary`. Loading: inline spinner + label, never collapse width.

### 6.3 Cards & panels
`--surface-1` bg, `1px --border-default`, `--radius-md`, 16px padding. Header row = uppercase micro-label left + action/menu right. Nest darker (`--bg-sunken`) wells for charts and key stats inside cards.

### 6.4 Tables (data grid)
The workhorse. Holdings, order book, cap table, activity.
- Header row: `--text-2xs` uppercase `--text-tertiary`, sticky, `--surface-2` bg, hairline bottom border.
- Rows: 36–40px, `--text-sm`, hairline `--border-subtle` separators, hover `--surface-3`.
- **Right-align all numeric columns**, mono, tabular-nums. Left-align text.
- Zebra striping is OFF (too noisy); rely on hairlines + hover.
- Sortable headers with a small ▲/▼. Sticky first column on horizontal scroll.

### 6.5 Charts (use Recharts or Lightweight-Charts)
- For price/value history use **TradingView Lightweight Charts** if possible (it's free and looks native-finance); else Recharts area/line.
- Line = `--brand` or `--up`/`--down` by trend; area fill = same at 8% opacity → transparent gradient. Grid lines = `--border-subtle`, dashed, minimal. Axis text = `--text-tertiary` mono 10–11px. Crosshair tooltip on a `--surface-4` card. No 3D, no bar-chart rainbow.

### 6.6 Order ticket / trade panel
Right context panel on a parcel page. Tabs: **Buy · Offer · Sell**. Fields: shares (stepper), price/share (mono input), auto-calc total in MNT + USD, available balance, slippage/expiry where relevant. Big Buy (green) / Sell (red) submit. Below: a tx preview line ("≈ 0.0003 MNT gas on Mantle"). After submit: inline tx status with a `View on MantleScan ↗` link.

### 6.7 Badges & status
- **Verified ✓** — `--verify` text + 12% bg chip, `--radius-full`. Pair with the AI confidence score.
- **On-chain ◆** — `--on-chain` blue chip, links to explorer.
- **Pending / Review** — `--accent-amber` chip with a tiny pulse dot.
- **Demand tag** — heat-scale colored dot + label.

### 6.8 Confidence score meter
A horizontal segmented bar (0–100) with a marker. ≥80 green zone, 60–79 amber, <60 red. Show the number in mono + a one-line AI rationale beneath. This is a trust centerpiece — give it room on the parcel and listing pages.

### 6.9 AI agent feed
Card list in the portfolio context panel. Each signal: a small AI glyph, a one-line plain-English insight, an affected-parcel chip, and an optional action button (Trim / View / Rebalance). Timestamped, mono. Keep tone analytical, not chatty.

### 6.10 Wallet / network
Network pill: `● Mantle Sepolia` (green dot when connected, amber when wrong network → click to switch). Wallet button shows avatar + truncated address; dropdown has balance, copy address, view on explorer, disconnect.

---

## 7. Motion

```css
--ease-out: cubic-bezier(0.16, 1, 0.3, 1);
--ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
--dur-fast: 120ms;   /* hovers, taps */
--dur-base: 180ms;   /* panels, tabs, color transitions */
--dur-slow: 320ms;   /* modals, route transitions, map recolor */
```
- Use Motion (Framer Motion) in React. Panels slide+fade (translateX 12px → 0, opacity). Modals scale 0.98 → 1 + backdrop fade.
- **Page load:** stagger the dashboard panels in (40ms delay each) — one orchestrated reveal, not scattered.
- **Tick flashes** (§6.1) and the live status bar are the only "always-on" motion. Everything else is interaction-triggered.
- Respect `prefers-reduced-motion`: disable tick flash and all transforms, keep instant state changes.
- **Never** bounce, wobble, or use spring overshoot on financial controls. Calm = trustworthy.

---

## 8. Iconography & imagery
- **Icons:** Lucide (thin, consistent stroke). 16–18px in UI, 1.5px stroke. No emoji in the product UI.
- **No stock photos.** The map, charts, and data are the imagery. If a parcel needs a visual, use its satellite tile thumbnail (from the map) — never generic clipart.
- Glyphs for finance: ▲▼ deltas, ◆ on-chain, ✓ verified, ⚡ instant settlement, ⌘K command.

---

## 9. Page-by-page intent

- **Landing (`/`)** — full-bleed dark map as hero with live parcels glowing on the heat scale; a concise value line overlaid top-left; status bar already live. One scroll reveals: "how it works" (3 steps), trust strip (verified/on-chain/Mantle), CTA to explore. Feels like opening a terminal, not a marketing page.
- **Map explorer (`/`, primary)** — §5 in full. The default home for logged-in users.
- **Parcel detail (`/parcel/[id]`)** — left: parcel header (ID, coords mono, verified badge, confidence meter), price chart, AI valuation rationale, cap table (owners + share bars). Right context panel: the order ticket (§6.6).
- **Portfolio (`/portfolio`)** — top: big mono portfolio value + total `<Delta>`; holdings table (§6.4) with per-parcel value/yield/Δ; a small allocation chart. Right panel: AI agent feed (§6.9) + claimable yield.
- **List asset (`/list`)** — a stepped wizard (Upload → Map/boundary → Shares & price → AI verification result → Mint). The AI verification step is the showcase: stream the doc-extraction, geo-check, valuation, then the confidence meter, then the Mint-on-Mantle button.
- **Acquire (`/acquire/[id]`)** — cap table with per-holder offer planner; AI acquisition strategy panel (cost-to-51%, cost-to-100%, ordered offer plan); progress toward majority; governance vote module once ≥51%.
- **Activity (`/activity`)** — a unified on-chain feed (mints, buys, offers, votes, yield) as a dense table, each row linking to MantleScan.

---

## 10. Accessibility & polish checklist
- Contrast: body text ≥ 4.5:1 on its surface; large text ≥ 3:1. `--text-tertiary` only for non-essential meta.
- Every interactive element: visible focus ring = 2px `--brand` outline, 2px offset.
- Color never the sole signal (deltas carry ▲▼ and signs; statuses carry icons + text).
- Keyboard: `⌘K` command palette, full tab order, `Esc` closes panels/modals.
- Loading: skeleton rows in `--surface-2` shimmer for tables/cards; never spinners-on-blank for primary content.
- Empty states: a single icon + one line + one CTA, centered, `--text-secondary`.
- Errors (esp. tx failures): inline, `--down` text + retry; never a raw stack trace; always offer the explorer link.
- All numbers tabular-mono; all addresses/hashes truncated `0x12…9f3a` with copy-on-click.

---

## 11. Hard DON'Ts (anti-crypto-slop)
1. No purple/violet gradients, no neon glow, no glassmorphism blur stacks.
2. No Inter / Roboto / Arial / Space Grotesk. No emoji in-product.
3. No rainbow charts, no 3D pie charts, no animated gradient backgrounds.
4. Don't use green/red for anything except up/down/buy/sell.
5. No giant rounded "pill everything" — keep radii crisp (≤12px on big surfaces).
6. No bouncy/spring motion on financial controls; no autoplaying loops besides ticks + status bar.
7. No light mode for v1. The terminal is dark.
8. Don't let numbers reflow on update — tabular-nums + fixed-width containers always.
9. Don't bury the on-chain proof — tx links, network pill, and confidence scores stay visible.
10. Don't over-pad. This is a dense financial tool, not a landing page.

---

## 12. Quick-start tokens (paste into globals.css)
Copy §1–§3 variables into `web/app/globals.css` under `:root`, wire Tailwind via `theme.extend.colors` mapping to the CSS vars (e.g. `surface-1: 'var(--surface-1)'`, `up: 'var(--up)'`), load Geist + Geist Mono with `next/font`, set `body { background: var(--bg-base); color: var(--text-primary); font-family: var(--font-sans); }`, and force `font-variant-numeric: tabular-nums` on a `.tnum` utility used by every numeric component. Build the terminal shell (§4) first, then the map (§5), then components (§6).

> Build the terminal shell (§4) first, then the map (§5), then components (§6). Keep this file open in Claude Code as the visual source of truth.
