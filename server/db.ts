import fs from 'fs';
import path from 'path';
import {
  Device,
  NetworkEvent,
  Alert,
  BaselineFeatures,
  SystemStatus,
  ResponseResult,
} from './types';

interface DatabaseSchema {
  devices: Device[];
  events: NetworkEvent[];
  alerts: Alert[];
  baseline: BaselineFeatures;
  actions: ResponseResult[];
  settings: {
    subnet: string;
    interfaceName: string;
    collectorType: 'linux' | 'macos' | 'windows' | 'mock';
    autoScanIntervalSeconds: number;
    baselineDurationSeconds: number;
    riskWeights: {
      newDevice: number;
      portScan: number;
      unusualHosts: number;
      unusualDns: number;
      abnormalTraffic: number;
      trustedBonus: number;
      baselineBonus: number;
    };
  };
}

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'sentinel_db.json');

const INITIAL_SETTINGS = {
  subnet: '',
  interfaceName: 'auto',
  collectorType: (process.platform === 'darwin' ? 'macos' : process.platform === 'linux' ? 'linux' : 'mock') as 'linux' | 'macos' | 'windows' | 'mock',
  autoScanIntervalSeconds: 10,
  baselineDurationSeconds: 15,
  riskWeights: {
    newDevice: 20,
    portScan: 30,
    unusualHosts: 20,
    unusualDns: 10,
    abnormalTraffic: 15,
    unidentifiedOs: 20,
    trustedBonus: 20,
    baselineBonus: 10,
  },
};

const INITIAL_BASELINE: BaselineFeatures = {
  isLearning: false,
  learningProgress: 0,
  confidenceScore: 0,
  devicesLearned: 0,
  eventsAnalyzed: 0,
  totalObservedPackets: 0,
  startTime: new Date().toISOString(),
  estimatedRemainingSeconds: 0,
  knownSubnets: [],
  typicalPorts: [],
  commonDnsDomains: [],
  averageTrafficKbps: 0,
};

const LEGACY_MOCK_DEVICE_IDS = new Set([
  'dev_gateway_01',
  'dev_workstation_02',
  'dev_nas_03',
  'dev_iot_cam_04',
  'dev_printer_05',
]);

export class Database {
  private data: DatabaseSchema;

  constructor() {
    this.ensureDataDir();
    this.data = this.loadData();
  }

  private ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
      try {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      } catch {
        // Fallback for restricted containers
      }
    }
  }

  private loadData(): DatabaseSchema {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);

        // Sanitize: strip out legacy hardcoded mock devices and mock events
        if (Array.isArray(parsed.devices)) {
          parsed.devices = parsed.devices.filter(
            (d: Device) => !LEGACY_MOCK_DEVICE_IDS.has(d.id)
          );
        } else {
          parsed.devices = [];
        }

        if (Array.isArray(parsed.events)) {
          parsed.events = parsed.events.filter(
            (e: NetworkEvent) =>
              !['evt_init_01', 'evt_init_02', 'evt_init_03'].includes(e.id) &&
              (!e.deviceId || !LEGACY_MOCK_DEVICE_IDS.has(e.deviceId))
          );
        } else {
          parsed.events = [];
        }

        if (!parsed.baseline || parsed.devices.length === 0) {
          parsed.baseline = {
            ...INITIAL_BASELINE,
            devicesLearned: parsed.devices.length,
          };
        }

        this.data = parsed;
        this.save();
        return parsed;
      }
    } catch {
      console.warn('Could not read existing database file, initializing fresh database');
    }
    return this.createDefaultDataset();
  }

  public save() {
    try {
      this.ensureDataDir();
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (err) {
      console.warn('Could not persist database to disk (operating in-memory):', err);
    }
  }

  public createDefaultDataset(): DatabaseSchema {
    return {
      devices: [],
      events: [],
      alerts: [],
      baseline: { ...INITIAL_BASELINE },
      actions: [],
      settings: { ...INITIAL_SETTINGS },
    };
  }

  public getDevices(): Device[] {
    return this.data.devices;
  }

  public getDeviceById(id: string): Device | undefined {
    return this.data.devices.find((d) => d.id === id);
  }

  public getDeviceByMac(mac: string): Device | undefined {
    return this.data.devices.find((d) => d.macAddress.toLowerCase() === mac.toLowerCase());
  }

  public getDeviceByIp(ip: string): Device | undefined {
    return this.data.devices.find((d) => d.currentIp === ip || d.ipAddresses.includes(ip));
  }

  public addDevice(device: Device): Device {
    this.data.devices.push(device);
    this.save();
    return device;
  }

  public updateDevice(id: string, updates: Partial<Device>): Device | undefined {
    const idx = this.data.devices.findIndex((d) => d.id === id);
    if (idx === -1) return undefined;
    this.data.devices[idx] = { ...this.data.devices[idx], ...updates };
    this.save();
    return this.data.devices[idx];
  }

  public getEvents(limit = 100): NetworkEvent[] {
    return [...this.data.events].reverse().slice(0, limit);
  }

  public addEvent(event: NetworkEvent): NetworkEvent {
    this.data.events.push(event);
    if (this.data.events.length > 1000) {
      this.data.events = this.data.events.slice(-1000);
    }
    this.save();
    return event;
  }

  public clearEvents(): void {
    this.data.events = [];
    this.save();
  }

  public getAlerts(): Alert[] {
    return [...this.data.alerts].reverse();
  }

  public addAlert(alert: Alert): Alert {
    this.data.alerts.push(alert);
    this.save();
    return alert;
  }

  public resolveAlert(id: string, resolvedBy = 'User'): Alert | undefined {
    const alert = this.data.alerts.find((a) => a.id === id);
    if (!alert) return undefined;
    alert.resolved = true;
    alert.resolvedAt = new Date().toISOString();
    alert.resolvedBy = resolvedBy;
    this.save();
    return alert;
  }

  public getBaseline(): BaselineFeatures {
    return this.data.baseline;
  }

  public updateBaseline(updates: Partial<BaselineFeatures>): BaselineFeatures {
    this.data.baseline = { ...this.data.baseline, ...updates };
    this.save();
    return this.data.baseline;
  }

  public getSettings() {
    return this.data.settings;
  }

  public updateSettings(updates: Partial<DatabaseSchema['settings']>) {
    if (updates.baselineDurationSeconds !== undefined) {
      updates.baselineDurationSeconds = Math.min(60, Math.max(5, updates.baselineDurationSeconds));
    }
    this.data.settings = { ...this.data.settings, ...updates };
    this.save();
    return this.data.settings;
  }

  public addAction(action: ResponseResult) {
    this.data.actions.push(action);
    this.save();
  }

  public getActions(): ResponseResult[] {
    return [...this.data.actions].reverse();
  }

  public resetDatabase() {
    this.data = this.createDefaultDataset();
    this.save();
    return this.data;
  }
}

export const db = new Database();
