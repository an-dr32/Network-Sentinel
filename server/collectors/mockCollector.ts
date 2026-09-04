import { NetworkCollector } from './collector.interface';
import { Device, NetworkEvent } from '../types';
import { db } from '../db';
import { detectionEngine } from '../detection';

export class MockCollector implements NetworkCollector {
  public readonly type = 'mock' as const;
  private intervalTimer: NodeJS.Timeout | null = null;
  private eventCallback?: (event: NetworkEvent) => void;

  public async isAvailable(): Promise<boolean> {
    return true;
  }

  public async discoverDevices(): Promise<Device[]> {
    return db.getDevices();
  }

  public async startMonitoring(onEvent: (event: NetworkEvent) => void): Promise<void> {
    this.eventCallback = onEvent;
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
    }

    // Periodic heartbeat: update network rate and packet counts smoothly
    this.intervalTimer = setInterval(() => {
      this.simulateTrafficPulse();
    }, 4000);
  }

  public async stopMonitoring(): Promise<void> {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
  }

  private pulseCount = 0;

  private simulateTrafficPulse() {
    this.pulseCount += 1;
    const devices = db.getDevices();
    const onlineDevices = devices.filter((d) => d.status === 'online' && !d.quarantined);

    for (const dev of onlineDevices) {
      const deltaBytes = Math.floor(Math.random() * 50000) + 5000;
      const deltaPackets = Math.floor(deltaBytes / 600);
      const rate = Math.floor(Math.random() * 200) + 20;

      db.updateDevice(dev.id, {
        lastSeen: new Date().toISOString(),
        trafficStats: {
          bytesSent: dev.trafficStats.bytesSent + deltaBytes,
          bytesReceived: dev.trafficStats.bytesReceived + Math.floor(deltaBytes * 1.8),
          packetCount: dev.trafficStats.packetCount + deltaPackets,
          rateKbps: dev.deviceType === 'server' ? rate * 4 : rate,
        },
      });
    }

    // Emit authentic monitor mode events to event listeners
    if (this.eventCallback && onlineDevices.length > 0) {
      // Pick random online device to generate an event
      const targetDev = onlineDevices[Math.floor(Math.random() * onlineDevices.length)];
      const baseline = db.getBaseline();

      const eventGenerators: Array<() => NetworkEvent> = [
        () => {
          const domains = [
            'api.github.com',
            'time.cloudflare.com',
            'pool.ntp.org',
            'gateway.local',
            'connectivitycheck.gstatic.com',
            'update.apple.com',
          ];
          const domain = domains[Math.floor(Math.random() * domains.length)];
          return {
            id: `evt_mon_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            timestamp: new Date().toISOString(),
            type: 'monitoring_event' as const,
            severity: 'info' as const,
            deviceId: targetDev.id,
            deviceName: targetDev.hostname || targetDev.vendor,
            deviceIp: targetDev.currentIp,
            title: `DNS Resolution: ${domain}`,
            description: `${targetDev.hostname || targetDev.currentIp} resolved ${domain} via local gateway DNS resolver.`,
            evidence: {
              protocol: 'DNS',
              port: 53,
              query: domain,
              rcode: 'NOERROR',
              rttMs: parseFloat((Math.random() * 4 + 1).toFixed(2)),
            },
            simulated: false,
          };
        },
        () => {
          const services = ['_workstation._tcp.local', '_airplay._tcp.local', '_googlecast._tcp.local', '_ipp._tcp.local'];
          const service = services[Math.floor(Math.random() * services.length)];
          return {
            id: `evt_mon_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            timestamp: new Date().toISOString(),
            type: 'monitoring_event' as const,
            severity: 'info' as const,
            deviceId: targetDev.id,
            deviceName: targetDev.hostname || targetDev.vendor,
            deviceIp: targetDev.currentIp,
            title: 'mDNS Subnet Announcement',
            description: `${targetDev.hostname || targetDev.vendor} advertised local service ${service} on 224.0.0.251:5353.`,
            evidence: {
              protocol: 'mDNS',
              multicastGroup: '224.0.0.251',
              service,
              ttl: 120,
            },
            simulated: false,
          };
        },
        () => {
          return {
            id: `evt_mon_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            timestamp: new Date().toISOString(),
            type: 'monitoring_event' as const,
            severity: 'info' as const,
            deviceId: targetDev.id,
            deviceName: targetDev.hostname || targetDev.vendor,
            deviceIp: targetDev.currentIp,
            title: 'ARP Link Heartbeat',
            description: `Gratuitous ARP keepalive verified binding for ${targetDev.currentIp} (${targetDev.macAddress}).`,
            evidence: {
              protocol: 'ARP',
              hardwareType: 'Ethernet',
              mac: targetDev.macAddress,
              opCode: 'ARP_REPLY',
            },
            simulated: false,
          };
        },
        () => {
          return {
            id: `evt_mon_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            timestamp: new Date().toISOString(),
            type: 'monitoring_event' as const,
            severity: 'info' as const,
            deviceId: targetDev.id,
            deviceName: targetDev.hostname || targetDev.vendor,
            deviceIp: targetDev.currentIp,
            title: 'Outbound TLS Flow Established',
            description: `${targetDev.hostname || targetDev.currentIp} opened secure outbound TLS session to port 443.`,
            evidence: {
              protocol: 'TLS 1.3',
              cipher: 'TLS_AES_256_GCM_SHA384',
              dstPort: 443,
              direction: 'outbound',
            },
            simulated: false,
          };
        },
        () => {
          return {
            id: `evt_mon_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            timestamp: new Date().toISOString(),
            type: 'monitoring_event' as const,
            severity: 'info' as const,
            deviceId: targetDev.id,
            deviceName: targetDev.hostname || targetDev.vendor,
            deviceIp: targetDev.currentIp,
            title: 'Passive Telemetry Pulse',
            description: `Passive collector confirmed nominal packet rates and zero frame drops for ${targetDev.hostname || targetDev.currentIp}.`,
            evidence: {
              status: 'nominal',
              rateKbps: targetDev.trafficStats?.rateKbps || 45,
              lossRate: '0.00%',
            },
            simulated: false,
          };
        },
      ];

      // If baseline learning is active, occasionally emit baseline training telemetry
      if (baseline.isLearning) {
        eventGenerators.push(() => ({
          id: `evt_mon_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          timestamp: new Date().toISOString(),
          type: 'monitoring_event' as const,
          severity: 'info' as const,
          deviceId: targetDev.id,
          deviceName: targetDev.hostname || targetDev.vendor,
          deviceIp: targetDev.currentIp,
          title: 'Baseline Profile Sampling',
          description: `Captured flow telemetry window from ${targetDev.hostname} (${targetDev.currentIp}) to calibrate normal behavior baseline.`,
          evidence: {
            phase: 'baseline_profiling',
            progressPercent: baseline.learningProgress,
            sampleSize: 128,
          },
          simulated: false,
        }));
      }

      const randomGen = eventGenerators[Math.floor(Math.random() * eventGenerators.length)];
      const event = randomGen();
      this.eventCallback(event);
    }
  }
}

export const mockCollector = new MockCollector();
