import { useState } from 'react'
import { intentLink } from '../lib/links'
import { APK_URL, PUBLIC_URL, isAndroid, isIOS, isNative, isStandalone } from '../lib/platform'

const DISMISS_KEY = 'turnos-handling:install-dismissed'
const PACKAGE = 'com.turnoshandling.app'

function AndroidSteps() {
  return (
    <>
      <a className="btn primary full" href={APK_URL} download>⬇️ Descargar app para Android</a>
      <p className="hint">Abre el archivo descargado y, si el teléfono lo pide, permite <b>instalar apps de origen desconocido</b>. Para actualizar, descarga e instala de nuevo desde aquí.</p>
    </>
  )
}

function IOSSteps() {
  return (
    <ol className="install-steps">
      <li>Abre esta página en <b>Safari</b>.</li>
      <li>Pulsa <b>Compartir</b> <span className="ios-share" aria-hidden>⬆︎</span> abajo en la pantalla.</li>
      <li>Elige <b>“Añadir a pantalla de inicio”</b> y pulsa <b>Añadir</b>.</li>
    </ol>
  )
}

/** Invites phone users browsing the web version to install the app (dismissable). */
export function InstallCard() {
  const [hidden, setHidden] = useState(() => {
    try { return localStorage.getItem(DISMISS_KEY) === '1' } catch { return false }
  })
  if (hidden || isNative() || isStandalone() || !(isAndroid() || isIOS())) return null
  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, '1') } catch { /* private mode */ }
    setHidden(true)
  }
  return (
    <div className="card install-card">
      <div className="section-title">
        <h3>📲 Instala la app</h3>
        <button className="icon-btn" onClick={dismiss} aria-label="Ocultar">✕</button>
      </div>
      {isAndroid() ? <AndroidSteps /> : <IOSSteps />}
    </div>
  )
}

/** Install options for every platform (profile sheet). */
export function InstallSection() {
  if (isNative()) return null
  return (
    <>
      <h3 className="list-title">Instalar la app</h3>
      <div className="card">
        <b>Android</b>
        <AndroidSteps />
      </div>
      <div className="card">
        <b>iPhone</b>
        <IOSSteps />
      </div>
      <p className="hint">Enlace para compartir con tus compañeros: <a href={PUBLIC_URL}>{PUBLIC_URL}</a></p>
    </>
  )
}

/**
 * A swap link opened in a browser tab: the installed app keeps its own data, so offer to
 * open it there (Android) or to paste it into the home-screen app (iPhone).
 */
export function LinkHandoff({ link, onClose }: { link: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  if (isNative() || isStandalone()) return null
  if (isAndroid()) {
    const href = intentLink(link, PACKAGE)
    if (!href) return null
    return (
      <div className="card handoff">
        <p className="hint">¿Usas la app de Android? Ábrelo allí para que quede en tus datos.</p>
        <div className="actions start">
          <a className="btn primary" href={href}>Abrir en la app</a>
          <button className="btn ghost" onClick={onClose}>Seguir aquí</button>
        </div>
      </div>
    )
  }
  if (isIOS()) {
    const copy = async () => {
      await navigator.clipboard?.writeText(link).then(() => setCopied(true)).catch(() => {})
    }
    return (
      <div className="card handoff">
        <p className="hint">
          ¿Tienes la app en la pantalla de inicio? Copia este enlace, abre la app y pégalo en <b>Cambios → Pegar enlace</b>.
        </p>
        <div className="actions start">
          <button className="btn primary" onClick={copy}>{copied ? 'Copiado ✓' : 'Copiar enlace'}</button>
          <button className="btn ghost" onClick={onClose}>Seguir aquí</button>
        </div>
      </div>
    )
  }
  return null
}
