import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import {
  Device,
  NetworkEvent,
  Alert,
  BaselineFeatures,
  TopologyData,
  SystemStatus,
  RouterRequestEvent,
  RouterTrafficSummary,
} from '../types';
import { api } from '../utils/api';

interface NetworkContextType {
  status: SystemStatus | null;
  devices: Device[];
  events: NetworkEvent[];
  alerts: Alert[];
  baseline: BaselineFeatures | null;
  topology: TopologyData | null;
  recentRouterRequests: RouterRequestEvent[];
  topologyTraffic: RouterTrafficSummary | null;
  selectedDevice: Device | null;
  setSelectedDevice: (device: Device | null) => void;
  quarantineTarget: Device | null;
  setQuarantineTarget: (device: Device | null) => void;
  isLoading: boolean;
  wsConnected: boolean;
  activeView: 'overview' | 'devices' | 'topology' | 'activity' | 'alerts' | 'security-lab' | 'settings';
  setActiveView: (view: 'overview' | 'devices' | 'topology' | 'activity' | 'alerts' | 'security-lab' | 'settings') => void;
  refreshAll: () => Promise<void>;
  updateDeviceTrust: (deviceId: string, trustStatus: string) => Promise<void>;
  resolveAlert: (alertId: string) => Promise<void>;
  triggerQuarantine: (deviceId: string, reason?: string) => Promise<void>;
  triggerRestore: (deviceId: string) => Promise<void>;
  startBaselineLearning: (durationSeconds?: number) => Promise<void>;
  runSecurityLabScenario: (scenario: 'new_device' | 'port_scan' | 'dns_anomaly' | 'traffic_spike' | 'ip_change', payload?: any) => Promise<any>;
  resetSecurityLab: () => Promise<void>;
  triggerDiscoveryScan: () => Promise<void>;
  detectDeviceOs: (deviceId: string) => Promise<{ device: Device; fingerprint: any }>;
  detectAllDevicesOs: () => Promise<{ count: number; devices: Device[] }>;
}

const NetworkContext = createContext<NetworkContextType | undefined>(undefined);

