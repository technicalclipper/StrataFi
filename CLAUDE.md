# CLAUDE.md — StrataFi

> **One-line pitch:** StrataFi is an AI-powered marketplace that turns real-world land into tradable on-chain shares — explore parcels on a live map, invest fractionally, and trade ownership like stocks, all settled on Mantle.

This file is the source of truth for the project. Read it fully before writing code. When in doubt about scope, optimize for the **hackathon scoring rubric** at the bottom of this file.

---

## 1. What we are building

A fractional real-estate (RWA) investing platform with three actors:

- **Sellers** tokenize their land into `N` shares after AI verification.
- **Buyers** discover parcels on a map and buy fractional shares (or whole parcels).
- **Owners** trade shares peer-to-peer, receive yield, and vote on parcel-level decisions.

Mental model: **Google Maps × Robinhood for land.** Each parcel is a stock; each share is one unit of ownership; the map is the order book.

### The asset
Real-world **land parcels** (agricultural, commercial, residential plots). Anchored on-chain by geo-coordinates + a hash of the verified title deed. The token is framed as a **fractional investment instrument / parallel ownership ledger**, NOT a legal replacement for a government land title. State this framing explicitly in the UI and docs — it is our compliance posture.

### The AI's job (this is 60% of the score — make it real, not decorative)
1. **Document verification** — OCR + field extraction from uploaded deeds; forgery/tamper detection; cross-check survey number against a (mocked for hackathon) registry.
2. **Geo validation** — plot the parcel polygon, detect overlaps with existing parcels and restricted zones, verify claimed area vs polygon area.
3. **Valuation engine** — produce a price-per-share range + yield estimate from location, comparables, infrastructure proximity, land use.
4. **Confidence score** — 0–100. ≥80 auto-approve, 60–79 human-review queue, <60 reject with reasons.
5. **Portfolio agent** — monitors holdings, surfaces buy/sell signals, suggests rebalancing in plain English.
6. **Acquisition strategist** — for full-parcel acquisition: ranks holders by sell-probability, suggests per-holder offer prices, computes cheapest path to 51%.

### How it lives on Mantle
All ownership, transfers, escrow, yield distribution, and governance are smart contracts on Mantle. Mantle is chosen for: EVM equivalence, very low L2 gas (micro-trades of fractional shares are 
 viable), and fast finality. Every financial action is atomic and on-chain.

---

## 2. Full idea & end-to-end flow (read this to understand WHY each piece exists)

StrataFi treats a piece of land the way a stock exchange treats a company: divide it into shares, let many people own pieces of it, let them trade those pieces freely, pay them their slice of any income, and let them collectively decide big moves. The map is the storefront; the blockchain is the share registry and settlement layer; the AI is the gatekeeper, appraiser, and advisor that makes the whole thing trustworthy and easy.

There are three actors and one shared trust layer. **Sellers** bring land and turn it into shares. **Buyers/investors** put small amounts of money into specific parcels they believe in. **Owners** (anyone holding shares) trade, earn yield, and vote. The shared layer is the AI verification + the on-chain record that everyone trusts instead of trusting each other.

### 2.1 Seller flow — from a plot of land to tradable shares

1. **Onboard.** Seller signs up and connects a wallet. The wallet address becomes their permanent identity; the platform never holds their keys.
2. **KYC once.** They upload a government ID + selfie. The AI (`/api/kyc`) reads the ID fields and checks the selfie matches. Only a *hash* of the result is stored — they never repeat KYC again.
3. **Upload the land.** They upload the title deed (e.g. patta/sale deed), survey number, and supporting docs, then drop a pin on the map and trace the parcel's boundary polygon over satellite imagery.
4. **Set the offering.** They choose how many shares to split the land into (e.g. 200) and an asking price per share. The AI shows a suggested fair price beside their input.
5. **AI verification (the trust gate).** Three things run: `/api/verify-doc` reads the deed, extracts fields, checks for tampering, and cross-checks the survey number against the (mocked) registry; geo-validation checks the drawn polygon for overlaps with existing parcels and restricted zones and confirms the area matches the deed; `/api/valuation` prices the land and estimates yield. These combine into a **confidence score (0–100)**.
6. **Decision.** Score ≥80 → auto-approved. 60–79 → goes to a human-review queue (simple admin page). <80 once approved, or below 60 → rejected with AI-written reasons the seller can act on.
7. **Mint on Mantle.** Once approved, the backend's authorized signer calls `ParcelRegistry.registerParcel(...)` (storing geoHash, docHash, confidence, totalShares, seller) and `ShareToken.mintShares(...)` mints N ERC-1155 tokens of that parcel ID into the seller's wallet.
8. **Go live.** The parcel appears on the public map, colored by demand. The seller's dashboard now tracks share sales, incoming offers, and yield in real time.

