'use client';

import { useEffect, useRef } from 'react';
import type { Map as LeafletMap, Marker } from 'leaflet';
import type { Bin } from '@/lib/types';

interface Props { bins: Bin[] }

const STATUS_COLOR: Record<string, string> = {
  ok:       '#34D399',
  warning:  '#FBBF24',
  critical: '#F87171',
};

function markerHtml(bin: Bin) {
  const color = bin.offline ? '#4D5F75' : STATUS_COLOR[bin.status];
  const pulse = !bin.offline && bin.status !== 'ok'
    ? `<div style="position:absolute;inset:0;border-radius:50%;background:${color};opacity:0.35;animation:ping 1.8s cubic-bezier(0,0,0.2,1) infinite"></div>`
    : '';
  return `
    <div style="position:relative;width:28px;height:28px">
      ${pulse}
      <div style="position:relative;width:28px;height:28px;border-radius:50%;
        background:#0F1624;border:2px solid ${color};
        display:flex;align-items:center;justify-content:center;
        font-size:9px;font-weight:700;color:${color};font-family:monospace">
        ${bin.fill}
      </div>
    </div>`;
}

function popupHtml(bin: Bin) {
  const color = bin.offline ? '#4D5F75' : STATUS_COLOR[bin.status];
  return `
    <div style="min-width:180px;font-family:'IBM Plex Sans',sans-serif">
      <div style="font-weight:700;font-size:13px;margin-bottom:2px">${bin.label}</div>
      <div style="color:#8494A8;font-size:10px;margin-bottom:10px">${bin.id} · Zone ${bin.zone}</div>
      <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px">
        <span style="color:#8494A8">Fill</span>
        <span style="color:${color};font-weight:700">${bin.fill}%</span>
      </div>
      <div style="background:#1E2B3F;height:5px;border-radius:4px;overflow:hidden;margin-bottom:10px">
        <div style="width:${bin.fill}%;height:100%;background:${color};border-radius:4px"></div>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px">
        <span style="color:#8494A8">Capacity</span>
        <span style="color:#E4EBF5">${bin.capacity} L</span>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px">
        <span style="color:#8494A8">Battery</span>
        <span style="color:${bin.battery < 30 ? '#FBBF24' : '#8494A8'}">${bin.battery}%</span>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:11px">
        <span style="color:#8494A8">Type</span>
        <span style="color:#E4EBF5;text-transform:capitalize">${bin.type}</span>
      </div>
      ${bin.offline ? '<div style="margin-top:8px;color:#F87171;font-size:10px;font-weight:700">● OFFLINE</div>' : ''}
    </div>`;
}

export default function MapView({ bins }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<LeafletMap | null>(null);
  const markersRef   = useRef<globalThis.Map<string, Marker>>(new globalThis.Map());

  // Initialise the map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    let cancelled = false;

    import('leaflet').then(async L => {
      if (cancelled || !containerRef.current || mapRef.current) return;

      // Leaflet CSS — must be loaded client-side
      await import('leaflet/dist/leaflet.css');

      const map = L.map(containerRef.current, {
        center: [14.599, 120.984],
        zoom: 14,
        zoomControl: true,
      });

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/">CARTO</a>',
        maxZoom: 19,
      }).addTo(map);

      mapRef.current = map;
    });

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markersRef.current.clear();
    };
  }, []);

  // Sync markers whenever bins data changes
  useEffect(() => {
    if (!mapRef.current) return;

    let scheduled = false;
    const sync = () => {
      if (!mapRef.current) return;

      import('leaflet').then(L => {
        if (!mapRef.current) return;
        const map = mapRef.current;
        const existing = markersRef.current;
        const incomingIds = new Set(bins.map(b => b.id));

        // Remove markers for bins that no longer exist
        existing.forEach((marker, id) => {
          if (!incomingIds.has(id)) { marker.remove(); existing.delete(id); }
        });

        bins.forEach(bin => {
          const icon = L.divIcon({
            className: '',
            html: markerHtml(bin),
            iconSize: [28, 28],
            iconAnchor: [14, 14],
            popupAnchor: [0, -16],
          });

          const marker = existing.get(bin.id);
          if (marker) {
            // Update existing marker icon (fill % may have changed)
            marker.setIcon(icon);
            marker.setPopupContent(popupHtml(bin));
          } else {
            const m = L.marker([bin.lat, bin.lng], { icon });
            m.bindPopup(popupHtml(bin));
            m.addTo(map);
            existing.set(bin.id, m);
          }
        });
      });
    };

    // Debounce rapid updates from the polling loop
    if (!scheduled) {
      scheduled = true;
      const id = setTimeout(sync, 50);
      return () => clearTimeout(id);
    }
  }, [bins]);

  return (
    <div style={{ position: 'relative', height: '100%', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)' }}>
      <style>{`
        .leaflet-container { background: #080D18 !important; font-family: 'IBM Plex Sans', sans-serif; }
        .leaflet-control-zoom { border: 1px solid #1E2B3F !important; border-radius: 8px !important; overflow: hidden; }
        .leaflet-control-zoom a { background: #0F1624 !important; color: #8494A8 !important; border-color: #1E2B3F !important; }
        .leaflet-control-zoom a:hover { background: #192236 !important; color: #E4EBF5 !important; }
        .leaflet-control-attribution { background: rgba(12,20,32,0.7) !important; color: #4D5F75 !important; font-size: 9px !important; }
        .leaflet-control-attribution a { color: #4D5F75 !important; }
        .leaflet-popup-content-wrapper { background: #0F1624 !important; border: 1px solid #1E2B3F !important; border-radius: 10px !important; color: #E4EBF5 !important; box-shadow: 0 8px 32px rgba(0,0,0,0.6) !important; }
        .leaflet-popup-content { margin: 14px 16px !important; }
        .leaflet-popup-tip-container { display: none; }
        .leaflet-popup-close-button { color: #4D5F75 !important; top: 8px !important; right: 10px !important; }
        @keyframes ping { 0%{transform:scale(1);opacity:0.4} 75%,100%{transform:scale(2.4);opacity:0} }
      `}</style>

      <div ref={containerRef} style={{ width: '100%', height: '100%' }}/>

      {/* Legend */}
      <div style={{
        position: 'absolute', bottom: 24, left: 16, zIndex: 1000,
        background: 'rgba(15,22,36,0.92)', border: '1px solid var(--border)',
        borderRadius: 8, padding: '10px 14px',
        display: 'flex', flexDirection: 'column', gap: 7,
        backdropFilter: 'blur(4px)',
      }}>
        {([
          ['#34D399', 'OK (< 60%)'],
          ['#FBBF24', 'Warning (60–84%)'],
          ['#F87171', 'Critical (≥ 85%)'],
          ['#4D5F75', 'Offline'],
        ] as const).map(([color, label]) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }}/>
            <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}