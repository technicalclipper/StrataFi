'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { ParcelData } from '@/lib/seed-parcels'
import { useRouter } from 'next/navigation'

type OverlayMode = 'demand' | 'ownership' | 'yield'

const HEAT_COLORS: Record<number, string> = {
  0: '#2A2F37',
  1: '#3A6B8C',
  2: '#4D9DE0',
  3: '#F5C518',
  4: '#FF8A3D',
  5: '#FF4D4D',
}

function getDemandColor(parcel: ParcelData): string {
  return HEAT_COLORS[parcel.demandScore] || HEAT_COLORS[3]
}

function getOwnershipColor(parcel: ParcelData): string {
  const pctSold = 1 - parcel.availableShares / parcel.totalShares
  const level = Math.min(5, Math.floor(pctSold * 6))
  return HEAT_COLORS[level]
}

function getYieldColor(parcel: ParcelData): string {
  if (parcel.yieldPct >= 12) return HEAT_COLORS[5]
  if (parcel.yieldPct >= 9) return HEAT_COLORS[4]
  if (parcel.yieldPct >= 6) return HEAT_COLORS[3]
  if (parcel.yieldPct >= 3) return HEAT_COLORS[2]
  return HEAT_COLORS[1]
}

function getColor(parcel: ParcelData, mode: OverlayMode): string {
  switch (mode) {
    case 'demand':
      return getDemandColor(parcel)
    case 'ownership':
      return getOwnershipColor(parcel)
    case 'yield':
      return getYieldColor(parcel)
  }
}

function buildGeoJSON(parcels: ParcelData[], mode: OverlayMode) {
  return {
    type: 'FeatureCollection' as const,
    features: parcels.map((p) => ({
      type: 'Feature' as const,
      id: p.id,
      properties: {
        id: p.id,
        name: p.name,
        color: getColor(p, mode),
        pricePerShare: p.pricePerShare,
        demandScore: p.demandScore,
        yieldPct: p.yieldPct,
        availableShares: p.availableShares,
        totalShares: p.totalShares,
      },
      geometry: {
        type: 'Polygon' as const,
        coordinates: [p.polygon],
      },
    })),
  }
}

const LEGEND_LABELS: Record<OverlayMode, string[]> = {
  demand: ['Very Low', 'Low', 'Medium', 'High', 'Very High'],
  ownership: ['0-20%', '20-40%', '40-60%', '60-80%', '80-100%'],
  yield: ['0-3%', '3-6%', '6-9%', '9-12%', '12%+'],
}

