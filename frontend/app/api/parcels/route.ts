/**
 * GET /api/parcels
 * Returns all minted parcels from the local data store
 */

import { NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import { join } from 'path'

const PARCELS_FILE = join(process.cwd(), 'data', 'parcels.json')

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const raw = readFileSync(PARCELS_FILE, 'utf-8')
    const parcels = JSON.parse(raw)
    return NextResponse.json(parcels)
  } catch {
    return NextResponse.json([])
  }
}