### 2.2 Buyer flow — from browsing a map to owning a slice

1. **Explore.** The buyer opens the map and toggles view modes — **demand heat**, **ownership %**, **yield %** — and filters by price, location, land type. Clicking a parcel opens its detail page: shares available, current owner breakdown, AI price/yield, verification status.
2. **KYC once.** Same one-time AI KYC as sellers; works with international IDs so a buyer abroad can participate. The cleared status is a hash on-chain — no per-purchase re-verification.
3. **Buy — two paths.**
   - **Path A — buy available shares:** shares still in the seller's pool (or listed by other holders) are bought instantly. `Marketplace` primary sale: buyer pays MNT, tokens transfer in, MNT forwards to the seller. ~seconds on Mantle, near-zero gas.
   - **Path B — make an offer:** the buyer targets a specific existing holder, locks a bid in escrow for a chosen quantity/price (72h expiry). The holder accepts → atomic swap fires; rejects/expires → escrow refunds. No middleman ever holds the funds.
4. **Hold & earn.** The ERC-1155 token sits in the buyer's wallet (visible in MetaMask and on the explorer). If the land is leased, `YieldSplitter` lets them claim their pro-rata share of deposited rental income in MNT.
5. **AI agent works in the background.** `/api/portfolio-agent` watches their parcels for price moves, demand shifts, and nearby infrastructure news, then surfaces plain-English signals ("demand near Parcel 12 dropped 20% — consider trimming"; "metro announced 800m from Parcel 5 — projected +15%").
6. **Exit — three paths.** List shares on the secondary market at a self-chosen price; accept an incoming offer from another buyer; or, if a full-parcel buyout is proposed, vote in governance and receive a pro-rata payout if it passes.

### 2.3 Full acquisition flow — buying an entire parcel (the standout mechanism)

This is a stock-style tender offer, on-chain. It works whether the acquirer starts with some shares or none.

1. **See the cap table.** The parcel detail page shows every holder's wallet alias and share count — full transparency, no hidden ownership.
2. **AI acquisition strategy.** `/api/acquisition` takes the acquirer's budget and the holder table and returns: feasibility, cost to reach 51% and 100%, and an *ordered, per-holder offer plan* — suggesting lower prices for likely sellers and higher for reluctant ones, ranked by sell-probability.
3. **Sweep then offer.** The acquirer instantly buys any shares already listed, then fires **simultaneous individual offers** to remaining holders. Each holder sees only their own offer; the acquirer's total bid is locked in escrow. As holders accept, shares flow in and their slice of escrow releases — partial fills are fine.
4. **Negotiate the holdouts.** Holders can accept, counter, or reject. The acquirer can raise offers, wait (the AI pings them when a holdout starts listing), or proceed.
5. **51% → squeeze-out.** Once the acquirer crosses 51%, `Governance.proposeBuyout` opens a 7-day, 1-share-1-vote ballot at a declared price. Because they already hold the majority, it passes; remaining holders are **automatically paid the declared price** in MNT and their tokens transfer over. Minorities can't block the sale but are guaranteed payment — they can never be stuck with worthless tokens.
6. **100% owner.** `ParcelRegistry` shows them as sole holder. They can hold, lease (100% of yield), sell the whole parcel, or **re-tokenize** — re-split into fresh shares at the new appreciated price and sell down, realizing profit while keeping a stake. That re-tokenization loop is what makes this behave like a living asset market rather than a one-shot sale.

