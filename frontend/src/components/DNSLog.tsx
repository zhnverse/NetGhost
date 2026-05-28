import { useEffect, useState, useCallback } from 'react';
import { RefreshCw, Shield } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';

interface DnsEntry {
  id: number;
  timestamp: number;
  query: string;
  src_ip: string;
  dst_ip: string;
  response_ip: string | null;
  is_tracker: number;
  category: string;
}

interface TopDomain {
  query: string;
  count: number;
  is_tracker: number;
}

const CUSTOM_TOOLTIP = {
  background: '#0d1f3c', border: '1px solid #1e3a5f',
  borderRadius: 6, fontSize: '0.7rem', color: '#e2e8f0',
};

function timeAgo(ts: number): string {
  const diff = Math.floor(Date.now() / 1000 - ts);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

function CategoryBadge({ cat }: { cat: string }) {
  const colors: Record<string, string> = {
    tracker: '#ff8c00', ads: '#ff3366', telemetry: '#8b5cf6',
    analytics: '#f59e0b', normal: '#64748b',
  };
  const c = colors[cat] || colors.normal;
  return (
    <span style={{
      fontSize: '0.55rem', padding: '1px 5px', borderRadius: 3,
      background: `${c}22`, color: c, border: `1px solid ${c}44`,
      fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
    }}>
      {cat}
    </span>
  );
}

export default function DNSLog() {
  const [entries, setEntries] = useState<DnsEntry[]>([]);
  const [topDomains, setTopDomains] = useState<TopDomain[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [trackerOnly, setTrackerOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ queries_last_hour: 0, tracker_count: 0, unique_domains: 0 });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '200' });
      if (search) params.set('search', search);
      if (trackerOnly) params.set('tracker_only', 'true');

      const [dnsRes, statsRes] = await Promise.all([
        fetch(`/api/dns?${params}`).then(r => r.json()),
        fetch('/api/dns/stats').then(r => r.json()),
      ]);

      setEntries(dnsRes.queries || []);
      setTopDomains(dnsRes.top_domains || []);
      setTotal(dnsRes.total || 0);
      setStats(statsRes);
    } catch {
      // backend not ready
    } finally {
      setLoading(false);
    }
  }, [search, trackerOnly]);

  useEffect(() => {
    load();
    const id = setInterval(load, 8000);
    return () => clearInterval(id);
  }, [load]);

  const trackerPercent = stats.unique_domains > 0
    ? Math.round((stats.tracker_count / stats.unique_domains) * 100)
    : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        padding: '0.75rem', background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border)', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem' }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && load()}
            placeholder="Search domain..."
            style={{
              flex: 1, background: 'var(--bg-card)', border: '1px solid var(--border)',
              color: 'var(--text-primary)', padding: '0.35rem 0.6rem',
              borderRadius: 6, fontSize: '0.75rem', fontFamily: 'monospace',
            }}
          />
          <button
            onClick={() => setTrackerOnly(!trackerOnly)}
            style={{
              padding: '0.35rem 0.75rem', borderRadius: 6, fontSize: '0.7rem', fontFamily: 'inherit',
              background: trackerOnly ? 'rgba(255,140,0,0.15)' : 'transparent',
              color: trackerOnly ? 'var(--accent-orange)' : 'var(--text-muted)',
              border: `1px solid ${trackerOnly ? 'var(--accent-orange)' : 'var(--border)'}`,
              cursor: 'pointer',
            }}
          >
            <Shield size={12} style={{ display: 'inline', marginRight: 4 }} />
            Trackers only
          </button>
          <button
            onClick={load}
            disabled={loading}
            style={{
              padding: '0.35rem 0.6rem', background: 'rgba(0,212,255,0.1)',
              border: '1px solid var(--accent-blue)', color: 'var(--accent-blue)',
              borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            <RefreshCw size={13} className={loading ? 'pulse' : ''} />
          </button>
        </div>

        {/* Stat chips */}
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          {[
            { label: 'Queries/hr', value: stats.queries_last_hour, color: 'var(--accent-blue)' },
            { label: 'Unique domains', value: stats.unique_domains, color: 'var(--accent-green)' },
            { label: 'Tracker domains', value: stats.tracker_count, color: 'var(--accent-orange)' },
            { label: 'Tracker %', value: `${trackerPercent}%`, color: trackerPercent > 30 ? 'var(--accent-red)' : 'var(--accent-orange)' },
          ].map(s => (
            <div key={s.label} style={{
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 6, padding: '0.3rem 0.6rem', textAlign: 'center',
            }}>
              <div style={{ fontSize: '0.55rem', color: 'var(--text-muted)', letterSpacing: '0.1em' }}>{s.label}</div>
              <div style={{ fontSize: '0.9rem', fontWeight: 700, color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Query log */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {/* Column headers */}
          <div style={{
            position: 'sticky', top: 0, zIndex: 2,
            padding: '0.25rem 0.75rem', background: 'var(--bg-secondary)',
            borderBottom: '1px solid var(--border)',
            display: 'grid', gridTemplateColumns: '75px 1fr 110px 90px',
            gap: '0.5rem', fontSize: '0.6rem', color: 'var(--text-muted)',
            fontWeight: 600, letterSpacing: '0.08em',
          }}>
            <span>TIME</span><span>DOMAIN</span><span>RESPONSE</span><span>CATEGORY</span>
          </div>

          {entries.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              {loading ? 'Loading...' : 'No DNS queries captured yet.'}
            </div>
          ) : (
            entries.map(e => (
              <div
                key={e.id}
                style={{
                  padding: '0.35rem 0.75rem',
                  borderBottom: '1px solid rgba(30,58,95,0.4)',
                  display: 'grid',
                  gridTemplateColumns: '75px 1fr 110px 90px',
                  gap: '0.5rem',
                  alignItems: 'center',
                  fontSize: '0.7rem',
                  background: e.is_tracker ? 'rgba(255,140,0,0.04)' : 'transparent',
                  borderLeft: e.is_tracker ? '3px solid rgba(255,140,0,0.5)' : '3px solid transparent',
                }}
              >
                <span style={{ color: 'var(--text-muted)', fontSize: '0.62rem', fontFamily: 'monospace' }}>
                  {timeAgo(e.timestamp)}
                </span>
                <span style={{
                  fontFamily: 'monospace', color: e.is_tracker ? '#fdba74' : 'var(--text-primary)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {e.query}
                </span>
                <span style={{ color: '#93c5fd', fontFamily: 'monospace', fontSize: '0.65rem' }}>
                  {e.response_ip || '—'}
                </span>
                <CategoryBadge cat={e.category || 'normal'} />
              </div>
            ))
          )}
        </div>

        {/* Right: top domains chart */}
        <div style={{
          width: 240, borderLeft: '1px solid var(--border)', padding: '0.75rem',
          overflowY: 'auto', flexShrink: 0,
        }}>
          <div style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: '0.5rem' }}>
            TOP DOMAINS ({total} total)
          </div>
          {topDomains.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>No data</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={topDomains.slice(0, 8)} layout="vertical" margin={{ left: 0, right: 20 }}>
                  <XAxis type="number" tick={{ fontSize: 8, fill: '#64748b' }} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="query" tick={{ fontSize: 7, fill: '#94a3b8' }} tickLine={false} width={80} />
                  <Tooltip contentStyle={CUSTOM_TOOLTIP} />
                  <Bar dataKey="count" radius={[0, 3, 3, 0]}>
                    {topDomains.slice(0, 8).map((d, i) => (
                      <Cell key={i} fill={d.is_tracker ? '#ff8c00' : '#00d4ff'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div style={{ marginTop: '0.5rem' }}>
                {topDomains.slice(0, 12).map(d => (
                  <div key={d.query} style={{
                    display: 'flex', justifyContent: 'space-between',
                    fontSize: '0.62rem', padding: '2px 0',
                    borderBottom: '1px solid rgba(30,58,95,0.3)',
                  }}>
                    <span style={{
                      fontFamily: 'monospace',
                      color: d.is_tracker ? '#fdba74' : 'var(--text-primary)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      maxWidth: 140,
                    }}>
                      {d.query}
                    </span>
                    <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>{d.count}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
