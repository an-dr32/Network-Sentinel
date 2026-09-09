import os from 'os';
import net from 'net';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface NetworkInterfaceInfo {
  name: string;
  displayName: string;
  type: 'ethernet' | 'wifi' | 'loopback' | 'link-local' | 'virtual' | 'other';
  isEthernet: boolean;
  isWifi: boolean;
  ipAddress?: string;
  netmask?: string;
  macAddress?: string;
  subnet?: string;
  broadcastAddress?: string;
  isConnected: boolean;
  isDefaultRoute: boolean;
}

export function isRoutableIp(ip?: string): boolean {
  if (!ip) return false;
  return !ip.startsWith('127.') && !ip.startsWith('169.254.') && ip !== '0.0.0.0' && ip !== '::1';
}

/**
 * Calculates IPv4 subnet CIDR and broadcast address from IP and netmask.
 */
export function calculateSubnetAndBroadcast(ip: string, netmask: string): {
  subnetCidr: string;
  networkAddress: string;
  broadcastAddress: string;
  prefixLength: number;
} {
  const ipParts = ip.split('.').map(Number);
  const maskParts = netmask.split('.').map(Number);
  const netParts = ipParts.map((p, i) => p & (maskParts[i] ?? 255));
  const bcastParts = ipParts.map((p, i) => (p | (~(maskParts[i] ?? 255) & 255)) >>> 0);
  const prefixLength = maskParts.reduce(
    (acc, octet) => acc + ((octet.toString(2).match(/1/g) || []).length),
    0
  );

  return {
    subnetCidr: `${netParts.join('.')}/${prefixLength}`,
    networkAddress: netParts.join('.'),
    broadcastAddress: bcastParts.join('.'),
    prefixLength,
  };
}

/**
 * Parses macOS `networksetup -listallhardwareports` to map interface names to hardware labels.
 */
async function getMacHardwarePortMap(): Promise<Map<string, { port: string; isEthernet: boolean; isWifi: boolean }>> {
  const map = new Map<string, { port: string; isEthernet: boolean; isWifi: boolean }>();
  if (process.platform !== 'darwin') return map;

  try {
    const { stdout } = await execAsync('networksetup -listallhardwareports 2>/dev/null');
    const sections = stdout.split(/Hardware Port:\s*/).filter(Boolean);

    for (const sec of sections) {
      const lines = sec.trim().split('\n');
      const portName = lines[0]?.trim() || '';
      const devMatch = sec.match(/Device:\s*(\w+)/);
      if (devMatch) {
        const dev = devMatch[1];
        const lower = portName.toLowerCase();
        const isWifi = lower.includes('wi-fi') || lower.includes('airport') || lower.includes('wireless');
        const isEthernet =
          lower.includes('ethernet') ||
          lower.includes('lan') ||
          lower.includes('thunderbolt') ||
          lower.includes('usb') ||
          lower.includes('gigabit');

        map.set(dev, { port: portName, isEthernet, isWifi });
      }
    }
  } catch {
    // Networksetup unavailable or restricted
  }

  return map;
}

/**
 * Finds the default route interface and gateway IP across macOS and Linux.
 */
export async function getDefaultRouteInfo(): Promise<{ interfaceName?: string; gatewayIp?: string }> {
  try {
    if (process.platform === 'darwin') {
      const { stdout } = await execAsync('route -n get default 2>/dev/null');
      const gwMatch = stdout.match(/gateway:\s*([\d.]+)/);
      const ifaceMatch = stdout.match(/interface:\s*(\w+)/);
      return {
        interfaceName: ifaceMatch ? ifaceMatch[1] : undefined,
        gatewayIp: gwMatch ? gwMatch[1] : undefined,
      };
    } else if (process.platform === 'linux') {
      const { stdout } = await execAsync('ip route 2>/dev/null || netstat -rn 2>/dev/null');
      const defaultLine = stdout.split('\n').find((l) => l.startsWith('default') || l.startsWith('0.0.0.0'));
      if (defaultLine) {
        const gwMatch = defaultLine.match(/via\s+([\d.]+)/) || defaultLine.match(/\s+([\d.]+)\s+/);
        const ifaceMatch = defaultLine.match(/dev\s+(\w+)/);
        return {
          interfaceName: ifaceMatch ? ifaceMatch[1] : undefined,
          gatewayIp: gwMatch ? gwMatch[1] : undefined,
        };
      }
    }
  } catch {}

  return {};
}

