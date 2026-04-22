'use client';

import { MapIcon, BinsIcon, RouteIcon, AlertsIcon, AnalyticsIcon, SettingsIcon } from '@/components/icons/NavIcons';
import type { Alert, ViewId } from '@/lib/types';

const NAV: { id: ViewId; Icon: React.FC<{ color?: string }>; label: string }[] = [
  { id: 'map',       Icon: MapIcon,       label: 'Live Map'  },
  { id: 'bins',      Icon: BinsIcon,      label: 'Bins'      },
  { id: 'route',     Icon: RouteIcon,     label: 'Routes'    },
  { id: 'alerts',    Icon: AlertsIcon,    label: 'Alerts'    },
  { id: 'analytics', Icon: AnalyticsIcon, label: 'Analytics' },
];

interface Props {
  active: ViewId;
  onNav: (v: ViewId) => void;
  alerts: Alert[];
}

export default function Sidebar({ active, onNav, alerts }: Props) {
  const unread = alerts.filter(a => !a.read).length;

  return (
    <div style={{
      width: 58,
      background: 'var(--bg-surface)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '12px 0',
      gap: 4,
      flexShrink: 0,
      zIndex: 10,
    }}>
      {NAV.map(({ id, Icon, label }) => {
        const isActive = active === id;
        const hasAlert = id === 'alerts' && unread > 0;
        return (
          <button
            key={id}
            onClick={() => onNav(id)}
            title={label}
            style={{
              width: 42, height: 42, borderRadius: 10, border: 'none',
              background: isActive ? '#192236' : 'transparent',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              position: 'relative',
              transition: 'background 0.15s ease',
              outline: isActive ? '1px solid var(--border)' : 'none',
            }}
          >
            <Icon color={isActive ? 'var(--accent)' : 'var(--text-muted)'}/>
            {hasAlert && (
              <span style={{
                position: 'absolute', top: 4, right: 4, width: 8, height: 8,
                background: 'var(--critical)', borderRadius: '50%',
                border: '1.5px solid var(--bg-surface)',
              }}/>
            )}
            {isActive && (
              <span style={{
                position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
                width: 3, height: 22, background: 'var(--accent)', borderRadius: '0 2px 2px 0',
              }}/>
            )}
          </button>
        );
      })}

      <div style={{ flex: 1 }}/>
      <button style={{
        width: 42, height: 42, borderRadius: 10, border: 'none',
        background: 'transparent', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }} title="Settings">
        <SettingsIcon color="var(--text-muted)"/>
      </button>
    </div>
  );
}