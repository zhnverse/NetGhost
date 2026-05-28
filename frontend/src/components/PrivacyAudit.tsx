import { useEffect, useState } from 'react';
import { Shield, RefreshCw, AlertTriangle, CheckCircle } from 'lucide-react';

interface Tracker {
  query: string;
  category: string;
  hits: number;
}

interface PrivacyData {
  score: number;
  tracker_count: number;
  tracker_hits: number;
  trackers: Tracker[];
  telemetry: Tracker[];
  ads: Tracker[];
  analytics: Tracker[];
  recommendations: string[];
}

function ScoreGauge({ score }: { score: number }) {
  const color = score >= 80 ? '#00ff88' : score >= 50 ? '#ff8c00' : '#ff3366';
  const label = score >= 80 ? 'Good' : score >= 50 ? 'Fair' : 'Poor';

  // SVG arc gauge
  const r = 54;
  const cx = 70;
  const cy = 70;
  const startAngle = -210;
  const sweepAngle = 240;
  const angle = startAngle + (score / 100) * sweepAngle;

  const toRad = (d: number) => (d * Math.PI) / 180;
  const arcPath = (start: number, end: number, radius: number) => {
    const s = { x: cx + radius * Math.cos(toRad(start)), y: cy + radius * Math.sin(toRad(start)) };
    const e = { x: cx + radius * Math.cos(toRad(end)), y: cy + radius * Math.sin(toRad(end)) };
    const large = end - start > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${radius} ${radius} 0 ${large} 1 ${e.x} ${e.y}`;
  };

  const needleX = cx + 42 * Math.cos(toRad(angle));
  const needleY = cy + 42 * Math.sin(toRad(angle));

  return (
    <div style={{ textAlign: 'center' }}>
      <svg width={140} height={110} style={{ overflow: 'visible' }}>
        {/* Background arc */}
        <path d={arcPath(-210, 30, r)} fill="none" stroke="#1e3a5f" strokeWidth={10} strokeLinecap="round" />
        {/* Score arc */}
        {score > 0 && (
          <path d={arcPath(-210, angle, r)} fill="none" stroke={color} strokeWidth={10} strokeLinecap="round" />
        )}
        {/* Needle */}
        <line x1={cx} y1={cy} x2={needleX} y2={needleY} stroke={color} strokeWidth={2} strokeLinecap="round" />
        <circle cx={cx} cy={cy} r={5} fill={color} />
        {/* Score text */}
        <text x={cx} y={cy + 22} textAnchor="middle" fill={color} fontSize={22} fontWeight={700}>{score}</text>
        <text x={cx} y={cy + 36} textAnchor="middle" fill="#94a3b8" fontSize={9} fontWeight={600}>{label.toUpperCase()}</text>
      </svg>
    </div>
  );
}

function TrackerRow({ t }: { t: Tracker }) {
  const catColors: Record<string, string> = {
    tracker: '#ff8c00', ads: '#ff3366', telemetry: '#8b5cf6',
    analytics: '#f59e0b', normal: '#64748b',
  };
  const c = catColors[t.category] || catColors.normal;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '0.5rem',
      padding: '0.3rem 0', borderBottom: '1px solid rgba(30,58,95,0.35)',
      fontSize: '0.7rem',
    }}>
      <span style={{
        minWidth: 60, fontSize: '0.55rem', padding: '1px 5px', borderRadius: 3,
        background: `${c}22`, color: c, border: `1px solid ${c}44`,
        fontWeight: 600, letterSpacing: '0.06em', textAlign: 'center',
      }}>
        {t.category.toUpperCase()}
      </span>
      <span style={{ flex: 1, fontFamily: 'monospace', color: '#fdba74', fontSize: '0.68rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {t.query}
      </span>
      <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>{t.hits}×</span>
    </div>
  );
}

export default function PrivacyAudit() {
  const [data, setData] = useState<PrivacyData | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/privacy').then(r => r.json());
      setData(r);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, []);

  if (!data) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
        {loading ? 'Loading privacy data...' : 'No data available. Start traffic capture first.'}
      </div>
    );
  }

  const allClear = data.tracker_count === 0;

  return (
    <div style={{ overflowY: 'auto', height: '100%', padding: '0.75rem' }}>
      {/* Top row: score + summary */}
      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
        <div className="card" style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: '0.25rem' }}>PRIVACY SCORE</div>
          <ScoreGauge score={data.score} />
          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            (last 24 hours)
          </div>
        </div>

        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.1em' }}>SUMMARY</div>
            <button
              onClick={load}
              disabled={loading}
              style={{
                background: 'rgba(0,212,255,0.1)', border: '1px solid var(--accent-blue)',
                color: 'var(--accent-blue)', borderRadius: 5, padding: '2px 8px',
                cursor: 'pointer', fontSize: '0.65rem', display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              <RefreshCw size={11} /> Refresh
            </button>
          </div>

          {allClear ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#00ff88', fontSize: '0.85rem', fontWeight: 600 }}>
              <CheckCircle size={20} />
              No trackers detected in the last 24 hours!
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '0.5rem' }}>
              {[
                { label: 'Trackers', value: data.tracker_count, color: 'var(--accent-orange)' },
                { label: 'Ads', value: data.ads.length, color: 'var(--accent-red)' },
                { label: 'Telemetry', value: data.telemetry.length, color: '#8b5cf6' },
                { label: 'Analytics', value: data.analytics.length, color: '#f59e0b' },
                { label: 'Total hits', value: data.tracker_hits, color: 'var(--text-primary)' },
              ].map(s => (
                <div key={s.label} style={{ textAlign: 'center', padding: '0.4rem', background: 'rgba(255,255,255,0.03)', borderRadius: 6 }}>
                  <div style={{ fontSize: '0.55rem', color: 'var(--text-muted)', letterSpacing: '0.1em' }}>{s.label}</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: s.color }}>{s.value}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recommendations */}
      {data.recommendations.length > 0 && (
        <div className="card" style={{ marginBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
            <AlertTriangle size={14} style={{ color: 'var(--accent-orange)' }} />
            <span style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--accent-orange)', letterSpacing: '0.1em' }}>
              RECOMMENDATIONS
            </span>
          </div>
          {data.recommendations.map((r, i) => (
            <div key={i} style={{
              padding: '0.4rem 0.5rem', marginBottom: '0.25rem',
              background: 'rgba(255,140,0,0.06)', border: '1px solid rgba(255,140,0,0.2)',
              borderRadius: 6, fontSize: '0.7rem', color: 'var(--text-primary)',
              lineHeight: 1.5,
            }}>
              {r}
            </div>
          ))}
        </div>
      )}

      {/* Tracker list */}
      {data.trackers.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
              <Shield size={13} style={{ color: 'var(--accent-orange)' }} />
              <span style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.1em' }}>
                ALL TRACKERS ({data.trackers.length})
              </span>
            </div>
            <div style={{ maxHeight: 300, overflowY: 'auto' }}>
              {data.trackers.map(t => <TrackerRow key={t.query} t={t} />)}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {data.telemetry.length > 0 && (
              <div className="card">
                <div style={{ fontSize: '0.65rem', fontWeight: 600, color: '#8b5cf6', letterSpacing: '0.1em', marginBottom: '0.4rem' }}>
                  TELEMETRY ({data.telemetry.length})
                </div>
                {data.telemetry.map(t => <TrackerRow key={t.query} t={t} />)}
              </div>
            )}
            {data.ads.length > 0 && (
              <div className="card">
                <div style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--accent-red)', letterSpacing: '0.1em', marginBottom: '0.4rem' }}>
                  AD NETWORKS ({data.ads.length})
                </div>
                {data.ads.map(t => <TrackerRow key={t.query} t={t} />)}
              </div>
            )}
            {data.analytics.length > 0 && (
              <div className="card">
                <div style={{ fontSize: '0.65rem', fontWeight: 600, color: '#f59e0b', letterSpacing: '0.1em', marginBottom: '0.4rem' }}>
                  ANALYTICS ({data.analytics.length})
                </div>
                {data.analytics.map(t => <TrackerRow key={t.query} t={t} />)}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