export function MapExplorer() {
  const mapContainer = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const [mode, setMode] = useState<OverlayMode>('demand')
  const [parcels, setParcels] = useState<ParcelData[]>([])
  const [hoveredParcel, setHoveredParcel] = useState<ParcelData | null>(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [cursorCoords, setCursorCoords] = useState({ lng: 0, lat: 0 })
  const router = useRouter()

  // Fetch parcels from API
  useEffect(() => {
    fetch('/api/parcels')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setParcels(data)
      })
      .catch(() => {})
  }, [])

  const updateSource = useCallback(
    (m: OverlayMode, data: ParcelData[]) => {
      const map = mapRef.current
      if (!map) return
      const source = map.getSource('parcels') as maplibregl.GeoJSONSource | undefined
      if (source) {
        source.setData(buildGeoJSON(data, m))
      }
    },
    []
  )

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        name: 'StrataFi Dark',
        sources: {
          osm: {
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
        layers: [
          {
            id: 'osm-tiles',
            type: 'raster',
            source: 'osm',
            minzoom: 0,
            maxzoom: 19,
          },
        ],
      },
      center: [77.65, 12.97],
      zoom: 11,
      maxZoom: 18,
      minZoom: 5,
    })

    map.addControl(new maplibregl.NavigationControl(), 'bottom-right')

    map.on('load', () => {
      map.addSource('parcels', {
        type: 'geojson',
        data: buildGeoJSON(parcels, mode),
      })

      map.addLayer({
        id: 'parcel-fill',
        type: 'fill',
        source: 'parcels',
        paint: {
          'fill-color': ['get', 'color'],
          'fill-opacity': 0.55,
        },
      })

      map.addLayer({
        id: 'parcel-line',
        type: 'line',
        source: 'parcels',
        paint: {
          'line-color': ['get', 'color'],
          'line-width': [
            'case',
            ['boolean', ['feature-state', 'hover'], false],
            2.5,
            1,
          ],
          'line-opacity': 1,
        },
      })

      map.addLayer({
        id: 'parcel-highlight',
        type: 'line',
        source: 'parcels',
        paint: {
          'line-color': '#E8EAED',
          'line-width': 2,
          'line-opacity': [
            'case',
            ['boolean', ['feature-state', 'hover'], false],
            1,
            0,
          ],
        },
      })
    })

    let hoveredId: number | null = null

    map.on('mousemove', 'parcel-fill', (e) => {
      if (e.features && e.features.length > 0) {
        if (hoveredId !== null) {
          map.setFeatureState({ source: 'parcels', id: hoveredId }, { hover: false })
        }
        hoveredId = e.features[0].id as number
        map.setFeatureState({ source: 'parcels', id: hoveredId }, { hover: true })
        map.getCanvas().style.cursor = 'pointer'
        const pid = e.features[0].properties?.id
        const p = parcels.find((p) => p.id === pid)
        if (p) setHoveredParcel(p)
      }
    })

    map.on('mouseleave', 'parcel-fill', () => {
      if (hoveredId !== null) {
        map.setFeatureState({ source: 'parcels', id: hoveredId }, { hover: false })
      }
      hoveredId = null
      map.getCanvas().style.cursor = ''
      setHoveredParcel(null)
    })

    map.on('mousemove', (e) => {
      setMousePos({ x: e.point.x, y: e.point.y })
      setCursorCoords({ lng: e.lngLat.lng, lat: e.lngLat.lat })
    })

    map.on('click', 'parcel-fill', (e) => {
      if (e.features && e.features.length > 0) {
        const id = e.features[0].properties?.id
        if (id) router.push(`/parcel/${id}`)
      }
    })

    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Update map when parcels load or mode changes
  useEffect(() => {
    updateSource(mode, parcels)

    // Fly to first parcel if any
    if (parcels.length > 0 && mapRef.current) {
      const first = parcels[0]
      const coords = first.coordinates as [number, number]
      if (coords[0] && coords[1]) {
        mapRef.current.flyTo({ center: coords, zoom: 13 })
      }
    }
  }, [mode, parcels, updateSource])

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />

      {/* Overlay mode selector */}
      <div className="absolute top-4 left-4 flex bg-surface-2/90 backdrop-blur-sm border border-border-default rounded-[var(--radius-md)] overflow-hidden">
        {(['demand', 'ownership', 'yield'] as OverlayMode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.06em] transition-colors ${
              mode === m
                ? 'bg-brand text-white'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-3'
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      {/* Parcel count */}
      {parcels.length === 0 && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-surface-2/90 backdrop-blur-sm border border-border-default rounded-[var(--radius-md)] px-4 py-2">
          <span className="text-[12.5px] text-text-secondary">
            No parcels minted yet.{' '}
            <a href="/list" className="text-brand hover:text-brand-hover">
              List one &rarr;
            </a>
          </span>
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-surface-2/90 backdrop-blur-sm border border-border-default rounded-[var(--radius-md)] p-3">
        <div className="text-[10px] uppercase tracking-[0.06em] text-text-tertiary mb-2">
          {mode}
        </div>
        {[1, 2, 3, 4, 5].map((level) => (
          <div key={level} className="flex items-center gap-2 py-0.5">
            <div
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: HEAT_COLORS[level] }}
            />
            <span className="text-[10px] text-text-secondary">
              {LEGEND_LABELS[mode][level - 1]}
            </span>
          </div>
        ))}
      </div>

      {/* Coordinate readout */}
      <div className="absolute bottom-4 right-16 text-[10px] font-mono text-text-tertiary bg-surface-2/80 px-2 py-1 rounded-[var(--radius-xs)]">
        {cursorCoords.lat.toFixed(6)}, {cursorCoords.lng.toFixed(6)}
      </div>

      {/* Hover tooltip */}
      {hoveredParcel && (
        <div
          className="absolute pointer-events-none z-50 bg-surface-4 border border-border-default rounded-[var(--radius-md)] p-2.5 shadow-[var(--shadow-md)]"
          style={{
            left: mousePos.x + 16,
            top: mousePos.y - 10,
          }}
        >
          <div className="text-[11px] font-medium text-text-primary mb-1">
            #{hoveredParcel.id} {hoveredParcel.name}
          </div>
          <div className="flex items-center gap-3 text-[10px]">
            <span className="tnum text-text-secondary">
              {hoveredParcel.pricePerShare} MNT/share
            </span>
            <span
              className="tnum"
              style={{ color: HEAT_COLORS[hoveredParcel.demandScore] || HEAT_COLORS[3] }}
            >
              Demand {hoveredParcel.demandScore}/5
            </span>
          </div>
          <div className="mt-1.5 h-1 bg-surface-2 rounded-full overflow-hidden">
            <div
              className="h-full bg-brand rounded-full transition-all"
              style={{
                width: `${((hoveredParcel.totalShares - hoveredParcel.availableShares) / hoveredParcel.totalShares) * 100}%`,
              }}
            />
          </div>
          <div className="text-[9px] text-text-tertiary mt-0.5">
            {hoveredParcel.totalShares - hoveredParcel.availableShares}/
            {hoveredParcel.totalShares} shares sold
          </div>
        </div>
      )}
    </div>
  )
}
