"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png"
import markerIcon from "leaflet/dist/images/marker-icon.png"
import markerShadow from "leaflet/dist/images/marker-shadow.png"
import { toast } from "@/hooks/use-toast"
import type { MapExpense, TripMapData } from "@/types/index"

// Leaflet marker icon fix for webpack bundlers
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
})

const LEG_ICONS: Record<string, string> = {
  flight: "✈",
  train: "🚄",
  bus: "🚌",
  ferry: "⛴",
  accommodation: "🏨",
  car_rental: "🚗",
  other: "📍",
}

const CATEGORY_COLORS: Record<string, string> = {
  Dining: "#e53e3e",
  Lodging: "#805ad5",
  Transport: "#2b6cb0",
  Culture: "#d69e2e",
  Shopping: "#38a169",
  Health: "#e53e3e",
  Other: "#718096",
}

function makeLegIcon(mode: string): L.DivIcon {
  const emoji = LEG_ICONS[mode] ?? "📍"
  return L.divIcon({
    className: "",
    html: `<div style="
      font-size:18px;line-height:1;
      filter:drop-shadow(0 1px 2px rgba(0,0,0,.4));
    ">${emoji}</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -14],
  })
}

function makeExpenseDotIcon(color: string): L.DivIcon {
  return L.divIcon({
    className: "",
    html: `<div style="
      width:16px;height:16px;
      border-radius:50%;
      background:${color};
      border:2.5px solid white;
      box-shadow:0 1px 4px rgba(0,0,0,.35);
      cursor:grab;
    "></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    popupAnchor: [0, -10],
  })
}

