import { NetworkCollector } from './collector.interface';
import { mockCollector } from './mockCollector';
import { linuxCollector } from './linuxCollector';
import { macosCollector } from './macosCollector';
import { db } from '../db';
import { NetworkEvent } from '../types';

export class CollectorManager {
  private activeCollector: NetworkCollector = mockCollector;
  private isMonitoring = false;
  private listeners: ((event: NetworkEvent) => void)[] = [];

  constructor() {
    this.init();
  }

  private async init() {
    const settings = db.getSettings();
    if (process.platform === 'darwin' && (await macosCollector.isAvailable())) {
      this.activeCollector = macosCollector;
    } else if (process.platform === 'linux' && (await linuxCollector.isAvailable())) {
      this.activeCollector = linuxCollector;
    } else if (settings.collectorType === 'linux' && (await linuxCollector.isAvailable())) {
      this.activeCollector = linuxCollector;
    } else if (settings.collectorType === 'macos' && (await macosCollector.isAvailable())) {
      this.activeCollector = macosCollector;
    } else {
      this.activeCollector = mockCollector;
    }
  }

  public subscribe(listener: (event: NetworkEvent) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private emitEvent(event: NetworkEvent) {
    db.addEvent(event);
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (err) {
        console.error('Error in event listener:', err);
      }
    }
  }

  public async start() {
    if (this.isMonitoring) return;
    this.isMonitoring = true;
    await this.activeCollector.startMonitoring((event) => {
      this.emitEvent(event);
    });
  }

  public async stop() {
    this.isMonitoring = false;
    await this.activeCollector.stopMonitoring();
  }

  public getIsMonitoring(): boolean {
    return this.isMonitoring;
  }

  public async setCollectorType(type: 'linux' | 'macos' | 'windows' | 'mock') {
    await this.stop();
    if (type === 'linux' && (await linuxCollector.isAvailable())) {
      this.activeCollector = linuxCollector;
    } else if (type === 'macos' && (await macosCollector.isAvailable())) {
      this.activeCollector = macosCollector;
    } else {
      this.activeCollector = mockCollector;
    }
    db.updateSettings({ collectorType: type });
    await this.start();
  }

  public getActiveCollectorType() {
    return this.activeCollector.type;
  }

  public async discoverNow() {
    return this.activeCollector.discoverDevices();
  }

  public broadcastCustomEvent(event: NetworkEvent) {
    this.emitEvent(event);
  }
}

export const collectorManager = new CollectorManager();
