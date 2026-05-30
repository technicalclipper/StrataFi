/**
 * POST /api/acquisition
 * AI acquisition strategist — per-holder offer plan for full parcel buyout
 *
 * Input: { parcelId, holders: [{address, shares, pct}], totalShares, budget, currentPrice }
 * Output: { feasibility, costTo51Pct, costTo100Pct, offerPlan: [{address, shares, suggestedPrice, sellProbability, reasoning}] }
 */

import { NextRequest, NextResponse } from 'next/server'
import { aiJSON } from '@/lib/ai'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { parcelId, holders, totalShares, budget, currentPrice } = body

    const result = await aiJSON({
      system: `You are an acquisition strategist AI for StrataFi. Given a target parcel's cap table, current price, and the acquirer's budget, produce a detailed acquisition plan.

Return ONLY this JSON:
{
  "feasibility": "feasible" | "challenging" | "infeasible",
  "costTo51Pct": number,
  "costTo100Pct": number,
  "offerPlan": [
    {
      "address": "0x...",
      "shares": number,
      "suggestedPrice": number,
      "sellProbability": "high" | "medium" | "low",
      "reasoning": "one sentence why this holder is likely/unlikely to sell at this price"
    }
  ],
  "strategy": "1-2 sentence overall acquisition strategy summary"
}

Order offerPlan by sell-probability (highest first). Suggest lower prices for likely sellers and higher for reluctant ones. The goal is to minimize total cost while maximizing chances of reaching 51%+ ownership.`,
      user: `Target parcel ID: ${parcelId}
Total shares: ${totalShares}
Current price/share: ${currentPrice} MNT
Acquirer budget: ${budget} MNT

Current holders:
${holders.map((h: { address: string; shares: number; pct: number }) => `- ${h.address}: ${h.shares} shares (${h.pct.toFixed(1)}%)`).join('\n')}

Produce the acquisition strategy JSON.`,
      model: 'gpt-4o-mini',
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('acquisition error:', error)
    return NextResponse.json(
      { error: 'Acquisition analysis failed' },
      { status: 500 }
    )
  }
}
