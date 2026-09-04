import net from 'net';
import os from 'os';
import fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { Device, OpenPort, OsDetectionDetails } from './types';
import { lookupOuiVendor } from './ouiDatabase';

const execAsync = promisify(exec);

export interface FingerprintResult {
  osGuess: string;
  confidence: number;
  deviceType: Device['deviceType'];
  details: OsDetectionDetails;
  openPorts: OpenPort[];
}

/**
 * Maps macOS Darwin kernel major versions to friendly marketing names
 */
function getDarwinMarketingName(release: string): string {
  const major = parseInt(release.split('.')[0], 10);
  switch (major) {
    case 24:
      return 'macOS Sequoia 15';
    case 23:
      return 'macOS Sonoma 14';
    case 22:
      return 'macOS Ventura 13';
    case 21:
      return 'macOS Monterey 12';
    case 20:
      return 'macOS Big Sur 11';
    case 19:
      return 'macOS Catalina 10.15';
    default:
      return `macOS Darwin (Kernel ${release})`;
  }
}

/**
 * Inspects Linux /etc/os-release if running on Linux
 */
function getLinuxPrettyName(): string {
  try {
    if (fs.existsSync('/etc/os-release')) {
      const content = fs.readFileSync('/etc/os-release', 'utf-8');
      const match = content.match(/PRETTY_NAME="?([^"\n]+)"?/);
      if (match && match[1]) {
        return match[1];
      }
    }
  } catch {
    // ignore
  }
  return `Linux Kernel ${os.release()}`;
}

export class OsFingerprintEngine {
  /**
   * Fast ICMP ping to measure initial Time-to-Live (TTL)
   */
  public async measureTtl(ip: string): Promise<number | null> {
    if (!ip || ip === '127.0.0.1' || ip === 'localhost') return 64;

    try {
      const isDarwin = process.platform === 'darwin';
      const cmd = isDarwin
        ? `ping -c 1 -W 400 ${ip} 2>/dev/null`
        : `ping -c 1 -W 1 ${ip} 2>/dev/null`;

      const { stdout } = await execAsync(cmd);
      const match = stdout.match(/ttl=(\d+)/i);
      if (match && match[1]) {
        return parseInt(match[1], 10);
      }
    } catch {
      // Ping failed or host blocked ICMP echo
    }
    return null;
  }

