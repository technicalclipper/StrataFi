'use client'

/**
 * "The Living Terminal" — cinematic map home page.
 * UI-only enhancements over the original explorer:
 * cinematic boot + fly-in, breathing hot parcels, sonar transaction
 * sparks + live feed (simulated client-side), 3D price extrusion on tilt,
 * demand time-lapse, ticker tape, ⌘K filter palette, Top Movers rail,
 * AI whisper bar, and mini-dashboard hover cards.
 * Data flow is unchanged: parcels come from /api/parcels, click → /parcel/[id].
 */

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { ParcelData } from '@/lib/seed-parcels'
import { useRouter } from 'next/navigation'
import {
  Search,
  TrendingUp,
  Flame,
  Percent,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  X,
} from 'lucide-react'
import {
  mulberry32,
  makeTicker,
  simulateSeries,
  Sparkline,
  DeltaChip,
  LiveBadge,
} from '@/components/MarketUI'

type OverlayMode = 'demand' | 'ownership' | 'yield'

type Enriched = ParcelData & {
  ticker: string
  livePrice: number
  changePct: number
  spark: number[]
  volume24h: number
}

const HEAT_COLORS: Record<number, string> = {
  0: '#2A2F37',
  1: '#3A6B8C',
  2: '#4D9DE0',
  3: '#F5C518',
  4: '#FF8A3D',
  5: '#FF4D4D',
}

const WEEKS = 11 // time-lapse range: 0 (T−11w) … 11 (now)

function clampDemand(n: number) {
  return Math.max(0, Math.min(5, n))
}

/** Seeded historic demand for the time-lapse scrubber. */
function historicDemand(p: ParcelData, week: number): number {
  if (week >= WEEKS) return p.demandScore
  const rng = mulberry32(p.id * 53 + week * 17 + 5)
  return clampDemand(Math.round(p.demandScore + (rng() - 0.55) * 3.2))
}

function getColor(p: ParcelData, mode: OverlayMode, week: number): string {
  switch (mode) {
    case 'demand':
      return HEAT_COLORS[historicDemand(p, week)] || HEAT_COLORS[3]
    case 'ownership': {
      const pctSold = 1 - p.availableShares / p.totalShares
      return HEAT_COLORS[Math.min(5, Math.floor(pctSold * 6))]
    }
    case 'yield': {
      if (p.yieldPct >= 12) return HEAT_COLORS[5]
      if (p.yieldPct >= 9) return HEAT_COLORS[4]
      if (p.yieldPct >= 6) return HEAT_COLORS[3]
      if (p.yieldPct >= 3) return HEAT_COLORS[2]
      return HEAT_COLORS[1]
    }
  }
}

function buildGeoJSON(parcels: Enriched[], colors: Record<number, string>) {
  const maxPrice = Math.max(...parcels.map((p) => p.livePrice), 0.0001)
  return {
    type: 'FeatureCollection' as const,
    features: parcels.map((p) => ({
      type: 'Feature' as const,
      id: p.id,
      properties: {
        id: p.id,
        name: p.name,
        color: colors[p.id] || HEAT_COLORS[3],
        pricePerShare: p.pricePerShare,
        demandScore: p.demandScore,
        yieldPct: p.yieldPct,
        availableShares: p.availableShares,
        totalShares: p.totalShares,
        // 3D bar height — price per share normalised to a visible range
        extrudeHeight: 150 + (p.livePrice / maxPrice) * 1100,
      },
      geometry: {
        type: 'Polygon' as const,
        coordinates: [p.polygon],
      },
    })),
  }
}

/** fill-opacity expression: dim filter > unlit (intro) > breathing hot > base */
function opacityExpr(breath: number): maplibregl.ExpressionSpecification {
  return [
    'case',
    ['boolean', ['feature-state', 'dim'], false],
    0.06,
    ['!', ['boolean', ['feature-state', 'lit'], false]],
    0,
    ['>=', ['get', 'demandScore'], 4],
    breath,
    0.55,
  ] as maplibregl.ExpressionSpecification
}

const LEGEND_LABELS: Record<OverlayMode, string[]> = {
  demand: ['Very Low', 'Low', 'Medium', 'High', 'Very High'],
  ownership: ['0-20%', '20-40%', '40-60%', '60-80%', '80-100%'],
  yield: ['0-3%', '3-6%', '6-9%', '9-12%', '12%+'],
}

