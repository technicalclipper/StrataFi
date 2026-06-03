# StrataFi

**AI-verified fractional land ownership, traded like stocks on Mantle.**

StrataFi is an AI-powered marketplace that turns real-world land parcels into tradable on-chain shares. Explore parcels on a live map, invest fractionally, and trade ownership like stocks -- all settled on Mantle Sepolia.

---

## What RWA are we bringing on-chain?

**Real-world land parcels**, tokenized as fractional ERC-1155 shares. Each parcel is anchored on-chain by geo-coordinates and a verified title deed hash. The token represents a fractional investment instrument / parallel ownership ledger -- not a legal replacement for a government land title. Parcels are split into N shares (e.g. 200), so investors can own a fraction of a $50k plot for as little as 0.5 MNT.

## How does AI play a role?

AI is load-bearing across the entire platform -- it gates listing, prices assets, and drives investment decisions:

1. **Document Verification** (`/api/verify-doc`) -- GPT-4o OCR reads the uploaded deed, extracts fields, detects tampering signals, and cross-checks the survey number against a registry. Returns a doc validity score (0-100).

2. **Geo Validation** -- Validates that the drawn polygon boundary matches the claimed area and checks for overlaps with existing parcels and restricted zones.

3. **Valuation Engine** (`/api/valuation`) -- Produces a price-per-share range, suggested price, and yield estimate based on location, comparables, infrastructure proximity, and land use classification.

4. **Confidence Score** -- A weighted blend of document validity, geo validation, and valuation certainty. Score >= 80 auto-approves listing; 60-79 routes to human review; below 60 rejects with AI-written reasons.

5. **KYC Verification** (`/api/kyc`) -- GPT-4o vision analyzes government ID and selfie, extracts fields, and confirms face match. One-time verification tied to wallet address; only a hash is stored.

6. **Portfolio Agent** (`/api/portfolio-agent`) -- Monitors holdings, surfaces buy/sell signals (e.g. "metro announced 800m away -- projected +15%"), and suggests rebalancing in plain English.

7. **Acquisition Strategist** (`/api/acquisition`) -- For full-parcel buyouts: ranks holders by sell-probability, suggests per-holder offer prices, and computes the cheapest path to 51% control.

## How is it realized on Mantle?

All ownership, trading, escrowed offers, yield distribution, and governance are smart contracts deployed on **Mantle Sepolia testnet** (chain ID 5003). Mantle was chosen for:

- **EVM equivalence** -- standard Solidity, standard tooling
- **Very low L2 gas** -- makes fractional-share micro-trades (0.5 MNT per share) economically viable
- **Fast finality** -- atomic settlement for escrow swaps and squeeze-out payouts

Every financial action is atomic and on-chain: buying shares, placing escrowed offers, claiming yield, and governance buyout votes.

---

## Deployed Contracts (Mantle Sepolia)

