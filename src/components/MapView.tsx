'use client'

import L from 'leaflet'
import { useEffect, useRef } from 'react'
import { borderFor, textOn } from '@/lib/palettes'
import type { Mark } from '@/lib/types'

export interface FlyTo {
  pos: [number, number]
  /** Число — конкретный зум, 'keep' — текущий, по умолчанию — не меньше 16. */
  zoom?: number | 'keep'
  /** Снизу открыта карточка — сдвинуть точку в верхнюю часть экрана. */
  sheet?: boolean
  key: number
}

interface Props {
  marks: Mark[]
  me: [number, number] | null
  accuracy: number | null
  pick: [number, number] | null
  onPick: (pos: [number, number]) => void
  onSelect: (id: number) => void
  selectedId: number | null
  flyTo: FlyTo | null
  active: boolean
  /** Цвет метки рабочего (своя палитра, у каждого рабочего свой цвет). */
  colorFor: (workerId: number) => string
  /** Сюда пишется текущий центр карты (для новой отметки без геопозиции). */
  centerRef: React.RefObject<[number, number] | null>
  baseLayer: BaseLayer
}

export type BaseLayer = 'satellite' | 'scheme'

const DEFAULT_CENTER: [number, number] = [55.75, 37.62]

function markIcon(m: Mark, selected: boolean, color: string) {
  return L.divIcon({
    className: '',
    html: `<div class="pin${selected ? ' selected' : ''}" style="--pin:${color};--pin-text:${textOn(color)};--pin-border:${borderFor(color)}"><span>${m.bales_count}</span></div>`,
    iconSize: [36, 44],
    iconAnchor: [18, 44],
  })
}

const pickIcon = L.divIcon({
  className: '',
  html: '<div class="pick-pin"><span>＋</span></div>',
  iconSize: [40, 48],
  iconAnchor: [20, 48],
})

