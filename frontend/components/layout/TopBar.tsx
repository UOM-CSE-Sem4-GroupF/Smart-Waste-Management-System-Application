'use client';

import { useEffect, useState } from 'react';
import PulseDot from '@/components/ui/PulseDot';
import StatusChip from '@/components/ui/StatusChip';
import type { Bin, Alert } from '@/lib/types';

interface Props { bins: Bin[]; alerts: Alert[] }

export default function TopBar({ bins, alerts }: Props) {
  const [time, setTime] = useState('');

  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString('en-GB'));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const critical = bins.filter(b => b.status === 'critical').length;
  const offline  = bins.filter(b => b.offline).length;
  const unread   = alerts.filter(a => !a.read).length;

  return (
    <div style={{
      height: 56,
      background: 'var(--bg-surface)',
      borderBottom: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 20px',
      gap: 20,
      flexShrink: 0,
      zIndex: 10,
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginRight: 8 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 7,
          background: 'linear-gradient(135deg, var(--accent), var(--accent-dim))',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
        }}>
          ♻
        </div>
        <div>
          <div style={{ color: 'var(--text-primary)', fontSize: 13, fontWeight: 700, lineHeight: 1.2 }}>
            Garabadge
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: 9, letterSpacing: '0.1em' }}>
            OPERATIONS
          </div>
        </div>
      </div>

      {/* Status chips */}
      <div style={{ display: 'flex', gap: 10, flex: 1 }}>
        <StatusChip icon={<PulseDot color="var(--ok)"/>} label="System" value="Online" color="var(--ok)"/>
        <StatusChip label="Bins Active" value={`${bins.length - offline} / ${bins.length}`} color="var(--info)"/>
        {critical > 0 && <StatusChip label="Critical" value={critical} color="var(--critical)"/>}
        {unread  > 0 && <StatusChip label="Alerts"   value={unread}   color="var(--warning)"/>}
      </div>

      {/* Clock + user */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", color: 'var(--text-muted)', fontSize: 12 }}>
          {time}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            background: '#192236', border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600,
          }}>
            OP
          </div>
          <div>
            <div style={{ color: 'var(--text-primary)', fontSize: 12, fontWeight: 600, lineHeight: 1.2 }}>
              Operator
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: 9 }}>Admin</div>
          </div>
        </div>
      </div>
    </div>
  );
}