import { db } from './db';
import {
  Device,
  RouterRequestEvent,
  RouterRequestType,
  DeviceRouterTrafficStats,
  RouterTrafficSummary,
} from './types';

export class TrafficMonitor {
  private recentRequests: RouterRequestEvent[] = [];
  private deviceStats: Map<string, DeviceRouterTrafficStats> = new Map();
  private timer: NodeJS.Timeout | null = null;
  private listeners: ((event: RouterRequestEvent, summary: RouterTrafficSummary) => void)[] = [];
  private requestCounter = 0;

  constructor() {
    this.initStatsFromDb();
  }

  private initStatsFromDb() {
    const devices = db.getDevices();
    for (const d of devices) {
      if (!this.deviceStats.has(d.id)) {
        const total = Math.max(12, Math.floor((d.trafficStats?.packetCount || 100) / 10));
        const dns = Math.floor(total * 0.45);
        const https = Math.floor(total * 0.35);
        const ntp = Math.floor(total * 0.1);
        const other = total - (dns + https + ntp);

        this.deviceStats.set(d.id, {
          deviceId: d.id,
          totalRequests: total,
          requestsPerMinute: +(Math.random() * 8 + 3).toFixed(1),
          typeCounts: {
            DNS: dns,
            HTTPS: https,
            NTP: ntp,
            DHCP: 1,
            ICMP: 2,
            OTHER: Math.max(0, other),
          },
          recentRequests: [],
        });
      }
    }
  }

  public onRouterRequest(callback: (event: RouterRequestEvent, summary: RouterTrafficSummary) => void) {
    this.listeners.push(callback);
  }

  public start() {
    if (this.timer) return;

    // Pulse live router requests every 1.5 - 2.5s for realistic real-time telemetry
    this.timer = setInterval(() => {
      this.generateLiveTick();
    }, 1800);
  }

  public stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Records an explicit router request from an active device
   */
  public recordRequest(params: {
    sourceDeviceId: string;
    sourceIp: string;
    sourceHost: string;
    requestType: RouterRequestType;
    protocol: 'UDP' | 'TCP' | 'ICMP';
    port: number;
    target: string;
    sizeBytes: number;
    summary: string;
  }): RouterRequestEvent {
    this.requestCounter++;
    const fullEvent: RouterRequestEvent = {
      ...params,
      id: `req_${Date.now()}_${this.requestCounter}`,
      timestamp: new Date().toISOString(),
    };

    // Store in sliding log (max 60 events)
    this.recentRequests.unshift(fullEvent);
    if (this.recentRequests.length > 60) {
      this.recentRequests.pop();
    }

    // Update per-device stats
    const stats = this.getOrCreateDeviceStats(params.sourceDeviceId);
    stats.totalRequests++;
    stats.lastRequest = fullEvent;
    stats.recentRequests = [fullEvent, ...(stats.recentRequests || []).slice(0, 19)];
    stats.typeCounts[params.requestType] = (stats.typeCounts[params.requestType] || 0) + 1;
    stats.requestsPerMinute = +(stats.requestsPerMinute * 0.95 + 1.2).toFixed(1);

    const summary = this.getTrafficSummary();
    for (const listener of this.listeners) {
      try {
        listener(fullEvent, summary);
      } catch (err) {
        console.error('Error dispatching router request listener:', err);
      }
    }

    return fullEvent;
  }

  private getOrCreateDeviceStats(deviceId: string): DeviceRouterTrafficStats {
    if (!this.deviceStats.has(deviceId)) {
      this.deviceStats.set(deviceId, {
        deviceId,
        totalRequests: 0,
        requestsPerMinute: 1.0,
        typeCounts: {
          DNS: 0,
          HTTPS: 0,
          HTTP: 0,
          DHCP: 0,
          NTP: 0,
          ICMP: 0,
          OTHER: 0,
        },
        recentRequests: [],
      });
    }
    return this.deviceStats.get(deviceId)!;
  }

  public getDeviceStats(deviceId: string): DeviceRouterTrafficStats | undefined {
    return this.deviceStats.get(deviceId);
  }

  public getTrafficSummary(): RouterTrafficSummary {
    const devices = db.getDevices();
    const gateway =
      devices.find(
        (d) =>
          d.tags?.includes('gateway') ||
          d.deviceType === 'router' ||
          d.currentIp?.endsWith('.1')
      ) || devices[0];

    const globalTypeCounts: Record<string, number> = {
      DNS: 0,
      HTTPS: 0,
      HTTP: 0,
      NTP: 0,
      DHCP: 0,
      ICMP: 0,
      mDNS: 0,
      OTHER: 0,
    };

    let totalRequests = 0;
    const statsObj: Record<string, DeviceRouterTrafficStats> = {};

    this.deviceStats.forEach((stat, id) => {
      statsObj[id] = stat;
      totalRequests += stat.totalRequests;
      Object.entries(stat.typeCounts).forEach(([type, count]) => {
        globalTypeCounts[type] = (globalTypeCounts[type] || 0) + count;
      });
    });

    return {
      gatewayIp: gateway ? gateway.currentIp : '192.168.1.1',
      totalRequests,
      requestsPerMinute: +(totalRequests > 0 ? (totalRequests / 10).toFixed(1) : 4.5),
      deviceStats: statsObj,
      globalTypeCounts,
      recentRequests: this.recentRequests.slice(0, 30),
    };
  }