export default function MapView(props: Props) {
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const marksLayer = useRef<L.LayerGroup | null>(null)
  const meLayer = useRef<L.LayerGroup | null>(null)
  const pickMarker = useRef<L.Marker | null>(null)
  const layers = useRef<Record<BaseLayer, L.Layer> | null>(null)
  const centered = useRef<'none' | 'marks' | 'me'>('none')
  const cb = useRef(props)
  useEffect(() => {
    cb.current = props
  })

  // Инициализация карты.
  useEffect(() => {
    if (!el.current || map.current) return
    const m = L.map(el.current, { zoomControl: false, attributionControl: true }).setView(DEFAULT_CENTER, 5)
    const scheme = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    })
    // Спутник Esri World Imagery (без ключа) + подписи населённых пунктов и границ поверх снимка.
    // maxNativeZoom 18: на больших зумах тайлы растягиваются вместо заглушки «нет данных».
    const esri = 'https://server.arcgisonline.com/ArcGIS/rest/services'
    const satellite = L.layerGroup([
      L.tileLayer(`${esri}/World_Imagery/MapServer/tile/{z}/{y}/{x}`, {
        maxZoom: 19,
        maxNativeZoom: 18,
        attribution: '&copy; Esri',
      }),
      L.tileLayer(`${esri}/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}`, {
        maxZoom: 19,
        maxNativeZoom: 18,
      }),
    ])
    layers.current = { satellite, scheme }
    layers.current[cb.current.baseLayer].addTo(m)
    L.control.zoom({ position: 'topright' }).addTo(m)
    m.attributionControl.setPrefix(false)
    marksLayer.current = L.layerGroup().addTo(m)
    meLayer.current = L.layerGroup().addTo(m)
    m.on('click', (e: L.LeafletMouseEvent) => {
      if (cb.current.pick) cb.current.onPick([e.latlng.lat, e.latlng.lng])
    })
    const syncCenter = () => {
      const c = m.getCenter()
      cb.current.centerRef.current = [c.lat, c.lng]
    }
    m.on('moveend', syncCenter)
    syncCenter()
    // Размер WebView меняется (клавиатура, разворачивание Mini App) — пересчитываем карту.
    const ro = new ResizeObserver(() => m.invalidateSize())
    ro.observe(el.current)
    map.current = m
    return () => {
      ro.disconnect()
      m.remove()
      map.current = null
    }
  }, [])

  // Переключение подложки: спутник / схема.
  const { baseLayer } = props
  useEffect(() => {
    const m = map.current
    const l = layers.current
    if (!m || !l) return
    for (const [key, layer] of Object.entries(l) as [BaseLayer, L.Layer][]) {
      if (key === baseLayer) {
        if (!m.hasLayer(layer)) layer.addTo(m)
      } else if (m.hasLayer(layer)) {
        m.removeLayer(layer)
      }
    }
  }, [baseLayer])

  // Маркеры отметок.
  const { marks, selectedId, colorFor } = props
  useEffect(() => {
    const layer = marksLayer.current
    const m = map.current
    if (!layer || !m) return
    layer.clearLayers()
    for (const mark of marks) {
      const selected = mark.id === selectedId
      L.marker([mark.lat, mark.lng], {
        icon: markIcon(mark, selected, colorFor(mark.worker_id)),
        zIndexOffset: selected ? 1000 : 0,
        keyboard: false,
      })
        .on('click', (e) => {
          L.DomEvent.stopPropagation(e)
          if (!cb.current.pick) cb.current.onSelect(mark.id)
        })
        .addTo(layer)
    }
    if (centered.current === 'none' && marks.length > 0) {
      m.fitBounds(L.latLngBounds(marks.map((x) => [x.lat, x.lng])), { padding: [40, 40], maxZoom: 15 })
      centered.current = 'marks'
    }
  }, [marks, selectedId, colorFor])

  // Текущая геопозиция: центр карты при первом получении.
  const { me, accuracy } = props
  useEffect(() => {
    const layer = meLayer.current
    const m = map.current
    if (!layer || !m) return
    layer.clearLayers()
    if (!me) return
    if (accuracy && accuracy < 2000) {
      L.circle(me, { radius: accuracy, color: '#2a8cff', weight: 1, fillOpacity: 0.1, interactive: false }).addTo(layer)
    }
    L.circleMarker(me, {
      radius: 8,
      color: '#fff',
      weight: 3,
      fillColor: '#2a8cff',
      fillOpacity: 1,
      interactive: false,
    }).addTo(layer)
    if (centered.current !== 'me') {
      m.setView(me, 16)
      centered.current = 'me'
    }
  }, [me, accuracy])

  // Точка для новой / редактируемой отметки.
  const { pick } = props
  useEffect(() => {
    const m = map.current
    if (!m) return
    if (!pick) {
      pickMarker.current?.remove()
      pickMarker.current = null
      return
    }
    if (!pickMarker.current) {
      pickMarker.current = L.marker(pick, { icon: pickIcon, draggable: true, zIndexOffset: 2000 })
        .on('dragend', (e) => {
          const ll = (e.target as L.Marker).getLatLng()
          cb.current.onPick([ll.lat, ll.lng])
        })
        .addTo(m)
    } else {
      pickMarker.current.setLatLng(pick)
    }
  }, [pick])

  const { flyTo } = props
  useEffect(() => {
    const m = map.current
    if (!flyTo || !m) return
    const zoom =
      flyTo.zoom === 'keep' ? m.getZoom() : (flyTo.zoom ?? Math.max(m.getZoom(), 16))
    let target = L.latLng(flyTo.pos)
    if (flyTo.sheet) target = m.unproject(m.project(target, zoom).add([0, m.getSize().y * 0.25]), zoom)
    m.flyTo(target, zoom, { duration: 0.5 })
  }, [flyTo])

  // Вкладка была скрыта — Leaflet должен пересчитать размер контейнера.
  const { active } = props
  useEffect(() => {
    if (active) map.current?.invalidateSize()
  }, [active])

  return <div ref={el} className="map" />
}
