import {
  Device,
  NetworkEvent,
  Alert,
  BaselineFeatures,
  TopologyData,
  SystemStatus,
  ResponseResult,
  NetworkInterfaceInfo,
} from '../types';

export const api = {
  async getStatus(): Promise<SystemStatus> {
    const res = await fetch('/api/status');
    if (!res.ok) throw new Error('Failed to fetch system status');
    return res.json();
  },

  async getInterfaces(): Promise<NetworkInterfaceInfo[]> {
    const res = await fetch('/api/interfaces');
    if (!res.ok) throw new Error('Failed to fetch network interfaces');
    return res.json();
  },

  async selectInterface(interfaceName: string, autoUpdateSubnet = true): Promise<{ success: boolean; status: SystemStatus }> {
    const res = await fetch('/api/interfaces/select', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ interfaceName, autoUpdateSubnet }),
    });
    if (!res.ok) throw new Error('Failed to select network interface');
    return res.json();
  },

  async toggleMonitoring(enabled?: boolean): Promise<{ active: boolean; mode: string; status?: SystemStatus }> {
    const res = await fetch('/api/monitoring/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(enabled !== undefined ? { enabled } : {}),
    });
    if (!res.ok) throw new Error('Failed to toggle monitoring mode');
    return res.json();
  },

  async getDevices(): Promise<Device[]> {
    const res = await fetch('/api/devices');
    if (!res.ok) throw new Error('Failed to fetch devices');
    return res.json();
  },

  async getDevice(id: string): Promise<Device> {
    const res = await fetch(`/api/devices/${id}`);
    if (!res.ok) throw new Error(`Failed to fetch device ${id}`);
    return res.json();
  },

  async updateTrustStatus(id: string, trustStatus: string): Promise<Device> {
    const res = await fetch(`/api/devices/${id}/trust`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trustStatus }),
    });
    if (!res.ok) throw new Error('Failed to update trust status');
    return res.json();
  },

  async updateDeviceName(id: string, customName: string): Promise<Device> {
    const res = await fetch(`/api/devices/${id}/name`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customName }),
    });
    if (!res.ok) throw new Error('Failed to update device name');
    return res.json();
  },

  async updateDeviceStatus(id: string, status: 'online' | 'offline'): Promise<Device> {
    const res = await fetch(`/api/devices/${id}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) throw new Error('Failed to update device status');
    return res.json();
  },

  async quarantineDevice(id: string, reason?: string): Promise<ResponseResult> {
    const res = await fetch(`/api/devices/${id}/quarantine`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Quarantine failed' }));
      throw new Error(err.error || 'Failed to quarantine device');
    }
    return res.json();
  },

  async restoreDevice(id: string): Promise<ResponseResult> {
    const res = await fetch(`/api/devices/${id}/restore`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Failed to restore device');
    return res.json();
  },

  async getEvents(limit = 100): Promise<NetworkEvent[]> {
    const res = await fetch(`/api/events?limit=${limit}`);
    if (!res.ok) throw new Error('Failed to fetch network events');
    return res.json();
  },

  async clearEvents(): Promise<void> {
    const res = await fetch('/api/events/clear', {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Failed to clear network events');
  },

  async getAlerts(): Promise<Alert[]> {
    const res = await fetch('/api/alerts');
    if (!res.ok) throw new Error('Failed to fetch alerts');
    return res.json();
  },

  async resolveAlert(id: string): Promise<Alert> {
    const res = await fetch(`/api/alerts/${id}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resolvedBy: 'Operator' }),
    });
    if (!res.ok) throw new Error('Failed to resolve alert');
    return res.json();
  },

  async getTopology(): Promise<TopologyData> {
    const res = await fetch('/api/topology');
    if (!res.ok) throw new Error('Failed to fetch topology');
    return res.json();
  },

  async getBaseline(): Promise<BaselineFeatures> {
    const res = await fetch('/api/baseline');
    if (!res.ok) throw new Error('Failed to fetch baseline');
    return res.json();
  },

  async startLearning(durationSeconds = 15, isIndefinite = false): Promise<void> {
    const res = await fetch('/api/baseline/start-learning', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        durationSeconds: isIndefinite ? 0 : durationSeconds,
        indefinite: isIndefinite,
      }),
    });
    if (!res.ok) throw new Error('Failed to start learning');
  },

  async finishLearning(): Promise<BaselineFeatures> {
    const res = await fetch('/api/baseline/finish-learning', {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Failed to finish learning');
    return res.json();
  },

  async triggerSecurityLabScenario(
    scenario: 'new_device' | 'port_scan' | 'dns_anomaly' | 'traffic_spike' | 'ip_change',
    payload?: { targetDeviceId?: string; customName?: string }
  ): Promise<any> {
    const res = await fetch('/api/security-lab/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario, ...payload }),
    });
    if (!res.ok) throw new Error('Failed to trigger scenario');
    return res.json();
  },

  async resetSecurityLab(): Promise<void> {
    const res = await fetch('/api/security-lab/reset', {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Failed to reset security lab');
  },

  async getSettings(): Promise<any> {
    const res = await fetch('/api/settings');
    if (!res.ok) throw new Error('Failed to fetch settings');
    return res.json();
  },

  async updateSettings(settings: any): Promise<any> {
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    if (!res.ok) throw new Error('Failed to update settings');
    return res.json();
  },

  async triggerScan(durationSeconds?: number, isIndefinite = false): Promise<{ count: number; devices: Device[]; durationSeconds?: number }> {
    const sec = isIndefinite ? 0 : (durationSeconds !== undefined ? Math.max(0, durationSeconds) : undefined);
    const res = await fetch('/api/discovery/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ durationSeconds: sec, indefinite: isIndefinite }),
    });
    if (!res.ok) throw new Error('Failed to trigger discovery scan');
    return res.json();
  },

  async detectDeviceOs(deviceId: string): Promise<{ device: Device; fingerprint: any }> {
    const res = await fetch(`/api/devices/${deviceId}/detect-os`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Failed to detect device OS');
    return res.json();
  },

  async detectAllDevicesOs(): Promise<{ count: number; devices: Device[] }> {
    const res = await fetch('/api/discovery/detect-all-os', {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Failed to run OS fingerprinting across all devices');
    return res.json();
  },

  async reportClientNetwork(details: {
    connectionState: 'wifi' | 'ethernet' | 'both' | 'offline';
    isOnline: boolean;
    hasEthernet: boolean;
    hasWifi: boolean;
    networkType?: string;
  }): Promise<{ success: boolean; status: SystemStatus }> {
    try {
      const res = await fetch('/api/client-network', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(details),
      });
      if (!res.ok) throw new Error('Failed to report client network status');
      return res.json();
    } catch (e: any) {
      // Return fallback
      return { success: false, status: null as any };
    }
  },
};
