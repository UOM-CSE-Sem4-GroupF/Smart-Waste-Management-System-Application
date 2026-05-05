interface Props { fill: number; height?: number }

export default function FillBar({ fill, height = 6 }: Props) {
  const color = fill >= 85 ? 'var(--critical)' : fill >= 60 ? 'var(--warning)' : 'var(--ok)';
  return (
    <div style={{
      width: '100%', height, background: 'var(--border)',
      borderRadius: height, overflow: 'hidden',
    }}>
      <div style={{
        width: `${fill}%`, height: '100%', background: color,
        borderRadius: height, transition: 'width 0.4s ease',
      }}/>
    </div>
  );
}