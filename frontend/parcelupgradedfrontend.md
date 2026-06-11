PAGE 2 — The Parcel / Property Page: "The Asset Terminal"
The hero (top of page)
The page opens with a cinematic flyover: a wide, short (240px) satellite strip across the top where the camera slowly drifts over the actual parcel, its boundary glowing in brand blue. Overlaid bottom-left in big mono: parcel ID, name, coordinates. Bottom-right: the price — huge mono number (₹4,200/share) with a live Δ chip that tick-flashes. This is the "stock header" of a trading app, but the backdrop is the actual land.
Directly under it, a trust strip — the row judges are scoring you on:
✓ AI Verified 94/100 · ◆ Minted on Mantle (tx ↗) · ⬡ Geo-validated · 👥 9 holders · 🗓 Listed 14d ago
Each chip is clickable and proves itself (the tx chip opens MantleScan).
The layout — three-column terminal
LEFT (main, ~60%):

Price chart — TradingView-style candlestick/area chart of share price history with timeframe pills (1D/1W/1M/1Y/ALL). Crosshair, OHLC readout, volume bars beneath. This single component makes land feel like a stock more than anything else on the page.
AI Verification Theater — the showstopper. An expandable panel that replays the AI's verification as a sequence: the deed image appears with animated bounding boxes drawing around extracted fields (owner name, survey no., area) one by one, each field sliding into a "extracted ✓ matches claim" row; then the geo-check animates the polygon being tested against neighbors (brief red flash where it checked for overlap, then green); then the valuation rationale types out; then the confidence meter fills 0→94 with a count-up. It's the AI doing its job visibly. Judges scoring "depth of AI integration" will remember this panel above everything else.
Cap table visualized — not a boring table: a horizontal stacked ownership bar (each holder a colored segment, hover to identify) PLUS the table below it with each holder's alias, shares, %, avg. entry price, and a "Make offer →" button per row. Your own segment glows if you hold shares.
Activity feed — every on-chain event for this parcel (mints, buys, offers, votes) as a live-updating mono feed, newest sliding in from the top, each row linking to the explorer.

RIGHT (sticky, ~25%): The Order Ticket
A sticky trade panel that follows scroll — Buy / Offer / Sell tabs:

Share stepper with a live total that recalculates in MNT + ₹ + USD as you type
A thin depth bar showing how many shares are available at what prices
The Buy button is the page's only big green element; pressing it shows an inline transaction lifecycle: Signing… → Submitted → Confirmed on Mantle ✓ with the block number and a confetti-free, dignified success state (a single green check that draws itself)
Below: "Own 10 shares = 0.05% of this land · est. yield ₹212/yr" — translating tokens into plain meaning. Judges love when crypto explains itself.

FAR-RIGHT THIN STRIP (~15%): AI Analyst column

AI fair-value gauge: a dial showing current price vs AI valuation range ("trading 4% below AI fair value")
AI yield forecast mini-chart
Two or three plain-English AI insights specific to this parcel
A "Ask AI about this parcel" input → opens a focused chat scoped to this asset

The governance moment (if a buyout is live)
A full-width amber-bordered banner: "⚡ Active buyout proposal — ₹5,100/share · 4 days left" with a live vote bar filling toward 51% in real time and Approve / Reject buttons. Voting animates your share-weight flowing into the bar. If it crosses 51% during the demo — the bar flashes, status flips to EXECUTING, and the payout distribution animates as rows of wallets each receiving their MNT. Squeeze-out as theater.
Micro-details that finish the kill

Every number on the page uses tick-flash on update — the page never feels static
Yield accrues live: "Unclaimed yield: ₹1,204.3182" with the last digits slowly counting up in real time (computed per-second from the rate). Hypnotic.
Scroll-linked satellite: as you scroll down the page, the hero satellite strip subtly continues drifting (parallax) — the land never stops being present
A floating "◆ on Mantle Sepolia · block 18,442,109" pill bottom-right on every page, always live

