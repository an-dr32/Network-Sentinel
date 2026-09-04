import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import { NetworkCollector } from './collector.interface';
import { Device, NetworkEvent } from '../types';
import { db } from '../db';
import { lookupOuiVendor } from '../ouiDatabase';

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
    const now = new Date().toISOString();

    let defaultGwIp = '';
    let activeIface = 'en0';

    try {
      // 1. Discover default gateway and active interface on macOS
      const { stdout: routeOut } = await execAsync('route -n get default 2>/dev/null');
      const gwMatch = routeOut.match(/gateway:\s*([\d.]+)/);
      const ifaceMatch = routeOut.match(/interface:\s*(\w+)/);
      if (gwMatch) defaultGwIp = gwMatch[1];
      if (ifaceMatch) activeIface = ifaceMatch[1];

      // Ping default gateway and broadcast to populate macOS ARP cache
      if (defaultGwIp) {
        try {
          await execAsync(`ping -c 1 -W 200 ${defaultGwIp} >/dev/null 2>&1`);
        } catch {}
      }

      try {
        // Fast burst broadcast ping across subnet
        await execAsync(`ping -c 2 -t 1 -W 500 255.255.255.255 >/dev/null 2>&1`);
      } catch {}
    } catch {
      // Fallback
    }

    // 2. Register local host Mac if available
    try {
      const ifaces = os.networkInterfaces();
      const targetIface = ifaces[activeIface] || Object.values(ifaces).flat().find((i) => i && !i.internal && i.family === 'IPv4');
      const ipv4Info = Array.isArray(targetIface)
        ? targetIface.find((i) => i.family === 'IPv4' && !i.internal)
        : targetIface;

      if (ipv4Info && ipv4Info.mac && ipv4Info.mac !== '00:00:00:00:00:00') {
        const mac = this.normalizeMac(ipv4Info.mac);
        const hostIp = ipv4Info.address;
        const hostName = os.hostname() || `macbook-${hostIp.replace(/\./g, '-')}.local`;

        if (!db.getDeviceByMac(mac)) {
          const hostDev: Device = {
            id: `dev_${mac.replace(/:/g, '')}`,
            macAddress: mac,
            hostname: hostName,
            vendor: 'Apple, Inc.',
            ipAddresses: [hostIp],
            currentIp: hostIp,
            ipHistory: [{ ip: hostIp, firstSeen: now, lastSeen: now, leaseType: 'dhcp' }],
            firstSeen: now,
            lastSeen: now,
            status: 'online',
            trustStatus: 'known',
            riskScore: 0,
            riskSeverity: 'normal',
            deviceType: 'laptop',
            osGuess: 'Apple macOS (Darwin)',
            osConfidence: 98,
            openPorts: [],
            riskEvidence: [],
            quarantined: false,
            trafficStats: {
              bytesSent: 204800,
              bytesReceived: 819200,
              packetCount: 1500,
              rateKbps: 45,
            },
            tags: ['workstation', 'primary-host', activeIface],
          };
          db.addDevice(hostDev);
        }
      }
    } catch (err) {
      console.warn('macOS collector host device identification error:', err);
    }

    // 3. Parse ARP table on macOS
    try {
      const { stdout } = await execAsync('arp -a');
      const lines = stdout.trim().split('\n');

      // Typical output:
      // ? (192.168.1.1) at 3c:22:fb:aa:bb:cc on en0 ifscope [ethernet]
      // router.home (192.168.1.1) at 3c:22:fb:aa:bb:cc on en0 ifscope [ethernet]
      const arpRegex = /([^\s()]+)\s+\(([\d.]+)\)\s+at\s+([0-9a-fA-F:]+)\s+on\s+(\w+)/;

      for (const line of lines) {
        const match = line.match(arpRegex);
        if (!match) continue;

        const rawHost = match[1];
        const ip = match[2];
        const rawMac = match[3];
        const iface = match[4];

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

        const isGateway = ip === defaultGwIp || ip.endsWith('.1');
        const resolvedHost =
          rawHost !== '?' && rawHost !== ip
            ? rawHost
            : isGateway
            ? 'gateway.local'
            : `host-${ip.replace(/\./g, '-')}.local`;

        if (existing) {
          existing.lastSeen = now;
          existing.status = 'online';
          if (isGateway && !existing.tags.includes('gateway')) {
            existing.tags.push('gateway', 'infrastructure');
            existing.deviceType = 'router';
          }
          db.updateDevice(existing.id, existing);
        } else {
          const newDev: Device = {
            id: `dev_${mac.replace(/:/g, '')}`,
            macAddress: mac,
            hostname: resolvedHost,
            vendor: this.lookupVendor(mac),
            ipAddresses: [ip],
            currentIp: ip,
            ipHistory: [{ ip, firstSeen: now, lastSeen: now, leaseType: isGateway ? 'static' : 'dhcp' }],
            firstSeen: now,
            lastSeen: now,
            status: 'online',
            trustStatus: isGateway ? 'known' : 'new',
            riskScore: isGateway ? 0 : 20,
            riskSeverity: 'normal',
            deviceType: isGateway ? 'router' : 'unknown',
            openPorts: [],
            riskEvidence: isGateway
              ? []
              : [
                  {
                    rule: 'New unverified device',
                    points: 20,
                    reason: 'Discovered via macOS ARP table during subnet scan',
                    timestamp: now,
                  },
                ],
            quarantined: false,
            trafficStats: {
              bytesSent: 1024,
              bytesReceived: 2048,
              packetCount: 12,
              rateKbps: 15,
            },
            tags: isGateway ? ['gateway', 'infrastructure', iface] : ['Discovered', iface],
          };

          db.addDevice(newDev);

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

    return db.getDevices();
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
    return lookupOuiVendor(mac) || 'Generic Network Interface';
  }
}

export const macosCollector = new MacosCollector();
