import { useState } from 'react';
import { Search, AlertTriangle, Plus } from 'lucide-react';
import type { Connection } from '../types';

function formatTime(ts: number): string {
  return new Date(ts * 1000).toLocaleString('en-US', { hour12: false });
}

function formatBytes(b: number): string {
  if (b < 1024) return `${b}B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)}KB`;
  return `${(b / 1048576).toFixed(1)}MB`;
}

const EXAMPLE_QUERIES = [
  'port_scan', 'reverse_shell', 'DNS', 'RDP', '4444', 'US', 'CN', 'HTTPS', 'tor',
];

export default function HuntPanel() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Connection[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [selectedResult, setSelectedResult] = useState<Connection | null>(null);

  // Threat intel
  const [intelIP, setIntelIP] = useState('');
  const [intelType, setIntelType] = useState('malware');
  const [intelList, setIntelList] = useState<Array<{ip: string; type: string; confidence: number}>>([]);
  const [showIntel, setShowIntel] = useState(false);

  async function search() {
    if (!query.trim()) return;
    setIsLoading(true);
    setSearched(true);
    try {
      const r = await fetch(`/api/hunt?q=${encodeURIComponent(query)}&limit=200`);
      const data = await r.json();
      setResults(data.results || []);
    } catch {
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }

  async function loadIntel() {
    try {
      const r = await fetch('/api/threat_intel');
      const data = await r.json();
      setIntelList(data.intel || []);
    } catch { /* ignore */ }
  }

  async function addIntel() {
    if (!intelIP.trim()) return;
    try {
      await fetch(`/api/threat_intel/add?ip=${encodeURIComponent(intelIP)}&threat_type=${encodeURIComponent(intelType)}`, {
        method: 'POST',
      });
      setIntelIP('');
      await loadIntel();
    } catch { /* ignore */ }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Search bar */}
      <div style={{
        padding: '0.75rem', background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border)', flexShrink: 0,
      }}>
        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
          Search across IPs, protocols, countries, threat types, ports...
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && search()}
            placeholder="e.g.: 8.8.8.8  |  port_scan  |  CN  |  HTTPS  |  4444"
            style={{
              flex: 1, background: 'var(--bg-card)', border: '1px solid var(--border)',
              color: 'var(--text-primary)', padding: '0.4rem 0.75rem',
              borderRadius: 6, fontSize: '0.75rem', fontFamily: 'monospace',
            }}
          />
          <button
            onClick={search}
            disabled={isLoading}
            style={{
              padding: '0.4rem 1rem', background: 'rgba(0,212,255,0.15)',
              border: '1px solid var(--accent-blue)', color: 'var(--accent-blue)',
              borderRadius: 6, cursor: 'pointer', fontSize: '0.75rem', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', gap: '0.35rem',
            }}
          >
            <Search size={14} />
            {isLoading ? 'Searching...' : 'Hunt'}
          </button>
          <button
            onClick={() => { setShowIntel(!showIntel); loadIntel(); }}
            style={{
              padding: '0.4rem 0.75rem', background: showIntel ? 'rgba(139,92,246,0.15)' : 'transparent',
              border: `1px solid ${showIntel ? 'var(--accent-purple)' : 'var(--border)'}`,
              color: showIntel ? 'var(--accent-purple)' : 'var(--text-muted)',
              borderRadius: 6, cursor: 'pointer', fontSize: '0.7rem', fontFamily: 'inherit',
            }}
          >
            Threat Intel
          </button>
        </div>

        {/* Example queries */}
        <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.4rem', flexWrap: 'wrap' }}>
          {EXAMPLE_QUERIES.map(q => (
            <button
              key={q}
              onClick={() => { setQuery(q); }}
              style={{
                padding: '2px 8px', borderRadius: 4, fontSize: '0.6rem',
                background: 'rgba(0,212,255,0.08)', color: 'var(--accent-blue)',
                border: '1px solid rgba(0,212,255,0.2)', cursor: 'pointer', fontFamily: 'monospace',
              }}
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Results */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {/* Threat intel panel */}
          {showIntel && (
            <div style={{
              padding: '0.75rem', background: 'rgba(139,92,246,0.05)',
              borderBottom: '1px solid var(--border)',
            }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--accent-purple)' }}>
                THREAT INTELLIGENCE — Add known malicious IPs
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <input
                  value={intelIP}
                  onChange={e => setIntelIP(e.target.value)}
                  placeholder="IP address"
                  style={{
                    flex: 1, background: 'var(--bg-card)', border: '1px solid var(--border)',
                    color: 'var(--text-primary)', padding: '0.3rem 0.5rem',
                    borderRadius: 4, fontSize: '0.7rem', fontFamily: 'monospace',
                  }}
                />
                <select
                  value={intelType}
                  onChange={e => setIntelType(e.target.value)}
                  style={{
                    background: 'var(--bg-card)', border: '1px solid var(--border)',
                    color: 'var(--text-primary)', padding: '0.3rem 0.5rem',
                    borderRadius: 4, fontSize: '0.7rem', fontFamily: 'inherit',
                  }}
                >
                  <option value="malware">Malware</option>
                  <option value="c2">C2 Server</option>
                  <option value="botnet">Botnet</option>
                  <option value="scanner">Scanner</option>
                  <option value="tor_exit">Tor Exit</option>
                  <option value="phishing">Phishing</option>
                </select>
                <button
                  onClick={addIntel}
                  style={{
                    padding: '0.3rem 0.75rem', background: 'rgba(139,92,246,0.2)',
                    border: '1px solid var(--accent-purple)', color: 'var(--accent-purple)',
                    borderRadius: 4, cursor: 'pointer', fontSize: '0.7rem', fontFamily: 'inherit',
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}
                >
                  <Plus size={12} /> Add
                </button>
              </div>
              {intelList.length > 0 && (
                <div style={{ maxHeight: 120, overflowY: 'auto' }}>
                  {intelList.map(item => (
                    <div key={item.ip} style={{
                      display: 'flex', justifyContent: 'space-between',
                      fontSize: '0.65rem', padding: '2px 0', color: 'var(--text-muted)',
                      borderBottom: '1px solid rgba(30,58,95,0.3)',
                    }}>
                      <span style={{ fontFamily: 'monospace', color: '#c4b5fd' }}>{item.ip}</span>
                      <span>{item.type}</span>
                      <span>{(item.confidence * 100).toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {!searched ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <Search size={40} style={{ opacity: 0.2, marginBottom: '0.5rem' }} />
              <div style={{ fontSize: '0.85rem' }}>Enter a query and press Hunt</div>
              <div style={{ fontSize: '0.7rem', marginTop: '0.25rem', opacity: 0.6 }}>
                Search by IP, protocol, country code, threat type, or port number
              </div>
            </div>
          ) : results.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              No results for "{query}"
            </div>
          ) : (
            <div>
              <div style={{
                padding: '0.4rem 0.75rem', background: 'var(--bg-secondary)',
                borderBottom: '1px solid var(--border)',
                fontSize: '0.65rem', color: 'var(--text-muted)',
              }}>
                {results.length} results for "{query}"
              </div>
              {results.map(conn => (
                <HuntResultRow
                  key={conn.id}
                  conn={conn}
                  selected={selectedResult?.id === conn.id}
                  onClick={() => setSelectedResult(selectedResult?.id === conn.id ? null : conn)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Detail sidebar */}
        {selectedResult && (
          <div style={{
            width: 260, borderLeft: '1px solid var(--border)',
            padding: '0.75rem', overflowY: 'auto', flexShrink: 0,
            fontSize: '0.7rem',
          }}>
            <div style={{ fontWeight: 600, marginBottom: '0.5rem', color: 'var(--accent-blue)' }}>
              Connection Detail
            </div>
            {[
              ['Time', formatTime(selectedResult.timestamp)],
              ['Src IP', selectedResult.src_ip],
              ['Src Port', String(selectedResult.src_port)],
              ['Dst IP', selectedResult.dst_ip],
              ['Dst Port', String(selectedResult.dst_port)],
              ['Protocol', selectedResult.protocol],
              ['Bytes', formatBytes(selectedResult.bytes)],
              ['Src Country', selectedResult.src_country || 'Unknown'],
              ['Dst Country', selectedResult.dst_country || 'Unknown'],
              ['Dst City', selectedResult.dst_city || 'Unknown'],
              ['Threat', selectedResult.is_threat ? 'YES' : 'No'],
              ...(selectedResult.is_threat ? [
                ['Threat Type', selectedResult.threat_type],
                ['Threat Score', `${(selectedResult.threat_score * 100).toFixed(0)}%`],
              ] : []),
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.25rem', padding: '0.15rem 0', borderBottom: '1px solid rgba(30,58,95,0.3)' }}>
                <span style={{ color: 'var(--text-muted)', minWidth: 80 }}>{k}</span>
                <span style={{
                  color: k === 'Threat' && v === 'YES' ? 'var(--accent-red)' :
                         k === 'Threat Type' ? 'var(--accent-orange)' :
                         'var(--text-primary)',
                  fontFamily: 'monospace', wordBreak: 'break-all',
                }}>{v}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function HuntResultRow({ conn, selected, onClick }: { conn: Connection; selected: boolean; onClick: () => void }) {
  const isThreat = conn.is_threat === 1;
  return (
    <div
      onClick={onClick}
      style={{
        padding: '0.4rem 0.75rem',
        borderBottom: '1px solid rgba(30,58,95,0.4)',
        cursor: 'pointer',
        background: selected ? 'rgba(0,212,255,0.06)' : isThreat ? 'rgba(255,51,102,0.04)' : 'transparent',
        borderLeft: isThreat ? '3px solid var(--accent-red)' : selected ? '3px solid var(--accent-blue)' : '3px solid transparent',
        display: 'grid',
        gridTemplateColumns: '130px 1fr 10px 1fr 55px 45px',
        gap: '0.4rem',
        alignItems: 'center',
        fontSize: '0.7rem',
        fontFamily: 'monospace',
      }}
    >
      <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>
        {new Date(conn.timestamp * 1000).toLocaleString('en-US', { hour12: false, month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
      </span>
      <span style={{ color: '#93c5fd', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {isThreat && <AlertTriangle size={9} style={{ display: 'inline', marginRight: 3, color: 'var(--accent-red)' }} />}
        {conn.src_ip}
      </span>
      <span style={{ color: 'var(--text-muted)' }}>→</span>
      <span style={{ color: isThreat ? '#fca5a5' : '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {conn.dst_ip} {conn.dst_country ? `(${conn.dst_country})` : ''}
      </span>
      <span style={{ fontSize: '0.6rem', color: '#64748b' }}>{conn.protocol}</span>
      <span style={{ color: isThreat ? 'var(--accent-red)' : 'var(--text-muted)', fontSize: '0.65rem', textAlign: 'right' }}>
        {isThreat ? conn.threat_type : `:${conn.dst_port}`}
      </span>
    </div>
  );
}
