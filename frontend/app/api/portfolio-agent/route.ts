/**
 * POST /api/portfolio-agent
 * AI portfolio monitoring — plain-English signals and suggestions
 *
 * Input: { holdings: [{ parcelId, shares, avgCost }], parcelStats: [...] }
 * Output: { signals: [{ parcelId, message, action, severity }] }
 */

import { NextRequest, NextResponse } from 'next/server'
import { aiJSON } from '@/lib/ai'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { holdings, parcelStats } = body

    const result = await aiJSON({
      system: `You are a portfolio monitoring AI agent for StrataFi, a fractional land investment platform. Analyze the user's holdings and current parcel stats, then generate actionable signals.

Return ONLY this JSON:
{
  "signals": [
    {
      "parcelId": number,
      "message": "one plain-English insight sentence",
      "action": "Hold" | "Trim" | "Buy More" | "Sell" | "Rebalance" | "View",
      "severity": "info" | "warning" | "opportunity"
    }
  ]
}

Generate 3-5 signals. Be analytical and specific. Reference real numbers from the data. Tone: like a fund manager's morning brief — concise, data-driven, no fluff.`,
      user: `User holdings:
${JSON.stringify(holdings, null, 2)}

Current parcel stats:
${JSON.stringify(parcelStats, null, 2)}

Analyze and return portfolio signals.`,
      model: 'gpt-4o-mini',
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('portfolio-agent error:', error)
    return NextResponse.json(
      { error: 'Portfolio analysis failed', signals: [] },
      { status: 500 }
    )
  }
}