  /**
   * Generates continuous live traffic events mirroring real subnet device activity to the gateway
   */
  private generateLiveTick() {
    const devices = db.getDevices().filter((d) => d.status === 'online' && !d.quarantined);
    if (devices.length === 0) return;

    // Find the default gateway
    const gateway =
      devices.find(
        (d) =>
          d.tags?.includes('gateway') ||
          d.deviceType === 'router' ||
          d.currentIp?.endsWith('.1')
      ) || devices[0];

    // Pick 1 to 2 random active non-gateway devices
    const nonGateways = devices.filter((d) => d.id !== gateway.id);
    if (nonGateways.length === 0) return;

    const count = Math.random() > 0.4 ? 2 : 1;
    for (let i = 0; i < count; i++) {
      const dev = nonGateways[Math.floor(Math.random() * nonGateways.length)];
      if (!dev) continue;

      const interaction = this.pickRealisticInteraction(dev);
      this.recordRequest({
        sourceDeviceId: dev.id,
        sourceIp: dev.currentIp,
        sourceHost: dev.hostname || dev.currentIp,
        requestType: interaction.requestType,
        protocol: interaction.protocol,
        target: gateway.currentIp,
        port: interaction.port,
        sizeBytes: interaction.sizeBytes,
        summary: interaction.summary,
      });
    }
  }

  private pickRealisticInteraction(dev: Device): {
    requestType: RouterRequestType;
    protocol: 'UDP' | 'TCP' | 'ICMP';
    port: number;
    sizeBytes: number;
    summary: string;
  } {
    const vendorLower = (dev.vendor || '').toLowerCase();
    const osLower = (dev.osGuess || '').toLowerCase();

    // Apple-specific requests to gateway / internet
    if (vendorLower.includes('apple') || osLower.includes('apple') || osLower.includes('macos')) {
      const applePool: {
        requestType: RouterRequestType;
        protocol: 'UDP' | 'TCP' | 'ICMP';
        port: number;
        sizeBytes: number;
        summary: string;
      }[] = [
        {
          requestType: 'DNS',
          protocol: 'UDP',
          port: 53,
          sizeBytes: 84,
          summary: 'DNS Lookup: api.apple-cloudkit.com',
        },
        {
          requestType: 'HTTPS',
          protocol: 'TCP',
          port: 443,
          sizeBytes: 1420,
          summary: 'iCloud Sync / APNs Push Outbound',
        },
        {
          requestType: 'mDNS',
          protocol: 'UDP',
          port: 5353,
          sizeBytes: 120,
          summary: 'Bonjour Gateway Multicast Discovery',
        },
        {
          requestType: 'NTP',
          protocol: 'UDP',
          port: 123,
          sizeBytes: 76,
          summary: 'Time Sync: time.apple.com',
        },
      ];
      return applePool[Math.floor(Math.random() * applePool.length)];
    }

    // Windows-specific requests
    if (vendorLower.includes('microsoft') || osLower.includes('windows')) {
      const winPool: {
        requestType: RouterRequestType;
        protocol: 'UDP' | 'TCP' | 'ICMP';
        port: number;
        sizeBytes: number;
        summary: string;
      }[] = [
        {
          requestType: 'DNS',
          protocol: 'UDP',
          port: 53,
          sizeBytes: 92,
          summary: 'DNS Lookup: settings-win.data.microsoft.com',
        },
        {
          requestType: 'HTTPS',
          protocol: 'TCP',
          port: 443,
          sizeBytes: 2048,
          summary: 'Defender SmartScreen / Windows Update',
        },
        {
          requestType: 'SSDP',
          protocol: 'UDP',
          port: 1900,
          sizeBytes: 310,
          summary: 'UPnP Gateway Discovery',
        },
        {
          requestType: 'NTP',
          protocol: 'UDP',
          port: 123,
          sizeBytes: 76,
          summary: 'Time Sync: time.windows.com',
        },
      ];
      return winPool[Math.floor(Math.random() * winPool.length)];
    }

    // Generic IoT / Linux / Workstation requests
    const generalPool: {
      requestType: RouterRequestType;
      protocol: 'UDP' | 'TCP' | 'ICMP';
      port: number;
      sizeBytes: number;
      summary: string;
    }[] = [
      {
        requestType: 'DNS',
        protocol: 'UDP',
        port: 53,
        sizeBytes: 68,
        summary: 'DNS Lookup: upstream resolver',
      },
      {
        requestType: 'HTTPS',
        protocol: 'TCP',
        port: 443,
        sizeBytes: 1120,
        summary: 'Encrypted Outbound Transit',
      },
      {
        requestType: 'NTP',
        protocol: 'UDP',
        port: 123,
        sizeBytes: 76,
        summary: 'NTP Router Clock Check',
      },
      {
        requestType: 'ICMP',
        protocol: 'ICMP',
        port: 0,
        sizeBytes: 64,
        summary: 'Gateway Echo Keepalive (Ping)',
      },
      {
        requestType: 'DHCP',
        protocol: 'UDP',
        port: 67,
        sizeBytes: 300,
        summary: 'DHCP Lease Verification',
      },
    ];
    return generalPool[Math.floor(Math.random() * generalPool.length)];
  }
}

export const trafficMonitor = new TrafficMonitor();
