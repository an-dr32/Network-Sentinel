import { NetworkCollector } from './collector.interface';
import { Device, NetworkEvent } from '../types';
import { db } from '../db';

export class MockCollector implements NetworkCollector {
  public readonly type = 'mock' as const;
  private intervalTimer: NodeJS.Timeout | null = null;
  private eventCallback?: (event: NetworkEvent) => void;

  public async isAvailable(): Promise<boolean> {
    return true;
  }

  public async discoverDevices(): Promise<Device[]> {
    return db.getDevices().filter((d) => d.status === 'online');
  }

  public async startMonitoring(onEvent: (event: NetworkEvent) => void): Promise<void> {
    this.eventCallback = onEvent;
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
  }

  public async stopMonitoring(): Promise<void> {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
  }
}

export const mockCollector = new MockCollector();
