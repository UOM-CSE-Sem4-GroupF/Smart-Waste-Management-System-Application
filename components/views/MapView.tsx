'use client';

import { useEffect, useRef, useState } from 'react';
import type { Map as LeafletMap, Marker, Polyline, Polygon } from 'leaflet';
import type { Bin, Vehicle, Route, Zone, WasteType } from '@/lib/types';

interface Props {
  bins: Bin[];
  vehicles: Vehicle[];
  routes: Route[];
  zones: Zone[];
}

// ── Fill-level colour scale ───────────────────────────────────────────────────
function fillColor(fill: number, offline: boolean): string {
  if (offline) return '#4D5F75';
  if (fill >= 90) return '#F87171'; // critical  red
  if (fill >= 75) return '#FB923C'; // urgent    orange
  if (fill >= 50) return '#FBBF24'; // monitor   yellow
  return '#34D399';                  // normal    green
}

// Density kg/L per waste type — used to estimate weight from fill + capacity
const DENSITY: Record<WasteType, number> = {
  general:   0.15,
  recycling: 0.08,
  organic:   0.25,
  hazardous: 0.12,
};

function estimatedKg(bin: Bin): number {
  return Math.round((bin.fill / 100) * bin.capacity * DENSITY[bin.type]);
}

// Marker diameter: 20–38 px proportional to estimated weight (max ~100 kg)
function markerSize(bin: Bin): number {
  const kg = estimatedKg(bin);
  return Math.round(20 + Math.min(kg / 100, 1) * 18);
}

function binMarkerHtml(bin: Bin): string {
  const color  = fillColor(bin.fill, bin.offline);
  const size   = markerSize(bin);
  const pulse  = !bin.offline && bin.fill >= 75
    ? `<div style="position:absolute;inset:0;border-radius:50%;background:${color};opacity:0.3;animation:ping 1.8s cubic-bezier(0,0,0.2,1) infinite"></div>`
    : '';
  return `
    <div style="position:relative;width:${size}px;height:${size}px">
      ${pulse}
      <div style="position:relative;width:${size}px;height:${size}px;border-radius:50%;
        background:#0F1624;border:2px solid ${color};
        display:flex;align-items:center;justify-content:center;
        font-size:${size < 26 ? 8 : 10}px;font-weight:700;color:${color};font-family:monospace">
        ${bin.fill}
      </div>
    </div>`;
}

function binPopupHtml(bin: Bin): string {
  const color = fillColor(bin.fill, bin.offline);
  const kg    = estimatedKg(bin);
  return `
    <div style="min-width:190px;font-family:'IBM Plex Sans',sans-serif">
      <div style="font-weight:700;font-size:13px;margin-bottom:2px">${bin.label}</div>
      <div style="color:#8494A8;font-size:10px;margin-bottom:10px">${bin.id} · Zone ${bin.zone} · <span style="text-transform:capitalize">${bin.type}</span></div>
      <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px">
        <span style="color:#8494A8">Fill</span>
        <span style="color:${color};font-weight:700">${bin.fill}%</span>
      </div>
      <div style="background:#1E2B3F;height:5px;border-radius:4px;overflow:hidden;margin-bottom:10px">
        <div style="width:${bin.fill}%;height:100%;background:${color};border-radius:4px"></div>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px">
        <span style="color:#8494A8">Est. weight</span><span style="color:#E4EBF5">${kg} kg</span>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px">
        <span style="color:#8494A8">Capacity</span><span style="color:#E4EBF5">${bin.capacity} L</span>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px">
        <span style="color:#8494A8">Battery</span>
        <span style="color:${bin.battery < 30 ? '#FBBF24' : '#8494A8'}">${bin.battery}%</span>
      </div>
      ${bin.offline ? '<div style="margin-top:8px;color:#F87171;font-size:10px;font-weight:700">● OFFLINE</div>' : ''}
    </div>`;
}

// Truck marker: circle + directional arrow rotated to heading
function vehicleMarkerHtml(v: Vehicle): string {
  return `
    <div style="width:34px;height:34px;transform:rotate(${v.heading}deg)">
      <svg width="34" height="34" viewBox="0 0 34 34" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="17" cy="17" r="14" fill="#0F1624" stroke="#60A5FA" stroke-width="2"/>
        <path d="M17 5 L22 22 L17 19 L12 22 Z" fill="#60A5FA"/>
      </svg>
    </div>`;
}

function vehiclePopupHtml(v: Vehicle): string {
  return `
    <div style="min-width:150px;font-family:'IBM Plex Sans',sans-serif">
      <div style="font-weight:700;font-size:13px;margin-bottom:6px">${v.id}</div>
      <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px">
        <span style="color:#8494A8">Speed</span><span style="color:#E4EBF5">${v.speed} km/h</span>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px">
        <span style="color:#8494A8">Heading</span><span style="color:#E4EBF5">${v.heading}°</span>
      </div>
      ${v.routeId ? `<div style="display:flex;justify-content:space-between;font-size:11px"><span style="color:#8494A8">Route</span><span style="color:#60A5FA">${v.routeId}</span></div>` : ''}
    </div>`;
}

