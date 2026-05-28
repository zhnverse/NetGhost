import { useEffect, useRef, useCallback } from 'react';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import GlobeLib from 'globe.gl';
import { useStore } from '../store';
import type { Connection } from '../types';

// globe.gl exports a factory function but its TS types declare a constructor.
// Cast to any so the chained API resolves without TS errors.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Globe = GlobeLib as any;

interface Arc {
  id: number;
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  color: string;
  threat: boolean;
  label: string;
}

interface GlobePoint {
  lat: number;
  lng: number;
  size: number;
  color: string;
  label: string;
}

const MAX_ARCS = 80;

export default function Globe3D() {
  const containerRef = useRef<HTMLDivElement>(null);
  const globeRef = useRef<ReturnType<typeof Globe> | null>(null);
  const arcsRef = useRef<Arc[]>([]);
  const pointsRef = useRef<Map<string, GlobePoint>>(new Map());
  const { connections, selectConnection } = useStore();
  const lastCountRef = useRef(0);

  useEffect(() => {
    if (!containerRef.current) return;

    const globe = Globe()(containerRef.current)
      .globeImageUrl('https://unpkg.com/three-globe/example/img/earth-night.jpg')
      .bumpImageUrl('https://unpkg.com/three-globe/example/img/earth-topology.png')
      .backgroundImageUrl('https://unpkg.com/three-globe/example/img/night-sky.png')
      .showAtmosphere(true)
      .atmosphereColor('rgba(0, 180, 255, 0.15)')
      .atmosphereAltitude(0.15)
      .arcsData([])
      .arcColor('color')
      .arcDashLength(0.4)
      .arcDashGap(0.2)
      .arcDashAnimateTime(1500)
      .arcStroke(0.5)
      .arcAltitude(0.1)
      .pointsData([])
      .pointColor('color')
      .pointAltitude(0.01)
      .pointRadius('size')
      .pointsMerge(false)
      .onArcClick((arc: object) => {
        const a = arc as Arc;
        // Find matching connection to select
        const conn = connections.find(c => c.id === a.id);
        if (conn) selectConnection(conn);
      });

    // Auto-rotate
    globe.controls().autoRotate = true;
    globe.controls().autoRotateSpeed = 0.3;
    globe.controls().enableDamping = true;

    globeRef.current = globe;

    // Resize observer
    const ro = new ResizeObserver(() => {
      if (!containerRef.current) return;
      globe.width(containerRef.current.clientWidth);
      globe.height(containerRef.current.clientHeight);
    });
    if (containerRef.current) ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      globeRef.current = null;
    };
  }, []);

  const addConnectionToGlobe = useCallback((conn: Connection) => {
    if (!globeRef.current) return;

    const hasGeo =
      conn.src_lat != null && conn.src_lon != null &&
      conn.dst_lat != null && conn.dst_lon != null;
    if (!hasGeo) return;

    // Skip LAN-to-LAN
    if (conn.src_country === 'LAN' && conn.dst_country === 'LAN') return;

    const isThreat = conn.is_threat === 1;
    const color = isThreat
      ? 'rgba(255,51,102,0.9)'
      : conn.protocol === 'DNS'
      ? 'rgba(147,51,234,0.6)'
      : conn.protocol === 'HTTPS'
      ? 'rgba(0,212,255,0.5)'
      : 'rgba(0,255,136,0.4)';

    const arc: Arc = {
      id: conn.id,
      startLat: conn.src_lat ?? 0,
      startLng: conn.src_lon ?? 0,
      endLat: conn.dst_lat ?? 0,
      endLng: conn.dst_lon ?? 0,
      color,
      threat: isThreat,
      label: `${conn.src_ip} → ${conn.dst_ip} [${conn.protocol}]`,
    };

    arcsRef.current = [arc, ...arcsRef.current].slice(0, MAX_ARCS);

    // Update destination point
    const key = `${conn.dst_lat},${conn.dst_lon}`;
    const existing = pointsRef.current.get(key);
    if (existing) {
      existing.size = Math.min(existing.size + 0.05, 0.8);
      if (isThreat) existing.color = 'rgba(255,51,102,0.9)';
    } else {
      pointsRef.current.set(key, {
        lat: conn.dst_lat ?? 0,
        lng: conn.dst_lon ?? 0,
        size: 0.2,
        color: isThreat ? 'rgba(255,51,102,0.9)' : 'rgba(0,212,255,0.5)',
        label: `${conn.dst_country || 'Unknown'} - ${conn.dst_city || ''}`,
      });
    }

    globeRef.current.arcsData(arcsRef.current);
    globeRef.current.pointsData(Array.from(pointsRef.current.values()));
  }, []);

  // Watch for new connections
  useEffect(() => {
    const newCount = connections.length;
    if (newCount <= lastCountRef.current) return;

    const newConns = connections.slice(0, newCount - lastCountRef.current);
    newConns.forEach(addConnectionToGlobe);
    lastCountRef.current = newCount;
  }, [connections, addConnectionToGlobe]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      style={{ background: 'transparent' }}
    />
  );
}
