import { Capacitor } from '@capacitor/core'

/** Public web address of the app; links shared from the native app must point here, not to localhost. */
export const PUBLIC_URL: string = import.meta.env.VITE_PUBLIC_URL || 'https://alvj95.github.io/turnos-handling/'

export const APK_URL = new URL('TurnosHandling.apk', PUBLIC_URL).href
export const APP_SCHEME = 'turnoshandling'

export const isNative = () => Capacitor.isNativePlatform()

const ua = () => (typeof navigator === 'undefined' ? '' : navigator.userAgent)
export const isAndroid = () => /android/i.test(ua())
export const isIOS = () => /iphone|ipad|ipod/i.test(ua()) || (/macintosh/i.test(ua()) && navigator.maxTouchPoints > 1)

/** Opened from the home-screen icon (installed PWA) rather than a browser tab. */
export const isStandalone = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true)

/** Base URL for links other people will open. */
export function appUrl(): string {
  if (isNative() || typeof location === 'undefined' || !/^https?:$/.test(location.protocol)) return PUBLIC_URL
  return `${location.origin}${location.pathname}`
}
