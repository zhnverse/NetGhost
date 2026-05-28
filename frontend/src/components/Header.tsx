import { Activity, Shield, Wifi, WifiOff, AlertTriangle } from 'lucide-react';
import { useStore } from '../store';

interface Tab { id: string; label: string; }

interface HeaderProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  tabs: Tab[];
}

export default function Header({ activeTab, onTabChange, tabs }: HeaderProps) {
  const { isConnected, isDemoMode, status, threats } = useStore();
  const unreadThreats = threats.filter(t => t.severity === 'high').length;

  return (
    <header
      style={{
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border)',
        padding: '0 1rem',
        display: 'flex',
        alignItems: 'center',
        gap: '1.5rem',
        height: '52px',
        flexShrink: 0,
        zIndex: 50,
      }}
    >
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 'fit-content' }}>
        <Shield size={20} style={{ color: 'var(--accent-blue)' }} />
        <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--accent-blue)', letterSpacing: '0.1em' }}>
          NETGHOST
        </span>
      </div>

      {/* Navigation tabs */}
      <nav style={{ display: 'flex', gap: '0.25rem', flex: 1, overflowX: 'auto' }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            style={{
              padding: '0.25rem 0.75rem',
              background: activeTab === tab.id ? 'var(--bg-card)' : 'transparent',
              color: activeTab === tab.id ? 'var(--accent-blue)' : 'var(--text-muted)',
              border: activeTab === tab.id ? '1px solid var(--border)' : '1px solid transparent',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.75rem',
              fontFamily: 'inherit',
              fontWeight: activeTab === tab.id ? 600 : 400,
              transition: 'all 0.15s',
              position: 'relative',
            }}
          >
            {tab.label}
            {tab.id === 'threats' && unreadThreats > 0 && (
              <span style={{
                position: 'absolute', top: -4, right: -4,
                background: 'var(--accent-red)', color: '#fff',
                borderRadius: '50%', width: 16, height: 16,
                fontSize: '0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700,
              }}>
                {unreadThreats > 9 ? '9+' : unreadThreats}
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* Status indicators */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginLeft: 'auto' }}>
        {isDemoMode && (
          <span style={{
            fontSize: '0.65rem', color: 'var(--accent-orange)',
            border: '1px solid var(--accent-orange)',
            padding: '2px 6px', borderRadius: 4, opacity: 0.8,
          }}>
            DEMO MODE
          </span>
        )}

        {status && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.7rem' }}>
              <Activity size={12} style={{ color: 'var(--accent-green)' }} />
              <span style={{ color: 'var(--text-muted)' }}>
                {(status.total_connections).toLocaleString()} pkts
              </span>
            </div>
            {status.total_threats > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.7rem' }}>
                <AlertTriangle size={12} style={{ color: 'var(--accent-red)' }} />
                <span style={{ color: 'var(--accent-red)' }}>
                  {status.total_threats} threats
                </span>
              </div>
            )}
          </>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.7rem' }}>
          {isConnected
            ? <Wifi size={14} style={{ color: 'var(--accent-green)' }} />
            : <WifiOff size={14} style={{ color: 'var(--accent-red)' }} />
          }
          <span style={{ color: isConnected ? 'var(--accent-green)' : 'var(--accent-red)' }}>
            {isConnected ? 'LIVE' : 'OFFLINE'}
          </span>
        </div>
      </div>
    </header>
  );
}
