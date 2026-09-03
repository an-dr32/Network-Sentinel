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

  private simulateTrafficPulse() {
    const devices = db.getDevices();
    for (const dev of devices) {
      if (dev.status === 'online' && !dev.quarantined) {
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
    }
  }
}

export const mockCollector = new MockCollector();