const BOOT_LINES = [
  'CONNECTING TO MANTLE SEPOLIA\u2026',
  '\u2713 CONNECTED \u00B7 CHAIN 5003',
  'SYNCING PARCEL REGISTRY\u2026',
]

const EVENT_TYPES = [
  { tag: 'BUY', color: 'var(--up)' },
  { tag: 'OFFER', color: 'var(--brand)' },
  { tag: 'LIST', color: 'var(--accent-amber)' },
]

type FeedEvent = {
  key: number
  ticker: string
  tag: string
  color: string
  qty: number
  price: number
  time: string
}

type Spark = { key: number; x: number; y: number; color: string }

/** Client-side "natural language" filter — keyword + numeric parsing. */
function applyQuery(q: string, list: Enriched[]): Set<number> | null {
  let s = q.trim().toLowerCase()
  if (!s) return null
  let maxP: number | null = null
  let minP: number | null = null
  const under = s.match(/(?:under|below|<)\s*(\d+(?:\.\d+)?)/)
  if (under) {
    maxP = +under[1]
    s = s.replace(under[0], '')
  }
  const over = s.match(/(?:over|above|>)\s*(\d+(?:\.\d+)?)/)
  if (over) {
    minP = +over[1]
    s = s.replace(over[0], '')
  }
  const tokens = s.split(/\s+/).filter(Boolean)
  return new Set(
    list
      .filter((p) => {
        if (maxP !== null && p.livePrice > maxP) return false
        if (minP !== null && p.livePrice < minP) return false
        const hay = `${p.name} ${p.location} ${p.landType} ${p.ticker}`.toLowerCase()
        return tokens.every((t) => {
          if (hay.includes(t)) return true
          if (t === 'verified') return p.verified
          if (t === 'hot' || t === 'high' || t === 'demand') return p.demandScore >= 4
          if (t === 'yield' || t === 'income') return p.yieldPct >= 7
          if (t === 'cheap') return p.livePrice <= 0.5
          return false
        })
      })
      .map((p) => p.id),
  )
}

