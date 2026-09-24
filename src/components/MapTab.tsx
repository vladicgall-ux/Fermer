'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '@/lib/client-api'
import { bales, fmtNum, plural } from '@/lib/format'
import { useBackButton, useGeolocation } from '@/lib/hooks'
import { alertDialog, confirmDialog, haptic } from '@/lib/telegram'
import type { Mark, User } from '@/lib/types'
import MarkCard from './MarkCard'
import MarkForm, { type MarkFormValues } from './MarkForm'
import type { BaseLayer, FlyTo } from './MapView'

const MapView = dynamic(() => import('./MapView'), {
  ssr: false,
  loading: () => <div className="map map-loading">Загрузка карты…</div>,
})

type Period = 'all' | 'today' | 'week' | 'month'
type Mode = { kind: 'view' } | { kind: 'create' } | { kind: 'edit'; mark: Mark }

const LAYER_KEY = 'fermer:baseLayer'

function savedLayer(): BaseLayer {
  try {
    return localStorage.getItem(LAYER_KEY) === 'scheme' ? 'scheme' : 'satellite'
  } catch {
    return 'satellite'
  }
}

const PERIODS: { id: Period; label: string }[] = [
  { id: 'all', label: 'Все' },
  { id: 'today', label: 'Сегодня' },
  { id: 'week', label: '7 дней' },
  { id: 'month', label: 'Месяц' },
]

function periodStart(p: Period): number {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  if (p === 'today') return d.getTime()
  if (p === 'week') return d.getTime() - 6 * 86400000
  if (p === 'month') return new Date(d.getFullYear(), d.getMonth(), 1).getTime()
  return 0
}

