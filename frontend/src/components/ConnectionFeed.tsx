import { useState, useMemo } from 'react';
import { AlertTriangle, Filter, Trash2 } from 'lucide-react';
import { useStore } from '../store';
import type { Connection } from '../types';

function formatBytes(b: number): string {
  if (b < 1024) return `${b}B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)}KB`;
  return `${(b / 1048576).toFixed(1)}MB`;
}

function formatTime(ts: number): string {
  return new Date(ts * 1000).toLocaleTimeString('en-US', { hour12: false });
}

function ProtocolBadge({ proto }: { proto: string }) {
  const colors: Record<string, string> = {
    HTTPS: '#06b6d4', HTTP: '#f59e0b', DNS: '#8b5cf6',
    SSH: '#10b981', FTP: '#ef4444', SMTP: '#f97316',
    TCP: '#64748b', UDP: '#475569', RDP: '#ef4444',
    SMB: '#dc2626', VNC: '#f59e0b',
  };
  const color = colors[proto] || '#64748b';
  return (
    <span style={{
      fontSize: '0.6rem', padding: '1px 5px', borderRadius: 3,
      background: `${color}22`, color, border: `1px solid ${color}44`,
      fontWeight: 600, letterSpacing: '0.05em',
    }}>
      {proto}
    </span>
  );
}

