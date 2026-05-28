import { useEffect, useState } from 'react';
import { Database, Trash2, RefreshCw, Wifi, WifiOff, Terminal } from 'lucide-react';

interface SettingsData {
  demo_mode: boolean;
  conn_count: number;
  threat_count: number;
  dns_count: number;
  intel_count: number;
  db_size_bytes: number;
  ws_clients: number;
}

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1048576).toFixed(2)} MB`;
}

export default function Settings() {
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [clearing, setClearing] = useState(false);
  const [clearConfirm, setClearConfirm] = useState(false);
  const [toast, setToast] = useState('');

  const load = async () => {
    try {
      const r = await fetch('/api/settings').then(r => r.json());
      setSettings(r);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const clearData = async () => {
    if (!clearConfirm) { setClearConfirm(true); return; }
    setClearing(true);
    try {
      await fetch('/api/connections/clear', { method: 'DELETE' });
      showToast('All data cleared successfully');
      setClearConfirm(false);
      await load();
    } catch {
      showToast('Error clearing data');
    } finally {
      setClearing(false);
    }
  };

  return (
    <div style={{ overflowY: 'auto', height: '100%', padding: '0.75rem', maxWidth: 760 }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 20, right: 20, zIndex: 999,
          background: 'var(--bg-card)', border: '1px solid var(--accent-green)',
          color: 'var(--accent-green)', padding: '0.5rem 1rem', borderRadius: 8,
          fontSize: '0.8rem', boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
        }}>
          {toast}
        </div>
      )}

      <h2 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent-blue)', letterSpacing: '0.1em', marginBottom: '1rem' }}>
        SETTINGS
      </h2>

      {/* Capture Status */}
      <div className="card" style={{ marginBottom: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
          {settings?.ws_clients ? (
            <Wifi size={16} style={{ color: 'var(--accent-green)' }} />
          ) : (
            <WifiOff size={16} style={{ color: 'var(--accent-red)' }} />
          )}
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            Capture Status
          </span>
          <span style={{
            fontSize: '0.6rem', padding: '1px 6px', borderRadius: 4, fontWeight: 600,
            background: settings?.demo_mode ? 'rgba(255,140,0,0.15)' : 'rgba(0,255,136,0.12)',
            color: settings?.demo_mode ? 'var(--accent-orange)' : 'var(--accent-green)',
            border: `1px solid ${settings?.demo_mode ? 'var(--accent-orange)' : 'var(--accent-green)'}`,
          }}>
            {settings?.demo_mode ? 'DEMO MODE' : 'LIVE CAPTURE'}
          </span>
        </div>

        <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 6, padding: '0.75rem', fontFamily: 'monospace', fontSize: '0.72rem', lineHeight: 1.8 }}>
          <div style={{ color: '#64748b', marginBottom: '0.25rem' }}># Start live capture (requires root + tshark):</div>
          <div style={{ color: 'var(--accent-green)' }}>sudo ./start.sh</div>
          <div style={{ color: '#64748b', marginTop: '0.5rem', marginBottom: '0.25rem' }}># Install tshark if missing:</div>
          <div style={{ color: 'var(--accent-green)' }}>sudo apt install tshark -y</div>
          <div style={{ color: '#64748b', marginTop: '0.5rem', marginBottom: '0.25rem' }}># Allow non-root capture:</div>
          <div style={{ color: 'var(--accent-green)' }}>sudo usermod -aG wireshark $USER && newgrp wireshark</div>
        </div>

        <div style={{ marginTop: '0.5rem', fontSize: '0.68rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
          {settings?.demo_mode
            ? 'Running in demo mode — generating simulated traffic. To capture real packets, run with tshark installed and root privileges.'
            : 'Live capture active — reading real network packets from your interface.'}
        </div>
      </div>

      {/* Database Stats */}
      <div className="card" style={{ marginBottom: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <Database size={16} style={{ color: 'var(--accent-blue)' }} />
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>Database</span>
        </div>

        {settings ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '0.5rem' }}>
            {[
              { label: 'Connections', value: settings.conn_count.toLocaleString() },
              { label: 'Threats', value: settings.threat_count.toLocaleString() },
              { label: 'DNS Queries', value: settings.dns_count.toLocaleString() },
              { label: 'Threat Intel', value: settings.intel_count.toLocaleString() },
              { label: 'DB Size', value: formatBytes(settings.db_size_bytes) },
              { label: 'WS Clients', value: settings.ws_clients.toString() },
            ].map(s => (
              <div key={s.label} style={{
                background: 'rgba(255,255,255,0.03)', borderRadius: 6,
                padding: '0.5rem', textAlign: 'center',
              }}>
                <div style={{ fontSize: '0.55rem', color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: 2 }}>{s.label}</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--accent-blue)' }}>{s.value}</div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Loading...</div>
        )}
      </div>

      {/* Data Management */}
      <div className="card" style={{ marginBottom: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <Trash2 size={16} style={{ color: 'var(--accent-red)' }} />
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>Data Management</span>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button
            onClick={clearData}
            disabled={clearing}
            style={{
              padding: '0.4rem 0.85rem', borderRadius: 6, fontSize: '0.75rem', fontFamily: 'inherit',
              background: clearConfirm ? 'rgba(255,51,102,0.25)' : 'rgba(255,51,102,0.1)',
              color: 'var(--accent-red)',
              border: `1px solid ${clearConfirm ? 'var(--accent-red)' : 'rgba(255,51,102,0.4)'}`,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <Trash2 size={13} />
            {clearing ? 'Clearing...' : clearConfirm ? 'Confirm — Clear All?' : 'Clear All Data'}
          </button>
          {clearConfirm && (
            <button
              onClick={() => setClearConfirm(false)}
              style={{
                padding: '0.4rem 0.75rem', borderRadius: 6, fontSize: '0.75rem', fontFamily: 'inherit',
                background: 'transparent', color: 'var(--text-muted)',
                border: '1px solid var(--border)', cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          )}
          <button
            onClick={load}
            style={{
              padding: '0.4rem 0.6rem', borderRadius: 6,
              background: 'rgba(0,212,255,0.1)', border: '1px solid var(--accent-blue)',
              color: 'var(--accent-blue)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
              fontSize: '0.75rem',
            }}
          >
            <RefreshCw size={12} /> Refresh
          </button>
        </div>
        <div style={{ marginTop: '0.5rem', fontSize: '0.65rem', color: 'var(--text-muted)' }}>
          Clears all connections, threats, and DNS log entries from the database. Cannot be undone.
        </div>
      </div>

      {/* Useful commands */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <Terminal size={16} style={{ color: 'var(--accent-green)' }} />
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>Quick Reference</span>
        </div>
        <div style={{ fontFamily: 'monospace', fontSize: '0.68rem', lineHeight: 2, color: 'var(--text-muted)' }}>
          {[
            ['Start NetGhost', './start.sh'],
            ['Start backend only', 'cd backend && source venv/bin/activate && uvicorn main:app --port 8000'],
            ['Start frontend only', 'cd frontend && npm run dev'],
            ['View live API', 'http://localhost:8000/docs'],
            ['Check interfaces', 'ip link show'],
            ['Test capture', 'sudo tshark -D'],
          ].map(([desc, cmd]) => (
            <div key={desc} style={{ display: 'flex', gap: '1rem', alignItems: 'baseline' }}>
              <span style={{ minWidth: 160, color: '#64748b' }}>{desc}</span>
              <span style={{ color: 'var(--accent-green)' }}>{cmd}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: '1rem', fontSize: '0.65rem', color: 'var(--text-muted)', textAlign: 'center' }}>
        NetGhost — Personal Network Visualizer & Threat Detector · MIT License
      </div>
    </div>
  );
}
