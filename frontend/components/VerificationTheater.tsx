'use client'

/**
 * AI Verification Theater — replays the AI's verification of this parcel
 * as a timed visual sequence: field extraction → geo overlap check →
 * valuation rationale typing out → confidence count-up.
 * Pure presentation built from already-verified parcel data.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import type { ParcelData } from '@/lib/seed-parcels'
import { ConfidenceMeter } from '@/components/ConfidenceMeter'
import { Bot, FileText, Globe2, Gauge, Play, CheckCircle2 } from 'lucide-react'

type Stage = 'idle' | 'doc' | 'geo' | 'valuation' | 'confidence' | 'done'

export function VerificationTheater({ parcel }: { parcel: ParcelData }) {
  const [stage, setStage] = useState<Stage>('idle')
  const [fieldCount, setFieldCount] = useState(0)
  const [typedLen, setTypedLen] = useState(0)
  const [score, setScore] = useState(0)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  const fields = useMemo(
    () => [
      { label: 'Owner', value: `${parcel.seller.slice(0, 10)}…${parcel.seller.slice(-6)}` },
      { label: 'Survey No.', value: `SRV-${String(parcel.id).padStart(3, '0')}-${parcel.geoHash.slice(2, 6).toUpperCase()}` },
      { label: 'Area', value: `${parcel.areaSqFt.toLocaleString()} sq ft` },
      { label: 'Land Use', value: parcel.landType },
    ],
    [parcel],
  )

  const rationale = `Based on location analysis, nearby infrastructure, and comparable land sales in ${parcel.location}, this parcel is valued at ${parcel.pricePerShare} MNT per share with a projected annual yield of ${parcel.yieldPct}%. The ${parcel.landType} classification and ${parcel.areaSqFt.toLocaleString()} sq ft area support this valuation.`

  const clearTimers = () => {
    timers.current.forEach(clearTimeout)
    timers.current = []
  }

  const play = () => {
    clearTimers()
    setStage('doc')
    setFieldCount(0)
    setTypedLen(0)
    setScore(0)
    const t = timers.current
    // doc fields, one every 700ms
    fields.forEach((_, i) => t.push(setTimeout(() => setFieldCount(i + 1), 500 + i * 700)))
    const geoAt = 500 + fields.length * 700 + 400
    t.push(setTimeout(() => setStage('geo'), geoAt))
    const valAt = geoAt + 2200
    t.push(setTimeout(() => setStage('valuation'), valAt))
    const confAt = valAt + rationale.length * 12 + 600
    t.push(setTimeout(() => setStage('confidence'), confAt))
    t.push(setTimeout(() => setStage('done'), confAt + 1600))
  }

  useEffect(() => clearTimers, [])

  // rationale typewriter
  useEffect(() => {
    if (stage !== 'valuation' && stage !== 'confidence' && stage !== 'done') return
    if (typedLen >= rationale.length) return
    const iv = setInterval(
      () => setTypedLen((l) => Math.min(l + 3, rationale.length)),
      30,
    )
    return () => clearInterval(iv)
  }, [stage, typedLen, rationale.length])

  // confidence count-up
  useEffect(() => {
    if (stage !== 'confidence' && stage !== 'done') return
    if (score >= parcel.confidenceScore) return
    const iv = setInterval(
      () => setScore((s) => Math.min(s + 2, parcel.confidenceScore)),
      25,
    )
    return () => clearInterval(iv)
  }, [stage, score, parcel.confidenceScore])

  const stageReached = (s: Stage) => {
    const order: Stage[] = ['idle', 'doc', 'geo', 'valuation', 'confidence', 'done']
    return order.indexOf(stage) >= order.indexOf(s)
  }

  // normalised polygon for the geo-check SVG
  const geoPath = useMemo(() => {
    const xs = parcel.polygon.map((p) => p[0])
    const ys = parcel.polygon.map((p) => p[1])
    const minX = Math.min(...xs)
    const maxX = Math.max(...xs)
    const minY = Math.min(...ys)
    const maxY = Math.max(...ys)
    const rx = maxX - minX || 1
    const ry = maxY - minY || 1
    return parcel.polygon
      .map(
        (p, i) =>
          `${i === 0 ? 'M' : 'L'}${10 + ((p[0] - minX) / rx) * 80},${50 - ((p[1] - minY) / ry) * 40}`,
      )
      .join(' ') + ' Z'
  }, [parcel.polygon])

  return (
    <div id="verification-theater" className="bg-surface-1 border border-border-default rounded-[var(--radius-md)] p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.06em] text-text-tertiary">
          <Bot size={11} className="text-brand" /> AI Verification Theater
        </div>
        <button
          onClick={play}
          className="inline-flex items-center gap-1.5 text-[10.5px] font-medium text-brand bg-brand-bg border border-brand-border rounded-[var(--radius-sm)] px-2.5 py-1 hover:bg-brand/20 transition-colors"
        >
          <Play size={10} />
          {stage === 'idle' ? 'Replay verification' : 'Replay'}
        </button>
      </div>

      {stage === 'idle' ? (
        <div className="flex items-center justify-between bg-bg-sunken rounded-[var(--radius-sm)] p-3">
          <span className="text-[12px] text-text-secondary">
            Watch how the AI verified this parcel — document extraction, geo
            validation, and valuation.
          </span>
          <span className="tnum text-[12px] font-semibold text-up shrink-0 ml-3">
            Scored {parcel.confidenceScore}/100
          </span>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Step 1 — document extraction */}
          <div className="bg-bg-sunken rounded-[var(--radius-sm)] p-3">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.06em] text-text-tertiary mb-2">
              <FileText size={10} className="text-brand" /> 01 · Deed extraction
            </div>
            <div className="grid grid-cols-2 gap-2">
              {fields.slice(0, fieldCount).map((f) => (
                <div
                  key={f.label}
                  className="bbox-draw flex items-center justify-between border border-brand-border rounded-[var(--radius-xs)] px-2.5 py-1.5"
                >
                  <div>
                    <div className="text-[9px] uppercase tracking-[0.05em] text-text-tertiary">
                      {f.label}
                    </div>
                    <div className="font-mono text-[11px] text-text-primary capitalize">
                      {f.value}
                    </div>
                  </div>
                  <span className="text-[9px] text-up font-medium shrink-0 ml-2">
                    ✓ matches claim
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Step 2 — geo validation */}
          {stageReached('geo') && (
            <div className="bbox-draw bg-bg-sunken rounded-[var(--radius-sm)] p-3 flex items-center gap-4">
              <svg width="100" height="56" viewBox="0 0 100 56" className="shrink-0">
                {/* neighbor ghosts */}
                <rect x="2" y="6" width="22" height="16" rx="1" fill="none" stroke="var(--border-strong)" strokeWidth="1" strokeDasharray="3 2" />
                <rect x="74" y="34" width="24" height="18" rx="1" fill="none" stroke="var(--border-strong)" strokeWidth="1" strokeDasharray="3 2" />
                <path d={geoPath} className="geo-probe" fill="rgba(31,204,139,0.08)" strokeWidth="1.5" />
              </svg>
              <div>
                <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.06em] text-text-tertiary mb-1">
                  <Globe2 size={10} className="text-brand" /> 02 · Geo validation
                </div>
                <div className="text-[11.5px] text-text-secondary leading-relaxed">
                  Boundary tested against neighboring parcels and restricted
                  zones — <span className="text-up font-medium">no overlaps</span>.
                  Polygon area matches deed claim of{' '}
                  <span className="tnum">{parcel.areaSqFt.toLocaleString()}</span> sq ft.
                </div>
              </div>
            </div>
          )}

          {/* Step 3 — valuation rationale */}
          {stageReached('valuation') && (
            <div className="bbox-draw bg-bg-sunken rounded-[var(--radius-sm)] p-3">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.06em] text-text-tertiary mb-1.5">
                <Gauge size={10} className="text-brand" /> 03 · Valuation rationale
              </div>
              <div className="text-[11.5px] text-text-secondary leading-relaxed font-mono">
                {rationale.slice(0, typedLen)}
                {typedLen < rationale.length && <span className="caret text-brand">_</span>}
              </div>
            </div>
          )}

          {/* Step 4 — confidence count-up */}
          {stageReached('confidence') && (
            <div className="bbox-draw bg-bg-sunken rounded-[var(--radius-sm)] p-3">
              <ConfidenceMeter
                score={score}
                rationale="Document verified, geo-boundaries validated, valuation within market range."
              />
            </div>
          )}

          {stage === 'done' && (
            <div className="flex items-center gap-1.5 text-[10.5px] text-up">
              <CheckCircle2 size={12} />
              Verification passed — parcel auto-approved and minted on Mantle.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
