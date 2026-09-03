import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  Device,
  NetworkEvent,
  Alert,
  BaselineFeatures,
  TopologyData,
  SystemStatus,
} from '../types';
import { api } from '../utils/api';

interface NetworkContextType {
  status: SystemStatus | null;
  devices: Device[];
  events: NetworkEvent[];
  alerts: Alert[];
  baseline: BaselineFeatures | null;
  topology: TopologyData | null;
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
}

const NetworkContext = createContext<NetworkContextType | undefined>(undefined);

export const NetworkProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [events, setEvents] = useState<NetworkEvent[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [baseline, setBaseline] = useState<BaselineFeatures | null>(null);
  const [topology, setTopology] = useState<TopologyData | null>(null);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [quarantineTarget, setQuarantineTarget] = useState<Device | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [wsConnected, setWsConnected] = useState(false);
  const [activeView, setActiveView] = useState<'overview' | 'devices' | 'topology' | 'activity' | 'alerts' | 'security-lab' | 'settings'>('overview');

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

      // Keep selected device synced if open
      if (selectedDevice) {
        const found = devicesData.find((d) => d.id === selectedDevice.id);
        if (found) setSelectedDevice(found);
      }
    } catch (err) {
      console.error('Failed to load initial data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedDevice]);

  // Initial load
  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  // WebSocket live feed
  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;

    function connect() {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;

      try {
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          setWsConnected(true);
        };

        ws.onmessage = (evt) => {
          try {
            const message = JSON.parse(evt.data);
            handleWsMessage(message);
          } catch {
            // Ignore parse errors
          }
        };

        ws.onclose = () => {
          setWsConnected(false);
          reconnectTimeout = setTimeout(connect, 3000);
        };

        ws.onerror = () => {
          setWsConnected(false);
          if (ws) ws.close();
        };
      } catch {
        setWsConnected(false);
        reconnectTimeout = setTimeout(connect, 3000);
      }
    }

    function handleWsMessage(message: { type: string; data: any }) {
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
      }
    }

    connect();

    // Fallback periodic poll in case websocket is disconnected
    const pollInterval = setInterval(() => {
      if (!wsConnected) {
        refreshAll();
      }
    }, 5000);

    return () => {
      if (ws) ws.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      clearInterval(pollInterval);
    };
  }, [wsConnected, refreshAll]);

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

  return (
    <NetworkContext.Provider
      value={{
        status,
        devices,
        events,
        alerts,
        baseline,
        topology,
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
