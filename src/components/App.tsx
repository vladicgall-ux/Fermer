'use client'

import { useCallback, useEffect, useState } from 'react'
import { api } from '@/lib/client-api'
import { supports, tg } from '@/lib/telegram'
import type { User } from '@/lib/types'
import MapTab from './MapTab'
import ProfileTab from './ProfileTab'
import StatsTab from './StatsTab'
import UsersTab from './UsersTab'

type Tab = 'map' | 'stats' | 'users' | 'profile'

export default function App() {
  const [me, setMe] = useState<User | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('map')
  const [workers, setWorkers] = useState<User[]>([])

  useEffect(() => {
    const w = tg()
    if (!w) return
    w.ready()
    w.expand()
    // Иначе вертикальный свайп по карте сворачивает Mini App.
    if (supports('7.7')) w.disableVerticalSwipes?.()
    const applyTheme = () => {
      const bg = w.themeParams.bg_color
      const secondary = w.themeParams.secondary_bg_color
      if (bg && supports('6.1')) w.setHeaderColor(bg)
      if (bg && supports('6.1')) w.setBackgroundColor(bg)
      if (secondary && supports('7.10')) w.setBottomBarColor?.(secondary)
      document.documentElement.dataset.scheme = w.colorScheme
    }
    applyTheme()
    w.onEvent('themeChanged', applyTheme)
    return () => w.offEvent('themeChanged', applyTheme)
  }, [])

  useEffect(() => {
    api<{ user: User }>('/api/me')
      .then((r) => setMe(r.user))
      .catch((e: Error) => setError(e.message))
  }, [])

  const isAdmin = me?.role === 'admin'
  // Если админ снял права с себя, вкладка «Пользователи» становится недоступной.
  const current: Tab = tab === 'users' && !isAdmin ? 'map' : tab

  // Админу — полный список пользователей, рабочему — только id и имена (для фильтра статистики).
  const loggedIn = me !== null
  const loadWorkers = useCallback(() => {
    if (!loggedIn) return
    const req = isAdmin
      ? api<{ users: User[] }>('/api/users').then((r) => r.users)
      : api<{ workers: Pick<User, 'id' | 'name'>[] }>('/api/workers').then((r) => r.workers as User[])
    req.then(setWorkers).catch(() => {})
  }, [isAdmin, loggedIn])

  useEffect(() => {
    loadWorkers()
  }, [loadWorkers])

  if (error) {
    return (
      <div className="splash">
        <div className="splash-icon">🌾</div>
        <p>{error}</p>
        <button className="btn primary" style={{ flex: 'none' }} onClick={() => window.location.reload()}>
          Повторить
        </button>
        <p className="hint">Если ошибка повторяется, откройте приложение заново через бота.</p>
      </div>
    )
  }
  if (!me) {
    return (
      <div className="splash">
        <div className="splash-icon">🌾</div>
        <p className="hint">Загрузка…</p>
      </div>
    )
  }

  return (
    <div className="app">
      <main className="content">
        {/* Карта не размонтируется при переключении вкладок, чтобы не терять позицию и зум. */}
        <div className="tab" hidden={current !== 'map'}>
          <MapTab key={me.role} me={me} workers={isAdmin ? workers : []} active={current === 'map'} />
        </div>
        {current === 'stats' && (
          <div className="tab scroll">
            <StatsTab key={me.role} me={me} workers={workers} />
          </div>
        )}
        {current === 'profile' && (
          <div className="tab scroll">
            <ProfileTab
              me={me}
              onChanged={(u) => {
                setMe(u)
                loadWorkers()
              }}
            />
          </div>
        )}
        {current === 'users' && isAdmin && (
          <div className="tab scroll">
            <UsersTab
              me={me}
              onChanged={(u) => {
                loadWorkers()
                if (u.id === me.id) setMe(u)
              }}
            />
          </div>
        )}
      </main>
      <nav className="bottom-nav">
        <NavButton active={current === 'map'} onClick={() => setTab('map')} icon="🗺️" label="Карта" />
        <NavButton active={current === 'stats'} onClick={() => setTab('stats')} icon="📊" label="Статистика" />
        {isAdmin && (
          <NavButton active={current === 'users'} onClick={() => setTab('users')} icon="👥" label="Пользователи" />
        )}
        <NavButton active={current === 'profile'} onClick={() => setTab('profile')} icon="👤" label="Профиль" />
      </nav>
    </div>
  )
}

function NavButton(props: { active: boolean; onClick: () => void; icon: string; label: string }) {
  return (
    <button className={`nav-btn${props.active ? ' active' : ''}`} onClick={props.onClick}>
      <span className="nav-icon" aria-hidden>
        {props.icon}
      </span>
      <span>{props.label}</span>
    </button>
  )
}
