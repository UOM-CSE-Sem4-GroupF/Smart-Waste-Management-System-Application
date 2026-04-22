interface IconProps { size?: number; color?: string }

export function MapIcon({ size = 18, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <path d="M10 2C7.24 2 5 4.24 5 7c0 4.25 5 11 5 11s5-6.75 5-11c0-2.76-2.24-5-5-5z"
        stroke={color} strokeWidth="1.5" fill={color} fillOpacity="0.15"/>
      <circle cx="10" cy="7" r="2" stroke={color} strokeWidth="1.5"/>
    </svg>
  );
}

export function BinsIcon({ size = 18, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <rect x="4" y="7" width="12" height="10" rx="1.5" stroke={color} strokeWidth="1.5"/>
      <path d="M3 7h14M8 7V5a1 1 0 011-1h2a1 1 0 011 1v2" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="8" y1="11" x2="8" y2="14" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="12" y1="11" x2="12" y2="14" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

export function RouteIcon({ size = 18, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <circle cx="4" cy="5" r="2" stroke={color} strokeWidth="1.5"/>
      <circle cx="16" cy="15" r="2" stroke={color} strokeWidth="1.5"/>
      <circle cx="16" cy="5" r="2" stroke={color} strokeWidth="1.5"/>
      <path d="M6 5h4.5A1.5 1.5 0 0112 6.5v7A1.5 1.5 0 0013.5 15"
        stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

export function AlertsIcon({ size = 18, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <path d="M10 2L3 16h14L10 2z" stroke={color} strokeWidth="1.5"
        strokeLinejoin="round" fill={color} fillOpacity="0.1"/>
      <line x1="10" y1="8" x2="10" y2="12" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="10" cy="14.5" r="0.75" fill={color}/>
    </svg>
  );
}

export function AnalyticsIcon({ size = 18, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <rect x="3" y="13" width="3" height="4" rx="0.5" fill={color} opacity="0.8"/>
      <rect x="8.5" y="9" width="3" height="8" rx="0.5" fill={color} opacity="0.8"/>
      <rect x="14" y="5" width="3" height="12" rx="0.5" fill={color} opacity="0.8"/>
      <path d="M4.5 13l6-8 5 4" stroke={color} strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    </svg>
  );
}

export function SettingsIcon({ size = 16, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="2.5" stroke={color} strokeWidth="1.5"/>
      <path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.22 4.22l1.42 1.42M14.36 14.36l1.42 1.42M4.22 15.78l1.42-1.42M14.36 5.64l1.42-1.42"
        stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}