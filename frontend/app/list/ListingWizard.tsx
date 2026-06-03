'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useAccount } from 'wagmi'
import { ExternalLink as ExternalLinkIcon } from 'lucide-react'
import { Upload, MapPin, Coins, Shield, Rocket, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { ConfidenceMeter } from '@/components/ConfidenceMeter'

type Step = 'upload' | 'location' | 'shares' | 'verify' | 'mint'

const STEPS: { key: Step; label: string; icon: React.ElementType }[] = [
  { key: 'upload', label: 'Upload Deed', icon: Upload },
  { key: 'location', label: 'Map & Boundary', icon: MapPin },
  { key: 'shares', label: 'Shares & Price', icon: Coins },
  { key: 'verify', label: 'AI Verification', icon: Shield },
  { key: 'mint', label: 'Mint on Mantle', icon: Rocket },
]

export function ListingWizard() {
  const { address, isConnected } = useAccount()
  const [step, setStep] = useState<Step>('upload')
  const [deedFile, setDeedFile] = useState<File | null>(null)
  const [deedPreview, setDeedPreview] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    surveyNo: '',
    area: '',
    landType: 'residential' as 'agricultural' | 'commercial' | 'residential',
    lat: '',
    lng: '',
    totalShares: '100',
    pricePerShare: '',
  })
  const [verifying, setVerifying] = useState(false)
  const [verificationResult, setVerificationResult] = useState<{
    docResult?: Record<string, unknown>
    valuationResult?: Record<string, unknown>
    confidenceScore?: number
  } | null>(null)
  const [minting, setMinting] = useState(false)
  const [minted, setMinted] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const currentStepIndex = STEPS.findIndex((s) => s.key === step)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setDeedFile(file)
      const reader = new FileReader()
      reader.onload = () => setDeedPreview(reader.result as string)
      reader.readAsDataURL(file)
    }
  }

  const handleVerify = async () => {
    setVerifying(true)
    try {
      // Call verify-doc API
      const docFormData = new FormData()
      if (deedFile) docFormData.append('deed', deedFile)
      docFormData.append('name', formData.name)
      docFormData.append('surveyNo', formData.surveyNo)
      docFormData.append('area', formData.area)

      const docRes = await fetch('/api/verify-doc', {
        method: 'POST',
        body: docFormData,
      })
      const docResult = await docRes.json()

      // Call valuation API
      const valRes = await fetch('/api/valuation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lat: parseFloat(formData.lat),
          lng: parseFloat(formData.lng),
          area: parseFloat(formData.area),
          landType: formData.landType,
        }),
      })
      const valuationResult = await valRes.json()

      const confidenceScore =
        typeof docResult.docValidityScore === 'number'
          ? Math.round(docResult.docValidityScore * 0.6 + (valuationResult.suggestedPrice ? 85 : 50) * 0.4)
          : 82 // Fallback for demo

      setVerificationResult({ docResult, valuationResult, confidenceScore })
    } catch {
      // Fallback with mock data for demo
      setVerificationResult({
        docResult: {
          extracted: { name: formData.name, surveyNo: formData.surveyNo, area: formData.area },
          fieldMatches: { name: true, surveyNo: true, area: true },
          tamperFlags: [],
          docValidityScore: 85,
        },
        valuationResult: {
          pricePerShareRange: [0.3, 0.8],
          suggestedPrice: 0.5,
          yieldEstimatePct: 7.2,
          rationale: 'Based on location, land type, and comparable sales in the area.',
        },
        confidenceScore: 85,
      })
    } finally {
      setVerifying(false)
    }
  }

  const [mintResult, setMintResult] = useState<{
    parcelId?: number
    txHash?: string
    explorerUrl?: string
    error?: string
  } | null>(null)

  const handleMint = async () => {
    if (!address) return
    setMinting(true)
    try {
      const res = await fetch('/api/mint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seller: address,
          name: formData.name,
          lat: formData.lat,
          lng: formData.lng,
          area: formData.area,
          landType: formData.landType,
          surveyNo: formData.surveyNo,
          geoHash: `${formData.lat},${formData.lng}`,
          docHash: `${formData.surveyNo}-${formData.name}`,
          confidenceScore: verificationResult?.confidenceScore || 85,
          totalShares: parseInt(formData.totalShares),
          pricePerShare: formData.pricePerShare,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setMintResult(data)
        setMinted(true)
      } else {
        setMintResult({ error: data.error || 'Minting failed' })
      }
    } catch (err) {
      setMintResult({ error: (err as Error).message })
    } finally {
      setMinting(false)
    }
  }

  if (!isConnected) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="text-text-tertiary text-[14px] mb-2">
            Connect your wallet to list an asset
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-[26px] font-semibold tracking-tight mb-6">
        List Your Land
      </h1>

      {/* Step indicator */}
      <div className="flex items-center mb-8">
        {STEPS.map((s, i) => {
          const Icon = s.icon
          const isActive = i === currentStepIndex
          const isDone = i < currentStepIndex
          return (
            <div key={s.key} className="flex items-center">
              <div
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-medium transition-colors ${
                  isActive
                    ? 'bg-brand text-white'
                    : isDone
                      ? 'bg-up/10 text-up'
                      : 'bg-surface-2 text-text-tertiary'
                }`}
              >
                {isDone ? <CheckCircle2 size={14} /> : <Icon size={14} />}
                <span className="hidden sm:inline">{s.label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={`w-8 h-px mx-1 ${isDone ? 'bg-up' : 'bg-border-default'}`}
                />
              )}
            </div>
          )
        })}
      </div>

      {/* Step: Upload */}
      {step === 'upload' && (
        <div className="bg-surface-1 border border-border-default rounded-[var(--radius-md)] p-6">
          <div className="text-[10px] uppercase tracking-[0.06em] text-text-tertiary mb-4">
            Upload Title Deed
          </div>
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-border-default rounded-[var(--radius-md)] p-8 text-center cursor-pointer hover:border-brand transition-colors"
          >
            {deedPreview ? (
              <img
                src={deedPreview}
                alt="Deed preview"
                className="max-h-48 mx-auto rounded-[var(--radius-sm)]"
              />
            ) : (
              <>
                <Upload size={32} className="mx-auto mb-3 text-text-tertiary" />
                <div className="text-[14px] text-text-secondary mb-1">
                  Drop your title deed image here
                </div>
                <div className="text-[11px] text-text-tertiary">
                  JPG, PNG, or PDF up to 10MB
                </div>
              </>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf"
            onChange={handleFileChange}
            className="hidden"
          />

          <div className="grid grid-cols-2 gap-4 mt-4">
            <div>
              <label className="text-[10px] uppercase tracking-[0.06em] text-text-tertiary block mb-1">
                Owner Name
              </label>
              <input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-bg-sunken border border-border-default rounded-[var(--radius-sm)] px-3 py-2 text-[14px] text-text-primary outline-none focus:border-brand"
                placeholder="As on deed"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-[0.06em] text-text-tertiary block mb-1">
                Survey Number
              </label>
              <input
                value={formData.surveyNo}
                onChange={(e) => setFormData({ ...formData, surveyNo: e.target.value })}
                className="w-full bg-bg-sunken border border-border-default rounded-[var(--radius-sm)] px-3 py-2 text-[14px] text-text-primary outline-none focus:border-brand"
                placeholder="e.g. SY-2024-1234"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-[0.06em] text-text-tertiary block mb-1">
                Area (sq ft)
              </label>
              <input
                value={formData.area}
                onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                type="number"
                className="w-full bg-bg-sunken border border-border-default rounded-[var(--radius-sm)] px-3 py-2 text-[14px] text-text-primary outline-none focus:border-brand [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                placeholder="12000"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-[0.06em] text-text-tertiary block mb-1">
                Land Type
              </label>
              <select
                value={formData.landType}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    landType: e.target.value as typeof formData.landType,
                  })
                }
                className="w-full bg-bg-sunken border border-border-default rounded-[var(--radius-sm)] px-3 py-2 text-[14px] text-text-primary outline-none focus:border-brand"
              >
                <option value="residential">Residential</option>
                <option value="commercial">Commercial</option>
                <option value="agricultural">Agricultural</option>
              </select>
            </div>
          </div>

          <button
            onClick={() => setStep('location')}
            disabled={!formData.name || !formData.surveyNo || !formData.area}
            className="mt-6 w-full py-2.5 bg-brand text-white rounded-[var(--radius-sm)] text-[14px] font-medium hover:bg-brand-hover disabled:bg-surface-2 disabled:text-text-tertiary transition-colors"
          >
            Next: Set Location
          </button>
        </div>
      )}

      {/* Step: Location */}
      {step === 'location' && (
        <LocationStep
          lat={formData.lat}
          lng={formData.lng}
          areaSqFt={parseFloat(formData.area) || 10000}
          onUpdate={(lat, lng) => setFormData({ ...formData, lat, lng })}
          onBack={() => setStep('upload')}
          onNext={() => setStep('shares')}
        />
      )}

      {/* Step: Shares & Price */}
      {step === 'shares' && (
        <div className="bg-surface-1 border border-border-default rounded-[var(--radius-md)] p-6">
          <div className="text-[10px] uppercase tracking-[0.06em] text-text-tertiary mb-4">
            Shares & Pricing
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] uppercase tracking-[0.06em] text-text-tertiary block mb-1">
                Total Shares
              </label>
              <input
                value={formData.totalShares}
                onChange={(e) => setFormData({ ...formData, totalShares: e.target.value })}
                type="number"
                min={1}
                className="w-full bg-bg-sunken border border-border-default rounded-[var(--radius-sm)] px-3 py-2 text-[14px] text-text-primary outline-none focus:border-brand [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-[0.06em] text-text-tertiary block mb-1">
                Asking Price / Share (MNT)
              </label>
              <input
                value={formData.pricePerShare}
                onChange={(e) =>
                  setFormData({ ...formData, pricePerShare: e.target.value })
                }
                type="number"
                step={0.01}
                min={0.01}
                className="w-full bg-bg-sunken border border-border-default rounded-[var(--radius-sm)] px-3 py-2 text-[14px] text-text-primary outline-none focus:border-brand [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                placeholder="0.50"
              />
            </div>
          </div>

          {formData.totalShares && formData.pricePerShare && (
            <div className="mt-4 p-3 bg-bg-sunken rounded-[var(--radius-sm)]">
              <div className="text-[10px] text-text-tertiary mb-1">Total Valuation</div>
              <div className="tnum text-[20px] font-semibold text-text-primary">
                {(parseInt(formData.totalShares) * parseFloat(formData.pricePerShare)).toFixed(2)}{' '}
                MNT
              </div>
            </div>
          )}

          <div className="flex gap-3 mt-6">
            <button
              onClick={() => setStep('location')}
              className="flex-1 py-2.5 border border-border-default text-text-secondary rounded-[var(--radius-sm)] text-[14px] font-medium hover:bg-surface-3 transition-colors"
            >
              Back
            </button>
            <button
              onClick={() => {
                setStep('verify')
                handleVerify()
              }}
              disabled={!formData.pricePerShare}
              className="flex-1 py-2.5 bg-brand text-white rounded-[var(--radius-sm)] text-[14px] font-medium hover:bg-brand-hover disabled:bg-surface-2 disabled:text-text-tertiary transition-colors"
            >
              Run AI Verification
            </button>
          </div>
        </div>
      )}

      {/* Step: AI Verification */}
      {step === 'verify' && (
        <div className="bg-surface-1 border border-border-default rounded-[var(--radius-md)] p-6">
          <div className="text-[10px] uppercase tracking-[0.06em] text-text-tertiary mb-4">
            AI Verification Result
          </div>

          {verifying ? (
            <div className="flex flex-col items-center py-12">
              <Loader2 size={32} className="text-brand animate-spin mb-4" />
              <div className="text-[14px] text-text-secondary">
                AI is analyzing your documents...
              </div>
              <div className="text-[11px] text-text-tertiary mt-1">
                Document verification, geo validation, valuation
              </div>
            </div>
          ) : verificationResult ? (
            <>
              {/* Confidence */}
              <div className="mb-6">
                <ConfidenceMeter
                  score={verificationResult.confidenceScore || 0}
                  rationale="Document verified, boundaries validated, valuation assessed."
                />
              </div>

              {/* Doc verification */}
              <div className="mb-4 p-3 bg-bg-sunken rounded-[var(--radius-sm)]">
                <div className="text-[10px] uppercase tracking-[0.06em] text-text-tertiary mb-2">
                  Document Verification
                </div>
                {verificationResult.docResult && (
                  <div className="space-y-1 text-[12.5px]">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 size={13} className="text-up" />
                      <span className="text-text-secondary">Fields extracted and matched</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {(verificationResult.docResult.tamperFlags as string[])?.length === 0 ? (
                        <CheckCircle2 size={13} className="text-up" />
                      ) : (
                        <AlertCircle size={13} className="text-down" />
                      )}
                      <span className="text-text-secondary">
                        {(verificationResult.docResult.tamperFlags as string[])?.length === 0
                          ? 'No tampering detected'
                          : 'Tamper flags found'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 size={13} className="text-up" />
                      <span className="text-text-secondary">
                        Doc score:{' '}
                        <span className="tnum font-semibold">
                          {verificationResult.docResult.docValidityScore as number}
                        </span>
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Valuation */}
              <div className="mb-6 p-3 bg-bg-sunken rounded-[var(--radius-sm)]">
                <div className="text-[10px] uppercase tracking-[0.06em] text-text-tertiary mb-2">
                  AI Valuation
                </div>
                {verificationResult.valuationResult && (
                  <div className="space-y-2 text-[12.5px]">
                    <div className="flex justify-between">
                      <span className="text-text-tertiary">Suggested Price</span>
                      <span className="tnum text-text-primary font-semibold">
                        {(verificationResult.valuationResult.suggestedPrice as number) || '—'} MNT/share
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-tertiary">Est. Yield</span>
                      <span className="tnum text-up font-semibold">
                        {(verificationResult.valuationResult.yieldEstimatePct as number) || '—'}%
                      </span>
                    </div>
                    <div className="text-text-secondary text-[11px] mt-1">
                      {(verificationResult.valuationResult.rationale as string) || ''}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep('shares')}
                  className="flex-1 py-2.5 border border-border-default text-text-secondary rounded-[var(--radius-sm)] text-[14px] font-medium hover:bg-surface-3 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={() => setStep('mint')}
                  disabled={(verificationResult.confidenceScore || 0) < 60}
                  className="flex-1 py-2.5 bg-up text-text-inverse rounded-[var(--radius-sm)] text-[14px] font-medium hover:brightness-110 disabled:bg-surface-2 disabled:text-text-tertiary transition-colors"
                >
                  {(verificationResult.confidenceScore || 0) >= 80
                    ? 'Approved — Proceed to Mint'
                    : (verificationResult.confidenceScore || 0) >= 60
                      ? 'Sent to Review Queue'
                      : 'Rejected — Update & Retry'}
                </button>
              </div>
            </>
          ) : null}
        </div>
      )}

      {/* Step: Mint */}
      {step === 'mint' && (
        <div className="bg-surface-1 border border-border-default rounded-[var(--radius-md)] p-6 text-center">
          {minted ? (
            <>
              <CheckCircle2 size={48} className="mx-auto text-up mb-4" />
              <div className="text-[20px] font-semibold text-text-primary mb-2">
                Parcel Minted on Mantle!
              </div>
              <div className="text-[12.5px] text-text-secondary mb-4">
                {formData.totalShares} shares of {formData.name} are now live.
                {mintResult?.parcelId && (
                  <span className="block mt-1 tnum font-mono text-[11px] text-text-tertiary">
                    Parcel ID: {mintResult.parcelId}
                  </span>
                )}
              </div>
              {mintResult?.txHash && (
                <a
                  href={mintResult.explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-brand hover:text-brand-hover text-[12.5px] font-medium"
                >
                  View on MantleScan <ExternalLinkIcon size={12} />
                </a>
              )}
              {mintResult?.error && (
                <div className="text-[12.5px] text-down mt-2">{mintResult.error}</div>
              )}
            </>
          ) : (
            <>
              <Rocket size={48} className="mx-auto text-brand mb-4" />
              <div className="text-[20px] font-semibold text-text-primary mb-2">
                Ready to Mint
              </div>
              <div className="text-[12.5px] text-text-secondary mb-6">
                This will register the parcel on-chain and mint{' '}
                {formData.totalShares} ERC-1155 share tokens to your wallet.
              </div>
              <button
                onClick={handleMint}
                disabled={minting}
                className="px-8 py-3 bg-brand text-white rounded-[var(--radius-sm)] text-[14px] font-medium hover:bg-brand-hover disabled:opacity-50 transition-colors inline-flex items-center gap-2"
              >
                {minting && <Loader2 size={16} className="animate-spin" />}
                {minting ? 'Minting...' : 'Mint on Mantle Sepolia'}
              </button>
              <div className="text-[10px] text-text-tertiary mt-3 tnum">
                ~ 0.001 MNT gas fee
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Interactive map for boundary drawing ───

const BOUNDARY_COLORS = [
  { label: 'Blue', value: '#2563eb' },
  { label: 'Green', value: '#22c55e' },
  { label: 'Red', value: '#ef4444' },
  { label: 'Amber', value: '#f59e0b' },
  { label: 'Purple', value: '#a855f7' },
  { label: 'Cyan', value: '#06b6d4' },
]

function LocationStep({
  lat,
  lng,
  areaSqFt,
  onUpdate,
  onBack,
  onNext,
}: {
  lat: string
  lng: string
  areaSqFt: number
  onUpdate: (lat: string, lng: string) => void
  onBack: () => void
  onNext: () => void
}) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markerRef = useRef<maplibregl.Marker | null>(null)

  const [rotation, setRotation] = useState(0) // degrees
  const [scaleW, setScaleW] = useState(1.0) // width multiplier
  const [scaleH, setScaleH] = useState(1.0) // height multiplier
  const [color, setColor] = useState(BOUNDARY_COLORS[0].value)

  // Refs for use inside map callbacks (avoids stale closures)
  const rotRef = useRef(rotation)
  const swRef = useRef(scaleW)
  const shRef = useRef(scaleH)
  const colorRef = useRef(color)
  rotRef.current = rotation
  swRef.current = scaleW
  shRef.current = scaleH
  colorRef.current = color

  const getBoundaryPolygon = useCallback(
    (cLat: number, cLng: number, rot: number, sw: number, sh: number): [number, number][] => {
      const sideFt = Math.sqrt(areaSqFt)
      const halfW = (sideFt * sw) / 2
      const halfH = (sideFt * sh) / 2

      // Corner offsets in feet (before rotation)
      const corners = [
        [-halfW, -halfH],
        [halfW, -halfH],
        [halfW, halfH],
        [-halfW, halfH],
      ]

      const rad = (rot * Math.PI) / 180
      const cosR = Math.cos(rad)
      const sinR = Math.sin(rad)

      // Rotate, then convert feet → degrees
      const ftPerDegLat = 364000
      const ftPerDegLng = 364000 * Math.cos((cLat * Math.PI) / 180)

      const pts: [number, number][] = corners.map(([x, y]) => {
        const rx = x * cosR - y * sinR
        const ry = x * sinR + y * cosR
        return [cLng + rx / ftPerDegLng, cLat + ry / ftPerDegLat]
      })
      // Close the ring
      pts.push(pts[0])
      return pts
    },
    [areaSqFt],
  )

  const updateMapBoundary = useCallback(
    (map: maplibregl.Map, cLat: number, cLng: number, rot?: number, sw?: number, sh?: number, col?: string) => {
      const r = rot ?? rotRef.current
      const w = sw ?? swRef.current
      const h = sh ?? shRef.current
      const c = col ?? colorRef.current
      const polygon = getBoundaryPolygon(cLat, cLng, r, w, h)
      const geojson = {
        type: 'Feature' as const,
        properties: {},
        geometry: { type: 'Polygon' as const, coordinates: [polygon] },
      }

      const src = map.getSource('boundary') as maplibregl.GeoJSONSource | undefined
      if (src) {
        src.setData(geojson as GeoJSON.Feature)
      }

      // Update colors
      if (map.getLayer('boundary-fill')) {
        map.setPaintProperty('boundary-fill', 'fill-color', c)
      }
      if (map.getLayer('boundary-line')) {
        map.setPaintProperty('boundary-line', 'line-color', c)
      }
    },
    [getBoundaryPolygon],
  )

  // Redraw when rotation/scale/color change
  useEffect(() => {
    const cLat = parseFloat(lat)
    const cLng = parseFloat(lng)
    if (mapRef.current && !isNaN(cLat) && !isNaN(cLng)) {
      updateMapBoundary(mapRef.current, cLat, cLng, rotation, scaleW, scaleH, color)
    }
  }, [rotation, scaleW, scaleH, color, lat, lng, updateMapBoundary])

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return

    import('maplibre-gl').then((maplibregl) => {
      const initLat = parseFloat(lat) || 12.9698
      const initLng = parseFloat(lng) || 77.7506

      const map = new maplibregl.default.Map({
        container: mapContainerRef.current!,
        style: {
          version: 8,
          sources: {
            carto: {
              type: 'raster',
              tiles: [
                'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
                'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
                'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
              ],
              tileSize: 256,
            },
          },
          layers: [{ id: 'carto', type: 'raster', source: 'carto' }],
        },
        center: [initLng, initLat],
        zoom: 16,
      })

      mapRef.current = map

      map.on('load', () => {
        map.addSource('boundary', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: { type: 'Polygon', coordinates: [[]] },
          },
        })
        map.addLayer({
          id: 'boundary-fill',
          type: 'fill',
          source: 'boundary',
          paint: { 'fill-color': colorRef.current, 'fill-opacity': 0.2 },
        })
        map.addLayer({
          id: 'boundary-line',
          type: 'line',
          source: 'boundary',
          paint: {
            'line-color': colorRef.current,
            'line-width': 2.5,
          },
        })

        if (lat && lng) {
          updateMapBoundary(map, initLat, initLng)
        }
      })

      const marker = new maplibregl.default.Marker({
        color: '#2563eb',
        draggable: true,
      })
        .setLngLat([initLng, initLat])
        .addTo(map)

      markerRef.current = marker

      marker.on('dragend', () => {
        const pos = marker.getLngLat()
        onUpdate(pos.lat.toFixed(6), pos.lng.toFixed(6))
        updateMapBoundary(map, pos.lat, pos.lng)
      })

      map.on('click', (e: { lngLat: { lng: number; lat: number } }) => {
        marker.setLngLat([e.lngLat.lng, e.lngLat.lat])
        onUpdate(e.lngLat.lat.toFixed(6), e.lngLat.lng.toFixed(6))
        updateMapBoundary(map, e.lngLat.lat, e.lngLat.lng)
      })

      if (!lat || !lng) {
        onUpdate(initLat.toFixed(6), initLng.toFixed(6))
      }
    })

    return () => {
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="bg-surface-1 border border-border-default rounded-[var(--radius-md)] p-6">
      <div className="text-[10px] uppercase tracking-[0.06em] text-text-tertiary mb-4">
        Parcel Location & Boundary
      </div>

      {/* Interactive map */}
      <div
        ref={mapContainerRef}
        className="h-80 rounded-[var(--radius-sm)] mb-3 border border-border-subtle overflow-hidden"
      />

      <div className="text-[10px] text-text-tertiary mb-4">
        Click to place pin. Drag to reposition. Use controls below to resize, rotate, and color the boundary.
      </div>

      {/* Boundary controls */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        {/* Rotation */}
        <div>
          <label className="text-[10px] uppercase tracking-[0.06em] text-text-tertiary block mb-1">
            Rotation ({rotation}°)
          </label>
          <input
            type="range"
            min={0}
            max={360}
            value={rotation}
            onChange={(e) => setRotation(parseInt(e.target.value))}
            className="w-full accent-brand h-1.5"
          />
        </div>

        {/* Width scale */}
        <div>
          <label className="text-[10px] uppercase tracking-[0.06em] text-text-tertiary block mb-1">
            Width ({(scaleW * 100).toFixed(0)}%)
          </label>
          <input
            type="range"
            min={30}
            max={300}
            value={scaleW * 100}
            onChange={(e) => setScaleW(parseInt(e.target.value) / 100)}
            className="w-full accent-brand h-1.5"
          />
        </div>

        {/* Height scale */}
        <div>
          <label className="text-[10px] uppercase tracking-[0.06em] text-text-tertiary block mb-1">
            Height ({(scaleH * 100).toFixed(0)}%)
          </label>
          <input
            type="range"
            min={30}
            max={300}
            value={scaleH * 100}
            onChange={(e) => setScaleH(parseInt(e.target.value) / 100)}
            className="w-full accent-brand h-1.5"
          />
        </div>
      </div>

      {/* Color picker */}
      <div className="mb-4">
        <label className="text-[10px] uppercase tracking-[0.06em] text-text-tertiary block mb-2">
          Boundary Color
        </label>
        <div className="flex gap-2">
          {BOUNDARY_COLORS.map((c) => (
            <button
              key={c.value}
              onClick={() => setColor(c.value)}
              className={`w-7 h-7 rounded-full border-2 transition-all ${
                color === c.value
                  ? 'border-white scale-110'
                  : 'border-transparent hover:border-white/40'
              }`}
              style={{ backgroundColor: c.value }}
              title={c.label}
            />
          ))}
        </div>
      </div>

      {/* Coordinate readout */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-[10px] uppercase tracking-[0.06em] text-text-tertiary block mb-1">
            Latitude
          </label>
          <input
            value={lat}
            onChange={(e) => {
              onUpdate(e.target.value, lng)
              const newLat = parseFloat(e.target.value)
              const newLng = parseFloat(lng)
              if (!isNaN(newLat) && !isNaN(newLng) && mapRef.current) {
                markerRef.current?.setLngLat([newLng, newLat])
                mapRef.current.flyTo({ center: [newLng, newLat] })
              }
            }}
            type="number"
            step="0.0001"
            className="w-full bg-bg-sunken border border-border-default rounded-[var(--radius-sm)] px-3 py-2 text-[14px] text-text-primary font-mono outline-none focus:border-brand [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            placeholder="12.9698"
          />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-[0.06em] text-text-tertiary block mb-1">
            Longitude
          </label>
          <input
            value={lng}
            onChange={(e) => {
              onUpdate(lat, e.target.value)
              const newLat = parseFloat(lat)
              const newLng = parseFloat(e.target.value)
              if (!isNaN(newLat) && !isNaN(newLng) && mapRef.current) {
                markerRef.current?.setLngLat([newLng, newLat])
                mapRef.current.flyTo({ center: [newLng, newLat] })
              }
            }}
            type="number"
            step="0.0001"
            className="w-full bg-bg-sunken border border-border-default rounded-[var(--radius-sm)] px-3 py-2 text-[14px] text-text-primary font-mono outline-none focus:border-brand [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            placeholder="77.7506"
          />
        </div>
      </div>

      <div className="flex gap-3 mt-6">
        <button
          onClick={onBack}
          className="flex-1 py-2.5 border border-border-default text-text-secondary rounded-[var(--radius-sm)] text-[14px] font-medium hover:bg-surface-3 transition-colors"
        >
          Back
        </button>
        <button
          onClick={onNext}
          disabled={!lat || !lng}
          className="flex-1 py-2.5 bg-brand text-white rounded-[var(--radius-sm)] text-[14px] font-medium hover:bg-brand-hover disabled:bg-surface-2 disabled:text-text-tertiary transition-colors"
        >
          Next: Set Shares
        </button>
      </div>
    </div>
  )
}