export const NetworkProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [events, setEvents] = useState<NetworkEvent[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [baseline, setBaseline] = useState<BaselineFeatures | null>(null);
  const [topology, setTopology] = useState<TopologyData | null>(null);
  const [recentRouterRequests, setRecentRouterRequests] = useState<RouterRequestEvent[]>([]);
  const [topologyTraffic, setTopologyTraffic] = useState<RouterTrafficSummary | null>(null);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [quarantineTarget, setQuarantineTarget] = useState<Device | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [wsConnected, setWsConnected] = useState(false);

  // Persist activeView across refreshes and hot reloads
  const [activeView, setActiveViewState] = useState<'overview' | 'devices' | 'topology' | 'activity' | 'alerts' | 'security-lab' | 'settings'>(() => {
    try {
      const saved = sessionStorage.getItem('sentinel_active_view') as any;
      if (saved && ['overview', 'devices', 'topology', 'activity', 'alerts', 'security-lab', 'settings'].includes(saved)) {
        return saved;
      }
    } catch {
      // ignore
    }
    return 'overview';
  });

  const setActiveView = useCallback((view: 'overview' | 'devices' | 'topology' | 'activity' | 'alerts' | 'security-lab' | 'settings') => {
    try {
      sessionStorage.setItem('sentinel_active_view', view);
    } catch {
      // ignore
    }
    setActiveViewState(view);
  }, []);

  // Stable data refresh function
  const refreshAll = useCallback(async () => {
    try {
      const [statusData, devicesData, eventsData, alertsData, baselineData, topoData] = await Promise.all([
        api.getStatus().catch(() => null),
        api.getDevices().catch(() => []),
        api.getEvents(100).catch(() => []),
        api.getAlerts().catch(() => []),
        api.getBaseline().catch(() => null),
        api.getTopology().catch(() => null),
      ]);

      if (statusData) setStatus(statusData);
      setDevices(devicesData);
      setEvents(eventsData);
      setAlerts(alertsData);
      if (baselineData) setBaseline(baselineData);
      if (topoData) setTopology(topoData);

      // Keep selected device synced if open without introducing dependency on selectedDevice
      setSelectedDevice((prev) => {
        if (!prev) return null;
        const found = devicesData.find((d) => d.id === prev.id);
        return found || prev;
      });
    } catch (err) {
      console.error('Failed to load initial data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  // WebSocket lifecycle refs
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);
  const isWsConnectedRef = useRef(false);

  // WebSocket live feed (strictly stable mount effect)
  useEffect(() => {
    isMountedRef.current = true;

    function handleWsMessage(message: { type: string; data: any }) {
      if (!isMountedRef.current) return;
      switch (message.type) {
        case 'system.status':
          setStatus(message.data);
          break;
        case 'event.created':
          setEvents((prev) => [message.data, ...prev.slice(0, 199)]);
          break;
        case 'alert.created':
          setAlerts((prev) => [message.data, ...prev]);
          break;
        case 'alert.resolved':
          setAlerts((prev) =>
            prev.map((a) => (a.id === message.data.id ? message.data : a))
          );
          break;
        case 'device.updated':
          setDevices((prev) => {
            const exists = prev.some((d) => d.id === message.data.id);
            if (exists) {
              return prev.map((d) => (d.id === message.data.id ? message.data : d));
            }
            return [message.data, ...prev];
          });
          setSelectedDevice((current) =>
            current && current.id === message.data.id ? message.data : current
          );
          break;
        case 'baseline.updated':
          setBaseline(message.data);
          break;
        case 'topology.updated':
          setTopology(message.data);
          break;
        case 'router.request':
          setRecentRouterRequests((prev) => [message.data, ...prev.slice(0, 49)]);
          break;
        case 'topology.traffic':
          setTopologyTraffic(message.data);
          setTopology((prev) => (prev ? { ...prev, trafficSummary: message.data } : prev));
          break;
      }
    }

    function connect() {
      if (!isMountedRef.current) return;
      if (
        wsRef.current &&
        (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)
      ) {
        return;
      }

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;

      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          if (!isMountedRef.current) return;
          isWsConnectedRef.current = true;
          setWsConnected(true);
        };

        ws.onmessage = (evt) => {
          if (!isMountedRef.current) return;
          try {
            const message = JSON.parse(evt.data);
            handleWsMessage(message);
          } catch {
            // Ignore parse errors
          }
        };

        ws.onclose = () => {
          if (!isMountedRef.current) return;
          isWsConnectedRef.current = false;
          setWsConnected(false);
          wsRef.current = null;
          if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = setTimeout(connect, 3000);
        };

        ws.onerror = () => {
          if (!isMountedRef.current) return;
          isWsConnectedRef.current = false;
          setWsConnected(false);
          try {
            ws.close();
          } catch {
            // ignore
          }
        };
      } catch {
        if (!isMountedRef.current) return;
        isWsConnectedRef.current = false;
        setWsConnected(false);
        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = setTimeout(connect, 3000);
      }
    }

    connect();

    // Fallback periodic poll in case websocket is disconnected
    const pollInterval = setInterval(() => {
      if (!isWsConnectedRef.current && isMountedRef.current) {
        refreshAll();
      }
    }, 5000);

    return () => {
      isMountedRef.current = false;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      clearInterval(pollInterval);
      if (wsRef.current) {
        // Disarm handlers so closing during unmount does not trigger callbacks
        wsRef.current.onopen = null;
        wsRef.current.onmessage = null;
        wsRef.current.onerror = null;
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [refreshAll]);

  const updateDeviceTrust = async (deviceId: string, trustStatus: string) => {
    const updated = await api.updateTrustStatus(deviceId, trustStatus);
    setDevices((prev) => prev.map((d) => (d.id === deviceId ? updated : d)));
    if (selectedDevice?.id === deviceId) {
      setSelectedDevice(updated);
    }
  };

  const resolveAlert = async (alertId: string) => {
    const updated = await api.resolveAlert(alertId);
    setAlerts((prev) => prev.map((a) => (a.id === alertId ? updated : a)));
  };

  const triggerQuarantine = async (deviceId: string, reason?: string) => {
    await api.quarantineDevice(deviceId, reason);
    await refreshAll();
  };

  const triggerRestore = async (deviceId: string) => {
    await api.restoreDevice(deviceId);
    await refreshAll();
  };

  const startBaselineLearning = async (durationSeconds = 15) => {
    await api.startLearning(durationSeconds);
  };

  const runSecurityLabScenario = async (
    scenario: 'new_device' | 'port_scan' | 'dns_anomaly' | 'traffic_spike' | 'ip_change',
    payload?: any
  ) => {
    const res = await api.triggerSecurityLabScenario(scenario, payload);
    await refreshAll();
    return res;
  };

  const resetSecurityLab = async () => {
    await api.resetSecurityLab();
    await refreshAll();
  };

  const triggerDiscoveryScan = async () => {
    await api.triggerScan();
    await refreshAll();
  };

  const detectDeviceOs = async (deviceId: string) => {
    const res = await api.detectDeviceOs(deviceId);
    await refreshAll();
    return res;
  };

  const detectAllDevicesOs = async () => {
    const res = await api.detectAllDevicesOs();
    await refreshAll();
    return res;
  };

  return (
    <NetworkContext.Provider
      value={{
        status,
        devices,
        events,
        alerts,
        baseline,
        topology,
        recentRouterRequests,
        topologyTraffic,
        selectedDevice,
        setSelectedDevice,
        quarantineTarget,
        setQuarantineTarget,
        isLoading,
        wsConnected,
        activeView,
        setActiveView,
        refreshAll,
        updateDeviceTrust,
        resolveAlert,
        triggerQuarantine,
        triggerRestore,
        startBaselineLearning,
        runSecurityLabScenario,
        resetSecurityLab,
        triggerDiscoveryScan,
        detectDeviceOs,
        detectAllDevicesOs,
      }}
    >
      {children}
    </NetworkContext.Provider>
  );
};

export const useNetwork = () => {
  const context = useContext(NetworkContext);
  if (!context) {
    throw new Error('useNetwork must be used within a NetworkProvider');
  }
  return context;
};
