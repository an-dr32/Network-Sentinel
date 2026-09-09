import fs from 'fs';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import { NetworkCollector } from './collector.interface';
import { Device, NetworkEvent } from '../types';
import { db } from '../db';
import { lookupOuiVendor } from '../ouiDatabase';
import { resolveTargetInterface, warmNeighborCache, isHostReachable } from '../interfaceDetector';

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

    // 3. Register or update host device if available
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

        const existingHost = db.getDeviceByMac(mac);
        if (existingHost) {
          const updatedHost = db.updateDevice(existingHost.id, {
            status: 'online',
            lastSeen: now,
            currentIp: hostIp,
          })!;
          devices.push(updatedHost);
        } else {
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
          devices.push(hostDev);
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
            const flags = parts[2];
            const mac = parts[3].toLowerCase();
            const iface = parts[5];
            // Only accept valid, complete ARP entries (Flags !== '0x0')
            if (mac && mac !== '00:00:00:00:00:00' && flags !== '0x0') {
              observedEntries.push({ ip, mac, iface });
            }
          }
        }
      }
    } catch (err) {
      console.warn('Linux collector /proc/net/arp read error:', err);
    }

    // Try `ip -4 neigh show` as secondary modern Linux neighbor table reader
    try {
      const { stdout: neighOut } = await execAsync(`ip -4 neigh show 2>/dev/null || true`);
      const neighLines = neighOut.trim().split('\n');
      for (const line of neighLines) {
        // e.g. "192.168.1.1 dev eth0 lladdr 00:11:22:33:44:55 REACHABLE"
        const upper = line.toUpperCase();
        // Ignore failed or incomplete neighbor records
        if (upper.includes('FAILED') || upper.includes('INCOMPLETE') || upper.includes('NONE')) {
          continue;
        }

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
        const updated = db.updateDevice(existing.id, existing)!;
        if (!devices.some((d) => d.id === updated.id)) {
          devices.push(updated);
        }
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

    // 5. Evaluate all other registered devices:
    // If a device in DB was marked 'online' but was NOT observed in the ARP/neighbor cache,
    // verify if it is still answering ping reachability probes. If unreachable, transition to 'offline' (Historic).
    const activeMacs = new Set(devices.map((d) => d.macAddress.toLowerCase()));
    const allDbDevices = db.getDevices();

    for (const dev of allDbDevices) {
      if (!activeMacs.has(dev.macAddress.toLowerCase())) {
        if (dev.status === 'online') {
          const reachable = await isHostReachable(dev.currentIp, activeIface);
          if (reachable) {
            const refreshed = db.updateDevice(dev.id, {
              status: 'online',
              lastSeen: now,
            })!;
            if (!devices.some((d) => d.id === refreshed.id)) {
              devices.push(refreshed);
            }
          } else {
            db.updateDevice(dev.id, {
              status: 'offline',
            });
            if (this.eventCallback) {
              this.eventCallback({
                id: `evt_off_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                timestamp: now,
                type: 'device_offline',
                severity: 'info',
                deviceId: dev.id,
                deviceName: dev.customName || dev.hostname,
                deviceIp: dev.currentIp,
                title: `Device Disconnected (${dev.customName || dev.hostname})`,
                description: `Node ${dev.macAddress} did not respond on ${activeIface} and moved to historic list.`,
                evidence: {
                  mac: dev.macAddress,
                  ip: dev.currentIp,
                  interface: activeIface,
                },
                simulated: false,
              });
            }
          }
        }
      }
    }

    // Return ONLY actively verified online devices
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

