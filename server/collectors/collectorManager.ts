import { NetworkCollector } from './collector.interface';
import { linuxCollector } from './linuxCollector';
import { macosCollector } from './macosCollector';
import { db } from '../db';
import { NetworkEvent } from '../types';

export class CollectorManager {
  private activeCollector: NetworkCollector = linuxCollector;
  private isMonitoring = false;
  private listeners: ((event: NetworkEvent) => void)[] = [];

  constructor() {
    this.init();
  }

  private async init() {
    const settings = db.getSettings();
    if (process.platform === 'darwin') {
      this.activeCollector = macosCollector;
    } else {
      this.activeCollector = linuxCollector;
    }

    // Run real discovery immediately on start
    try {
      await this.activeCollector.discoverDevices();
    } catch (err) {
      console.warn('Initial device discovery warning:', err);
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

  public async setCollectorType(type: 'linux' | 'macos' | 'windows' | 'mock') {
    await this.stop();
    if (type === 'macos' || process.platform === 'darwin') {
      this.activeCollector = macosCollector;
    } else {
      this.activeCollector = linuxCollector;
    }
    db.updateSettings({ collectorType: this.activeCollector.type });
    await this.start();
  }

  public isRunning(): boolean {
    return this.isMonitoring;
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
