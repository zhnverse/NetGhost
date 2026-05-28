import { Shield, Clock, Globe } from 'lucide-react';
import { useStore } from '../store';
import type { Threat } from '../types';

function formatTime(ts: number): string {
  return new Date(ts * 1000).toLocaleTimeString('en-US', { hour12: false });
}

function SeverityBadge({ severity }: { severity: string }) {
  const styles: Record<string, { bg: string; color: string }> = {
    high: { bg: 'rgba(255,51,102,0.15)', color: '#ff3366' },
    medium: { bg: 'rgba(255,140,0,0.15)', color: '#ff8c00' },
    low: { bg: 'rgba(250,204,21,0.15)', color: '#facc15' },
  };
  const s = styles[severity] || styles.low;
  return (
    <span style={{
      padding: '2px 8px', borderRadius: 4, fontSize: '0.6rem',
      fontWeight: 700, letterSpacing: '0.1em',
      background: s.bg, color: s.color,
    }}>
      {severity.toUpperCase()}
    </span>
  );
}

function ThreatCard({ threat }: { threat: Threat }) {
  const typeIcons: Record<string, string> = {
    reverse_shell: '🔴', c2: '🕸', botnet: '🤖', malware: '☠',
    port_scan: '🔍', port_sweep: '📡', data_exfil: '📤',
    backdoor: '🚪', rat: '🐀', suspicious_ip: '⚠',
    tor: '🧅', vnc: '🖥', telnet: '📟', smb: '💾',
  };
  const icon = typeIcons[threat.threat_type] || '⚠';

  return (
    <div
      className="fade-in"
      style={{
        padding: '0.75rem',
        marginBottom: '0.5rem',
        background: 'var(--bg-card)',
        border: `1px solid ${threat.severity === 'high' ? 'rgba(255,51,102,0.4)' : 'var(--border)'}`,
        borderRadius: 8,
        borderLeft: `4px solid ${
          threat.severity === 'high' ? '#ff3366' :
          threat.severity === 'medium' ? '#ff8c00' : '#facc15'
        }`,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.4rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span style={{ fontSize: '1rem' }}>{icon}</span>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            {threat.threat_type.replace(/_/g, ' ').toUpperCase()}
          </span>
        </div>
        <SeverityBadge severity={threat.severity} />
      </div>

      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
        {threat.description}
      </div>

      <div style={{ display: 'flex', gap: '1rem', fontSize: '0.65rem', color: 'var(--text-muted)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <Globe size={10} />
          <span style={{ fontFamily: 'monospace', color: '#93c5fd' }}>{threat.ip}</span>
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <Clock size={10} />
          {formatTime(threat.timestamp)}
        </span>
      </div>
    </div>
  );
}

export default function ThreatPanel() {
  const { threats, connections } = useStore();

  const threatStats = {
    high: threats.filter(t => t.severity === 'high').length,
    medium: threats.filter(t => t.severity === 'medium').length,
    low: threats.filter(t => t.severity === 'low').length,
  };

  const typeBreakdown = threats.reduce<Record<string, number>>((acc, t) => {
    acc[t.threat_type] = (acc[t.threat_type] || 0) + 1;
    return acc;
  }, {});

  const topTypes = Object.entries(typeBreakdown)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Summary bar */}
      <div style={{
        padding: '0.75rem',
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border)',
        display: 'flex', gap: '1rem', flexShrink: 0,
      }}>
        <StatBox label="HIGH" value={threatStats.high} color="var(--accent-red)" />
        <StatBox label="MEDIUM" value={threatStats.medium} color="var(--accent-orange)" />
        <StatBox label="LOW" value={threatStats.low} color="#facc15" />
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Shield size={14} style={{ color: 'var(--accent-blue)' }} />
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            {connections.length > 0
              ? `${((threats.length / connections.length) * 100).toFixed(1)}% threat rate`
              : 'No data'}
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Threat list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem' }}>
          {threats.length === 0 ? (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', height: '100%', gap: '0.5rem',
              color: 'var(--text-muted)', fontSize: '0.85rem',
            }}>
              <Shield size={40} style={{ opacity: 0.3 }} />
              <span>No threats detected</span>
              <span style={{ fontSize: '0.7rem', opacity: 0.6 }}>Monitoring network traffic...</span>
            </div>
          ) : (
            threats.map(t => <ThreatCard key={t.id} threat={t} />)
          )}
        </div>

        {/* Right panel: type breakdown */}
        {topTypes.length > 0 && (
          <div style={{
            width: 200, borderLeft: '1px solid var(--border)',
            padding: '0.75rem', flexShrink: 0,
          }}>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.5rem', letterSpacing: '0.1em' }}>
              THREAT TYPES
            </div>
            {topTypes.map(([type, count]) => (
              <div key={type} style={{ marginBottom: '0.4rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', marginBottom: 2 }}>
                  <span style={{ color: 'var(--text-primary)' }}>{type.replace(/_/g, ' ')}</span>
                  <span style={{ color: 'var(--text-muted)' }}>{count}</span>
                </div>
                <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${(count / topTypes[0][1]) * 100}%`,
                    background: 'var(--accent-red)',
                    borderRadius: 2,
                  }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: '0.55rem', color: 'var(--text-muted)', letterSpacing: '0.12em' }}>{label}</span>
      <span style={{ fontSize: '1.2rem', fontWeight: 700, color, lineHeight: 1 }}>{value}</span>
    </div>
  );
}
