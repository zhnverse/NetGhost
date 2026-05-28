import { create } from 'zustand';
import type { Connection, Threat, Status } from './types';

const MAX_CONNECTIONS = 500;
const MAX_THREATS = 100;

interface NetGhostStore {
  connections: Connection[];
  threats: Threat[];
  status: Status | null;
  isConnected: boolean;
  isDemoMode: boolean;
  selectedConnection: Connection | null;
  activeTab: string;

  addConnection: (conn: Connection) => void;
  addThreat: (threat: Threat) => void;
  setStatus: (s: Status) => void;
  setConnected: (v: boolean) => void;
  setDemoMode: (v: boolean) => void;
  selectConnection: (c: Connection | null) => void;
  setActiveTab: (t: string) => void;
  clearAll: () => void;
}

export const useStore = create<NetGhostStore>((set) => ({
  connections: [],
  threats: [],
  status: null,
  isConnected: false,
  isDemoMode: false,
  selectedConnection: null,
  activeTab: 'globe',

  addConnection: (conn) =>
    set((state) => ({
      connections: [conn, ...state.connections].slice(0, MAX_CONNECTIONS),
    })),

  addThreat: (threat) =>
    set((state) => ({
      threats: [threat, ...state.threats].slice(0, MAX_THREATS),
    })),

  setStatus: (s) => set({ status: s }),
  setConnected: (v) => set({ isConnected: v }),
  setDemoMode: (v) => set({ isDemoMode: v }),
  selectConnection: (c) => set({ selectedConnection: c }),
  setActiveTab: (t) => set({ activeTab: t }),
  clearAll: () => set({ connections: [], threats: [] }),
}));
