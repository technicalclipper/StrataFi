/**
 * POST /api/valuation
 * AI land valuation — price per share range, yield estimate
 *
 * Input: { lat, lng, area, landType }
 * Output: { pricePerShareRange, suggestedPrice, yieldEstimatePct, rationale }
 */

import { NextRequest, NextResponse } from 'next/server'
import { aiJSON } from '@/lib/ai'

// Mock comparable sales data (seeded for hackathon)
const COMPARABLES = [
  { location: 'Whitefield, Bangalore', pricePerSqFt: 4500, landType: 'commercial', yieldPct: 8.0 },
  { location: 'Electronic City, Bangalore', pricePerSqFt: 3200, landType: 'residential', yieldPct: 6.5 },
  { location: 'Koramangala, Bangalore', pricePerSqFt: 12000, landType: 'commercial', yieldPct: 11.0 },
  { location: 'Hebbal, Bangalore', pricePerSqFt: 5500, landType: 'residential', yieldPct: 7.5 },
  { location: 'Devanahalli, Bangalore', pricePerSqFt: 1200, landType: 'agricultural', yieldPct: 4.0 },
  { location: 'Indiranagar, Bangalore', pricePerSqFt: 18000, landType: 'commercial', yieldPct: 14.0 },
  { location: 'Sarjapur Road, Bangalore', pricePerSqFt: 4000, landType: 'residential', yieldPct: 7.0 },
]

// Mock infrastructure proximity data
const INFRA_SIGNALS = [
  { type: 'metro_station', distKm: 1.2, impact: '+8% premium' },
  { type: 'highway', distKm: 0.5, impact: '+5% premium' },
  { type: 'school_cluster', distKm: 2.0, impact: '+3% premium' },
  { type: 'hospital', distKm: 3.5, impact: '+2% premium' },
]

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { lat, lng, area, landType } = body

    const relevantComps = COMPARABLES.filter(
      (c) => c.landType === landType || true
    ).slice(0, 4)

    const result = await aiJSON({
      system: `You are a land valuation AI for the StrataFi platform. Given location, area, land type, comparable sales, and infrastructure proximity data, produce a valuation.

Return ONLY this JSON:
{
  "pricePerShareRange": [low_number, high_number],
  "suggestedPrice": number,
  "yieldEstimatePct": number,
  "rationale": "2-3 sentence explanation of the valuation"
}

Assume 100 shares per parcel for price calculation. Express prices in MNT (1 MNT ≈ $0.42). Be analytical and specific in the rationale.`,
      user: `Location: lat ${lat}, lng ${lng} (Bangalore area)
Area: ${area} sq ft
Land type: ${landType}

Comparable sales data:
${relevantComps.map((c) => `- ${c.location}: ${c.pricePerSqFt} INR/sqft (${c.landType}), yield ${c.yieldPct}%`).join('\n')}

Infrastructure proximity:
${INFRA_SIGNALS.map((i) => `- ${i.type}: ${i.distKm}km away (${i.impact})`).join('\n')}

Provide the valuation JSON.`,
      model: 'gpt-4o-mini',
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('valuation error:', error)
    return NextResponse.json(
      { error: 'Valuation failed' },
      { status: 500 }
    )
  }
}
