export const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? ''

/** Resolve correct style for current color scheme.
 * Call this inside a 'use client' component after mounting. */
export function getMapboxStyle(theme: 'light' | 'dark' | string): string {
  if (theme === 'dark') {
    return (
      process.env.NEXT_PUBLIC_MAPBOX_STYLE_DARK ??
      'mapbox://styles/mapbox/dark-v11'
    )
  }
  return (
    process.env.NEXT_PUBLIC_MAPBOX_STYLE ??
    'mapbox://styles/mapbox/light-v11'
  )
}

/** University of Moratuwa fallback coordinates [lng, lat] */
export const DEFAULT_CENTER: [number, number] = [79.8864, 6.7967]
export const DEFAULT_ZOOM = 13