function ConnectionRow({ conn, onClick, isSelected }: {
  conn: Connection; onClick: () => void; isSelected: boolean;
}) {
  const isThreat = conn.is_threat === 1;
  return (
    <div
      onClick={onClick}
      className="fade-in"
      style={{
        padding: '0.4rem 0.75rem',
        borderBottom: '1px solid rgba(30,58,95,0.5)',
        cursor: 'pointer',
        background: isSelected
          ? 'rgba(0,212,255,0.08)'
          : isThreat
          ? 'rgba(255,51,102,0.05)'
          : 'transparent',
        borderLeft: isThreat
          ? '3px solid var(--accent-red)'
          : isSelected
          ? '3px solid var(--accent-blue)'
          : '3px solid transparent',
        display: 'grid',
        gridTemplateColumns: '65px 1fr 10px 1fr 60px 50px 50px',
        alignItems: 'center',
        gap: '0.5rem',
        fontSize: '0.7rem',
        fontFamily: 'monospace',
        transition: 'background 0.1s',
      }}
    >
      <span style={{ color: 'var(--text-muted)' }}>{formatTime(conn.timestamp)}</span>

      <span style={{ color: isThreat ? 'var(--accent-red)' : 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {isThreat && <AlertTriangle size={10} style={{ display: 'inline', marginRight: 3, color: 'var(--accent-red)' }} />}
        {conn.src_ip}
      </span>

      <span style={{ color: 'var(--text-muted)', textAlign: 'center' }}>→</span>

      <span style={{ color: isThreat ? 'var(--accent-red)' : '#93c5fd', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {conn.dst_ip}
        {conn.dst_country && conn.dst_country !== 'LAN' && (
          <span style={{ color: 'var(--text-muted)', marginLeft: 4 }}>({conn.dst_country})</span>
        )}
      </span>

      <span><ProtocolBadge proto={conn.protocol} /></span>

      <span style={{ color: 'var(--text-muted)', textAlign: 'right' }}>{formatBytes(conn.bytes)}</span>

      <span style={{
        color: isThreat ? 'var(--accent-red)' : 'var(--text-muted)',
        textAlign: 'right', fontSize: '0.6rem',
      }}>
        {isThreat ? (conn.threat_type || 'threat') : `:${conn.dst_port}`}
      </span>
    </div>
  );
}

export default function ConnectionFeed() {
  const { connections, selectedConnection, selectConnection, clearAll } = useStore();
  const [filterThreat, setFilterThreat] = useState(false);
  const [filterProto, setFilterProto] = useState('');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    let list = connections;
    if (filterThreat) list = list.filter(c => c.is_threat === 1);
    if (filterProto) list = list.filter(c => c.protocol === filterProto);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(c =>
        c.src_ip.includes(q) || c.dst_ip.includes(q) ||
        c.protocol.toLowerCase().includes(q) ||
        (c.dst_country || '').toLowerCase().includes(q) ||
        (c.threat_type || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [connections, filterThreat, filterProto, search]);

  const protocols = useMemo(() => {
    const set = new Set(connections.map(c => c.protocol));
    return Array.from(set).sort();
  }, [connections]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Toolbar */}
      <div style={{
        padding: '0.5rem 0.75rem',
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border)',
        display: 'flex', gap: '0.5rem', alignItems: 'center', flexShrink: 0,
      }}>
        <Filter size={14} style={{ color: 'var(--text-muted)' }} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search IP, protocol, country..."
          style={{
            flex: 1, background: 'var(--bg-card)', border: '1px solid var(--border)',
            color: 'var(--text-primary)', padding: '0.25rem 0.5rem',
            borderRadius: 4, fontSize: '0.7rem', fontFamily: 'inherit',
          }}
        />
        <select
          value={filterProto}
          onChange={e => setFilterProto(e.target.value)}
          style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            color: 'var(--text-primary)', padding: '0.25rem 0.5rem',
            borderRadius: 4, fontSize: '0.7rem', fontFamily: 'inherit',
          }}
        >
          <option value="">All protocols</option>
          {protocols.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <button
          onClick={() => setFilterThreat(!filterThreat)}
          style={{
            padding: '0.25rem 0.5rem', borderRadius: 4, fontSize: '0.65rem',
            background: filterThreat ? 'rgba(255,51,102,0.2)' : 'transparent',
            color: filterThreat ? 'var(--accent-red)' : 'var(--text-muted)',
            border: `1px solid ${filterThreat ? 'var(--accent-red)' : 'var(--border)'}`,
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          Threats only
        </button>
        <button
          onClick={clearAll}
          title="Clear all"
          style={{
            padding: '0.25rem', background: 'transparent', border: '1px solid var(--border)',
            color: 'var(--text-muted)', cursor: 'pointer', borderRadius: 4,
            display: 'flex', alignItems: 'center',
          }}
        >
          <Trash2 size={12} />
        </button>
        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
          {filtered.length} / {connections.length}
        </span>
      </div>

      {/* Column headers */}
      <div style={{
        padding: '0.25rem 0.75rem',
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border)',
        display: 'grid',
        gridTemplateColumns: '65px 1fr 10px 1fr 60px 50px 50px',
        gap: '0.5rem',
        fontSize: '0.6rem',
        color: 'var(--text-muted)',
        fontWeight: 600,
        letterSpacing: '0.08em',
        flexShrink: 0,
      }}>
        <span>TIME</span><span>SOURCE</span><span></span>
        <span>DESTINATION</span><span>PROTO</span>
        <span style={{ textAlign: 'right' }}>SIZE</span>
        <span style={{ textAlign: 'right' }}>PORT</span>
      </div>

      {/* Feed */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {filtered.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            {connections.length === 0
              ? 'Waiting for network traffic...'
              : 'No connections match filter'}
          </div>
        ) : (
          filtered.map(conn => (
            <ConnectionRow
              key={conn.id}
              conn={conn}
              isSelected={selectedConnection?.id === conn.id}
              onClick={() => selectConnection(selectedConnection?.id === conn.id ? null : conn)}
            />
          ))
        )}
      </div>

      {/* Detail panel */}
      {selectedConnection && (
        <ConnectionDetail conn={selectedConnection} onClose={() => selectConnection(null)} />
      )}
    </div>
  );
}

function ConnectionDetail({ conn, onClose }: { conn: Connection; onClose: () => void }) {
  const isThreat = conn.is_threat === 1;
  return (
    <div style={{
      borderTop: `2px solid ${isThreat ? 'var(--accent-red)' : 'var(--border)'}`,
      background: 'var(--bg-secondary)',
      padding: '0.75rem',
      flexShrink: 0,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: isThreat ? 'var(--accent-red)' : 'var(--accent-blue)' }}>
          {isThreat ? '⚠ THREAT DETECTED' : 'Connection Details'}
        </span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1rem' }}>×</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.25rem', fontSize: '0.7rem' }}>
        <Field label="Source" value={`${conn.src_ip}:${conn.src_port}`} />
        <Field label="Destination" value={`${conn.dst_ip}:${conn.dst_port}`} />
        <Field label="Protocol" value={conn.protocol} />
        <Field label="Bytes" value={`${conn.bytes.toLocaleString()} B`} />
        <Field label="Src Location" value={conn.src_country === 'LAN' ? 'Local Network' : `${conn.src_city || ''} ${conn.src_country || 'Unknown'}`} />
        <Field label="Dst Location" value={`${conn.dst_city || ''} ${conn.dst_country || 'Unknown'}`} />
        {isThreat && <Field label="Threat Type" value={conn.threat_type} threat />}
        {isThreat && <Field label="Score" value={`${(conn.threat_score * 100).toFixed(0)}%`} threat />}
        {conn.threat_desc && <Field label="Description" value={conn.threat_desc} threat />}
      </div>
    </div>
  );
}

function Field({ label, value, threat }: { label: string; value: string; threat?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: '0.5rem' }}>
      <span style={{ color: 'var(--text-muted)', minWidth: 80 }}>{label}:</span>
      <span style={{ color: threat ? 'var(--accent-red)' : 'var(--text-primary)', fontFamily: 'monospace' }}>{value}</span>
    </div>
  );
}
