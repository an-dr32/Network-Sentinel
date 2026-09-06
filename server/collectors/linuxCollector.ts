import fs from 'fs';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import { NetworkCollector } from './collector.interface';
import { Device, NetworkEvent } from '../types';
import { db } from '../db';
import { lookupOuiVendor } from '../ouiDatabase';
import { resolveTargetInterface, warmNeighborCache } from '../interfaceDetector';

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
    const settings = db.getSettings();

    // 1. Resolve active interface (obeying configured Ethernet/Wi-Fi or auto-detecting connected Ethernet)
    const target = await resolveTargetInterface(settings.interfaceName);
    const activeIface = target.name;
    const isEthernet = target.isEthernet;
    const ifaceIp = target.ipAddress;
    const broadcastIp = target.broadcastAddress;
    const defaultGwIp = target.gatewayIp;

    // 2. Actively warm neighbor cache on this interface
    await warmNeighborCache({
      interfaceName: activeIface,
      ipAddress: ifaceIp,
      broadcastAddress: broadcastIp,
      gatewayIp: defaultGwIp,
    });

    // 3. Register host device if available
    try {
      const ifaces = os.networkInterfaces();
      const targetIfaceAddrs = ifaces[activeIface] || Object.values(ifaces).flat().find((i) => i && !i.internal && i.family === 'IPv4');
      const ipv4Info = Array.isArray(targetIfaceAddrs)
        ? targetIfaceAddrs.find((i) => i.family === 'IPv4' && !i.internal)
        : targetIfaceAddrs;

      if (ipv4Info && ipv4Info.mac && ipv4Info.mac !== '00:00:00:00:00:00') {
        const mac = ipv4Info.mac.toLowerCase();
        const hostIp = ipv4Info.address;
        const hostName = os.hostname() || `linux-${hostIp.replace(/\./g, '-')}.local`;

        if (!db.getDeviceByMac(mac)) {
          const hostDev: Device = {
            id: `dev_${mac.replace(/:/g, '')}`,
            macAddress: mac,
            hostname: hostName,
            vendor: 'Linux Host Platform',
            ipAddresses: [hostIp],
            currentIp: hostIp,
            ipHistory: [{ ip: hostIp, firstSeen: now, lastSeen: now, leaseType: 'dhcp' }],
            firstSeen: now,
            lastSeen: now,
            status: 'online',
            trustStatus: 'known',
            riskScore: 0,
            riskSeverity: 'normal',
            deviceType: 'server',
            osGuess: 'Linux Kernel (POSIX)',
            osConfidence: 95,
            openPorts: [],
            riskEvidence: [],
            quarantined: false,
            trafficStats: {
              bytesSent: 1048576,
              bytesReceived: 2097152,
              packetCount: 3000,
              rateKbps: 60,
            },
            tags: ['workstation', 'primary-host', activeIface, isEthernet ? 'ethernet' : 'wifi'],
          };
          db.addDevice(hostDev);
        }
      }
    } catch {}

    // 4. Read /proc/net/arp and ip neigh
    const observedEntries: Array<{ ip: string; mac: string; iface: string }> = [];

    try {
      if (fs.existsSync('/proc/net/arp')) {
        const arpData = fs.readFileSync('/proc/net/arp', 'utf-8');
        const lines = arpData.trim().split('\n');
        for (let i = 1; i < lines.length; i++) {
          const parts = lines[i].trim().split(/\s+/);
          if (parts.length >= 6) {
            const ip = parts[0];
            const mac = parts[3].toLowerCase();
            const iface = parts[5];
            if (mac && mac !== '00:00:00:00:00:00') {
              observedEntries.push({ ip, mac, iface });
            }
          }
        }
      }
    } catch (err) {
      console.warn('Linux collector /proc/net/arp read error:', err);
    }

    // Try `ip neigh show` as secondary modern Linux neighbor table reader
    try {
      const { stdout: neighOut } = await execAsync(`ip -4 neigh show 2>/dev/null || true`);
      const neighLines = neighOut.trim().split('\n');
      for (const line of neighLines) {
        // e.g. "192.168.1.1 dev eth0 lladdr 00:11:22:33:44:55 REACHABLE"
        const ipMatch = line.match(/^([\d.]+)/);
        const devMatch = line.match(/dev\s+(\w+)/);
        const macMatch = line.match(/lladdr\s+([0-9a-fA-F:]+)/);
        if (ipMatch && macMatch) {
          const ip = ipMatch[1];
          const mac = macMatch[1].toLowerCase();
          const iface = devMatch ? devMatch[1] : activeIface;
          if (mac && mac !== '00:00:00:00:00:00' && !observedEntries.some((e) => e.mac === mac)) {
            observedEntries.push({ ip, mac, iface });
          }
        }
      }
    } catch {}

    for (const entry of observedEntries) {
      const { ip, mac, iface } = entry;
      const isGateway = ip === defaultGwIp || ip.endsWith('.1');
      const entryIsEthernet =
        iface === activeIface
          ? isEthernet
          : iface.startsWith('eth') ||
            iface.startsWith('enp') ||
            iface.startsWith('eno') ||
            iface.startsWith('ens') ||
            iface.startsWith('enx');

      const connTag = entryIsEthernet ? 'ethernet' : 'wifi';

      const existing = db.getDeviceByMac(mac);
      if (existing) {
        existing.lastSeen = now;
        existing.status = 'online';
        if (!existing.tags.includes(iface)) existing.tags.push(iface);
        if (!existing.tags.includes(connTag)) existing.tags.push(connTag);
        if (isGateway && !existing.tags.includes('gateway')) {
          existing.tags.push('gateway', 'infrastructure');
          existing.deviceType = 'router';
        }
        db.updateDevice(existing.id, existing);
        devices.push(existing);
      } else {
        const newDev: Device = {
          id: `dev_${mac.replace(/:/g, '')}`,
          macAddress: mac,
          hostname: isGateway ? 'gateway.local' : `host-${ip.replace(/\./g, '-')}.local`,
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
          tags: isGateway ? ['gateway', 'infrastructure', iface, connTag] : ['arp-neighbor', iface, connTag],
          deviceType: isGateway ? 'router' : 'unknown',
          openPorts: [],
          riskEvidence: isGateway
            ? []
            : [
                {
                  rule: 'New unverified device',
                  points: 20,
                  reason: `Discovered via Linux neighbor table on ${iface} (${connTag.toUpperCase()})`,
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
            title: `New Device Discovered on ${iface} (${connTag.toUpperCase()})`,
            description: `Hardware ${mac} (${newDev.vendor}) detected on Linux interface ${iface} via ${connTag}.`,
            evidence: {
              interface: iface,
              connectionType: connTag,
              ip,
              mac,
              vendor: newDev.vendor,
            },
            simulated: false,
          });
        }
      }
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
    return lookupOuiVendor(mac) || 'Generic Network Interface';
  }
}

export const linuxCollector = new LinuxCollector();