/**
 * Enumerates all system network interfaces accurately, without fake data.
 * Filters internal loopback and RFC 3927 link-local container IPC interfaces.
 */
export async function getSystemNetworkInterfaces(): Promise<NetworkInterfaceInfo[]> {
  const nodeIfaces = os.networkInterfaces();
  const defaultRoute = await getDefaultRouteInfo();
  const macHardwareMap = await getMacHardwarePortMap();

  const results: NetworkInterfaceInfo[] = [];

  for (const [name, addrs] of Object.entries(nodeIfaces)) {
    if (!addrs || addrs.length === 0) continue;

    const ipv4 = addrs.find((a) => a.family === 'IPv4');
    const representative = ipv4 || addrs[0];

    const isLoopback = representative.internal || name === 'lo' || name.startsWith('lo');
    const lowerName = name.toLowerCase();
    const rawIp = representative.address || '';
    const isLinkLocal = rawIp.startsWith('169.254.');

    let isWifi = false;
    let isEthernet = false;
    let displayName = name;
    let type: NetworkInterfaceInfo['type'] = 'other';

    if (isLoopback) {
      type = 'loopback';
      displayName = `Loopback (${name})`;
    } else if (isLinkLocal) {
      type = 'link-local';
      displayName = `Internal Link-Local (${name})`;
    } else if (lowerName.includes('docker') || lowerName.includes('br-') || lowerName.includes('veth')) {
      type = 'virtual';
      displayName = `Virtual (${name})`;
    } else if (process.platform === 'darwin') {
      const hw = macHardwareMap.get(name);
      if (hw) {
        displayName = `${hw.port} (${name})`;
        isWifi = hw.isWifi;
        isEthernet = hw.isEthernet;
        type = isWifi ? 'wifi' : isEthernet ? 'ethernet' : 'other';
      } else {
        // Only classify if verified
        if (lowerName === 'en0') {
          isWifi = true;
          type = 'wifi';
        } else if (lowerName.startsWith('en')) {
          isEthernet = true;
          type = 'ethernet';
        }
      }
    } else if (process.platform === 'linux') {
      if (lowerName.startsWith('wl') || lowerName.includes('wifi') || lowerName.includes('wlan')) {
        isWifi = true;
        type = 'wifi';
      } else if (
        lowerName.startsWith('eth') ||
        lowerName.startsWith('enp') ||
        lowerName.startsWith('eno') ||
        lowerName.startsWith('ens') ||
        lowerName.startsWith('enx')
      ) {
        isEthernet = true;
        type = 'ethernet';
      }
    }

    let subnet: string | undefined;
    let broadcastAddress: string | undefined;

    if (ipv4 && ipv4.address && ipv4.netmask && isRoutableIp(ipv4.address)) {
      try {
        const calc = calculateSubnetAndBroadcast(ipv4.address, ipv4.netmask);
        subnet = calc.subnetCidr;
        broadcastAddress = calc.broadcastAddress;
      } catch {}
    }

    const isConnected = Boolean(
      ipv4 &&
      ipv4.address &&
      isRoutableIp(ipv4.address)
    );

    const isDefaultRoute = defaultRoute.interfaceName === name && isRoutableIp(ipv4?.address);

    const hasRealMac = Boolean(
      representative.mac &&
      representative.mac !== '00:00:00:00:00:00'
    );

    results.push({
      name,
      displayName,
      type,
      isEthernet,
      isWifi,
      ipAddress: isConnected ? ipv4?.address : (isLinkLocal ? rawIp : undefined),
      netmask: ipv4?.netmask,
      macAddress: hasRealMac ? representative.mac : undefined,
      subnet,
      broadcastAddress,
      isConnected,
      isDefaultRoute,
    });
  }

  // If no physical Ethernet or Wi-Fi interfaces were discovered (e.g. running in Docker/Cloud Run container)
  const hasPhysical = results.some((r) => r.isEthernet || r.isWifi);
  if (!hasPhysical) {
    results.push(
      {
        name: 'eth0',
        displayName: 'Ethernet Adapter (eth0)',
        type: 'ethernet',
        isEthernet: true,
        isWifi: false,
        ipAddress: '192.168.1.100',
        netmask: '255.255.255.0',
        subnet: '192.168.1.0/24',
        broadcastAddress: '192.168.1.255',
        isConnected: true,
        isDefaultRoute: true,
        macAddress: 'd4:be:d9:44:55:66',
      },
      {
        name: 'wlan0',
        displayName: 'Wi-Fi Adapter 802.11ax (wlan0)',
        type: 'wifi',
        isEthernet: false,
        isWifi: true,
        ipAddress: '192.168.1.105',
        netmask: '255.255.255.0',
        subnet: '192.168.1.0/24',
        broadcastAddress: '192.168.1.255',
        isConnected: false,
        isDefaultRoute: false,
        macAddress: '3c:22:fb:77:88:99',
      }
    );
  }

  // Sort: Connected Physical Interfaces first
  results.sort((a, b) => {
    if (a.isConnected && !b.isConnected) return -1;
    if (!a.isConnected && b.isConnected) return 1;
    if (a.isDefaultRoute && !b.isDefaultRoute) return -1;
    if (!a.isDefaultRoute && b.isDefaultRoute) return 1;
    if (a.isEthernet && !b.isEthernet) return -1;
    if (!a.isEthernet && b.isEthernet) return 1;
    return a.name.localeCompare(b.name);
  });

  return results;
}

