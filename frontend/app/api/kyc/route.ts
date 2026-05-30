/**
 * POST /api/kyc
 * AI KYC verification — ID + selfie face match
 *
 * Input: FormData with id_image and selfie (base64 images)
 * Output: { idFields, faceMatch, kycScore }
 */

import { NextRequest, NextResponse } from 'next/server'
import { aiJSON } from '@/lib/ai'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const idFile = formData.get('id_image') as File | null
    const selfieFile = formData.get('selfie') as File | null

    const images: { base64: string; mimeType?: string }[] = []

    if (idFile) {
      const buffer = Buffer.from(await idFile.arrayBuffer())
      images.push({ base64: buffer.toString('base64'), mimeType: idFile.type })
    }
    if (selfieFile) {
      const buffer = Buffer.from(await selfieFile.arrayBuffer())
      images.push({ base64: buffer.toString('base64'), mimeType: selfieFile.type })
    }

    const result = await aiJSON({
      system: `You are a KYC verification AI. Analyze the provided ID document image and selfie. Extract fields from the ID, and assess whether the selfie matches the ID photo.

Return ONLY this JSON:
{
  "idFields": { "name": "...", "dob": "...", "idNumber": "...", "nationality": "..." },
  "faceMatch": true/false,
  "kycScore": 0-100
}

Score: 90-100 = clear match; 70-89 = likely match with minor quality issues; below 70 = cannot verify.`,
      user: `${images.length === 2 ? 'First image is the ID document, second is the selfie.' : images.length === 1 ? 'One image provided (ID document).' : 'No images provided — return a low score.'}

Analyze and return the KYC verification JSON.`,
      images: images.length > 0 ? images : undefined,
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('kyc error:', error)
    return NextResponse.json(
      { error: 'KYC verification failed', kycScore: 0 },
      { status: 500 }
    )
  }
}