export function MapExplorer() {
  const mapContainer = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const router = useRouter()

  const [mode, setMode] = useState<OverlayMode>('demand')
  const [parcels, setParcels] = useState<ParcelData[]>([])
  const [hoveredParcel, setHoveredParcel] = useState<Enriched | null>(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [cursorCoords, setCursorCoords] = useState({ lng: 0, lat: 0 })
  const [cursorMoved, setCursorMoved] = useState(false)

  // cinematic boot
  const [mapReady, setMapReady] = useState(false)
  const [introDone, setIntroDone] = useState(false)
  const [booted, setBooted] = useState(false)
  const [bootStep, setBootStep] = useState(0)
  const introStartedRef = useRef(false)

  // live simulation
  const [feed, setFeed] = useState<FeedEvent[]>([])
  const [sparks, setSparks] = useState<Spark[]>([])

  // ⌘K palette
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [query, setQuery] = useState('')
  const paletteInputRef = useRef<HTMLInputElement>(null)

  // top movers rail
  const [moversOpen, setMoversOpen] = useState(true)
  const [moversTab, setMoversTab] = useState<'gainers' | 'traded' | 'yield'>('gainers')

  // time-lapse
  const [week, setWeek] = useState(WEEKS)

  // AI whisper bar
  const [whisperIdx, setWhisperIdx] = useState(0)
  const [whisperLen, setWhisperLen] = useState(0)

  // 3D hint
  const [pitched, setPitched] = useState(false)

  const enriched = useMemo<Enriched[]>(
    () =>
      parcels.map((p) => {
        const sim = simulateSeries(p.id, p.pricePerShare)
        const rng = mulberry32(p.id * 104729 + 7)
        return {
          ...p,
          ticker: makeTicker(p.name, p.id),
          livePrice: sim.livePrice,
          changePct: sim.changePct,
          spark: sim.series,
          volume24h: Math.round(rng() * p.totalShares * 0.4),
        }
      }),
    [parcels],
  )

  const enrichedRef = useRef<Enriched[]>([])
  enrichedRef.current = enriched

  const matched = useMemo(() => applyQuery(query, enriched), [query, enriched])

  const colorsFor = useCallback(
    (m: OverlayMode, w: number): Record<number, string> =>
      Object.fromEntries(enrichedRef.current.map((p) => [p.id, getColor(p, m, w)])),
    [],
  )
  const colorsRef = useRef<Record<number, string>>({})

  const setMapData = useCallback((colors: Record<number, string>) => {
    const map = mapRef.current
    if (!map) return
    const source = map.getSource('parcels') as maplibregl.GeoJSONSource | undefined
    if (source) source.setData(buildGeoJSON(enrichedRef.current, colors))
    colorsRef.current = colors
  }, [])

  // ---- fetch parcels (unchanged data flow) ----
  useEffect(() => {
    fetch('/api/parcels')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setParcels(data)
      })
      .catch(() => {})
  }, [])

  // ---- map init ----
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
          { id: 'osm-tiles', type: 'raster', source: 'osm', minzoom: 0, maxzoom: 19 },
        ],
      },
      // satellite-descent intro: start zoomed way out
      center: [78.7, 18.5],
      zoom: 4.1,
      maxZoom: 18,
      minZoom: 3,
      maxPitch: 60,
    })

    map.addControl(new maplibregl.NavigationControl(), 'bottom-right')

    map.on('load', () => {
      map.addSource('parcels', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })

      map.addLayer({
        id: 'parcel-fill',
        type: 'fill',
        source: 'parcels',
        paint: {
          'fill-color': ['get', 'color'],
          'fill-opacity': opacityExpr(0.55),
        },
      })

      // 3D price bars — revealed as the camera tilts (right-drag)
      map.addLayer({
        id: 'parcel-extrude',
        type: 'fill-extrusion',
        source: 'parcels',
        paint: {
          'fill-extrusion-color': ['get', 'color'],
          'fill-extrusion-height': ['get', 'extrudeHeight'],
          'fill-extrusion-base': 0,
          'fill-extrusion-opacity': 0,
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

      setMapReady(true)
    })

    map.on('pitch', () => {
      const pitch = map.getPitch()
      if (map.getLayer('parcel-extrude')) {
        map.setPaintProperty(
          'parcel-extrude',
          'fill-extrusion-opacity',
          Math.min(pitch / 45, 1) * 0.8,
        )
      }
      setPitched(pitch > 5)
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
        const p = enrichedRef.current.find((p) => p.id === pid)
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
      setCursorMoved(true)
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

  // ---- boot terminal sequence ----
  useEffect(() => {
    if (!mapReady) return
    const timers = [
      setTimeout(() => setBootStep(1), 300),
      setTimeout(() => setBootStep(2), 1000),
      setTimeout(() => setBootStep(3), 1700),
      setTimeout(() => setBootStep(4), 2400),
      setTimeout(() => setBooted(true), 4200),
    ]
    return () => timers.forEach(clearTimeout)
  }, [mapReady])

  // ---- cinematic fly-in + staggered parcel power-on ----
  useEffect(() => {
    if (!mapReady || enriched.length === 0 || introStartedRef.current) return
    introStartedRef.current = true
    const map = mapRef.current!

    setMapData(colorsFor(mode, week))

    const bounds = new maplibregl.LngLatBounds()
    enriched.forEach((p) => bounds.extend(p.coordinates))
    map.fitBounds(bounds, { padding: 140, duration: 3200, maxZoom: 13 })

    const timers = enriched.map((p, i) =>
      setTimeout(
        () => map.setFeatureState({ source: 'parcels', id: p.id }, { lit: true }),
        1400 + i * 200,
      ),
    )
    timers.push(setTimeout(() => setIntroDone(true), 1400 + enriched.length * 200 + 600))
    return () => timers.forEach(clearTimeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, enriched])

  // ---- breathing hot parcels (fill opacity 0.5 → 0.65) ----
  useEffect(() => {
    if (!introDone) return
    const map = mapRef.current
    if (!map) return
    let raf = 0
    let last = 0
    const loop = (t: number) => {
      if (t - last > 80) {
        last = t
        const breath = 0.575 + 0.075 * Math.sin((t / 3000) * Math.PI * 2)
        if (map.getLayer('parcel-fill')) {
          map.setPaintProperty('parcel-fill', 'fill-opacity', opacityExpr(breath))
        }
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [introDone])

  // ---- mode switch: wave recolor sweeping left → right by longitude ----
  const waveRaf = useRef(0)
  useEffect(() => {
    if (!introStartedRef.current) return
    const list = enrichedRef.current
    if (list.length === 0) return
    const oldColors = { ...colorsRef.current }
    const newColors = colorsFor(mode, week)
    const lngs = list.map((p) => p.coordinates[0])
    const minLng = Math.min(...lngs)
    const maxLng = Math.max(...lngs) + 0.0001
    cancelAnimationFrame(waveRaf.current)
    const start = performance.now()
    const step = (t: number) => {
      const k = Math.min((t - start) / 600, 1)
      const sweep = minLng + k * (maxLng - minLng)
      const mixed = Object.fromEntries(
        list.map((p) => [
          p.id,
          p.coordinates[0] <= sweep ? newColors[p.id] : oldColors[p.id],
        ]),
      )
      setMapData(mixed)
      if (k < 1) waveRaf.current = requestAnimationFrame(step)
    }
    waveRaf.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(waveRaf.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  // ---- time-lapse scrub (demand mode) — instant recolor ----
  useEffect(() => {
    if (!introStartedRef.current) return
    setMapData(colorsFor(mode, week))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [week])

  // ---- ⌘K filter: dim non-matching parcels ----
  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.getSource('parcels')) return
    enriched.forEach((p) =>
      map.setFeatureState(
        { source: 'parcels', id: p.id },
        { dim: matched !== null && !matched.has(p.id) },
      ),
    )
  }, [matched, enriched])

  // ---- ⌘K keyboard shortcut ----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((v) => !v)
      } else if (e.key === 'Escape') {
        setPaletteOpen(false)
        setQuery('')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (paletteOpen) paletteInputRef.current?.focus()
  }, [paletteOpen])

  // ---- simulated background transactions: sonar sparks + live feed ----
  useEffect(() => {
    if (!booted || enriched.length === 0) return
    let timer: ReturnType<typeof setTimeout>
    const fire = () => {
      const map = mapRef.current
      const list = enrichedRef.current
      if (map && list.length > 0) {
        const p = list[Math.floor(Math.random() * list.length)]
        const ev = EVENT_TYPES[Math.floor(Math.random() * EVENT_TYPES.length)]
        const qty = 1 + Math.floor(Math.random() * Math.max(2, p.totalShares * 0.04))
        const price = p.livePrice * (0.985 + Math.random() * 0.03)
        const key = Date.now()
        setFeed((f) =>
          [
            {
              key,
              ticker: p.ticker,
              tag: ev.tag,
              color: ev.color,
              qty,
              price,
              time: new Date().toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              }),
            },
            ...f,
          ].slice(0, 7),
        )
        const pt = map.project(p.coordinates as [number, number])
        setSparks((s) => [...s, { key, x: pt.x, y: pt.y, color: ev.color }])
        setTimeout(() => setSparks((s) => s.filter((sp) => sp.key !== key)), 1300)
      }
      timer = setTimeout(fire, 8000 + Math.random() * 7000)
    }
    timer = setTimeout(fire, 3000 + Math.random() * 4000)
    return () => clearTimeout(timer)
  }, [booted, enriched.length])

  // ---- AI whisper bar (typewriter, rotates every 12s) ----
  const whispers = useMemo(() => {
    if (enriched.length === 0) return []
    const byDemand = [...enriched].sort((a, b) => b.demandScore - a.demandScore)[0]
    const byYield = [...enriched].sort((a, b) => b.yieldPct - a.yieldPct)[0]
    const cheapest = [...enriched].sort((a, b) => a.livePrice - b.livePrice)[0]
    const hottest = [...enriched].sort(
      (a, b) =>
        b.totalShares - b.availableShares - (a.totalShares - a.availableShares),
    )[0]
    return [
      `\u25C6 AI: Demand around ${byDemand.name} is rated ${byDemand.demandScore}/5 \u2014 strongest zone on the board.`,
      `\u25C6 AI: ${byYield.ticker} is yielding ${byYield.yieldPct}% \u2014 highest income parcel on the map.`,
      `\u25C6 AI: ${cheapest.ticker} trades at ${cheapest.livePrice.toFixed(3)} MNT/share \u2014 lowest entry point right now.`,
      `\u25C6 AI: ${Math.round(((hottest.totalShares - hottest.availableShares) / hottest.totalShares) * 100)}% of ${hottest.name} is already distributed \u2014 supply tightening.`,
    ]
  }, [enriched])

  useEffect(() => {
    if (whispers.length === 0) return
    setWhisperLen(0)
    const typer = setInterval(() => {
      setWhisperLen((l) => {
        if (l >= whispers[whisperIdx].length) {
          clearInterval(typer)
          return l
        }
        return l + 1
      })
    }, 28)
    const rotate = setTimeout(
      () => setWhisperIdx((i) => (i + 1) % whispers.length),
      12000,
    )
    return () => {
      clearInterval(typer)
      clearTimeout(rotate)
    }
  }, [whisperIdx, whispers])

  // ---- top movers ----
  const movers = useMemo(() => {
    const list = [...enriched]
    if (moversTab === 'gainers') list.sort((a, b) => b.changePct - a.changePct)
    if (moversTab === 'traded') list.sort((a, b) => b.volume24h - a.volume24h)
    if (moversTab === 'yield') list.sort((a, b) => b.yieldPct - a.yieldPct)
    return list.slice(0, 6)
  }, [enriched, moversTab])

  const flyToParcel = useCallback((p: Enriched) => {
    mapRef.current?.flyTo({ center: p.coordinates as [number, number], zoom: 15, duration: 1400 })
  }, [])

  const glowParcel = useCallback((id: number, on: boolean) => {
    const map = mapRef.current
    if (map && map.getSource('parcels')) {
      map.setFeatureState({ source: 'parcels', id }, { hover: on })
    }
  }, [])

  const paletteResults = useMemo(
    () => (matched === null ? [] : enriched.filter((p) => matched.has(p.id))),
    [matched, enriched],
  )

  const tapeItems = useMemo(() => {
    if (enriched.length === 0) return []
    const reps = Math.max(4, Math.ceil(20 / enriched.length))
    return Array.from({ length: reps * 2 }, (_, i) => enriched[i % enriched.length])
  }, [enriched])

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />

      {/* Crosshair targeting lines */}
      {cursorMoved && !paletteOpen && (
        <>
          <div
            className="absolute top-0 bottom-0 pointer-events-none"
            style={{ left: mousePos.x, width: 1, background: 'rgba(232,234,237,0.06)' }}
          />
          <div
            className="absolute left-0 right-0 pointer-events-none"
            style={{ top: mousePos.y, height: 1, background: 'rgba(232,234,237,0.06)' }}
          />
        </>
      )}

      {/* Sonar transaction sparks */}
      {sparks.map((s) => (
        <div
          key={s.key}
          className="sonar-ring absolute pointer-events-none rounded-full"
          style={{
            left: s.x,
            top: s.y,
            width: 56,
            height: 56,
            border: `1.5px solid ${s.color}`,
          }}
        />
      ))}

      {/* Ticker tape */}
      {enriched.length > 0 && (
        <div className="absolute top-0 left-0 right-0 h-8 bg-surface-1/95 backdrop-blur-sm border-b border-border-default overflow-hidden flex items-center">
          <div className="ticker-tape flex items-center w-max">
            {tapeItems.map((p, i) => (
              <button
                key={`${p.id}-${i}`}
                onClick={() => flyToParcel(p)}
                className="flex items-center gap-2 px-4 shrink-0 hover:bg-surface-3 h-8 transition-colors"
              >
                <span className="font-mono text-[10.5px] font-semibold text-text-secondary">
                  {p.ticker}
                </span>
                <span className="tnum text-[10.5px] text-text-primary">
                  {p.livePrice.toFixed(3)}
                </span>
                <span
                  className="tnum text-[10px]"
                  style={{ color: p.changePct >= 0 ? 'var(--up)' : 'var(--down)' }}
                >
                  {p.changePct >= 0 ? '\u25B2' : '\u25BC'}
                  {Math.abs(p.changePct).toFixed(1)}%
                </span>
                <span className="text-border-strong text-[10px]">·</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* AI whisper bar */}
      {whispers.length > 0 && booted && (
        <div className="absolute top-11 left-1/2 -translate-x-1/2 max-w-[60%] pointer-events-none">
          <div className="bg-surface-1/90 backdrop-blur-sm border border-border-subtle rounded-full px-4 py-1.5 text-[11px] text-text-secondary font-mono whitespace-nowrap overflow-hidden">
            <span className="text-brand">{whispers[whisperIdx].slice(0, 6)}</span>
            {whispers[whisperIdx].slice(6, whisperLen)}
            <span className="caret text-brand">_</span>
          </div>
        </div>
      )}

      {/* Overlay mode selector + ⌘K hint */}
      <div className="absolute top-11 left-4 flex items-center gap-2">
        <div className="flex bg-surface-2/90 backdrop-blur-sm border border-border-default rounded-[var(--radius-md)] overflow-hidden">
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
        <button
          onClick={() => setPaletteOpen(true)}
          className="flex items-center gap-1.5 bg-surface-2/90 backdrop-blur-sm border border-border-default rounded-[var(--radius-md)] px-2.5 py-1.5 text-[11px] text-text-tertiary hover:text-text-primary hover:border-border-strong transition-colors"
        >
          <Search size={11} />
          Search
          <kbd className="font-mono text-[9px] bg-surface-3 px-1 py-px rounded">⌘K</kbd>
        </button>
        {query && (
          <button
            onClick={() => setQuery('')}
            className="flex items-center gap-1.5 bg-brand-bg border border-brand-border rounded-[var(--radius-md)] px-2.5 py-1.5 text-[11px] text-brand"
          >
            “{query}” · {paletteResults.length} match
            {paletteResults.length === 1 ? '' : 'es'}
            <X size={11} />
          </button>
        )}
      </div>

      {/* Top Movers rail */}
      {enriched.length > 0 && booted && (
        <div className="absolute top-24 left-4 w-60">
          <div className="bg-surface-1/95 backdrop-blur-sm border border-border-default rounded-[var(--radius-md)] overflow-hidden">
            <button
              onClick={() => setMoversOpen((v) => !v)}
              className="w-full flex items-center justify-between px-3 py-2 text-[10px] uppercase tracking-[0.06em] text-text-tertiary hover:text-text-secondary transition-colors"
            >
              Top Movers
              {moversOpen ? <ChevronLeft size={12} /> : <ChevronRight size={12} />}
            </button>
            {moversOpen && (
              <>
                <div className="flex border-y border-border-subtle">
                  {(
                    [
                      ['gainers', TrendingUp, 'Gainers'],
                      ['traded', Flame, 'Traded'],
                      ['yield', Percent, 'Yield'],
                    ] as const
                  ).map(([key, Icon, label]) => (
                    <button
                      key={key}
                      onClick={() => setMoversTab(key)}
                      className={`flex-1 flex items-center justify-center gap-1 py-1.5 text-[10px] font-medium transition-colors ${
                        moversTab === key
                          ? 'text-brand bg-brand-bg'
                          : 'text-text-tertiary hover:text-text-secondary'
                      }`}
                    >
                      <Icon size={10} />
                      {label}
                    </button>
                  ))}
                </div>
                {movers.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => flyToParcel(p)}
                    onMouseEnter={() => glowParcel(p.id, true)}
                    onMouseLeave={() => glowParcel(p.id, false)}
                    className="w-full flex items-center justify-between px-3 py-2 hover:bg-surface-2 transition-colors border-b border-border-subtle last:border-b-0"
                  >
                    <div className="text-left">
                      <div className="font-mono text-[11px] font-semibold text-text-primary">
                        {p.ticker}
                      </div>
                      <div className="text-[9px] text-text-tertiary truncate max-w-[80px]">
                        {p.location}
                      </div>
                    </div>
                    <Sparkline data={p.spark} up={p.changePct >= 0} w={44} h={16} />
                    <div className="tnum text-[10.5px] text-right w-14">
                      {moversTab === 'gainers' && (
                        <span
                          style={{
                            color: p.changePct >= 0 ? 'var(--up)' : 'var(--down)',
                          }}
                        >
                          {p.changePct >= 0 ? '+' : ''}
                          {p.changePct.toFixed(1)}%
                        </span>
                      )}
                      {moversTab === 'traded' && (
                        <span className="text-text-secondary">{p.volume24h} sh</span>
                      )}
                      {moversTab === 'yield' && (
                        <span className="text-up">{p.yieldPct}%</span>
                      )}
                    </div>
                  </button>
                ))}
              </>
            )}
          </div>
        </div>
      )}

      {/* Live activity feed */}
      {booted && feed.length > 0 && (
        <div className="absolute top-11 right-4 w-64">
          <div className="bg-surface-1/95 backdrop-blur-sm border border-border-default rounded-[var(--radius-md)] overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b border-border-subtle">
              <span className="text-[10px] uppercase tracking-[0.06em] text-text-tertiary">
                Activity
              </span>
              <LiveBadge />
            </div>
            {feed.map((ev) => (
              <div
                key={ev.key}
                className="feed-in flex items-center justify-between px-3 py-1.5 border-b border-border-subtle last:border-b-0"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="text-[8.5px] font-semibold px-1.5 py-px rounded-[var(--radius-xs)]"
                    style={{
                      color: ev.color,
                      backgroundColor: `color-mix(in srgb, ${ev.color} 12%, transparent)`,
                    }}
                  >
                    {ev.tag}
                  </span>
                  <span className="font-mono text-[10.5px] text-text-primary">
                    {ev.ticker}
                  </span>
                </div>
                <div className="text-right">
                  <div className="tnum text-[10px] text-text-secondary">
                    {ev.qty} sh @ {ev.price.toFixed(3)}
                  </div>
                  <div className="tnum text-[8.5px] text-text-tertiary">{ev.time}</div>
                </div>
              </div>
            ))}
            <div className="px-3 py-1 text-[8.5px] text-text-tertiary text-center">
              Simulated demo feed
            </div>
          </div>
        </div>
      )}

      {/* Parcel count / empty state */}
      {parcels.length === 0 && booted && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 bg-surface-2/90 backdrop-blur-sm border border-border-default rounded-[var(--radius-md)] px-4 py-2">
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

      {/* Time-lapse scrubber (demand history) */}
      {mode === 'demand' && enriched.length > 0 && booted && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-surface-2/90 backdrop-blur-sm border border-border-default rounded-[var(--radius-md)] px-4 py-2 flex items-center gap-3 w-72">
          <span className="text-[9px] uppercase tracking-[0.06em] text-text-tertiary shrink-0">
            Time-lapse
          </span>
          <input
            type="range"
            min={0}
            max={WEEKS}
            value={week}
            onChange={(e) => setWeek(Number(e.target.value))}
            className="flex-1 accent-[var(--brand)] h-1"
          />
          <span className="tnum text-[10px] font-mono text-text-secondary w-12 text-right shrink-0">
            {week === WEEKS ? 'NOW' : `T\u2212${WEEKS - week}w`}
          </span>
        </div>
      )}

      {/* 3D hint */}
      {booted && !pitched && enriched.length > 0 && (
        <div className="absolute bottom-28 right-4 text-[9.5px] text-text-tertiary bg-surface-2/80 backdrop-blur-sm px-2.5 py-1.5 rounded-[var(--radius-sm)] border border-border-subtle pointer-events-none">
          Right-drag to tilt — 3D price view
        </div>
      )}

      {/* Coordinate readout */}
      <div className="absolute bottom-4 right-16 text-[10px] font-mono text-text-tertiary bg-surface-2/80 px-2 py-1 rounded-[var(--radius-xs)]">
        {cursorCoords.lat.toFixed(6)}, {cursorCoords.lng.toFixed(6)}
      </div>

      {/* Hover mini-dashboard */}
      {hoveredParcel && (
        <div
          className="absolute pointer-events-none z-50 bg-surface-4 border border-border-default rounded-[var(--radius-md)] p-2.5 shadow-[var(--shadow-md)] w-[190px]"
          style={{ left: mousePos.x + 16, top: mousePos.y - 10 }}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="font-mono text-[11px] font-semibold text-text-primary">
              {hoveredParcel.ticker}
            </span>
            <DeltaChip value={hoveredParcel.changePct} />
          </div>
          <div className="text-[9.5px] text-text-tertiary mb-1.5 truncate">
            #{hoveredParcel.id} {hoveredParcel.name}
          </div>
          <div className="flex items-end justify-between mb-1.5">
            <span className="tnum text-[13px] font-semibold text-text-primary">
              {hoveredParcel.livePrice.toFixed(3)}
              <span className="text-[8.5px] font-normal text-text-tertiary ml-1">
                MNT
              </span>
            </span>
            <Sparkline
              data={hoveredParcel.spark}
              up={hoveredParcel.changePct >= 0}
              w={64}
              h={20}
            />
          </div>
          <div className="h-1 bg-surface-2 rounded-full overflow-hidden mb-1">
            <div
              className="h-full bg-brand rounded-full"
              style={{
                width: `${((hoveredParcel.totalShares - hoveredParcel.availableShares) / hoveredParcel.totalShares) * 100}%`,
              }}
            />
          </div>
          <div className="flex items-center justify-between text-[9px] text-text-tertiary">
            <span>
              {hoveredParcel.totalShares - hoveredParcel.availableShares}/
              {hoveredParcel.totalShares} sold
            </span>
            <span className="flex items-center gap-1" style={{ color: 'var(--up)' }}>
              <ShieldCheck size={9} />
              AI {hoveredParcel.confidenceScore}
            </span>
          </div>
        </div>
      )}

      {/* ⌘K command palette */}
      {paletteOpen && (
        <div
          className="absolute inset-0 z-[60] bg-black/50 backdrop-blur-[2px] flex items-start justify-center pt-24"
          onClick={() => setPaletteOpen(false)}
        >
          <div
            className="w-[480px] bg-surface-2 border border-border-strong rounded-[var(--radius-lg)] shadow-[var(--shadow-lg)] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border-subtle">
              <Search size={14} className="text-text-tertiary shrink-0" />
              <input
                ref={paletteInputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && paletteResults.length > 0) {
                    flyToParcel(paletteResults[0])
                    setPaletteOpen(false)
                  }
                }}
                placeholder='Try "commercial under 2" or "high yield bangalore"…'
                className="flex-1 bg-transparent text-[13px] text-text-primary placeholder:text-text-tertiary outline-none"
              />
              <kbd className="font-mono text-[9px] text-text-tertiary bg-surface-3 px-1.5 py-0.5 rounded">
                ESC
              </kbd>
            </div>
            {query && (
              <div className="max-h-72 overflow-y-auto">
                {paletteResults.length === 0 ? (
                  <div className="px-4 py-6 text-center text-[12px] text-text-tertiary">
                    No parcels match — the map is dimmed to nothing
                  </div>
                ) : (
                  paletteResults.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        flyToParcel(p)
                        setPaletteOpen(false)
                      }}
                      className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-surface-3 transition-colors border-b border-border-subtle last:border-b-0"
                    >
                      <div className="text-left">
                        <span className="font-mono text-[12px] font-semibold text-text-primary mr-2">
                          {p.ticker}
                        </span>
                        <span className="text-[11px] text-text-tertiary">
                          {p.name} · {p.location}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="tnum text-[11.5px] text-text-secondary">
                          {p.livePrice.toFixed(3)} MNT
                        </span>
                        <DeltaChip value={p.changePct} />
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
            <div className="px-4 py-2 text-[9.5px] text-text-tertiary border-t border-border-subtle">
              Filters the map live · matches name, location, type, “under/over
              ⟨price⟩”, “high demand”, “yield”
            </div>
          </div>
        </div>
      )}

      {/* Cinematic boot overlay */}
      {!booted && (
        <div
          className="absolute inset-0 z-[70] pointer-events-none transition-opacity duration-1000"
          style={{
            backgroundColor: mapReady ? 'transparent' : '#000',
            transitionProperty: 'background-color',
            transitionDuration: '1500ms',
          }}
        >
          <div className="absolute bottom-10 left-6 font-mono text-[11px] space-y-1.5">
            {BOOT_LINES.slice(0, bootStep).map((line, i) => (
              <div
                key={line}
                className="boot-line"
                style={{
                  color: line.startsWith('\u2713') ? 'var(--up)' : 'var(--text-secondary)',
                  animationDelay: `${i * 60}ms`,
                }}
              >
                {line}
              </div>
            ))}
            {bootStep >= 4 && (
              <div className="boot-line" style={{ color: 'var(--up)' }}>
                {'\u2713'} {enriched.length} PARCEL{enriched.length === 1 ? '' : 'S'} LIVE
                {' \u00B7 '}MARKET ONLINE
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