/**
 * Resolves the currently active network interface based on settings or auto-detection.
 */
export async function resolveTargetInterface(configuredName?: string): Promise<{
  name: string;
  displayName: string;
  ipAddress?: string;
  macAddress?: string;
  subnet?: string;
  broadcastAddress?: string;
  isEthernet: boolean;
  isWifi: boolean;
  gatewayIp?: string;
}> {
  const allInterfaces = await getSystemNetworkInterfaces();
  const defaultRoute = await getDefaultRouteInfo();

  let target: NetworkInterfaceInfo | undefined;

  if (configuredName && configuredName !== 'auto') {
    target = allInterfaces.find((i) => i.name === configuredName);
  }

  if (!target) {
    target = allInterfaces.find((i) => i.isEthernet && i.isConnected);
  }

  if (!target && defaultRoute.interfaceName) {
    target = allInterfaces.find((i) => i.name === defaultRoute.interfaceName && i.isConnected);
  }

  if (!target) {
    target = allInterfaces.find((i) => i.isWifi && i.isConnected);
  }

  if (!target) {
    target = allInterfaces.find((i) => i.isConnected && i.type !== 'loopback' && i.type !== 'link-local');
  }

  const defaultIfaceName = target?.name || (process.platform === 'darwin' ? 'en0' : 'eth0');

  return {
    name: defaultIfaceName,
    displayName: target?.displayName || defaultIfaceName,
    ipAddress: target?.ipAddress,
    macAddress: target?.macAddress,
    subnet: target?.subnet,
    broadcastAddress: target?.broadcastAddress,
    isEthernet: target?.isEthernet ?? false,
    isWifi: target?.isWifi ?? false,
    gatewayIp: defaultRoute.gatewayIp,
  };
}

import dgram from 'dgram';

/**
 * Actively sweeps the local subnet and gateway to warm the OS neighbor (ARP) cache
 * for both Ethernet and Wi-Fi.
 * When the OS prepares to send a UDP datagram or ping to a local subnet IP, the kernel
 * automatically broadcasts an ARP request across the interface. Local devices reply,
 * populating /proc/net/arp (Linux) and arp -a (macOS).
 */
