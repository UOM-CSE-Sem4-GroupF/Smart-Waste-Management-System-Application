'use client';

interface Props { color?: string }

export default function PulseDot({ color = '#34D399' }: Props) {
  return (
    <span style={{ position: 'relative', display: 'inline-flex', width: 10, height: 10 }}>
      <span style={{
        position: 'absolute', inset: 0, borderRadius: '50%',
        background: color, opacity: 0.4,
        animation: 'ping 1.8s cubic-bezier(0,0,0.2,1) infinite',
      }}/>
      <span style={{
        position: 'relative', borderRadius: '50%', background: color,
        width: 10, height: 10, display: 'inline-block',
        boxShadow: `0 0 6px ${color}`,
      }}/>
    </span>
  );
}
