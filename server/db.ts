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
  subnet: '192.168.1.0/24',
  interfaceName: 'eth0',
  collectorType: 'mock' as const,
  autoScanIntervalSeconds: 8,
  baselineDurationSeconds: 15,
  riskWeights: {
    newDevice: 20,
    portScan: 30,
    unusualHosts: 20,
    unusualDns: 10,
    abnormalTraffic: 15,
    trustedBonus: 20,
    baselineBonus: 10,
  },
};

const INITIAL_BASELINE: BaselineFeatures = {
  isLearning: false,
  learningProgress: 100,
  confidenceScore: 92,
  devicesLearned: 5,
  eventsAnalyzed: 142,
  totalObservedPackets: 84920,
  startTime: new Date(Date.now() - 3600000).toISOString(),
  estimatedRemainingSeconds: 0,
  knownSubnets: ['192.168.1.0/24'],
  typicalPorts: [53, 80, 443, 8080, 22],
  commonDnsDomains: [
    'google.com',
    'apple.com',
    'cloudflare.com',
    'github.com',
    'gstatic.com',
    'amazon.com',
  ],
  averageTrafficKbps: 450,
};

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
        return JSON.parse(raw);
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
    const now = new Date();
    const isoNow = now.toISOString();
    const oneHourAgo = new Date(now.getTime() - 3600000).toISOString();
    const twoHoursAgo = new Date(now.getTime() - 7200000).toISOString();

    const initialDevices: Device[] = [
      {
        id: 'dev_gateway_01',
        macAddress: 'd4:ca:6d:11:22:33',
        hostname: 'gateway.local',
        vendor: 'RouterBOARD (MikroTik)',
        ipAddresses: ['192.168.1.1'],
        currentIp: '192.168.1.1',
        ipHistory: [
          { ip: '192.168.1.1', firstSeen: twoHoursAgo, lastSeen: isoNow, leaseType: 'static' },
        ],
        firstSeen: twoHoursAgo,
        lastSeen: isoNow,
        status: 'online',
        trustStatus: 'known',
        riskScore: 0,
        riskSeverity: 'normal',
        tags: ['gateway', 'infrastructure', 'dhcp-server'],
        deviceType: 'router',
        osGuess: 'RouterOS 7.12',
        openPorts: [
          { port: 53, service: 'domain', protocol: 'udp', state: 'open', riskRating: 'low' },
          { port: 80, service: 'http', protocol: 'tcp', state: 'open', riskRating: 'low' },
          { port: 443, service: 'https', protocol: 'tcp', state: 'open', riskRating: 'low' },
          { port: 22, service: 'ssh', protocol: 'tcp', state: 'open', riskRating: 'medium' },
        ],
        riskEvidence: [],
        quarantined: false,
        trafficStats: {
          bytesSent: 18450000,
          bytesReceived: 42300000,
          packetCount: 52100,
          rateKbps: 340,
        },
      },
      {
        id: 'dev_workstation_02',
        macAddress: '3c:22:fb:45:67:89',
        hostname: 'macbook-pro-m3.local',
        vendor: 'Apple, Inc.',
        ipAddresses: ['192.168.1.104'],
        currentIp: '192.168.1.104',
        ipHistory: [
          { ip: '192.168.1.104', firstSeen: twoHoursAgo, lastSeen: isoNow, leaseType: 'dhcp' },
        ],
        firstSeen: twoHoursAgo,
        lastSeen: isoNow,
        status: 'online',
        trustStatus: 'known',
        riskScore: 5,
        riskSeverity: 'normal',
        tags: ['workstation', 'primary-admin'],
        deviceType: 'laptop',
        osGuess: 'macOS Sonoma (Darwin 23.4)',
        openPorts: [
          { port: 443, service: 'https', protocol: 'tcp', state: 'open', riskRating: 'low' },
          { port: 5000, service: 'airplay', protocol: 'tcp', state: 'open', riskRating: 'low' },
        ],
        riskEvidence: [
          { rule: 'Normal baseline activity', points: -10, reason: 'Follows established behavioral model', timestamp: isoNow },
        ],
        quarantined: false,
        trafficStats: {
          bytesSent: 1240000,
          bytesReceived: 8920000,
          packetCount: 14200,
          rateKbps: 180,
        },
      },
      {
        id: 'dev_nas_03',
        macAddress: '00:11:32:8a:bc:de',
        hostname: 'synology-ds920.local',
        vendor: 'Synology Incorporated',
        ipAddresses: ['192.168.1.50'],
        currentIp: '192.168.1.50',
        ipHistory: [
          { ip: '192.168.1.50', firstSeen: twoHoursAgo, lastSeen: isoNow, leaseType: 'static' },
        ],
        firstSeen: twoHoursAgo,
        lastSeen: isoNow,
        status: 'online',
        trustStatus: 'known',
        riskScore: 0,
        riskSeverity: 'normal',
        tags: ['storage', 'backup', 'nfs'],
        deviceType: 'server',
        osGuess: 'Linux (DSM 7.2)',
        openPorts: [
          { port: 5000, service: 'http-dsm', protocol: 'tcp', state: 'open', riskRating: 'low' },
          { port: 5001, service: 'https-dsm', protocol: 'tcp', state: 'open', riskRating: 'low' },
          { port: 445, service: 'microsoft-ds', protocol: 'tcp', state: 'open', riskRating: 'medium' },
        ],
        riskEvidence: [],
        quarantined: false,
        trafficStats: {
          bytesSent: 45000000,
          bytesReceived: 3100000,
          packetCount: 39000,
          rateKbps: 620,
        },
      },
      {
        id: 'dev_iot_cam_04',
        macAddress: '18:b4:30:aa:bb:cc',
        hostname: 'nest-cam-livingroom',
        vendor: 'Nest Labs (Google)',
        ipAddresses: ['192.168.1.188'],
        currentIp: '192.168.1.188',
        ipHistory: [
          { ip: '192.168.1.188', firstSeen: twoHoursAgo, lastSeen: isoNow, leaseType: 'dhcp' },
        ],
        firstSeen: twoHoursAgo,
        lastSeen: isoNow,
        status: 'online',
        trustStatus: 'known',
        riskScore: 0,
        riskSeverity: 'normal',
        tags: ['iot', 'camera', 'media'],
        deviceType: 'iot',
        osGuess: 'Embedded Linux',
        openPorts: [
          { port: 443, service: 'https', protocol: 'tcp', state: 'open', riskRating: 'low' },
        ],
        riskEvidence: [],
        quarantined: false,
        trafficStats: {
          bytesSent: 3400000,
          bytesReceived: 420000,
          packetCount: 6800,
          rateKbps: 95,
        },
      },
      {
        id: 'dev_printer_05',
        macAddress: '00:1e:c9:44:55:66',
        hostname: 'brother-hl-l2350dw',
        vendor: 'Brother Industries, Ltd.',
        ipAddresses: ['192.168.1.200'],
        currentIp: '192.168.1.200',
        ipHistory: [
          { ip: '192.168.1.200', firstSeen: twoHoursAgo, lastSeen: isoNow, leaseType: 'dhcp' },
        ],
        firstSeen: twoHoursAgo,
        lastSeen: isoNow,
        status: 'online',
        trustStatus: 'known',
        riskScore: 0,
        riskSeverity: 'normal',
        tags: ['printer', 'ipp'],
        deviceType: 'iot',
        osGuess: 'Brother Embedded OS',
        openPorts: [
          { port: 631, service: 'ipp', protocol: 'tcp', state: 'open', riskRating: 'low' },
          { port: 80, service: 'http', protocol: 'tcp', state: 'open', riskRating: 'low' },
        ],
        riskEvidence: [],
        quarantined: false,
        trafficStats: {
          bytesSent: 120000,
          bytesReceived: 480000,
          packetCount: 1200,
          rateKbps: 5,
        },
      },
    ];

    const initialEvents: NetworkEvent[] = [
      {
        id: 'evt_init_01',
        timestamp: twoHoursAgo,
        type: 'system_info',
        severity: 'info',
        title: 'Network Sentinel Engine Initialized',
        description: 'Passive collector active on subnet 192.168.1.0/24 (interface eth0).',
        evidence: { subnet: '192.168.1.0/24', collector: 'PassiveARP+NDP' },
        simulated: false,
      },
      {
        id: 'evt_init_02',
        timestamp: oneHourAgo,
        type: 'device_discovered',
        deviceId: 'dev_gateway_01',
        deviceName: 'gateway.local',
        deviceIp: '192.168.1.1',
        severity: 'info',
        title: 'Gateway Discovered',
        description: 'Identified local default gateway at 192.168.1.1 (RouterBOARD).',
        evidence: { ip: '192.168.1.1', mac: 'd4:ca:6d:11:22:33', vendor: 'MikroTik' },
        simulated: false,
      },
      {
        id: 'evt_init_03',
        timestamp: oneHourAgo,
        type: 'device_discovered',
        deviceId: 'dev_workstation_02',
        deviceName: 'macbook-pro-m3.local',
        deviceIp: '192.168.1.104',
        severity: 'info',
        title: 'Device Discovered',
        description: 'Identified Apple client device on DHCP lease 192.168.1.104.',
        evidence: { ip: '192.168.1.104', mac: '3c:22:fb:45:67:89', vendor: 'Apple' },
        simulated: false,
      },
    ];

    return {
      devices: initialDevices,
      events: initialEvents,
      alerts: [],
      baseline: INITIAL_BASELINE,
      actions: [],
      settings: INITIAL_SETTINGS,
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