async function handleMarkerDragEnd(
  exp: MapExpense,
  marker: L.Marker,
  onUpdate: (id: string, lat: number, lng: number, name: string) => void,
) {
  const { lat, lng } = marker.getLatLng()
  const newLat = Math.round(lat * 1e6) / 1e6
  const newLng = Math.round(lng * 1e6) / 1e6

  try {
    let newName = exp.location_name ?? ""
    try {
      const geoRes = await fetch(
        `/api/proxy/geocoding/reverse?lat=${newLat}&lng=${newLng}`
      )
      if (geoRes.ok) {
        const geoData = await geoRes.json()
        newName = geoData.name || newName
      }
    } catch {
      // reverse geocoding fallback silencioso
    }

    const res = await fetch(`/api/proxy/expenses/${exp.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location_lat: newLat,
        location_lng: newLng,
        location_name: newName || null,
      }),
    })
    if (!res.ok) throw new Error("PUT failed")

    toast.success(`Ubicación actualizada: ${newName || "nueva posición"}`)
    onUpdate(exp.id, newLat, newLng, newName)
  } catch {
    toast.error("Error al guardar la nueva ubicación")
    if (exp.location_lat != null && exp.location_lng != null) {
      marker.setLatLng([exp.location_lat, exp.location_lng])
    }
  }
}

interface TripMapProps {
  tripId: string
  data: TripMapData
  showExpenses: boolean
  showLegs: boolean
  onExpenseLocationUpdated?: (id: string, lat: number, lng: number, name: string) => void
}

export default function TripMap({
  tripId,
  data,
  showExpenses,
  showLegs,
  onExpenseLocationUpdated,
}: TripMapProps) {
  const router = useRouter()
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const expenseLayerRef = useRef<L.LayerGroup | null>(null)
  const legLayerRef = useRef<L.LayerGroup | null>(null)

  // Initialize map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = L.map(containerRef.current, {
      center: [20, 0],
      zoom: 2,
      zoomControl: true,
    })

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map)

    expenseLayerRef.current = L.layerGroup().addTo(map)
    legLayerRef.current = L.layerGroup().addTo(map)
    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
      expenseLayerRef.current = null
      legLayerRef.current = null
    }
  }, [])

  // Redraw expense layer when data or toggle changes
  useEffect(() => {
    const layer = expenseLayerRef.current
    const map = mapRef.current
    if (!layer || !map) return

    layer.clearLayers()
    if (!showExpenses || !data.expenses.length) return

    const withCoords = data.expenses.filter(
      (e) => e.location_lat != null && e.location_lng != null &&
             isFinite(Number(e.location_lat)) && isFinite(Number(e.location_lng))
    )

    for (const exp of withCoords) {
      const lat = Number(exp.location_lat)
      const lng = Number(exp.location_lng)
      const color = CATEGORY_COLORS[exp.category] ?? "#718096"
      const icon = makeExpenseDotIcon(color)

      const marker = L.marker([lat, lng], { icon, draggable: true })

      const label = exp.location_name ?? `${lat.toFixed(4)}, ${lng.toFixed(4)}`
      const btnId = `expense-nav-${exp.id}`
      marker.bindPopup(
        `<div style="min-width:160px">
          <p style="font-weight:600;margin:0 0 4px">${exp.description ?? exp.category}</p>
          <p style="margin:0;font-size:13px;color:#555">${exp.currency} ${Number(exp.amount).toLocaleString("es-ES", { minimumFractionDigits: 2 })}</p>
          <p style="margin:2px 0 0;font-size:11px;color:#888">${label}</p>
          <p style="margin:2px 0 0;font-size:11px;color:#aaa">${exp.date}</p>
          <button id="${btnId}" style="margin-top:8px;background:#004d64;color:white;border:none;border-radius:6px;padding:6px 12px;cursor:pointer;font-size:12px;width:100%">Ver / Editar →</button>
        </div>`
      )
      marker.on("popupopen", () => {
        document.getElementById(btnId)?.addEventListener(
          "click",
          () => router.push(`/trips/${tripId}/expenses/${exp.id}`),
          { once: true }
        )
      })

      const currentOnUpdate = onExpenseLocationUpdated ?? (() => {})
      marker.on("dragend", () => {
        handleMarkerDragEnd(exp, marker, currentOnUpdate)
      })

      // cursor visual tras añadir al mapa
      marker.on("add", () => {
        const el = marker.getElement()
        if (el) el.style.cursor = "grab"
      })

      layer.addLayer(marker)
    }
  }, [data.expenses, showExpenses, tripId, router, onExpenseLocationUpdated])

  // Redraw leg layer when data or toggle changes
  useEffect(() => {
    const layer = legLayerRef.current
    const map = mapRef.current
    if (!layer || !map) return

    layer.clearLayers()
    if (!showLegs || !data.legs.length) return

    for (const leg of data.legs) {
      if (!leg.points.length) continue
      const icon = makeLegIcon(leg.mode)

      for (const pt of leg.points) {
        const marker = L.marker([pt.lat, pt.lng], { icon })
        marker.bindPopup(`<p style="margin:0;font-size:13px;font-weight:600">${pt.label}</p>`)
        layer.addLayer(marker)
      }

      // Draw arc line between origin and destination for transport legs
      if (leg.points.length === 2) {
        const [a, b] = leg.points
        const polyline = L.polyline(
          [[a.lat, a.lng], [b.lat, b.lng]],
          { color: "#2b6cb0", weight: 2, opacity: 0.6, dashArray: "6 4" }
        )
        layer.addLayer(polyline)
      }
    }
  }, [data.legs, showLegs])

  // Fit bounds when data changes
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const allPoints: [number, number][] = []
    if (showExpenses) {
      for (const e of data.expenses) {
        if (e.location_lat != null && e.location_lng != null &&
            isFinite(Number(e.location_lat)) && isFinite(Number(e.location_lng))) {
          allPoints.push([Number(e.location_lat), Number(e.location_lng)])
        }
      }
    }
    if (showLegs) {
      for (const leg of data.legs) {
        for (const pt of leg.points) allPoints.push([pt.lat, pt.lng])
      }
    }
    if (allPoints.length > 0) {
      map.fitBounds(L.latLngBounds(allPoints), { padding: [40, 40], maxZoom: 14 })
    }
  }, [data, showExpenses, showLegs])

  return <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />
}
