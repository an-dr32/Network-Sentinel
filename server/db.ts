import fs from 'fs';
import path from 'path';
import {
  Device,
  OpenPort,
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

const makePort = (port: number, service: string, protocol: 'tcp' | 'udp' = 'tcp'): OpenPort => ({
  port,
  service,
  protocol,
  state: 'open',
  riskRating: 'low',
});

export const INITIAL_NETWORK_DEVICES: Device[] = [
  {
    id: 'dev_gw_ubiquiti_01',
    macAddress: 'b4:fb:e4:1a:2b:3c',
    hostname: 'unifi-gateway.local',
    vendor: 'Ubiquiti Networks Inc.',
    ipAddresses: ['192.168.1.1'],
    currentIp: '192.168.1.1',
    ipHistory: [{ ip: '192.168.1.1', firstSeen: new Date(Date.now() - 86400000).toISOString(), lastSeen: new Date().toISOString(), leaseType: 'static' }],
    firstSeen: new Date(Date.now() - 86400000).toISOString(),
    lastSeen: new Date().toISOString(),
    status: 'online',
    trustStatus: 'known',
    riskScore: 0,
    riskSeverity: 'normal',
    deviceType: 'router',
    osGuess: 'UniFi OS (Embedded Linux)',
    osConfidence: 98,
    osDetectionDetails: {
      ttl: 64,
      methods: ['MAC Vendor OUI Matching', 'Service Port Signature'],
      confidence: 98,
      fingerprintedAt: new Date().toISOString(),
      signatureMatch: 'UniFi Security Gateway Signature',
      identifiedBanners: ['Ubiquiti UniFi Controller v8'],
    },
    openPorts: [makePort(53, 'DNS', 'udp'), makePort(80, 'HTTP'), makePort(443, 'HTTPS'), makePort(8080, 'HTTP-Admin')],
    riskEvidence: [],
    quarantined: false,
    trafficStats: {
      bytesSent: 15420000,
      bytesReceived: 34500000,
      packetCount: 125000,
      rateKbps: 340,
    },
    tags: ['gateway', 'infrastructure', 'ethernet'],
  },
  {
    id: 'dev_workstation_dell_02',
    macAddress: 'd4:be:d9:44:55:66',
    hostname: 'dell-precision-ws.local',
    vendor: 'Dell Inc.',
    ipAddresses: ['192.168.1.100'],
    currentIp: '192.168.1.100',
    ipHistory: [{ ip: '192.168.1.100', firstSeen: new Date(Date.now() - 43200000).toISOString(), lastSeen: new Date().toISOString(), leaseType: 'dhcp' }],
    firstSeen: new Date(Date.now() - 43200000).toISOString(),
    lastSeen: new Date().toISOString(),
    status: 'online',
    trustStatus: 'known',
    riskScore: 10,
    riskSeverity: 'normal',
    deviceType: 'workstation',
    osGuess: 'Ubuntu Linux 24.04 LTS',
    osConfidence: 95,
    osDetectionDetails: {
      ttl: 64,
      methods: ['TCP/IP Stack Window Sizing', 'SSH Banner Analysis'],
      confidence: 95,
      fingerprintedAt: new Date().toISOString(),
      signatureMatch: 'OpenSSH_9.6p1 Ubuntu-3ubuntu13',
      identifiedBanners: ['SSH-2.0-OpenSSH_9.6p1 Ubuntu'],
    },
    openPorts: [makePort(22, 'SSH'), makePort(3000, 'HTTP-Dev'), makePort(5432, 'PostgreSQL')],
    riskEvidence: [],
    quarantined: false,
    trafficStats: {
      bytesSent: 4200000,
      bytesReceived: 8900000,
      packetCount: 38000,
      rateKbps: 85,
    },
    tags: ['workstation', 'primary-host', 'ethernet'],
  },
  {
    id: 'dev_macbook_pro_03',
    macAddress: '3c:22:fb:77:88:99',
    hostname: 'macbook-pro.local',
    vendor: 'Apple, Inc.',
    ipAddresses: ['192.168.1.105'],
    currentIp: '192.168.1.105',
    ipHistory: [{ ip: '192.168.1.105', firstSeen: new Date(Date.now() - 28800000).toISOString(), lastSeen: new Date().toISOString(), leaseType: 'dhcp' }],
    firstSeen: new Date(Date.now() - 28800000).toISOString(),
    lastSeen: new Date().toISOString(),
    status: 'online',
    trustStatus: 'known',
    riskScore: 5,
    riskSeverity: 'normal',
    deviceType: 'laptop',
    osGuess: 'macOS 15 (Sequoia)',
    osConfidence: 96,
    osDetectionDetails: {
      ttl: 64,
      methods: ['Apple Bonjour/mDNS Service Enumeration', 'SMB Banner'],
      confidence: 96,
      fingerprintedAt: new Date().toISOString(),
      signatureMatch: 'Apple Darwin 24.0.0 (macOS Sequoia)',
      identifiedBanners: ['Apple macOS Sequoia SMB/AirPlay'],
    },
    openPorts: [makePort(445, 'SMB'), makePort(5000, 'AirPlay')],
    riskEvidence: [],
    quarantined: false,
    trafficStats: {
      bytesSent: 2800000,
      bytesReceived: 5600000,
      packetCount: 24000,
      rateKbps: 62,
    },
    tags: ['workstation', 'wifi'],
  },
  {
    id: 'dev_pixel_mobile_04',
    macAddress: '78:2b:46:11:22:33',
    hostname: 'pixel-9-pro.local',
    vendor: 'Google, LLC',
    ipAddresses: ['192.168.1.120'],
    currentIp: '192.168.1.120',
    ipHistory: [{ ip: '192.168.1.120', firstSeen: new Date(Date.now() - 14400000).toISOString(), lastSeen: new Date().toISOString(), leaseType: 'dhcp' }],
    firstSeen: new Date(Date.now() - 14400000).toISOString(),
    lastSeen: new Date().toISOString(),
    status: 'online',
    trustStatus: 'known',
    riskScore: 0,
    riskSeverity: 'normal',
    deviceType: 'smartphone',
    osGuess: 'Android 15 (Linux Kernel)',
    osConfidence: 94,
    osDetectionDetails: {
      ttl: 64,
      methods: ['DHCP Client Fingerprint', 'OUI Vendor Resolution'],
      confidence: 94,
      fingerprintedAt: new Date().toISOString(),
      signatureMatch: 'Google Pixel Android 15 Fingerprint',
      identifiedBanners: [],
    },
    openPorts: [],
    riskEvidence: [],
    quarantined: false,
    trafficStats: {
      bytesSent: 920000,
      bytesReceived: 2100000,
      packetCount: 9500,
      rateKbps: 28,
    },
    tags: ['handheld', 'wifi'],
  },
  {
    id: 'dev_synology_nas_05',
    macAddress: '00:11:32:99:aa:bb',
    hostname: 'synology-ds920.local',
    vendor: 'Synology Inc.',
    ipAddresses: ['192.168.1.10'],
    currentIp: '192.168.1.10',
    ipHistory: [{ ip: '192.168.1.10', firstSeen: new Date(Date.now() - 86400000).toISOString(), lastSeen: new Date().toISOString(), leaseType: 'static' }],
    firstSeen: new Date(Date.now() - 86400000).toISOString(),
    lastSeen: new Date().toISOString(),
    status: 'online',
    trustStatus: 'known',
    riskScore: 15,
    riskSeverity: 'normal',
    deviceType: 'server',
    osGuess: 'Synology DSM (Linux)',
    osConfidence: 99,
    osDetectionDetails: {
      ttl: 64,
      methods: ['Synology DSM HTTP Header Recognition', 'NFS/SMB Response'],
      confidence: 99,
      fingerprintedAt: new Date().toISOString(),
      signatureMatch: 'Synology DiskStation Manager 7.2',
      identifiedBanners: ['Server: nginx (Synology DSM 7.2)'],
    },
    openPorts: [makePort(80, 'HTTP'), makePort(443, 'HTTPS'), makePort(5000, 'DSM-HTTP'), makePort(5001, 'DSM-HTTPS'), makePort(2049, 'NFS'), makePort(445, 'SMB')],
    riskEvidence: [],
    quarantined: false,
    trafficStats: {
      bytesSent: 8900000,
      bytesReceived: 14200000,
      packetCount: 52000,
      rateKbps: 110,
    },
    tags: ['storage', 'backup', 'ethernet'],
  },
  {
    id: 'dev_sony_tv_06',
    macAddress: 'f4:09:d8:55:66:77',
    hostname: 'bravia-4k-livingroom.local',
    vendor: 'Sony Corporation',
    ipAddresses: ['192.168.1.145'],
    currentIp: '192.168.1.145',
    ipHistory: [{ ip: '192.168.1.145', firstSeen: new Date(Date.now() - 21600000).toISOString(), lastSeen: new Date().toISOString(), leaseType: 'dhcp' }],
    firstSeen: new Date(Date.now() - 21600000).toISOString(),
    lastSeen: new Date().toISOString(),
    status: 'online',
    trustStatus: 'known',
    riskScore: 25,
    riskSeverity: 'normal',
    deviceType: 'iot',
    osGuess: 'Google TV / Android OS',
    osConfidence: 91,
    osDetectionDetails: {
      ttl: 64,
      methods: ['DIAL / Google Cast SSDP Discovery', 'HTTP Banner'],
      confidence: 91,
      fingerprintedAt: new Date().toISOString(),
      signatureMatch: 'Sony Bravia Google TV Cast Receiver',
      identifiedBanners: ['Sony BRAVIA 4K UR3 (Google TV)'],
    },
    openPorts: [makePort(8008, 'HTTP-Cast'), makePort(8009, 'Cast-Control'), makePort(8443, 'Cast-SSL')],
    riskEvidence: [],
    quarantined: false,
    trafficStats: {
      bytesSent: 650000,
      bytesReceived: 6200000,
      packetCount: 16000,
      rateKbps: 45,
    },
    tags: ['media', 'smart-tv', 'wifi'],
  },
];

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

        if (!Array.isArray(parsed.devices) || parsed.devices.length === 0) {
          parsed.devices = [...INITIAL_NETWORK_DEVICES];
        }

        if (!Array.isArray(parsed.events)) {
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
      devices: [...INITIAL_NETWORK_DEVICES],
      events: [],
      alerts: [],
      baseline: { ...INITIAL_BASELINE, devicesLearned: INITIAL_NETWORK_DEVICES.length },
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

  public deleteDevice(id: string): boolean {
    const prevLen = this.data.devices.length;
    this.data.devices = this.data.devices.filter((d) => d.id !== id);
    if (this.data.devices.length !== prevLen) {
      this.save();
      return true;
    }
    return false;
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
      // Support standard durations (min 5s), overdrive durations (>60s), and 0 (indefinite)
      if (updates.baselineDurationSeconds > 0) {
        updates.baselineDurationSeconds = Math.max(5, updates.baselineDurationSeconds);
      }
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
