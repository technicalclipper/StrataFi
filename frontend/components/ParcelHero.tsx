'use client'

/**
 * Cinematic map hero strip for the parcel page (CARTO dark tiles —
 * same tile host as the home map, which is reachable on this network).
 * Non-interactive MapLibre view of the actual parcel with a glowing
 * boundary, slowly drifting camera, and stock-style price overlay.
 * Purely presentational — no data fetching.
 */

import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { ParcelData } from '@/lib/seed-parcels'
import { DeltaChip } from '@/components/MarketUI'

export function ParcelHero({
  parcel,
  ticker,
  livePrice,
  changePct,
}: {
  parcel: ParcelData
  ticker: string
  livePrice: number
  changePct: number
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)

  // gentle visual-only price jitter so the header ticks like a terminal
  const [display, setDisplay] = useState(livePrice)
  const [flash, setFlash] = useState<'tick-up' | 'tick-down' | ''>('')
  useEffect(() => {
    const t = setInterval(() => {
      const jitter = livePrice * (1 + (Math.random() - 0.5) * 0.0016)
      setDisplay((prev) => {
        setFlash(jitter >= prev ? 'tick-up' : 'tick-down')
        return jitter
      })
      setTimeout(() => setFlash(''), 650)
    }, 3200)
    return () => clearInterval(t)
  }, [livePrice])

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {
          base: {
            type: 'raster',
            tiles: [
              'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
              'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
              'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
            ],
            tileSize: 256,
            attribution: '&copy; CARTO &copy; OpenStreetMap',
          },
        },
        layers: [{ id: 'base-tiles', type: 'raster', source: 'base' }],
      },
      center: parcel.coordinates as [number, number],
      zoom: 15.6,
      pitch: 40,
      bearing: 0,
      interactive: false,
      attributionControl: false,
      maxZoom: 18.5,
      minZoom: 12,
    })

    // Zoom-only interaction: keep the cinematic framing (no panning),
    // but let the user zoom via buttons, scroll wheel, and pinch.
    map.scrollZoom.enable()
    map.doubleClickZoom.enable()
    map.touchZoomRotate.enable()
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')

    let raf = 0
    map.on('load', () => {
      map.addSource('boundary', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: { type: 'Polygon', coordinates: [parcel.polygon] },
        },
      })
      map.addLayer({
        id: 'boundary-glow',
        type: 'line',
        source: 'boundary',
        paint: { 'line-color': '#4D7CFE', 'line-width': 7, 'line-blur': 6, 'line-opacity': 0.55 },
      })
      map.addLayer({
        id: 'boundary-line',
        type: 'line',
        source: 'boundary',
        paint: { 'line-color': '#6B92FF', 'line-width': 2 },
      })
      map.addLayer({
        id: 'boundary-fill',
        type: 'fill',
        source: 'boundary',
        paint: { 'fill-color': '#4D7CFE', 'fill-opacity': 0.1 },
      })

      // guard against a zero-size canvas if mounted mid-layout
      map.resize()

      // slow cinematic drift — rAF-driven so it can't loop on reduced motion
      let last = performance.now()
      const drift = (t: number) => {
        map.setBearing(map.getBearing() + (t - last) * 0.0009)
        last = t
        raf = requestAnimationFrame(drift)
      }
      raf = requestAnimationFrame(drift)
    })

    // late resize for containers that settle after mount
    const resizeT = setTimeout(() => map.resize(), 400)

    mapRef.current = map
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(resizeT)
      map.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="relative h-60 rounded-[var(--radius-md)] overflow-hidden border border-border-default mb-3">
      {/* NOTE: maplibre's stylesheet forces `position: relative` on the map
          container (unlayered CSS beats Tailwind v4 layer), so `absolute
          inset-0` collapses to 0 height — size it explicitly instead. */}
      <div ref={containerRef} className="h-full w-full" />
      {/* vignette for legibility */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'linear-gradient(to top, rgba(6,7,8,0.85) 0%, rgba(6,7,8,0.15) 40%, rgba(6,7,8,0.25) 100%)',
        }}
      />

      {/* bottom-left: identity */}
      <div className="absolute bottom-4 left-5 font-mono pointer-events-none">
        <div className="text-[10px] text-text-tertiary mb-0.5">PARCEL #{parcel.id}</div>
        <div className="text-[20px] font-semibold text-text-primary tracking-tight leading-tight">
          {ticker}
          <span className="text-[12px] font-normal text-text-secondary ml-2.5">
            {parcel.name}
          </span>
        </div>
        <div className="tnum text-[10.5px] text-text-secondary mt-0.5">
          {parcel.coordinates[1].toFixed(5)}°N {parcel.coordinates[0].toFixed(5)}°E ·{' '}
          {parcel.location}
        </div>
      </div>

      {/* bottom-right: live price */}
      <div className="absolute bottom-4 right-5 text-right pointer-events-none">
        <div className="flex items-baseline justify-end gap-2">
          <span
            className={`tnum text-[32px] font-semibold text-text-primary leading-none px-1.5 rounded-[var(--radius-xs)] ${flash}`}
          >
            {display.toFixed(3)}
          </span>
          <span className="text-[12px] text-text-tertiary">MNT/share</span>
        </div>
        <div className="flex justify-end mt-1.5">
          <DeltaChip value={changePct} size="md" />
        </div>
      </div>
    </div>
  )
}
