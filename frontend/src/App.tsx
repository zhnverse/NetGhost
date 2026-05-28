import { useState, useEffect } from 'react';
import { useWebSocket } from './hooks/useWebSocket';
import { useStore } from './store';
import Header from './components/Header';
import Globe3D from './components/Globe3D';
import ConnectionFeed from './components/ConnectionFeed';
import ThreatPanel from './components/ThreatPanel';
import Analytics from './components/Analytics';
import HuntPanel from './components/HuntPanel';
import DNSLog from './components/DNSLog';
import Processes from './components/Processes';
import PrivacyAudit from './components/PrivacyAudit';
import Settings from './components/Settings';
import type { Connection } from './types';

function GlobeView() {
  const { threats, connections } = useStore();
  const latestThreat = threats[0];
  const recentConns = connections.slice(0, 5);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <Globe3D />

      {/* Live connections overlay */}
      <div style={{
        position: 'absolute', top: 12, left: 12,
        display: 'flex', flexDirection: 'column', gap: '0.4rem',
        pointerEvents: 'none',
      }}>
        <div style={{
          background: 'rgba(5,13,26,0.85)', backdropFilter: 'blur(8px)',
          border: '1px solid var(--border)', borderRadius: 8,
          padding: '0.6rem 0.75rem', minWidth: 180,
        }}>
          <div style={{ fontSize: '0.55rem', color: 'var(--text-muted)', letterSpacing: '0.12em', marginBottom: '0.4rem' }}>
            LIVE CONNECTIONS
          </div>
          {recentConns.length === 0 ? (
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Waiting...</div>
          ) : recentConns.map((c: Connection) => (
            <div key={c.id} style={{
              fontSize: '0.65rem', fontFamily: 'monospace',
              color: c.is_threat ? 'var(--accent-red)' : 'var(--text-muted)',
              padding: '1px 0',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              maxWidth: 200,
            }}>
              {c.src_ip} → {c.dst_ip}
              <span style={{ color: 'var(--text-muted)', marginLeft: 4 }}>[{c.protocol}]</span>
            </div>
          ))}
        </div>
      </div>

      {/* Threat alert overlay */}
      {latestThreat && (
        <div style={{
          position: 'absolute', top: 12, right: 12,
          background: 'rgba(255,51,102,0.12)', backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255,51,102,0.5)', borderRadius: 8,
          padding: '0.6rem 0.75rem', maxWidth: 260,
        }}
          className="slide-in"
        >
          <div style={{ fontSize: '0.55rem', color: 'var(--accent-red)', letterSpacing: '0.12em', marginBottom: '0.3rem', fontWeight: 700 }}>
            THREAT DETECTED
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-primary)', fontFamily: 'monospace' }}>
            {latestThreat.ip}
          </div>
          <div style={{ fontSize: '0.65rem', color: 'var(--accent-orange)', marginTop: 2 }}>
            {latestThreat.threat_type.replace(/_/g, ' ')}
          </div>
          <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginTop: 2 }}>
            {latestThreat.description}
          </div>
        </div>
      )}

      {/* Globe legend */}
      <div style={{
        position: 'absolute', bottom: 12, right: 12,
        background: 'rgba(5,13,26,0.8)', backdropFilter: 'blur(8px)',
        border: '1px solid var(--border)', borderRadius: 8,
        padding: '0.5rem 0.75rem',
        pointerEvents: 'none',
      }}>
        <div style={{ fontSize: '0.55rem', color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: '0.3rem' }}>LEGEND</div>
        {[
          { color: 'rgba(0,212,255,0.7)', label: 'HTTPS' },
          { color: 'rgba(0,255,136,0.6)', label: 'TCP' },
          { color: 'rgba(147,51,234,0.7)', label: 'DNS' },
          { color: 'rgba(255,51,102,0.9)', label: 'Threat' },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.65rem', padding: '1px 0' }}>
            <div style={{ width: 20, height: 2, background: color, borderRadius: 1 }} />
            <span style={{ color: 'var(--text-muted)' }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const TABS = [
  { id: 'globe', label: 'Globe' },
  { id: 'feed', label: 'Live Feed' },
  { id: 'threats', label: 'Threats' },
  { id: 'stats', label: 'Analytics' },
  { id: 'hunt', label: 'Hunt' },
  { id: 'dns', label: 'DNS Log' },
  { id: 'processes', label: 'Protocols' },
  { id: 'privacy', label: 'Privacy' },
  { id: 'settings', label: 'Settings' },
];

export { TABS };

export default function App() {
  const [activeTab, setActiveTab] = useState('globe');
  const { setStatus } = useStore();

  useWebSocket();

  useEffect(() => {
    const poll = async () => {
      try {
        const r = await fetch('/api/status');
        const data = await r.json();
        setStatus(data);
      } catch { /* backend not ready yet */ }
    };
    poll();
    const id = setInterval(poll, 5000);
    return () => clearInterval(id);
  }, [setStatus]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <Header activeTab={activeTab} onTabChange={setActiveTab} tabs={TABS} />

      <main style={{ flex: 1, overflow: 'hidden' }}>
        <div style={{ display: activeTab === 'globe' ? 'block' : 'none', height: '100%' }}>
          <GlobeView />
        </div>
        <div style={{ display: activeTab === 'feed' ? 'flex' : 'none', height: '100%', flexDirection: 'column' }}>
          <ConnectionFeed />
        </div>
        <div style={{ display: activeTab === 'threats' ? 'flex' : 'none', height: '100%', flexDirection: 'column' }}>
          <ThreatPanel />
        </div>
        <div style={{ display: activeTab === 'stats' ? 'block' : 'none', height: '100%', overflow: 'auto' }}>
          <Analytics />
        </div>
        <div style={{ display: activeTab === 'hunt' ? 'flex' : 'none', height: '100%', flexDirection: 'column' }}>
          <HuntPanel />
        </div>
        <div style={{ display: activeTab === 'dns' ? 'flex' : 'none', height: '100%', flexDirection: 'column' }}>
          <DNSLog />
        </div>
        <div style={{ display: activeTab === 'processes' ? 'flex' : 'none', height: '100%', flexDirection: 'column' }}>
          <Processes />
        </div>
        <div style={{ display: activeTab === 'privacy' ? 'block' : 'none', height: '100%', overflow: 'auto' }}>
          <PrivacyAudit />
        </div>
        <div style={{ display: activeTab === 'settings' ? 'block' : 'none', height: '100%', overflow: 'auto' }}>
          <Settings />
        </div>
      </main>
    </div>
  );
}
