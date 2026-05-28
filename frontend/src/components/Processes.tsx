import { useEffect, useState } from 'react';
import { Activity, Globe, AlertTriangle } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';

interface Process {
  name: string;
  connections: number;
  bytes: number;
  unique_destinations: number;
  countries: number;
  first_seen: number;
  last_seen: number;
  threats: number;
  top_destinations: Array<{ dst_ip: string; dst_country: string; count: number; bytes: number }>;
}

interface ProcessDetail {
  name: string;
  connections: Array<Record<string, unknown>>;
  countries: Array<{ country: string; count: number }>;
  top_ips: Array<{ dst_ip: string; count: number; bytes: number }>;
}

const CUSTOM_TOOLTIP = {
  background: '#0d1f3c', border: '1px solid #1e3a5f',
  borderRadius: 6, fontSize: '0.7rem', color: '#e2e8f0',
};

function formatBytes(b: number): string {
  if (!b) return '0B';
  if (b < 1024) return `${b}B`;
  if (b < 1048576) return `${(b / 1024).toFixed(0)}KB`;
  if (b < 1073741824) return `${(b / 1048576).toFixed(1)}MB`;
  return `${(b / 1073741824).toFixed(1)}GB`;
}

function timeAgo(ts: number): string {
  const diff = Math.floor(Date.now() / 1000 - ts);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const PROTO_COLORS: Record<string, string> = {
  HTTPS: '#00d4ff', HTTP: '#f59e0b', DNS: '#8b5cf6', SSH: '#10b981',
  FTP: '#ef4444', SMTP: '#f97316', TCP: '#64748b', UDP: '#475569',
  RDP: '#ef4444', SMB: '#dc2626', NTP: '#06b6d4',
};

export default function Processes() {
  const [processes, setProcesses] = useState<Process[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<ProcessDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch('/api/processes').then(r => r.json());
        setProcesses(r.processes || []);
      } catch { /* ignore */ }
    };
    load();
    const id = setInterval(load, 10000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!selected) { setDetail(null); return; }
    setLoading(true);
    fetch(`/api/processes/${encodeURIComponent(selected)}`)
      .then(r => r.json())
      .then(d => { setDetail(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [selected]);

  const maxConns = processes[0]?.connections || 1;

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Left: process list */}
      <div style={{ flex: selected ? '0 0 380px' : '1', overflowY: 'auto', borderRight: selected ? '1px solid var(--border)' : 'none' }}>
        {/* Chart */}
        {processes.length > 0 && (
          <div style={{ padding: '0.75rem', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.1em', marginBottom: '0.4rem' }}>
              CONNECTIONS BY PROTOCOL
            </div>
            <ResponsiveContainer width="100%" height={130}>
              <BarChart data={processes.slice(0, 10)} layout="vertical" margin={{ left: 0, right: 30 }}>
                <XAxis type="number" tick={{ fontSize: 8, fill: '#64748b' }} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 8, fill: '#94a3b8' }} tickLine={false} width={55} />
                <Tooltip contentStyle={CUSTOM_TOOLTIP} />
                <Bar dataKey="connections" radius={[0, 3, 3, 0]}>
                  {processes.slice(0, 10).map((p, i) => (
                    <Cell key={i} fill={PROTO_COLORS[p.name] || '#64748b'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Process cards */}
        <div style={{ padding: '0.5rem' }}>
          {processes.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              No network activity yet
            </div>
          ) : (
            processes.map(p => {
              const color = PROTO_COLORS[p.name] || '#64748b';
              const isActive = selected === p.name;
              return (
                <div
                  key={p.name}
                  onClick={() => setSelected(isActive ? null : p.name)}
                  style={{
                    background: isActive ? 'rgba(0,212,255,0.06)' : 'var(--bg-card)',
                    border: `1px solid ${isActive ? 'var(--accent-blue)' : 'var(--border)'}`,
                    borderRadius: 8, padding: '0.6rem 0.75rem', marginBottom: '0.4rem',
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: p.threats > 0 ? 'var(--accent-red)' : 'var(--text-primary)' }}>
                        {p.name}
                      </span>
                      {p.threats > 0 && <AlertTriangle size={12} style={{ color: 'var(--accent-red)' }} />}
                    </div>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                      {timeAgo(p.last_seen)}
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div style={{ height: 3, background: 'var(--border)', borderRadius: 2, overflow: 'hidden', marginBottom: '0.3rem' }}>
                    <div style={{
                      height: '100%', borderRadius: 2,
                      width: `${(p.connections / maxConns) * 100}%`,
                      background: p.threats > 0 ? 'var(--accent-red)' : color,
                    }} />
                  </div>

                  <div style={{ display: 'flex', gap: '1rem', fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                    <span><Activity size={9} style={{ display: 'inline', marginRight: 2 }} />{p.connections.toLocaleString()} conns</span>
                    <span>{formatBytes(p.bytes)}</span>
                    <span><Globe size={9} style={{ display: 'inline', marginRight: 2 }} />{p.unique_destinations} IPs</span>
                    <span>{p.countries} countries</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right: detail panel */}
      {selected && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: PROTO_COLORS[selected] || 'var(--accent-blue)' }}>
              {selected}
            </div>
            <button
              onClick={() => setSelected(null)}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.1rem' }}
            >×</button>
          </div>

          {loading ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Loading...</div>
          ) : detail && (
            <>
              {/* Countries */}
              {detail.countries.length > 0 && (
                <div className="card" style={{ marginBottom: '0.75rem' }}>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.1em', marginBottom: '0.4rem' }}>
                    DESTINATION COUNTRIES
                  </div>
                  <ResponsiveContainer width="100%" height={120}>
                    <BarChart data={detail.countries.slice(0, 10)} layout="vertical" margin={{ left: 0, right: 20 }}>
                      <XAxis type="number" tick={{ fontSize: 8, fill: '#64748b' }} tickLine={false} axisLine={false} />
                      <YAxis type="category" dataKey="country" tick={{ fontSize: 9, fill: '#94a3b8' }} tickLine={false} width={30} />
                      <Tooltip contentStyle={CUSTOM_TOOLTIP} />
                      <Bar dataKey="count" fill={PROTO_COLORS[selected] || '#00d4ff'} radius={[0, 3, 3, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Top IPs */}
              {detail.top_ips.length > 0 && (
                <div className="card" style={{ marginBottom: '0.75rem' }}>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.1em', marginBottom: '0.5rem' }}>
                    TOP DESTINATION IPs
                  </div>
                  {detail.top_ips.map(ip => (
                    <div key={ip.dst_ip} style={{
                      display: 'flex', justifyContent: 'space-between',
                      padding: '0.25rem 0', fontSize: '0.7rem',
                      borderBottom: '1px solid rgba(30,58,95,0.3)',
                    }}>
                      <span style={{ fontFamily: 'monospace', color: '#93c5fd' }}>{ip.dst_ip}</span>
                      <span style={{ color: 'var(--text-muted)' }}>{ip.count} / {formatBytes(ip.bytes)}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Recent connections */}
              <div className="card">
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.1em', marginBottom: '0.5rem' }}>
                  RECENT CONNECTIONS ({detail.connections.length})
                </div>
                <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                  {detail.connections.slice(0, 50).map((c, i) => (
                    <div key={i} style={{
                      display: 'grid', gridTemplateColumns: '1fr 1fr 55px',
                      gap: '0.5rem', padding: '0.2rem 0',
                      fontSize: '0.65rem', fontFamily: 'monospace',
                      borderBottom: '1px solid rgba(30,58,95,0.3)',
                      color: c.is_threat ? 'var(--accent-red)' : 'var(--text-muted)',
                    }}>
                      <span style={{ color: '#93c5fd' }}>{String(c.dst_ip)}</span>
                      <span>{String(c.dst_country) || '?'}</span>
                      <span style={{ textAlign: 'right' }}>{formatBytes(Number(c.bytes))}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