| Contract | Address |
|---|---|
| ParcelRegistry | [`0x4E563f7c04b3d2049D3aFCB183CD57c7394dAFBa`](https://sepolia.mantlescan.xyz/address/0x4E563f7c04b3d2049D3aFCB183CD57c7394dAFBa) |
| ShareToken (ERC-1155) | [`0xdAe51E525fa951eF3772355c2cbe97A8566a307A`](https://sepolia.mantlescan.xyz/address/0xdAe51E525fa951eF3772355c2cbe97A8566a307A) |
| Marketplace | [`0x400c29db2F0234dD843F784A1D1bDb0B8fDdFB0e`](https://sepolia.mantlescan.xyz/address/0x400c29db2F0234dD843F784A1D1bDb0B8fDdFB0e) |
| YieldSplitter | [`0x3e682A2788F9320caB980E0917c11F0c72918C18`](https://sepolia.mantlescan.xyz/address/0x3e682A2788F9320caB980E0917c11F0c72918C18) |
| Governance | [`0x5Ca096E27d48452501fa221b2aE7e8c0a64Db9C7`](https://sepolia.mantlescan.xyz/address/0x5Ca096E27d48452501fa221b2aE7e8c0a64Db9C7) |

---

## Architecture

```
User (wallet) --> Next.js Frontend --> AI API Routes (GPT-4o)
                      |                       |
                      v                       v
                 wagmi/viem ----------> Mantle Sepolia
                                    (5 Solidity contracts)
```

### Smart Contracts

- **ParcelRegistry** -- Canonical record of each parcel (geoHash, docHash, confidence, totalShares, seller). Only authorized verifiers can register.
- **ShareToken (ERC-1155)** -- Token ID = parcel ID, balance = shares owned. Minter-controlled mint/burn.
- **Marketplace** -- Primary sales (seller pool), secondary listings, and direct offers with 72h escrowed MNT. Supports simultaneous per-holder offers for the acquisition flow. ReentrancyGuard on all MNT transfers.
- **YieldSplitter** -- Pro-rata pull-payment yield distribution. Holders call `claim()` to withdraw their share of deposited rental income.
- **Governance** -- 51% buyout proposal with 7-day voting (1 share = 1 vote). On pass: automatic squeeze-out pays remaining holders at the declared price.

### Frontend

- **Next.js 16** (App Router) + TypeScript + Tailwind CSS v4
- **wagmi 2.x + viem 2.x + RainbowKit 2.x** for wallet connection and contract interaction
- **MapLibre GL** with CARTO dark tiles for the map explorer
- Dark Bloomberg terminal-style theme with demand/yield/ownership heat overlays

### AI Stack

- **OpenAI GPT-4o** (multimodal) for document parsing, KYC verification, valuation reasoning
- All AI runs server-side in Next.js route handlers; API key never exposed client-side
- Structured JSON output via `response_format: { type: "json_object" }`

---

## Features

| Feature | Status |
|---|---|
| Map explorer with GeoJSON parcels + 3 overlay modes | Built |
| Parcel detail with stats, AI valuation, confidence meter, cap table | Built |
| Seller listing wizard (upload deed -> AI verify -> mint on Mantle) | Built |
| AI document verification (OCR + tamper detection + registry cross-check) | Built |
| AI valuation engine (price range + yield estimate) | Built |
| AI KYC (ID + selfie face match) | Built |
| Primary buy (wallet -> Marketplace.buyPrimary on Mantle) | Built |
| Secondary listings + direct offers with escrow | Built |
| Offer inbox (accept/reject incoming offers) | Built |
| Full-parcel acquisition with AI strategy | Built |
| Governance buyout (51% -> squeeze-out) | Built |
| Yield distribution (YieldSplitter.claim) | Built |
| AI portfolio agent (monitoring + signals) | Built |
| 30/30 Foundry tests passing | Built |

---

## Security Considerations

- **Access control**: Only authorized verifiers can register parcels; only authorized minters can mint shares
- **Reentrancy guards**: All MNT transfer functions use OpenZeppelin's ReentrancyGuard
- **Checks-effects-interactions**: State updated before external calls
- **Pull payments**: Yield claims use pull pattern (holders call `claim()`) to avoid gas-bomb loops
- **No `tx.origin`**: All auth uses `msg.sender`
- **Escrow expiry**: Offers expire after 72 hours with automatic refund capability
- **Compliance framing**: Token is explicitly framed as a "fractional investment instrument / parallel ownership ledger", not a legal land title replacement

---

## Running Locally

### Prerequisites
- Node.js 18+
- Foundry (`curl -L https://foundry.paradigm.xyz | bash && foundryup`)

### Contracts
```bash
cd contracts
forge build
forge test -vvv
```

### Frontend
```bash
cd frontend
npm install
cp .env.example .env.local  # add OPENAI_API_KEY
npm run dev                  # http://localhost:3000
```

### Environment Variables
```
OPENAI_API_KEY=sk-...
DEPLOYER_PRIVATE_KEY=0x...  # testnet-only throwaway wallet
NEXT_PUBLIC_PARCEL_REGISTRY=0x4E563f7c04b3d2049D3aFCB183CD57c7394dAFBa
NEXT_PUBLIC_SHARE_TOKEN=0xdAe51E525fa951eF3772355c2cbe97A8566a307A
NEXT_PUBLIC_MARKETPLACE=0x400c29db2F0234dD843F784A1D1bDb0B8fDdFB0e
NEXT_PUBLIC_YIELD_SPLITTER=0x3e682A2788F9320caB980E0917c11F0c72918C18
NEXT_PUBLIC_GOVERNANCE=0x5Ca096E27d48452501fa221b2aE7e8c0a64Db9C7
```

---

## Demo Flow

1. **Connect wallet** (Mantle Sepolia via RainbowKit)
2. **Explore map** -- Browse parcels, toggle demand/yield/ownership overlays
3. **Complete KYC** -- Upload ID + selfie, AI verifies
4. **List a parcel** -- Upload deed -> AI verifies + values -> Mint shares on Mantle
5. **Buy shares** -- Select a parcel, buy fractional shares (atomic on-chain)
6. **Send an offer** -- Target a specific holder, lock MNT in escrow
7. **Accept/reject offers** -- Offer inbox in portfolio
8. **Claim yield** -- Pull accrued rental income
9. **Full acquisition** -- AI suggests strategy, fire per-holder offers, propose 51% buyout

---

## Tech Stack

| Layer | Choice |
|---|---|
| Smart Contracts | Solidity ^0.8.24, Foundry |
| Token Standard | ERC-1155 (1 token ID per parcel) |
| Chain | Mantle Sepolia (5003) |
| Frontend | Next.js 16, TypeScript, Tailwind v4 |
| Web3 | wagmi 2.x, viem 2.x, RainbowKit 2.x |
| Map | MapLibre GL (CARTO dark tiles) |
| AI | OpenAI GPT-4o via server-side route handlers |

---

## What's Mocked (Hackathon Scope)

- Government land-registry cross-check (uses a seeded JSON of fake survey numbers)
- Comparable sales and infrastructure data feeds (seeded static data)
- Yield deposits (admin calls `depositYield` -- in production this would be an oracle/lessee)
- Portfolio holdings display (mock data -- in production, indexed from on-chain events)
- Offer inbox data (mock offers -- in production, indexed from contract events)

All mocks are clearly labeled in code comments. The AI endpoints, smart contracts, and wallet interactions are real.

---

## License

MIT