### 2.4 Why each layer is non-negotiable
- **AI** is the trust gate (bad/forged deeds never get minted), the appraiser (fair, explainable prices), and the advisor (portfolio + acquisition). Without it, this is just another token marketplace — the AI is what earns the "AI × RWA" score.
- **Mantle** is the settlement and registry. Fractional shares mean tiny transactions; only an L2 with very low gas makes micro-trades and frequent yield claims economically sane. Atomicity (escrow swaps, squeeze-out payouts) removes counterparty risk entirely.
- **The map** is the UX unlock — it turns an abstract financial product into something a non-expert can browse, understand, and act on in seconds.

---

## 3. Tech stack (opinionated — chosen for build speed)

| Layer | Choice | Notes |
|---|---|---|
| Smart contracts | **Solidity ^0.8.24 + Foundry** | Fast tests, fast deploy. Hardhat acceptable if Foundry unavailable. |
| Token standard | **ERC-1155** | One token ID per parcel; balance = shares held. |
| Chain | **Mantle Sepolia testnet (chain 5003) — ONLY** | No mainnet anywhere. All demos and txns are on testnet with faucet MNT. |
| Frontend | **Next.js 14 (App Router) + TypeScript + Tailwind** | |
| Web3 client | **wagmi + viem + RainbowKit** | viem is the default; do not use ethers unless a lib forces it. |
| Map | **MapLibre GL** (free, no token) or **Leaflet** | Parcels = GeoJSON polygons. Heatmap by demand/yield/ownership. |
| AI backend | **Node/TypeScript API routes** (Next.js route handlers) calling the **OpenAI API** | Single backend; no separate service needed for the demo. Use the official `openai` npm SDK. |
| AI models | **GPT-4o** for doc parsing + vision (reading deed/ID images), valuation reasoning, portfolio/acquisition strategy. `gpt-4o-mini` for cheaper text-only calls. | GPT-4o is multimodal — use it for any endpoint that takes an image. |
| DB / state | **SQLite via Prisma** (or in-memory JSON for fastest path) | Off-chain cache of parcel metadata, KYC status, offers. On-chain is source of truth. |
| File storage | Local `/uploads` for demo (deed images). Store only a **hash** on-chain. | IPFS optional, not required for demo. |

**Do not over-engineer.** No microservices, no Kubernetes, no separate Python service. One Next.js app + one Foundry project in a monorepo.

---

## 4. Repository structure

```
stratafi/
├── CLAUDE.md                      # this file
├── README.md                      # submission doc (see §11)
├── contracts/                     # Foundry project
│   ├── src/
│   │   ├── ParcelRegistry.sol
│   │   ├── ShareToken.sol         # ERC-1155
│   │   ├── Marketplace.sol        # primary sale + secondary listings + offers/escrow
│   │   ├── YieldSplitter.sol
│   │   └── Governance.sol
│   ├── test/                      # one test file per contract
│   ├── script/Deploy.s.sol
│   └── foundry.toml
├── web/                           # Next.js app
│   ├── app/
│   │   ├── page.tsx               # map explorer (landing)
│   │   ├── parcel/[id]/page.tsx   # parcel detail + buy/offer
│   │   ├── portfolio/page.tsx     # holdings + AI agent
│   │   ├── list/page.tsx          # seller listing wizard
│   │   ├── acquire/[id]/page.tsx  # full-parcel acquisition flow
│   │   └── api/
│   │       ├── verify-doc/route.ts      # AI doc verification
│   │       ├── valuation/route.ts       # AI valuation
│   │       ├── kyc/route.ts             # AI KYC
│   │       ├── portfolio-agent/route.ts # AI monitoring/suggestions
│   │       └── acquisition/route.ts     # AI acquisition strategy
│   ├── components/
│   │   ├── MapExplorer.tsx
│   │   ├── ParcelCard.tsx
│   │   ├── ShareDistribution.tsx
│   │   ├── OfferInbox.tsx
│   │   └── ...
│   ├── lib/
│   │   ├── contracts.ts           # addresses + ABIs + viem clients
│   │   ├── mantle.ts              # chain config (see §7)
│   │   └── ai.ts                  # OpenAI API wrapper
│   └── prisma/schema.prisma
└── package.json (workspace root)
```

