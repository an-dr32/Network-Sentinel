import fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { NetworkCollector } from './collector.interface';
import { Device, NetworkEvent } from '../types';
import { db } from '../db';

const execAsync = promisify(exec);

export class LinuxCollector implements NetworkCollector {
  public readonly type = 'linux' as const;
  private intervalTimer: NodeJS.Timeout | null = null;
  private eventCallback?: (event: NetworkEvent) => void;

  public async isAvailable(): Promise<boolean> {
    try {
      return fs.existsSync('/proc/net/arp');
    } catch {
      return false;
    }
  }

  public async discoverDevices(): Promise<Device[]> {
    const devices: Device[] = [];
    const now = new Date().toISOString();

    try {
      // 1. Read /proc/net/arp
      if (fs.existsSync('/proc/net/arp')) {
        const arpData = fs.readFileSync('/proc/net/arp', 'utf-8');
        const lines = arpData.trim().split('\n');
        // Skip header: IP address HW type Flags HW address Mask Device
        for (let i = 1; i < lines.length; i++) {
          const parts = lines[i].trim().split(/\s+/);
          if (parts.length >= 6) {
            const ip = parts[0];
            const mac = parts[3];
            const iface = parts[5];

            if (mac && mac !== '00:00:00:00:00:00') {
              const existing = db.getDeviceByMac(mac);
              if (existing) {
                devices.push(existing);
              } else {
                const newDev: Device = {
                  id: `dev_${mac.replace(/:/g, '')}`,
                  macAddress: mac,
                  hostname: `host-${ip.replace(/\./g, '-')}.local`,
                  vendor: this.lookupVendor(mac),
                  ipAddresses: [ip],
                  currentIp: ip,
                  ipHistory: [
                    { ip, firstSeen: now, lastSeen: now, leaseType: 'dhcp' },
                  ],
                  firstSeen: now,
                  lastSeen: now,
                  status: 'online',
                  trustStatus: 'new',
                  riskScore: 20,
                  riskSeverity: 'normal',
                  tags: ['arp-neighbor', iface],
                  deviceType: 'unknown',
                  openPorts: [],
                  riskEvidence: [
                    { rule: 'New unverified device', points: 20, reason: 'Discovered via kernel neighbor table', timestamp: now },
                  ],
                  quarantined: false,
                  trafficStats: {
                    bytesSent: 1024,
                    bytesReceived: 2048,
                    packetCount: 12,
                    rateKbps: 15,
                  },
                };
                db.addDevice(newDev);
                devices.push(newDev);
              }
            }
          }
        }
      }
    } catch (err) {
      console.warn('Linux collector read error:', err);
    }

    if (devices.length === 0) {
      return db.getDevices();
    }
    return devices;
  }

  public async startMonitoring(onEvent: (event: NetworkEvent) => void): Promise<void> {
    this.eventCallback = onEvent;
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
    }

    this.intervalTimer = setInterval(async () => {
      await this.discoverDevices();
    }, 10000);
  }

  public async stopMonitoring(): Promise<void> {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
  }

  private lookupVendor(mac: string): string {
    const prefix = mac.toLowerCase().substring(0, 8);
    const vendorMap: Record<string, string> = {
      'd4:ca:6d': 'MikroTik',
      '3c:22:fb': 'Apple, Inc.',
      '00:11:32': 'Synology Incorporated',
      '18:b4:30': 'Nest Labs (Google)',
      '00:1e:c9': 'Brother Industries, Ltd.',
      'b8:27:eb': 'Raspberry Pi Foundation',
      'dc:a6:32': 'Raspberry Pi Trading',
      'ac:bc:32': 'Apple, Inc.',
      'f4:f5:e8': 'Google LLC',
      '50:c7:bf': 'TP-Link Corporation',
      '00:0c:29': 'VMware, Inc.',
      '08:00:27': 'Oracle VirtualBox',
    };
    return vendorMap[prefix] || 'Generic Network Interface';
  }
}

export const linuxCollector = new LinuxCollector();
