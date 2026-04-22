import type { ReactNode } from 'react';

interface Props {
  icon?: ReactNode;
  label: string;
  value: string | number;
  color: string;
}

export default function StatusChip({ icon, label, value, color }: Props) {
  return (
    <div style={{
      background: 'var(--bg-input)',
      border: '1px solid var(--border)',
      borderRadius: 6,
      padding: '4px 10px',
      display: 'flex',
      alignItems: 'center',
      gap: 6,
    }}>
      {icon}
      <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>{label}</span>
      <span style={{ color, fontSize: 11, fontWeight: 700 }}>{value}</span>
    </div>
  );
}