export default function MapTab({ me, workers, active }: { me: User; workers: User[]; active: boolean }) {
  const isAdmin = me.role === 'admin'
  const geo = useGeolocation()
  const [marks, setMarks] = useState<Mark[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [period, setPeriod] = useState<Period>('all')
  const [workerFilter, setWorkerFilter] = useState<number | 0>(0)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [mode, setMode] = useState<Mode>({ kind: 'view' })
  const [pick, setPick] = useState<[number, number] | null>(null)
  const [flyTo, setFlyTo] = useState<FlyTo | null>(null)
  const [busy, setBusy] = useState(false)
  const centerRef = useRef<[number, number] | null>(null)
  const [baseLayer, setBaseLayer] = useState<BaseLayer>(savedLayer)

  const toggleLayer = () => {
    const next: BaseLayer = baseLayer === 'satellite' ? 'scheme' : 'satellite'
    setBaseLayer(next)
    try {
      localStorage.setItem(LAYER_KEY, next)
    } catch {
      // хранилище недоступно — выбор просто не запомнится
    }
  }

  const load = useCallback(async () => {
    try {
      const r = await api<{ marks: Mark[] }>('/api/marks')
      setMarks(r.marks)
      setLoadError(null)
    } catch (e) {
      setLoadError((e as Error).message)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- начальная загрузка данных
    load()
  }, [load])

  const visible = useMemo(() => {
    const from = periodStart(period)
    return marks.filter(
      (m) => (from === 0 || Date.parse(m.date) >= from) && (!workerFilter || m.worker_id === workerFilter),
    )
  }, [marks, period, workerFilter])

  const editingId = mode.kind === 'edit' ? mode.mark.id : null
  // Редактируемую отметку скрываем — вместо неё на карте перетаскиваемая метка.
  const shown = useMemo(
    () => (editingId === null ? visible : visible.filter((m) => m.id !== editingId)),
    [visible, editingId],
  )

  const totalBales = useMemo(() => visible.reduce((s, m) => s + m.bales_count, 0), [visible])
  const selected = marks.find((m) => m.id === selectedId) ?? null

  const closeAll = useCallback(() => {
    setMode({ kind: 'view' })
    setPick(null)
    setSelectedId(null)
  }, [])

  useBackButton(active && (mode.kind !== 'view' || selectedId !== null), closeAll)

  const selectMark = useCallback(
    (id: number) => {
      setSelectedId(id)
      const m = marks.find((x) => x.id === id)
      if (m) setFlyTo({ pos: [m.lat, m.lng], zoom: 'keep', sheet: true, key: Date.now() })
    },
    [marks],
  )

  const startCreate = () => {
    setSelectedId(null)
    const pos = geo.pos ?? centerRef.current
    if (!pos) return
    setPick(pos)
    setMode({ kind: 'create' })
    setFlyTo({ pos, sheet: true, key: Date.now() })
    haptic('light')
  }

  const startEdit = (mark: Mark) => {
    setMode({ kind: 'edit', mark })
    setPick([mark.lat, mark.lng])
    setFlyTo({ pos: [mark.lat, mark.lng], zoom: 'keep', sheet: true, key: Date.now() })
  }

  const submit = async (v: MarkFormValues) => {
    if (!pick) return
    setBusy(true)
    try {
      if (mode.kind === 'create') {
        const r = await api<{ mark: Mark }>('/api/marks', {
          method: 'POST',
          body: {
            lat: pick[0],
            lng: pick[1],
            bales_count: v.bales_count,
            ...(isAdmin ? { worker_id: v.worker_id } : {}),
          },
        })
        setMarks((ms) => [r.mark, ...ms])
        setMode({ kind: 'view' })
        setPick(null)
        setSelectedId(r.mark.id)
      } else if (mode.kind === 'edit') {
        const orig = mode.mark
        const body: Record<string, unknown> = {}
        if (v.bales_count !== orig.bales_count) body.bales_count = v.bales_count
        if (v.worker_id !== orig.worker_id) body.worker_id = v.worker_id
        if (pick[0] !== orig.lat || pick[1] !== orig.lng) {
          body.lat = pick[0]
          body.lng = pick[1]
        }
        if (v.date && v.date !== orig.date) body.date = v.date
        if (Object.keys(body).length > 0) {
          const r = await api<{ mark: Mark }>(`/api/marks/${orig.id}`, { method: 'PATCH', body })
          setMarks((ms) => ms.map((m) => (m.id === r.mark.id ? r.mark : m)))
        }
        setMode({ kind: 'view' })
        setPick(null)
        setSelectedId(orig.id)
      }
      haptic('success')
    } catch (e) {
      haptic('error')
      await alertDialog((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const remove = async (mark: Mark) => {
    const ok = await confirmDialog(`Точно удалить отметку?\n${mark.worker_name}: ${bales(mark.bales_count)}`)
    if (!ok) return
    try {
      await api(`/api/marks/${mark.id}`, { method: 'DELETE' })
      setMarks((ms) => ms.filter((m) => m.id !== mark.id))
      setSelectedId(null)
      haptic('success')
    } catch (e) {
      haptic('error')
      await alertDialog((e as Error).message)
    }
  }

  const picking = mode.kind !== 'view'

  return (
    <div className="map-tab">
      <MapView
        marks={shown}
        me={geo.pos}
        accuracy={geo.accuracy}
        pick={pick}
        onPick={setPick}
        onSelect={selectMark}
        selectedId={selectedId}
        flyTo={flyTo}
        active={active}
        colorByWorker={isAdmin}
        centerRef={centerRef}
        baseLayer={baseLayer}
      />

      <button className="fab-layer" onClick={toggleLayer} aria-label="Переключить вид карты">
        {baseLayer === 'satellite' ? '🗺️ Схема' : '🛰️ Спутник'}
      </button>

      {!picking && (
        <div className="map-top">
          <div className="chips">
            {PERIODS.map((p) => (
              <button
                key={p.id}
                className={`chip${period === p.id ? ' active' : ''}`}
                onClick={() => setPeriod(p.id)}
              >
                {p.label}
              </button>
            ))}
          </div>
          {isAdmin && workers.length > 0 && (
            <select
              className="chip-select"
              value={workerFilter}
              onChange={(e) => setWorkerFilter(Number(e.target.value))}
            >
              <option value={0}>Все рабочие</option>
              {workers.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          )}
          <div className="summary-pill">
            {fmtNum(visible.length)} {plural(visible.length, ['отметка', 'отметки', 'отметок'])} ·{' '}
            {bales(totalBales)}
          </div>
          {loadError && <div className="error-pill">{loadError}</div>}
          {geo.error && <div className="error-pill">{geo.error}</div>}
        </div>
      )}

      {!picking && (
        <button
          className="fab-locate"
          aria-label="Моё местоположение"
          disabled={!geo.pos}
          onClick={() => geo.pos && setFlyTo({ pos: geo.pos, key: Date.now() })}
        >
          ◎
        </button>
      )}

      {!picking && !selected && (
        <button className="fab-add" onClick={startCreate}>
          ＋ Добавить отметку
        </button>
      )}

      {!picking && selected && (
        <MarkCard
          mark={selected}
          isAdmin={isAdmin}
          onClose={() => setSelectedId(null)}
          onEdit={() => startEdit(selected)}
          onDelete={() => remove(selected)}
        />
      )}

      {picking && pick && (
        <MarkForm
          key={mode.kind === 'edit' ? `e${mode.mark.id}` : 'create'}
          me={me}
          workers={workers}
          isAdmin={isAdmin}
          editing={mode.kind === 'edit' ? mode.mark : null}
          pick={pick}
          busy={busy}
          canUseMyPos={!!geo.pos}
          onUseMyPos={() => {
            if (!geo.pos) return
            setPick(geo.pos)
            setFlyTo({ pos: geo.pos, sheet: true, key: Date.now() })
          }}
          onCancel={() => {
            const wasEdit = mode.kind === 'edit' ? mode.mark.id : null
            setMode({ kind: 'view' })
            setPick(null)
            setSelectedId(wasEdit)
          }}
          onSubmit={submit}
        />
      )}
    </div>
  )
}
