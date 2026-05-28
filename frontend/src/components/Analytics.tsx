import { useEffect, useState } from 'react';
import {
  XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area,
} from 'recharts';
import { useStore } from '../store';
import type { GeoStat, TimelinePoint, ProtocolStat, TopIP } from '../types';

const COLORS = ['#00d4ff', '#8b5cf6', '#00ff88', '#ff8c00', '#ff3366', '#facc15', '#06b6d4', '#ec4899'];

function formatBytes(b: number): string {
  if (!b) return '0B';
  if (b < 1024) return `${b}B`;
  if (b < 1048576) return `${(b / 1024).toFixed(0)}KB`;
  if (b < 1073741824) return `${(b / 1048576).toFixed(1)}MB`;
  return `${(b / 1073741824).toFixed(1)}GB`;
}

const CUSTOM_TOOLTIP_STYLE = {
  background: '#0d1f3c', border: '1px solid #1e3a5f',
  borderRadius: 6, fontSize: '0.7rem', color: '#e2e8f0',
};

export default function Analytics() {
  const { connections, status } = useStore();
  const [geoData, setGeoData] = useState<GeoStat[]>([]);
  const [timeline, setTimeline] = useState<TimelinePoint[]>([]);
  const [protocols, setProtocols] = useState<ProtocolStat[]>([]);
  const [topIPs, setTopIPs] = useState<TopIP[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const [g, t, p, i] = await Promise.all([
          fetch('/api/stats/geo').then(r => r.json()),
          fetch('/api/stats/timeline?minutes=60').then(r => r.json()),
          fetch('/api/stats/protocols').then(r => r.json()),
          fetch('/api/stats/top_ips?limit=10').then(r => r.json()),
        ]);
        setGeoData(g.countries || []);
        setTimeline(t.timeline || []);
        setProtocols(p.protocols || []);
        setTopIPs(i.ips || []);
      } catch { /* backend may not be ready */ }
    };

    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, [connections.length]);

  const timelineData = timeline.map(p => ({
    time: new Date(p.bucket * 1000).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
    connections: p.count,
    threats: p.threats,
    bytes: p.bytes,
  }));

  return (
    <div style={{ padding: '0.75rem', overflow: 'auto', height: '100%' }}>
      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginBottom: '1rem' }}>
        <StatCard label="Total Packets" value={(status?.total_connections || connections.length).toLocaleString()} color="var(--accent-blue)" />
        <StatCard label="Threats Detected" value={(status?.total_threats || 0).toString()} color="var(--accent-red)" />
        <StatCard label="Bytes Received" value={formatBytes(status?.bytes_recv || 0)} color="var(--accent-green)" />
        <StatCard label="Bytes Sent" value={formatBytes(status?.bytes_sent || 0)} color="var(--accent-purple)" />
      </div>

      {/* Timeline chart */}
      <div className="card" style={{ marginBottom: '0.75rem' }}>
        <div style={{ fontSize: '0.7rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-muted)', letterSpacing: '0.1em' }}>
          CONNECTION TIMELINE (1h)
        </div>
        <ResponsiveContainer width="100%" height={140}>
          <AreaChart data={timelineData}>
            <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#64748b' }} tickLine={false} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 9, fill: '#64748b' }} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={CUSTOM_TOOLTIP_STYLE} />
            <Area type="monotone" dataKey="connections" stroke="#00d4ff" fill="rgba(0,212,255,0.1)" strokeWidth={1.5} dot={false} />
            <Area type="monotone" dataKey="threats" stroke="#ff3366" fill="rgba(255,51,102,0.1)" strokeWidth={1.5} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
        {/* Protocol distribution */}
        <div className="card">
          <div style={{ fontSize: '0.7rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-muted)', letterSpacing: '0.1em' }}>
            PROTOCOLS
          </div>
          {protocols.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', padding: '1rem 0' }}>No data</div>
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={protocols.slice(0, 8)} dataKey="count" nameKey="protocol"
                  cx="50%" cy="50%" outerRadius={60} innerRadius={35}>
                  {protocols.slice(0, 8).map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={CUSTOM_TOOLTIP_STYLE} formatter={(v: unknown) => [Number(v).toLocaleString(), 'packets']} />
              </PieChart>
            </ResponsiveContainer>
          )}
          {protocols.slice(0, 4).map((p, i) => (
            <div key={p.protocol} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', padding: '1px 0' }}>
              <span style={{ color: COLORS[i % COLORS.length] }}>{p.protocol}</span>
              <span style={{ color: 'var(--text-muted)' }}>{p.count.toLocaleString()}</span>
            </div>
          ))}
        </div>

        {/* Top countries */}
        <div className="card">
          <div style={{ fontSize: '0.7rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-muted)', letterSpacing: '0.1em' }}>
            TOP DESTINATION COUNTRIES
          </div>
          {geoData.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', padding: '1rem 0' }}>No data</div>
          ) : (
            <div style={{ maxHeight: 220, overflowY: 'auto' }}>
              {geoData.slice(0, 10).map((g, i) => (
                <div key={g.country} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.2rem 0' }}>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', minWidth: 20, textAlign: 'right' }}>
                    {i + 1}.
                  </span>
                  <span style={{ fontSize: '0.7rem', fontWeight: 600, minWidth: 30, color: 'var(--accent-blue)' }}>
                    {g.country}
                  </span>
                  <div style={{ flex: 1, height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: 3,
                      width: `${(g.count / geoData[0].count) * 100}%`,
                      background: g.threats > 0 ? 'var(--accent-red)' : 'var(--accent-blue)',
                    }} />
                  </div>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', minWidth: 35, textAlign: 'right' }}>
                    {g.count.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Top IPs */}
      <div className="card">
        <div style={{ fontSize: '0.7rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-muted)', letterSpacing: '0.1em' }}>
          TOP DESTINATION IPs
        </div>
        {topIPs.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>No data yet</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.7rem' }}>
              <thead>
                <tr style={{ color: 'var(--text-muted)', fontSize: '0.6rem', letterSpacing: '0.08em' }}>
                  <th style={{ textAlign: 'left', padding: '0.25rem 0.5rem', fontWeight: 600 }}>IP</th>
                  <th style={{ textAlign: 'left', padding: '0.25rem 0.5rem', fontWeight: 600 }}>COUNTRY</th>
                  <th style={{ textAlign: 'right', padding: '0.25rem 0.5rem', fontWeight: 600 }}>PACKETS</th>
                  <th style={{ textAlign: 'right', padding: '0.25rem 0.5rem', fontWeight: 600 }}>BYTES</th>
                  <th style={{ textAlign: 'center', padding: '0.25rem 0.5rem', fontWeight: 600 }}>THREAT</th>
                </tr>
              </thead>
              <tbody>
                {topIPs.map(ip => (
                  <tr key={ip.ip} style={{ borderTop: '1px solid rgba(30,58,95,0.4)' }}>
                    <td style={{ padding: '0.3rem 0.5rem', fontFamily: 'monospace', color: '#93c5fd' }}>{ip.ip}</td>
                    <td style={{ padding: '0.3rem 0.5rem', color: 'var(--text-muted)' }}>{ip.country || '?'}</td>
                    <td style={{ padding: '0.3rem 0.5rem', textAlign: 'right', color: 'var(--text-primary)' }}>{ip.count.toLocaleString()}</td>
                    <td style={{ padding: '0.3rem 0.5rem', textAlign: 'right', color: 'var(--text-muted)' }}>{formatBytes(ip.bytes)}</td>
                    <td style={{ padding: '0.3rem 0.5rem', textAlign: 'center' }}>
                      {ip.is_threat ? '⚠' : '✓'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="card" style={{ textAlign: 'center' }}>
      <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: '1.3rem', fontWeight: 700, color }}>{value}</div>
    </div>
  );
}