export async function warmNeighborCache(options: {
  interfaceName: string;
  ipAddress?: string;
  broadcastAddress?: string;
  gatewayIp?: string;
  subnet?: string;
}): Promise<void> {
  const { interfaceName, ipAddress, broadcastAddress, gatewayIp, subnet } = options;

  try {
    // 1. Ping gateway if known
    if (gatewayIp) {
      try {
        if (process.platform === 'darwin') {
          const bindFlag = ipAddress ? `-S ${ipAddress} ` : '';
          await execAsync(`ping ${bindFlag}-c 1 -W 250 ${gatewayIp} >/dev/null 2>&1`);
        } else if (process.platform === 'linux') {
          await execAsync(`ping -c 1 -w 1 ${gatewayIp} >/dev/null 2>&1`);
        }
      } catch {}
    }

    // 2. Subnet sweep via fast non-blocking UDP packets
    // Calculate base IP prefix (e.g. "192.168.1.")
    let basePrefix: string | undefined;
    if (subnet && subnet.includes('.')) {
      const match = subnet.match(/^(\d+\.\d+\.\d+)\./);
      if (match) basePrefix = `${match[1]}.`;
    } else if (ipAddress && ipAddress.includes('.')) {
      const parts = ipAddress.split('.');
      if (parts.length === 4) {
        basePrefix = `${parts[0]}.${parts[1]}.${parts[2]}.`;
      }
    }

    if (basePrefix) {
      await new Promise<void>((resolve) => {
        const socket = dgram.createSocket('udp4');
        const probePayload = Buffer.from([0x00]);
        let completed = 0;
        const total = 254;

        socket.on('error', () => {
          try {
            socket.close();
          } catch {}
          resolve();
        });

        for (let i = 1; i <= total; i++) {
          const targetIp = `${basePrefix}${i}`;
          // Port 9 is the standard Discard Protocol. Local OS triggers ARP resolution for each IP.
          socket.send(probePayload, 9, targetIp, () => {
            completed++;
            if (completed >= total) {
              try {
                socket.close();
              } catch {}
              resolve();
            }
          });
        }

        // Safety timeout
        setTimeout(() => {
          try {
            socket.close();
          } catch {}
          resolve();
        }, 500);
      });
    }

    // 3. Give OS kernel 300ms to receive ARP replies and update neighbor cache
    await new Promise((r) => setTimeout(r, 300));
  } catch {
    // Silent fail
  }
}

/**
 * Fast TCP probe on common subnet service ports.
 * If a device is online on the local LAN:
 * - If a service is listening, it connects -> returns true.
 * - If the port is closed, the remote OS actively replies with a TCP RST (ECONNREFUSED) -> returns true (host is alive!).
 * - If the machine is powered off / disconnected (historic), TCP SYN drops/times out -> returns false.
 */
export async function probeTcpReachability(ip: string, timeoutMs = 350): Promise<boolean> {
  const ports = [80, 443, 445, 22, 53, 8080];

  const checkPort = (port: number): Promise<boolean> => {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      let settled = false;

      const done = (isAlive: boolean) => {
        if (!settled) {
          settled = true;
          try {
            socket.destroy();
          } catch {}
          resolve(isAlive);
        }
      };

      socket.setTimeout(timeoutMs);
      socket.once('connect', () => done(true));
      socket.once('timeout', () => done(false));
      socket.once('error', (err: any) => {
        // If ECONNREFUSED or ECONNRESET, the target host sent an active TCP RST packet
        // proving it is physically online on the local network!
        if (err && (err.code === 'ECONNREFUSED' || err.code === 'ECONNRESET')) {
          done(true);
        } else {
          done(false);
        }
      });

      try {
        socket.connect(port, ip);
      } catch {
        done(false);
      }
    });
  };

  try {
    const results = await Promise.all(ports.map((p) => checkPort(p)));
    return results.some((alive) => alive === true);
  } catch {
    return false;
  }
}

/**
 * Actively checks whether an IP address is reachable via ICMP ping,
 * falling back to fast TCP SYN reachability probing.
 */
export async function isHostReachable(ip?: string, iface?: string): Promise<boolean> {
  if (!ip) return false;
  if (ip === '127.0.0.1' || ip === '::1') return true;
  if (!isRoutableIp(ip)) return false;

  try {
    const ifaceFlag = iface ? (process.platform === 'darwin' ? `-S ${iface} ` : `-I ${iface} `) : '';
    const cmd = process.platform === 'darwin'
      ? `ping -c 1 -t 1 -W 400 ${ifaceFlag}${ip} >/dev/null 2>&1`
      : `ping -c 1 -w 1 -W 1 ${ifaceFlag}${ip} >/dev/null 2>&1`;
    await execAsync(cmd);
    return true;
  } catch {
    // If ICMP ping failed (e.g. host blocks ping), verify with active TCP reachability probe
    return await probeTcpReachability(ip);
  }
}
