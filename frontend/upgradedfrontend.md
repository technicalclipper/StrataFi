PAGE 1 — The Home / Map Page: "The Living Terminal"
The opening moment (first 3 seconds — this wins or loses the demo)
The page doesn't just load — it arrives. Pure black screen, then the dark map fades in from above like a satellite descending: starts zoomed out over the region, then smoothly flies down (MapLibre flyTo with easing) into the city where parcels live. As the camera descends, parcels light up one by one in a staggered ripple — tiny 200ms delays, like a city's power grid switching on. Meanwhile the bottom status bar boots up like a terminal: CONNECTING TO MANTLE… ✓ BLOCK #18,442,107 · GAS 0.02 GWEI · MNT $1.04.
That's a 3-second cinematic that says this thing is alive before the judge touches anything.
The map itself — not a map, a market

Parcels breathe. High-demand parcels have a slow, subtle pulse (fill opacity oscillating 0.5→0.65 over 3s). Not blinking — breathing. The judge's eye is instantly drawn to hot zones without a single label.
Live activity sparks. When any transaction happens (a buy, an offer accepted), a brief white ring ripples outward from that parcel on everyone's map — like sonar. Pair it with a one-line entry sliding into the live feed. Seed fake background transactions every 8–15 seconds during the demo so the map constantly twinkles with life.
3D on demand. Hold right-click and tilt — parcels extrude upward into 3D bars where height = price per share (MapLibre fill-extrusion). The map literally becomes a bar chart of the land market. This single trick gets an audible reaction.
Time-lapse slider. A thin timeline scrubber at the bottom of the map: drag it and watch demand history replay — parcels recoloring week by week over the past "year" (seeded data). Judges love seeing data move through time.
Cursor as instrument. A fine crosshair follows the cursor with live mono coordinates in the corner (13.4213°N 80.1982°E), and the nearest parcel's ID ghost-highlights. Feels like a targeting system.

The chrome around the map

Top ticker tape. Above the map, a slim horizontally auto-scrolling ticker — exactly like a stock exchange: PRCL-047 ₹4,200 ▲2.4% · PRCL-089 ₹6,150 ▲11.2% · PRCL-012 ₹1,890 ▼0.8%… Click any ticker chip → camera flies to that parcel.
Command palette (⌘K). Hit ⌘K and a spotlight-style search drops down: type "high yield Chennai" and it filters the map live as you type, dimming everything that doesn't match. AI-powered natural language filtering — "agricultural land under ₹2,000/share near a highway" actually works (one GPT call translating text → filter params).
Left rail: Top Movers. A slim collapsible panel ranking parcels like a stock screener — Top Gainers / Most Traded / Highest Yield tabs, each row with a micro sparkline of its 30-day price. Hover a row → its parcel glows on the map (the connection between list and map is the magic).
AI whisper bar. A single elegant line above the map that periodically types out (typewriter effect) one AI market insight: "◆ AI: Demand within 2km of the new metro corridor is up 18% this month." Rotates every 12s. It makes the AI feel ambient and omnipresent, not hidden in a chatbot.
Hover cards that are mini-dashboards. Hover any parcel → a compact card with name, price (mono), Δ%, a tiny live sparkline, shares-sold bar, and the AI confidence badge. Information density of Bloomberg, in 180×120px.

Overlay modes — make switching feel physical
Demand / Ownership / Yield segmented control — but when you switch, the recolor sweeps across the map left-to-right like a wave (animate each parcel's color with a delay proportional to its longitude). A 600ms detail that feels expensive.