// Distinct colours for up to 8 concurrent routes
const ROUTE_COLORS = ['#22D3C5','#60A5FA','#A78BFA','#FBBF24','#34D399','#F87171','#FB923C','#E879F9'];

// ── Filter state ─────────────────────────────────────────────────────────────
interface Filters {
  zones: Set<string>;
  types: Set<WasteType>;
  statuses: Set<string>;
  showZones: boolean;
  showVehicles: boolean;
  showRoutes: boolean;
}

const ALL_TYPES: WasteType[]  = ['general','recycling','organic','hazardous'];
const ALL_STATUSES            = ['normal','monitor','urgent','critical','offline'];

function statusFromFill(bin: Bin): string {
  if (bin.offline) return 'offline';
  if (bin.fill >= 90) return 'critical';
  if (bin.fill >= 75) return 'urgent';
  if (bin.fill >= 50) return 'monitor';
  return 'normal';
}

// ── Component ────────────────────────────────────────────────────────────────
export default function MapView({ bins, vehicles, routes, zones }: Props) {
  const containerRef     = useRef<HTMLDivElement>(null);
  const mapRef           = useRef<LeafletMap | null>(null);
  const binMarkersRef    = useRef<globalThis.Map<string, Marker>>(new globalThis.Map());
  const vehicleMarkersRef= useRef<globalThis.Map<string, Marker>>(new globalThis.Map());
  const polylinesRef     = useRef<globalThis.Map<string, Polyline>>(new globalThis.Map());
  const polygonsRef      = useRef<Polygon[]>([]);
  const filtersRef       = useRef<Filters>({
    zones:        new Set(),
    types:        new Set(),
    statuses:     new Set(),
    showZones:    true,
    showVehicles: true,
    showRoutes:   true,
  });

  const [filters, setFilters] = useState<Filters>(filtersRef.current);
  const [panelOpen, setPanelOpen] = useState(false);

  // Keep ref in sync so Leaflet effects can read latest without re-running
  useEffect(() => { filtersRef.current = filters; }, [filters]);

  // ── Init map ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let cancelled = false;

    import('leaflet').then(async L => {
      if (cancelled || !containerRef.current || mapRef.current) return;
      await import('leaflet/dist/leaflet.css');

      const map = L.map(containerRef.current!, { center: [14.599, 120.984], zoom: 14, zoomControl: true });
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap © CARTO', maxZoom: 19,
      }).addTo(map);

      mapRef.current = map;
    });

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      binMarkersRef.current.clear();
      vehicleMarkersRef.current.clear();
      polylinesRef.current.clear();
      polygonsRef.current = [];
    };
  }, []);

  // ── Bin markers ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current) return;
    const id = setTimeout(() => {
      import('leaflet').then(L => {
        const map = mapRef.current;
        if (!map) return;
        const f   = filtersRef.current;
        const existing = binMarkersRef.current;
        const incomingIds = new Set(bins.map(b => b.id));

        existing.forEach((marker, id) => {
          if (!incomingIds.has(id)) { marker.remove(); existing.delete(id); }
        });

        bins.forEach(bin => {
          const status = statusFromFill(bin);
          // Filter
          if (f.zones.size    > 0 && !f.zones.has(bin.zone))     return;
          if (f.types.size    > 0 && !f.types.has(bin.type))     return;
          if (f.statuses.size > 0 && !f.statuses.has(status))    return;

          const size = markerSize(bin);
          const icon = L.divIcon({
            className: '',
            html: binMarkerHtml(bin),
            iconSize:   [size, size],
            iconAnchor: [size / 2, size / 2],
            popupAnchor:[0, -size / 2 - 4],
          });

          const m = existing.get(bin.id);
          if (m) {
            m.setIcon(icon);
            m.setPopupContent(binPopupHtml(bin));
            if (!map.hasLayer(m)) m.addTo(map);
          } else {
            const nm = L.marker([bin.lat, bin.lng], { icon });
            nm.bindPopup(binPopupHtml(bin));
            nm.addTo(map);
            existing.set(bin.id, nm);
          }
        });

        // Hide filtered-out markers
        existing.forEach((marker, id) => {
          const bin = bins.find(b => b.id === id);
          if (!bin) return;
          const status = statusFromFill(bin);
          const filtered =
            (f.zones.size    > 0 && !f.zones.has(bin.zone))  ||
            (f.types.size    > 0 && !f.types.has(bin.type))  ||
            (f.statuses.size > 0 && !f.statuses.has(status));
          if (filtered && map.hasLayer(marker)) marker.remove();
          else if (!filtered && !map.hasLayer(marker)) marker.addTo(map);
        });
      });
    }, 50);
    return () => clearTimeout(id);
  }, [bins, filters]);

  // ── Vehicle markers ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current) return;
    import('leaflet').then(L => {
      const map = mapRef.current;
      if (!map) return;
      const existing  = vehicleMarkersRef.current;
      const incomingIds = new Set(vehicles.map(v => v.id));
      const show = filtersRef.current.showVehicles;

      existing.forEach((marker, id) => {
        if (!incomingIds.has(id)) { marker.remove(); existing.delete(id); }
      });

      vehicles.forEach(v => {
        const icon = L.divIcon({
          className: '',
          html: vehicleMarkerHtml(v),
          iconSize:   [34, 34],
          iconAnchor: [17, 17],
          popupAnchor:[0, -20],
        });
        const m = existing.get(v.id);
        if (m) {
          m.setLatLng([v.lat, v.lng]);
          m.setIcon(icon);
          m.setPopupContent(vehiclePopupHtml(v));
          if (show && !map.hasLayer(m)) m.addTo(map);
          if (!show && map.hasLayer(m)) m.remove();
        } else {
          const nm = L.marker([v.lat, v.lng], { icon });
          nm.bindPopup(vehiclePopupHtml(v));
          if (show) nm.addTo(map);
          existing.set(v.id, nm);
        }
      });
    });
  }, [vehicles, filters]);

  // ── Route polylines ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current) return;
    import('leaflet').then(L => {
      const map = mapRef.current;
      if (!map) return;
      const existing  = polylinesRef.current;
      const show      = filtersRef.current.showRoutes;
      const binMap    = Object.fromEntries(bins.map(b => [b.id, b]));
      const activeRoutes = routes.filter(r => r.status === 'active' || r.status === 'pending');
      const incomingIds  = new Set(activeRoutes.map(r => r.id));

      existing.forEach((line, id) => {
        if (!incomingIds.has(id)) { line.remove(); existing.delete(id); }
      });

      activeRoutes.forEach((route, idx) => {
        const color  = ROUTE_COLORS[idx % ROUTE_COLORS.length];
        const latlngs = route.stops
          .slice().sort((a, b) => a.order - b.order)
          .map(s => binMap[s.binId])
          .filter(Boolean)
          .map(b => [b!.lat, b!.lng] as [number, number]);

        if (latlngs.length < 2) return;

        const existing_line = existing.get(route.id);
        if (existing_line) {
          existing_line.setLatLngs(latlngs);
          if (show && !map.hasLayer(existing_line)) existing_line.addTo(map);
          if (!show && map.hasLayer(existing_line)) existing_line.remove();
        } else {
          const line = L.polyline(latlngs, {
            color, weight: 3, opacity: 0.8, dashArray: '6 4',
          });
          if (show) line.addTo(map);
          existing.set(route.id, line);
        }
      });
    });
  }, [routes, bins, filters]);

  // ── Zone polygons ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current) return;
    import('leaflet').then(L => {
      const map = mapRef.current;
      if (!map) return;
      const show = filtersRef.current.showZones;

      // Clear old polygons
      polygonsRef.current.forEach(p => p.remove());
      polygonsRef.current = [];

      if (!show) return;

      zones.forEach(zone => {
        const zoneBins = bins.filter(b => b.zone === zone.id && b.lat !== 0 && b.lng !== 0);
        if (zoneBins.length === 0) return;

        const lats = zoneBins.map(b => b.lat);
        const lngs = zoneBins.map(b => b.lng);
        const pad  = 0.003;
        const bounds: [number, number][] = [
          [Math.min(...lats) - pad, Math.min(...lngs) - pad],
          [Math.min(...lats) - pad, Math.max(...lngs) + pad],
          [Math.max(...lats) + pad, Math.max(...lngs) + pad],
          [Math.max(...lats) + pad, Math.min(...lngs) - pad],
        ];

        const poly = L.polygon(bounds, {
          color: zone.color, weight: 1.5, opacity: 0.6,
          fillColor: zone.color, fillOpacity: 0.06,
        });
        poly.bindTooltip(zone.name, { permanent: false, direction: 'center', className: 'zone-tip' });
        poly.addTo(map);
        polygonsRef.current.push(poly);
      });
    });
  }, [zones, bins, filters]);

  // ── Filter helpers ─────────────────────────────────────────────────────────
  function toggleSet<T>(set: Set<T>, val: T): Set<T> {
    const next = new Set(set);
    next.has(val) ? next.delete(val) : next.add(val);
    return next;
  }

  const zoneIds   = [...new Set(bins.map(b => b.zone))].filter(Boolean);
  const activeBtn = (active: boolean, color = 'var(--accent)') => ({
    padding: '4px 10px', borderRadius: 5, fontSize: 10, fontWeight: 600,
    cursor: 'pointer', border: `1px solid ${active ? color : 'var(--border)'}`,
    background: active ? `${color}22` : 'var(--bg-input)',
    color: active ? color : 'var(--text-muted)',
  });

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
        .zone-tip { background: #0F1624; border: 1px solid #1E2B3F; color: #E4EBF5; font-size: 11px; padding: 4px 8px; border-radius: 6px; }
        @keyframes ping { 0%{transform:scale(1);opacity:0.4} 75%,100%{transform:scale(2.4);opacity:0} }
      `}</style>

      <div ref={containerRef} style={{ width: '100%', height: '100%' }}/>

      {/* Filter toggle button */}
      <button
        onClick={() => setPanelOpen(o => !o)}
        style={{
          position: 'absolute', top: 12, right: 12, zIndex: 1000,
          background: panelOpen ? 'var(--accent)' : 'rgba(15,22,36,0.92)',
          border: `1px solid ${panelOpen ? 'var(--accent)' : 'var(--border)'}`,
          color: panelOpen ? '#0F1624' : 'var(--text-secondary)',
          borderRadius: 8, padding: '6px 12px', fontSize: 11, fontWeight: 700,
          cursor: 'pointer', backdropFilter: 'blur(4px)',
        }}
      >
        ⚙ Filters
      </button>

      {/* Filter panel */}
      {panelOpen && (
        <div style={{
          position: 'absolute', top: 46, right: 12, zIndex: 1000, width: 220,
          background: 'rgba(12,20,32,0.96)', border: '1px solid var(--border)',
          borderRadius: 10, padding: '14px 16px', backdropFilter: 'blur(8px)',
          display: 'flex', flexDirection: 'column', gap: 14,
        }}>
          {/* Layers */}
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: 8 }}>LAYERS</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {([
                ['showZones',    'Zones'],
                ['showVehicles', 'Vehicles'],
                ['showRoutes',   'Routes'],
              ] as const).map(([key, label]) => (
                <button key={key} style={activeBtn(filters[key])}
                  onClick={() => setFilters(f => ({ ...f, [key]: !f[key] }))}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Status */}
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: 8 }}>STATUS</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {ALL_STATUSES.map(s => {
                const color = s === 'critical' ? '#F87171' : s === 'urgent' ? '#FB923C' : s === 'monitor' ? '#FBBF24' : s === 'offline' ? '#4D5F75' : '#34D399';
                const active = filters.statuses.has(s);
                return (
                  <button key={s} style={activeBtn(active, color)}
                    onClick={() => setFilters(f => ({ ...f, statuses: toggleSet(f.statuses, s) }))}>
                    {s}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Waste type */}
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: 8 }}>WASTE TYPE</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {ALL_TYPES.map(t => (
                <button key={t} style={activeBtn(filters.types.has(t))}
                  onClick={() => setFilters(f => ({ ...f, types: toggleSet(f.types, t) }))}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Zone */}
          {zoneIds.length > 0 && (
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: 8 }}>ZONE</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {zoneIds.map(zId => {
                  const zone = zones.find(z => z.id === zId);
                  return (
                    <button key={zId} style={activeBtn(filters.zones.has(zId), zone?.color ?? 'var(--accent)')}
                      onClick={() => setFilters(f => ({ ...f, zones: toggleSet(f.zones, zId) }))}>
                      {zone?.name ?? zId}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Reset */}
          <button
            onClick={() => setFilters({ zones: new Set(), types: new Set(), statuses: new Set(), showZones: true, showVehicles: true, showRoutes: true })}
            style={{ fontSize: 10, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}
          >
            Reset filters
          </button>
        </div>
      )}

      {/* Legend */}
      <div style={{
        position: 'absolute', bottom: 24, left: 16, zIndex: 1000,
        background: 'rgba(15,22,36,0.92)', border: '1px solid var(--border)',
        borderRadius: 8, padding: '10px 14px',
        display: 'flex', flexDirection: 'column', gap: 7,
        backdropFilter: 'blur(4px)',
      }}>
        {([
          ['#34D399', 'Normal  (0–49%)'],
          ['#FBBF24', 'Monitor (50–74%)'],
          ['#FB923C', 'Urgent  (75–89%)'],
          ['#F87171', 'Critical (90%+)'],
          ['#4D5F75', 'Offline'],
          ['#60A5FA', 'Vehicle'],
        ] as const).map(([color, label]) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }}/>
            <span style={{ color: 'var(--text-secondary)', fontFamily: "'IBM Plex Mono', monospace" }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
