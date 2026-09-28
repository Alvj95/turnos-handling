import { useCallback, useEffect, useMemo, useState } from 'react'
import { App as CapApp } from '@capacitor/app'
import type { Shift } from './types'
import { CalendarTab } from './components/CalendarTab'
import { HoursTab } from './components/HoursTab'
import { InstallCard, LinkHandoff } from './components/Install'
import { ProfileSheet } from './components/ProfileSheet'
import { RosterTab } from './components/RosterTab'
import { SwapsTab } from './components/SwapsTab'
import { isMe, mergeCompanyShifts } from './lib/roster'
import { emptyData, useAppData } from './lib/store'
import { hasLink, readLink } from './lib/links'
import { isNative } from './lib/platform'
import { applyAcceptedSwap, applyIncomingSwap, receiveLink } from './lib/swaps'

type Tab = 'calendar' | 'roster' | 'swaps' | 'hours'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'calendar', label: 'Mis turnos', icon: '📅' },
  { id: 'roster', label: 'Horario', icon: '📋' },
  { id: 'swaps', label: 'Cambios', icon: '🔄' },
  { id: 'hours', label: 'Horas', icon: '⏱️' },
]

const byDateTime = (a: Shift, b: Shift) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start)

export default function App() {
  const [data, update] = useAppData()
  const [tab, setTab] = useState<Tab>('calendar')
  const [profileOpen, setProfileOpen] = useState(false)
  const [swapShiftId, setSwapShiftId] = useState('')
  const [notice, setNotice] = useState('')

  const [openedLink, setOpenedLink] = useState('') // link opened in a browser tab, to hand off to the app

  /** Records a swap request/answer link, wherever it came from (URL, native deep link, pasted text). */
  const processLink = useCallback((text: string) => {
    setTab('swaps')
    const link = readLink(text)
    if (!link) {
      setNotice('El enlace del cambio está incompleto. Pide que te lo reenvíen.')
      return false
    }
    update((d) => {
      const result = receiveLink(d, link)
      setNotice(result.notice)
      return result.data
    })
    requestAnimationFrame(() => document.querySelector('.content')?.scrollTo(0, 0))
    return true
  }, [update])

  // Web: links arrive as "#cambio=…" (opened from WhatsApp).
  useEffect(() => {
    if (isNative()) return
    const handle = () => {
      if (!hasLink(location.hash)) return
      const text = location.href
      history.replaceState(null, '', location.pathname + location.search)
      setOpenedLink(text)
      processLink(text)
    }
    handle()
    window.addEventListener('hashchange', handle)
    return () => window.removeEventListener('hashchange', handle)
  }, [processLink])

  // Android app: links open the app directly (turnoshandling://… or the https link).
  useEffect(() => {
    if (!isNative()) return
    CapApp.getLaunchUrl().then((launch) => launch?.url && hasLink(launch.url) && processLink(launch.url))
    const opened = CapApp.addListener('appUrlOpen', ({ url }) => hasLink(url) && processLink(url))
    // Back button closes the open sheet first; with nothing open it leaves the app.
    const back = CapApp.addListener('backButton', () => {
      if (document.querySelector('.sheet')) window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
      else CapApp.minimizeApp()
    })
    return () => {
      opened.then((h) => h.remove())
      back.then((h) => h.remove())
    }
  }, [processLink])

  const myRoster = useMemo(() => data.roster.filter((e) => isMe(e.employee, data.profile)), [data.roster, data.profile])
  // Things waiting on me: requests to answer and accepted changes to email.
  const pendingSwaps =
    data.incoming.filter((i) => i.status === 'pendiente').length +
    data.swaps.filter((s) => s.status === 'aceptado_companero').length

  const saveShift = (shift: Shift) => update((d) => ({
    ...d,
    shifts: [...d.shifts.filter((s) => s.id !== shift.id), shift].sort(byDateTime),
  }))

  const syncMine = () => {
    update((d) => ({ ...d, shifts: mergeCompanyShifts(d.shifts, d.roster, d.profile) }))
    setTab('calendar')
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">✈</span>
          <div>
            <div className="brand-name">Turnos Handling</div>
            <div className="brand-sub">{data.profile.name || 'Configura tu perfil'}</div>
          </div>
        </div>
        <button className="avatar" onClick={() => setProfileOpen(true)} aria-label="Mi perfil">
          {data.profile.name ? data.profile.name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase() : '👤'}
        </button>
      </header>

      <main className="content">
        {!data.profile.name && (
          <button className="banner" onClick={() => setProfileOpen(true)}>
            👋 Empieza poniendo tu nombre tal como aparece en el horario de la empresa.
          </button>
        )}
        {notice && (
          <button className="banner notice" onClick={() => setNotice('')}>{notice} <span className="muted">✕</span></button>
        )}
        {openedLink && <LinkHandoff link={openedLink} onClose={() => setOpenedLink('')} />}
        {tab === 'calendar' && <InstallCard />}
        {tab === 'calendar' && (
          <CalendarTab
            shifts={data.shifts}
            myRoster={myRoster}
            onSave={saveShift}
            onDelete={(id) => update((d) => ({ ...d, shifts: d.shifts.filter((s) => s.id !== id) }))}
            onSwap={(s) => { setSwapShiftId(s.id); setTab('swaps') }}
          />
        )}
        {tab === 'roster' && (
          <RosterTab
            roster={data.roster}
            rosterName={data.rosterName}
            importedAt={data.rosterImportedAt}
            profile={data.profile}
            onSyncMine={syncMine}
            onImport={(result, name, myName) => update((d) => {
              const profile = myName && !isMe(myName, d.profile) ? { ...d.profile, name: myName } : d.profile
              const next = { ...d, profile, roster: result.entries, rosterName: name, rosterImportedAt: Date.now() }
              return myName ? { ...next, shifts: mergeCompanyShifts(d.shifts, result.entries, profile) } : next
            })}
          />
        )}
        {tab === 'swaps' && (
          <SwapsTab
            shifts={data.shifts}
            roster={data.roster}
            profile={data.profile}
            swaps={data.swaps}
            incoming={data.incoming}
            selectedId={swapShiftId}
            onSelect={setSwapShiftId}
            onCreate={(swap) => update((d) => ({ ...d, swaps: [...d.swaps, swap] }))}
            onUpdate={(id, patch) => update((d) => ({ ...d, swaps: d.swaps.map((s) => (s.id === id ? { ...s, ...patch } : s)) }))}
            onApprove={(swap) => update((d) => applyAcceptedSwap(d, swap))}
            onSchedulingEmail={(email) => update((d) => ({ ...d, profile: { ...d.profile, schedulingEmail: email } }))}
            onAnswer={(id, ok) => update((d) => ({
              ...d,
              incoming: d.incoming.map((i) => (i.id === id ? { ...i, status: ok ? 'aceptado' : 'rechazado' } : i)),
            }))}
            onApplyIncoming={(inc) => update((d) => applyIncomingSwap(d, inc))}
            onPasteLink={processLink}
          />
        )}
        {tab === 'hours' && <HoursTab shifts={data.shifts} />}
      </main>

      <nav className="tabbar">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
            <span className="tab-icon">{t.icon}</span>
            <span>{t.label}</span>
            {t.id === 'swaps' && pendingSwaps > 0 && <span className="badge">{pendingSwaps}</span>}
          </button>
        ))}
      </nav>

      {profileOpen && (
        <ProfileSheet
          data={data}
          onClose={() => setProfileOpen(false)}
          onSave={(profile) => update((d) => ({ ...d, profile }))}
          onRestore={(restored) => update(() => restored)}
          onReset={() => update(() => emptyData())}
        />
      )}
    </div>
  )
}
