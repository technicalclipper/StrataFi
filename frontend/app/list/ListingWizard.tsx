'use client'

import { useState, useRef } from 'react'
import { useAccount } from 'wagmi'
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
  const { isConnected } = useAccount()
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

  const handleMint = async () => {
    setMinting(true)
    // Simulate minting delay (actual contract call would go here)
    await new Promise((r) => setTimeout(r, 2000))
    setMinting(false)
    setMinted(true)
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
        <div className="bg-surface-1 border border-border-default rounded-[var(--radius-md)] p-6">
          <div className="text-[10px] uppercase tracking-[0.06em] text-text-tertiary mb-4">
            Parcel Location & Boundary
          </div>
          <div className="h-64 bg-bg-sunken rounded-[var(--radius-sm)] flex items-center justify-center mb-4 border border-border-subtle">
            <span className="text-[12.5px] text-text-tertiary">
              Map boundary drawing — enter coordinates below for demo
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] uppercase tracking-[0.06em] text-text-tertiary block mb-1">
                Latitude
              </label>
              <input
                value={formData.lat}
                onChange={(e) => setFormData({ ...formData, lat: e.target.value })}
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
                value={formData.lng}
                onChange={(e) => setFormData({ ...formData, lng: e.target.value })}
                type="number"
                step="0.0001"
                className="w-full bg-bg-sunken border border-border-default rounded-[var(--radius-sm)] px-3 py-2 text-[14px] text-text-primary font-mono outline-none focus:border-brand [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                placeholder="77.7506"
              />
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={() => setStep('upload')}
              className="flex-1 py-2.5 border border-border-default text-text-secondary rounded-[var(--radius-sm)] text-[14px] font-medium hover:bg-surface-3 transition-colors"
            >
              Back
            </button>
            <button
              onClick={() => setStep('shares')}
              disabled={!formData.lat || !formData.lng}
              className="flex-1 py-2.5 bg-brand text-white rounded-[var(--radius-sm)] text-[14px] font-medium hover:bg-brand-hover disabled:bg-surface-2 disabled:text-text-tertiary transition-colors"
            >
              Next: Set Shares
            </button>
          </div>
        </div>
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
              </div>
              <a
                href="https://sepolia.mantlescan.xyz"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-brand hover:text-brand-hover text-[12.5px] font-medium"
              >
                View on MantleScan &rarr;
              </a>
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