  /**
   * Probes a single TCP port with a tight timeout and grabs initial banner if available
   */
  public probeTcpPort(
    ip: string,
    port: number,
    timeoutMs = 400
  ): Promise<{ open: boolean; banner?: string; service: string }> {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      let hasResponded = false;
      let banner = '';

      const serviceMap: Record<number, string> = {
        22: 'ssh',
        53: 'domain',
        80: 'http',
        135: 'msrpc',
        139: 'netbios-ssn',
        443: 'https',
        445: 'microsoft-ds',
        631: 'ipp',
        3389: 'ms-wbt-server',
        5000: 'airplay-http',
        5001: 'https-admin',
        5357: 'wsdapi',
        7000: 'airplay-raop',
        8080: 'http-proxy',
      };

      const service = serviceMap[port] || `tcp-${port}`;

      socket.setTimeout(timeoutMs);

      socket.on('connect', () => {
        hasResponded = true;

        if (port === 22) {
          // SSH server immediately sends identification string
          socket.once('data', (chunk) => {
            banner = chunk.toString('utf-8').trim().split('\n')[0];
            socket.destroy();
            resolve({ open: true, banner, service });
          });
        } else if (port === 80 || port === 8080) {
          // Send HTTP HEAD request to extract Server header
          try {
            socket.write(`HEAD / HTTP/1.1\r\nHost: ${ip}\r\nUser-Agent: NetworkSentinel/1.0\r\nConnection: close\r\n\r\n`);
          } catch {}

          socket.once('data', (chunk) => {
            const res = chunk.toString('utf-8');
            const serverMatch = res.match(/Server:\s*([^\r\n]+)/i);
            if (serverMatch && serverMatch[1]) {
              banner = serverMatch[1].trim();
            }
            socket.destroy();
            resolve({ open: true, banner: banner ? `HTTP: ${banner}` : undefined, service });
          });
        } else {
          socket.destroy();
          resolve({ open: true, service });
        }
      });

      socket.on('timeout', () => {
        socket.destroy();
        if (!hasResponded) resolve({ open: false, service });
      });

      socket.on('error', () => {
        socket.destroy();
        if (!hasResponded) resolve({ open: false, service });
      });

      try {
        socket.connect(port, ip);
      } catch {
        resolve({ open: false, service });
      }
    });
  }

  /**
   * Probes targeted fingerprint ports in parallel
   */
  public async probeSignaturePorts(ip: string): Promise<{
    openPorts: OpenPort[];
    banners: string[];
    hasSmb: boolean;
    hasRdp: boolean;
    hasSsh: boolean;
    hasAirplay: boolean;
    hasIpp: boolean;
    hasHttp: boolean;
    hasWsd: boolean;
  }> {
    const targetPorts = [22, 53, 80, 135, 139, 445, 631, 3389, 5000, 5357, 7000, 8080];
    const results = await Promise.all(
      targetPorts.map((port) => this.probeTcpPort(ip, port, 450))
    );

    const openPorts: OpenPort[] = [];
    const banners: string[] = [];
    let hasSmb = false;
    let hasRdp = false;
    let hasSsh = false;
    let hasAirplay = false;
    let hasIpp = false;
    let hasHttp = false;
    let hasWsd = false;

    for (const r of results) {
      if (r.open) {
        openPorts.push({
          port: targetPorts[results.indexOf(r)],
          service: r.service,
          protocol: 'tcp',
          state: 'open',
          riskRating: [135, 139, 445, 3389].includes(r.service as any) ? 'medium' : 'low',
        });

        if (r.banner) {
          banners.push(r.banner);
        }

        if (r.service === 'microsoft-ds' || r.service === 'msrpc' || r.service === 'netbios-ssn') hasSmb = true;
        if (r.service === 'wsdapi') hasWsd = true;
        if (r.service === 'ms-wbt-server') hasRdp = true;
        if (r.service === 'ssh') hasSsh = true;
        if (r.service.includes('airplay')) hasAirplay = true;
        if (r.service === 'ipp') hasIpp = true;
        if (r.service.startsWith('http')) hasHttp = true;
      }
    }

    return {
      openPorts,
      banners,
      hasSmb,
      hasRdp,
      hasSsh,
      hasAirplay,
      hasIpp,
      hasHttp,
      hasWsd,
    };
  }

  /**
   * Fingerprints the given device using a synthesis of TTL, Port/Banner probes,
   * MAC Vendor OUI, and hostname heuristics.
   */
  public async fingerprintDevice(device: Device): Promise<FingerprintResult> {
    const now = new Date().toISOString();
    const methods: string[] = [];
    const identifiedBanners: string[] = [];
    let confidence = 50;
    let osGuess = device.osGuess || 'Unknown OS';
    let deviceType: Device['deviceType'] = device.deviceType || 'unknown';
    let signatureMatch = 'Generic Subnet Heuristic';

    // 1. Host Machine Detection (100% confidence)
    if (
      device.tags?.includes('primary-host') ||
      device.currentIp === '127.0.0.1' ||
      device.currentIp === 'localhost'
    ) {
      methods.push('Local Host Kernel & OS Release Inspection');
      confidence = 98;
      if (process.platform === 'darwin') {
        osGuess = getDarwinMarketingName(os.release());
        deviceType = 'laptop';
        signatureMatch = 'Local macOS Darwin System API';
      } else if (process.platform === 'linux') {
        osGuess = getLinuxPrettyName();
        deviceType = 'workstation';
        signatureMatch = 'Local Linux /etc/os-release';
      } else if (process.platform === 'win32') {
        osGuess = `Microsoft Windows (${os.release()})`;
        deviceType = 'workstation';
        signatureMatch = 'Local Windows Registry API';
      }

      return {
        osGuess,
        confidence,
        deviceType,
        details: {
          ttl: 64,
          methods,
          confidence,
          fingerprintedAt: now,
          identifiedBanners: [`Host: ${os.type()} ${os.release()} (${os.arch()})`],
          signatureMatch,
        },
        openPorts: device.openPorts || [],
      };
    }

    // 2. Gateway / Router Node
    const isGateway =
      device.tags?.includes('gateway') ||
      device.deviceType === 'router' ||
      device.currentIp?.endsWith('.1');

    if (isGateway) {
      methods.push('Default Gateway Network Topology Classifier');
      confidence = 90;
      deviceType = 'router';
      if (device.vendor && !device.vendor.includes('Generic')) {
        osGuess = `${device.vendor} RouterOS / Network Firmware`;
      } else {
        osGuess = 'Embedded Router OS (Gateway Firmware)';
      }
      signatureMatch = 'Default Gateway Routing Hub';
    }

    // 3. ICMP TTL Inspection
    const measuredTtl = await this.measureTtl(device.currentIp);
    let ttlFamily: 'unix' | 'windows' | 'network' | 'unknown' = 'unknown';

    if (measuredTtl !== null) {
      methods.push(`Passive ICMP TTL Inspection (Observed: ${measuredTtl})`);
      if (measuredTtl >= 50 && measuredTtl <= 64) {
        ttlFamily = 'unix';
      } else if (measuredTtl >= 110 && measuredTtl <= 128) {
        ttlFamily = 'windows';
      } else if (measuredTtl >= 240 && measuredTtl <= 255) {
        ttlFamily = 'network';
        if (!isGateway) {
          osGuess = 'Network Appliance / Embedded Infrastructure';
          deviceType = 'router';
          confidence = 75;
        }
      }
    }

    // 4. Targeted Port & Banner Probing
    const probe = await this.probeSignaturePorts(device.currentIp);
    const combinedPorts = this.mergePorts(device.openPorts || [], probe.openPorts);

    if (probe.banners.length > 0) {
      methods.push(`Service Banner Grabbing (${probe.banners.length} banners retrieved)`);
      identifiedBanners.push(...probe.banners);
    }

    // Check specific banner signatures
    for (const b of probe.banners) {
      if (b.includes('Ubuntu')) {
        osGuess = 'Ubuntu Linux';
        deviceType = 'server';
        confidence = 96;
        signatureMatch = `SSH Server Banner: ${b}`;
        break;
      } else if (b.includes('Debian')) {
        osGuess = 'Debian GNU/Linux';
        deviceType = 'server';
        confidence = 96;
        signatureMatch = `SSH Server Banner: ${b}`;
        break;
      } else if (b.includes('Raspbian') || b.includes('Raspberry')) {
        osGuess = 'Raspberry Pi OS (Linux)';
        deviceType = 'iot';
        confidence = 96;
        signatureMatch = `Raspberry Pi OS Banner: ${b}`;
        break;
      } else if (b.toLowerCase().includes('dropbear')) {
        osGuess = 'OpenWrt / Embedded Linux (Dropbear SSH)';
        deviceType = 'router';
        confidence = 92;
        signatureMatch = `Dropbear Banner: ${b}`;
        break;
      } else if (b.includes('Microsoft-IIS') || b.includes('Microsoft-HTTPAPI')) {
        osGuess = 'Microsoft Windows Server (IIS)';
        deviceType = 'server';
        confidence = 94;
        signatureMatch = `HTTP Server Banner: ${b}`;
        break;
      } else if (b.toLowerCase().includes('mikrotik') || b.toLowerCase().includes('routeros')) {
        osGuess = 'MikroTik RouterOS';
        deviceType = 'router';
        confidence = 98;
        signatureMatch = `MikroTik Service Banner: ${b}`;
        break;
      }
    }

    // 5. Apple Hardware / Stack Priority Check
    const vendorLookup = lookupOuiVendor(device.macAddress) || '';
    const vendorLower = `${device.vendor || ''} ${vendorLookup}`.toLowerCase();
    const hostLower = (device.hostname || '').toLowerCase();

    const isAppleHardware =
      vendorLower.includes('apple') ||
      hostLower.includes('macbook') ||
      hostLower.includes('imac') ||
      hostLower.includes('mac-') ||
      hostLower.includes('apple') ||
      hostLower.includes('iphone') ||
      hostLower.includes('ipad') ||
      probe.hasAirplay;

    if (isAppleHardware) {
      methods.push('Apple Ecosystem Hardware & Network Stack Correlation');
      if (hostLower.includes('iphone') || hostLower.includes('ipad')) {
        osGuess = 'Apple iOS / iPadOS';
        deviceType = 'smartphone';
        confidence = 94;
      } else {
        osGuess = 'Apple macOS (Darwin)';
        deviceType = 'laptop';
        confidence = 94;
      }
      signatureMatch = probe.hasAirplay
        ? 'Apple Bonjour / AirPlay Stack'
        : 'Apple Hardware OUI & Hostname Signature';
    } else {
      // 6. Windows OS Identification
      const isWindowsCandidate =
        probe.hasSmb ||
        probe.hasRdp ||
        probe.hasWsd ||
        ttlFamily === 'windows' ||
        vendorLower.includes('microsoft') ||
        vendorLower.includes('dell') ||
        vendorLower.includes('lenovo') ||
        vendorLower.includes('hewlett-packard') ||
        vendorLower.includes('hp') ||
        vendorLower.includes('asus') ||
        vendorLower.includes('acer') ||
        vendorLower.includes('intel') ||
        vendorLower.includes('realtek') ||
        /^(desktop|laptop|win|pc)-[a-z0-9]+/i.test(hostLower) ||
        /.*-pc$/i.test(hostLower) ||
        hostLower.includes('windows');

      if (isWindowsCandidate && confidence < 90) {
        methods.push('Microsoft Windows Network Stack / RPC / NetBIOS Correlation');
        if (probe.hasRdp) {
          osGuess = 'Microsoft Windows 10/11 Pro / Enterprise (RDP Active)';
        } else {
          osGuess = 'Microsoft Windows 10/11';
        }
        deviceType = 'workstation';
        confidence = 88;
        signatureMatch = probe.hasWsd
          ? 'Windows Web Services Discovery (WSDAPI 5357)'
          : probe.hasSmb
          ? 'Active Windows NetBIOS / SMB / MSRPC Stack'
          : ttlFamily === 'windows'
          ? 'Windows TCP/IP Stack Default TTL 128'
          : 'Windows PC Vendor / Hostname Heuristic';
      } else if (!isGateway && confidence < 75) {
        // 7. Linux / Unix Identification
        if (ttlFamily === 'unix' && probe.hasSsh) {
          methods.push('Linux / Unix SSH Stack Correlation');
          osGuess = 'Linux OS (Linux Kernel)';
          deviceType = 'server';
          confidence = 85;
          signatureMatch = 'OpenSSH Server on TTL 64 Stack';
        } else if (vendorLower.includes('synology')) {
          methods.push('Hardware OUI Vendor Correlation (Synology Inc.)');
          osGuess = 'Synology DiskStation Manager (DSM / Linux)';
          deviceType = 'server';
          confidence = 90;
        } else if (vendorLower.includes('raspberry')) {
          methods.push('Hardware OUI Vendor Correlation (Raspberry Pi)');
          osGuess = 'Raspberry Pi OS (Linux ARM)';
          deviceType = 'iot';
          confidence = 88;
        } else if (vendorLower.includes('espressif')) {
          methods.push('Hardware OUI Vendor Correlation (Espressif IoT)');
          osGuess = 'FreeRTOS / ESP-IDF (Embedded Microcontroller)';
          deviceType = 'iot';
          confidence = 90;
        } else if (hostLower.includes('android') || hostLower.includes('galaxy') || hostLower.includes('pixel')) {
          osGuess = 'Android OS (Linux Kernel)';
          deviceType = 'smartphone';
          confidence = 84;
          methods.push(`Hostname Pattern Matching ("${device.hostname}")`);
        } else if (probe.hasIpp && (vendorLower.includes('brother') || vendorLower.includes('hp') || vendorLower.includes('canon'))) {
          methods.push('Internet Printing Protocol (IPP/CUPS) Fingerprint');
          osGuess = `${device.vendor || 'Network'} Embedded Printer OS`;
          deviceType = 'printer';
          confidence = 90;
          signatureMatch = 'IPP/CUPS Daemon Port 631';
        }
      }
    }

    // 8. Undetected OS Fallback
    if (confidence < 50 || !osGuess || osGuess === 'Unknown OS') {
      osGuess = 'Unidentified Operating System';
      confidence = 30;
      signatureMatch = 'Unidentified Operating System (Flagged for Security Review)';
      methods.push('OS Signature Analysis Inconclusive');
    }

    return {
      osGuess,
      confidence,
      deviceType,
      details: {
        ttl: measuredTtl ?? undefined,
        methods,
        confidence,
        fingerprintedAt: now,
        identifiedBanners: identifiedBanners.length > 0 ? identifiedBanners : undefined,
        signatureMatch,
      },
      openPorts: combinedPorts,
    };
  }

  private mergePorts(existing: OpenPort[], detected: OpenPort[]): OpenPort[] {
    const portMap = new Map<number, OpenPort>();
    for (const p of existing) {
      portMap.set(p.port, p);
    }
    for (const p of detected) {
      portMap.set(p.port, p);
    }
    return Array.from(portMap.values()).sort((a, b) => a.port - b.port);
  }
}

export const osFingerprintEngine = new OsFingerprintEngine();
