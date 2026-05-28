import { useEffect, useRef } from 'react';
import { useStore } from '../store';
import type { Connection } from '../types';

const WS_URL = `ws://${window.location.host}/ws`;
const RECONNECT_DELAY = 3000;

export function useWebSocket() {
  const { addConnection, addThreat, setConnected, setDemoMode } = useStore();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    function connect() {
      if (!mountedRef.current) return;

      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!mountedRef.current) return;
        setConnected(true);
        console.log('[WS] Connected');
      };

      ws.onmessage = (e) => {
        if (!mountedRef.current) return;
        try {
          const data = JSON.parse(e.data);
          if (data.type === 'ping') return;
          if (data.type === 'connection') {
            const conn = data as Connection;
            addConnection(conn);
            if (conn.is_demo) setDemoMode(true);
            if (conn.is_threat) {
              addThreat({
                id: conn.id,
                timestamp: conn.timestamp,
                ip: conn.dst_ip,
                threat_type: conn.threat_type,
                description: conn.threat_desc || conn.threat_type,
                severity: conn.threat_score > 0.7 ? 'high' : conn.threat_score > 0.4 ? 'medium' : 'low',
                connection_id: conn.id,
              });
            }
          }
        } catch {
          // ignore parse errors
        }
      };

      ws.onerror = () => {
        ws.close();
      };

      ws.onclose = () => {
        if (!mountedRef.current) return;
        setConnected(false);
        console.log('[WS] Disconnected, reconnecting...');
        reconnectRef.current = setTimeout(connect, RECONNECT_DELAY);
      };
    }

    connect();

    return () => {
      mountedRef.current = false;
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      wsRef.current?.close();
    };
  }, []);
}
