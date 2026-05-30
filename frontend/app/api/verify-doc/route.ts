/**
 * POST /api/verify-doc
 * AI document verification — OCR + field extraction + tamper detection
 *
 * Input: FormData with deed image + claimed fields (name, surveyNo, area)
 * Output: { extracted, fieldMatches, tamperFlags, docValidityScore }
 */

import { NextRequest, NextResponse } from 'next/server'
import { aiJSON } from '@/lib/ai'

// Mock registry of known survey numbers (for hackathon)
const MOCK_REGISTRY: Record<string, { owner: string; area: string }> = {
  'SY-2024-1234': { owner: 'Rajesh Kumar', area: '24000' },
  'SY-2024-5678': { owner: 'Priya Sharma', area: '12000' },
  'SY-2023-9012': { owner: 'Amit Patel', area: '108000' },
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const deedFile = formData.get('deed') as File | null
    const claimedName = formData.get('name') as string
    const claimedSurveyNo = formData.get('surveyNo') as string
    const claimedArea = formData.get('area') as string

    let images: { base64: string; mimeType?: string }[] | undefined

    if (deedFile) {
      const buffer = Buffer.from(await deedFile.arrayBuffer())
      images = [{ base64: buffer.toString('base64'), mimeType: deedFile.type }]
    }

    // Cross-check survey number against mock registry
    const registryMatch = MOCK_REGISTRY[claimedSurveyNo]
    const registryNote = registryMatch
      ? `Registry match found: owner="${registryMatch.owner}", area=${registryMatch.area} sq ft.`
      : `Survey number "${claimedSurveyNo}" not found in registry (mocked). Proceeding with document analysis only.`

    const result = await aiJSON({
      system: `You are a land document verification AI. Analyze the uploaded title deed image (if provided) and the claimed fields. Extract key fields from the document, compare with claimed values, detect any signs of tampering or forgery, and cross-check with registry data.

Return ONLY this JSON:
{
  "extracted": { "name": "...", "surveyNo": "...", "area": "...", "additionalFields": {} },
  "fieldMatches": { "name": true/false, "surveyNo": true/false, "area": true/false },
  "tamperFlags": ["list of suspicious findings, empty if clean"],
  "docValidityScore": 0-100
}

Score guidelines: 90-100 = perfect document, all fields match; 70-89 = minor discrepancies but likely valid; 50-69 = significant concerns, needs review; below 50 = likely invalid or forged.`,
      user: `Claimed fields:
- Owner name: "${claimedName}"
- Survey number: "${claimedSurveyNo}"
- Area: "${claimedArea}" sq ft

Registry cross-check: ${registryNote}

${images ? 'A deed image has been provided for analysis.' : 'No deed image provided — score based on field consistency and registry match only.'}

Analyze and return the verification JSON.`,
      images,
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('verify-doc error:', error)
    return NextResponse.json(
      { error: 'Verification failed', docValidityScore: 0 },
      { status: 500 }
    )
  }
}
