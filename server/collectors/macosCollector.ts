import { exec } from 'child_process';
import { promisify } from 'util';
import { NetworkCollector } from './collector.interface';
import { Device, NetworkEvent } from '../types';
import { db } from '../db';

const execAsync = promisify(exec);

export class MacosCollector implements NetworkCollector {
  public readonly type = 'macos' as const;
  private intervalTimer: NodeJS.Timeout | null = null;
  private eventCallback?: (event: NetworkEvent) => void;

  public async isAvailable(): Promise<boolean> {
    return process.platform === 'darwin';
  }

  /**
   * Normalizes MAC address string (e.g. "0:11:22:3:4:5" -> "00:11:22:03:04:05")
   */
  private normalizeMac(mac: string): string {
    return mac
      .split(':')
      .map((part) => part.padStart(2, '0'))
      .join(':')
      .toLowerCase();
  }

  public async discoverDevices(): Promise<Device[]> {
    const devices: Device[] = [];
    const now = new Date().toISOString();

    try {
      // Execute arp -an on macOS
      const { stdout } = await execAsync('arp -an');
      const lines = stdout.trim().split('\n');

      // Typical output: ? (192.168.1.1) at 3c:22:fb:aa:bb:cc on en0 ifscope [ethernet]
      const arpRegex = /\?\s+\(([\d.]+)\)\s+at\s+([0-9a-fA-F:]+)\s+on\s+(\w+)/;

      for (const line of lines) {
        const match = line.match(arpRegex);
        if (!match) continue;

        const ip = match[1];
        const rawMac = match[2];
        const iface = match[3];

        if (
          !rawMac ||
          rawMac === '(incomplete)' ||
          rawMac === 'ff:ff:ff:ff:ff:ff' ||
          rawMac === '0:0:0:0:0:0'
        ) {
          continue;
        }

        const mac = this.normalizeMac(rawMac);
        const existing = db.getDeviceByMac(mac);

        if (existing) {
          devices.push(existing);
        } else {
          const newDev: Device = {
            id: `dev_${mac.replace(/:/g, '')}`,
            macAddress: mac,
            hostname: `mac-host-${ip.replace(/\./g, '-')}.local`,
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
            deviceType: 'unknown',
            openPorts: [],
            riskEvidence: [
              { rule: 'New unverified device', points: 20, reason: 'Discovered via macOS neighbor table', timestamp: now },
            ],
            quarantined: false,
            trafficStats: {
              bytesSent: 1024,
              bytesReceived: 2048,
              packetCount: 12,
              rateKbps: 15,
            },
            tags: ['Discovered', iface],
          };

          db.addDevice(newDev);
          devices.push(newDev);

          if (this.eventCallback) {
            this.eventCallback({
              id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
              timestamp: now,
              type: 'device_discovered',
              severity: 'info',
              deviceId: newDev.id,
              deviceName: newDev.hostname,
              deviceIp: ip,
              title: `New Device Discovered on ${iface}`,
              description: `Hardware ${mac} (${newDev.vendor}) detected on macOS interface ${iface}.`,
              evidence: {
                interface: iface,
                ip,
                mac,
                vendor: newDev.vendor,
              },
              simulated: false,
            });
          }
        }
      }
    } catch (err) {
      console.warn('macOS collector arp read error:', err);
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

    // Initial discovery
    await this.discoverDevices();

    // Poll every 10 seconds
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
      'f0:18:98': 'Apple, Inc.',
      'a4:83:e7': 'Apple, Inc.',
      '40:6c:8f': 'Apple, Inc.',
    };
    return vendorMap[prefix] || 'Generic Network Interface';
  }
}

export const macosCollector = new MacosCollector();