---

## 5. Smart contracts — specification

Build in this order. Write Foundry tests for each before moving on. Keep them simple and readable; judges will skim them.

### 5.1 `ParcelRegistry.sol`
Stores the canonical record of each parcel.
- `struct Parcel { uint256 id; bytes32 geoHash; bytes32 docHash; uint16 confidenceScore; uint256 totalShares; address seller; bool verified; }`
- `registerParcel(...)` — callable only by an authorized `verifier` address (the backend's signer wallet after AI approval). Emits `ParcelRegistered`.
- `getParcel(id)` view.
- Holds the mapping; other contracts read from it.

### 5.2 `ShareToken.sol` (ERC-1155)
- Token `id` == parcel `id`. Balance of an address == shares owned.
- `mintShares(parcelId, to, amount)` — only callable by Registry/Marketplace.
- Standard `safeTransferFrom` used for all share movement.
- Override `uri()` to point at parcel metadata endpoint.

### 5.3 `Marketplace.sol` (the core trading engine)
Three mechanisms:
1. **Primary sale** — buyer pays MNT for shares still held by the seller's pool; shares transfer, MNT forwards to seller. Atomic.
2. **Secondary listing** — any holder lists `amount` shares at `pricePerShare`; any buyer fills instantly.
3. **Direct offer + escrow** — buyer locks MNT in escrow targeting a specific holder for `amount` shares at `bidPrice`, expiring in 72h. Holder `acceptOffer` → atomic swap (shares→buyer, MNT→holder). `rejectOffer`/expiry → MNT refunds buyer. Support **simultaneous per-holder offers** for the acquisition flow.
- All payments in native **MNT** (`msg.value`). Use a `nonReentrant` guard.
- Emit events for every action (frontend reads these).

### 5.4 `YieldSplitter.sol`
- `depositYield(parcelId)` payable — anyone (e.g. a lessee/oracle) deposits MNT rental income for a parcel.
- Pull-payment pattern: holders `claim(parcelId)`; amount = `shareBalance / totalShares * accruedYield`. Track per-holder claimed amounts to prevent double-claims. (Pull pattern avoids gas-bomb loops over all holders.)

### 5.5 `Governance.sol`
- `proposeBuyout(parcelId, pricePerShare)` — callable by a holder who controls ≥51% (the acquirer), or opens a general vote.
- 1 share = 1 vote. 7-day window. `vote(proposalId, support)`.
- On pass (≥51% of total shares vote yes): execute **squeeze-out** — remaining holders are paid `pricePerShare` in MNT from the acquirer's escrowed funds, their tokens transfer to the acquirer. Minority is guaranteed payment, cannot block.
- Record all votes/outcomes on-chain.

**Security basics (mention in README for compliance points):** access control on mint/register, reentrancy guards on all MNT transfers, checks-effects-interactions, no `tx.origin`, pull payments for yield.

---

## 6. AI services — specification

All AI runs server-side in Next.js route handlers using the **OpenAI API** (official `openai` npm SDK). Wrapper lives in `web/lib/ai.ts`. **Never expose the API key client-side.** Read it from `process.env.OPENAI_API_KEY`.

For each endpoint: call `chat.completions.create` with `model: "gpt-4o"`, a tightly-scoped system prompt, and **`response_format: { type: "json_object" }`** so the model returns strict JSON. Instruct it in the system prompt to return only the specified JSON shape (no markdown, no preamble), then `JSON.parse` defensively in a try/catch. For image inputs (deeds, IDs), pass them as image content parts: `{ type: "image_url", image_url: { url: "data:image/jpeg;base64,..." } }`.

`web/lib/ai.ts` should export one thin helper, e.g. `aiJSON({ system, user, images? }) => Promise<object>`, so all five routes share the same call path and you can swap models in one place.

### 6.1 `POST /api/verify-doc`
Input: deed image(s) (base64) + claimed fields (name, survey no., area).
Model: **GPT-4o** (vision). Extract fields, compare to claimed values, flag tamper signals, return:
```json
{ "extracted": {...}, "fieldMatches": {...}, "tamperFlags": [...], "docValidityScore": 0-100 }
```

### 6.2 `POST /api/valuation`
Input: geo coords, area, land use, (mocked) comparables + infra signals.
Output:
```json
{ "pricePerShareRange": [low, high], "suggestedPrice": n, "yieldEstimatePct": n, "rationale": "..." }
```

### 6.3 `POST /api/kyc`
Input: ID image + selfie (base64).
Output: `{ "idFields": {...}, "faceMatch": bool, "kycScore": 0-100 }`. Store only a hash of the result; write a KYC flag on-chain (or in DB for demo speed).

### 6.4 `POST /api/portfolio-agent`
Input: user's holdings + parcel stats.
Output: array of plain-English signals + suggested actions (rebalance/hold/sell) with reasons.

### 6.5 `POST /api/acquisition`
Input: target parcel, full holder table, acquirer budget.
Output: feasibility, cost to 51% and to 100%, ordered per-holder offer plan with suggested prices and sell-probability reasoning.

**Confidence score** = weighted blend of `docValidityScore`, geo-validity, and valuation certainty. Compute in `verify-doc` aggregation step. ≥80 auto-approve → backend signer calls `registerParcel`. 60–79 → human-review queue (a simple admin page). <60 → reject with reasons shown to seller.

---

## 7. Mantle configuration (TESTNET ONLY — use exactly these)

**This project deploys to Mantle Sepolia testnet only. Never deploy to or reference Mantle mainnet anywhere in code, scripts, or UI.**

```ts
// web/lib/mantle.ts
export const mantleSepolia = {
  id: 5003,
  name: 'Mantle Sepolia',
  nativeCurrency: { name: 'Mantle', symbol: 'MNT', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.sepolia.mantle.xyz'] } },
  blockExplorers: { default: { name: 'MantleSepoliaScan', url: 'https://sepolia.mantlescan.xyz' } },
  testnet: true,
};
```

- wagmi/viem exposes a built-in `mantleSepoliaTestnet` chain — prefer the built-in if present, else use the object above. Configure RainbowKit/wagmi with **only** this one chain so the wallet can't switch to mainnet.
- **Testnet faucet:** https://faucets.chain.link/mantle-sepolia — get free test MNT before deploying/demoing. (No real funds are ever used.)
- Foundry deploy target: `--rpc-url https://rpc.sepolia.mantle.xyz`. Verify on `sepolia.mantlescan.xyz`.
- The old chain ID **5001 (BIT) testnet is deprecated — never use it.** Mantle mainnet (5000) is **out of scope** for this project.

`.env` keys required: `OPENAI_API_KEY`, `DEPLOYER_PRIVATE_KEY` (a throwaway testnet-only wallet, never commit, never hold real funds), `NEXT_PUBLIC_*` contract addresses after deploy.

---

## 8. Build order (milestones — follow this sequence)

Ship a working vertical slice early; breadth over polish until the core loop works end-to-end.

**M1 — Contracts core.** ParcelRegistry + ShareToken + minting. Foundry tests green. Deploy to Mantle Sepolia. Save addresses.

**M2 — Map + listing read path.** Map explorer renders seeded parcels from chain/DB as GeoJSON polygons with demand/yield/ownership color modes. Parcel detail page reads on-chain state.

**M3 — AI verification + seller wizard.** Listing flow: upload deed → `/api/verify-doc` + `/api/valuation` → confidence score → on approval, backend signer mints. Show the AI output to the user (this is the demo money-shot).

**M4 — Primary buy + KYC.** wagmi buy button → Marketplace primary sale on Mantle. One-time KYC gate via `/api/kyc`. Tokens show in portfolio.

**M5 — Secondary + offers/escrow.** Listings and the direct-offer/escrow flow. Offer inbox UI.

**M6 — Acquisition + governance.** Full-parcel acquisition page using `/api/acquisition`; Governance buyout vote + squeeze-out.

**M7 — Yield + portfolio agent.** YieldSplitter claim flow; `/api/portfolio-agent` signals on the portfolio page.

**M8 — Polish + submission.** README, demo script, one-line pitch, record demo video.

### What to BUILD vs MOCK for the hackathon
- **Build real:** all 5 contracts on Mantle Sepolia, the AI endpoints (real OpenAI calls), the map, the core buy/offer loop, wallet connection.
- **Mock acceptably:** the government land-registry cross-check (use a seeded JSON of fake survey numbers), comparables/infra data feeds (seeded), the lessee depositing yield (an admin button calling `depositYield`), KYC persistence (DB flag). Label mocks clearly in code comments and README — judges reward honesty about scope.

---

## 9. Coding conventions

- TypeScript strict mode on. No `any` unless unavoidable (comment why).
- Contracts: NatSpec comments on every public function. Custom errors over `require` strings.
- Frontend: server components by default; client components only where wallet/interaction needed.
- All on-chain reads through viem; all writes through wagmi hooks with proper pending/success/error states.
- Money: store MNT amounts as `bigint` wei end-to-end; format only at the display edge.
- Keep components < ~200 lines; extract hooks into `web/hooks/`.
- Commit in small logical units with clear messages. One milestone ≈ a few commits.
- Add a short comment block at the top of each AI route documenting the expected JSON contract.

---

## 10. Common commands

```bash
# Contracts
cd contracts
forge build
forge test -vvv
forge script script/Deploy.s.sol --rpc-url https://rpc.sepolia.mantle.xyz --private-key $DEPLOYER_PRIVATE_KEY --broadcast --verify

# Web
cd web
npm install
npx prisma migrate dev
npm run dev          # http://localhost:3000
npm run build && npm start
```

After deploying contracts, copy addresses into `web/.env.local` as `NEXT_PUBLIC_*` and into `web/lib/contracts.ts`.

---

## 11. Submission requirements (the hackathon needs all three)

1. **Open-source repo** — public, with this README answering the three required questions (below).
2. **Demo** — a recorded walkthrough hitting: list a parcel → AI verifies → mint on Mantle → buyer KYC → buy shares → send an offer → governance buyout. Show the Mantle explorer txns.
3. **One-line pitch** — *"StrataFi: AI-verified fractional land ownership, traded like stocks on Mantle."*

### README must explicitly answer:
- **What RWA are we bringing on-chain?** Real-world land parcels, tokenized as fractional ERC-1155 shares anchored by geo-coordinates and a verified deed hash.
- **How does AI play a role?** AI verifies deeds (OCR + forgery + registry cross-check), validates geo boundaries, prices the asset and estimates yield, gates listings via a confidence score, and powers a portfolio agent + acquisition strategist.
- **How is it realized on Mantle?** All ownership, atomic trading, escrowed offers, pro-rata yield distribution, and token-weighted governance are smart contracts on Mantle Sepolia, chosen for EVM equivalence and gas low enough to make fractional-share micro-trades viable.

---

## 12. Scoring rubric — keep this in view at all times

**General (60%):**
- *Depth of AI × RWA integration* → AI must be load-bearing (gates minting, prices assets, drives decisions), not a chatbot bolted on.
- *Technical completeness* → end-to-end loop works on testnet; contracts tested.
- *Mantle integration* → real deployment, real txns, explorer links.
- *Compliance awareness* → KYC flow + the "investment instrument, not legal title" framing + basic contract security, all documented.

**Track-specific (40%) — we target BOTH paths but lead with Application (B):**
- *Application → Real-World Validity:* clear asset (land), defined users (sellers / fractional investors / acquirers), complete UX (map → buy → trade → govern → yield).
- *Infrastructure → Technical Feasibility:* the tokenization flow is complete and the per-holder offer/escrow + squeeze-out governance is a genuinely novel technical approach.

**Guiding principle:** a judge should, in 3 minutes, see real land go on-chain through AI verification, buy a fractional share on Mantle, and watch an offer settle atomically. Build toward that demo.
