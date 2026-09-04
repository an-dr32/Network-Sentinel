import net from 'net';
import os from 'os';
import fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { Device, OpenPort, OsDetectionDetails } from './types';

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
  }> {
    const targetPorts = [22, 53, 80, 135, 445, 631, 3389, 5000, 7000, 8080];
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

    for (const r of results) {
      if (r.open) {
        openPorts.push({
          port: targetPorts[results.indexOf(r)],
          service: r.service,
          protocol: 'tcp',
          state: 'open',
          riskRating: [135, 445, 3389].includes(r.service as any) ? 'medium' : 'low',
        });

        if (r.banner) {
          banners.push(r.banner);
        }

        if (r.service === 'microsoft-ds' || r.service === 'msrpc') hasSmb = true;
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
        if (!isGateway && confidence < 70) {
          osGuess = 'Linux / Apple Darwin / Unix Family';
          confidence = 65;
        }
      } else if (measuredTtl >= 110 && measuredTtl <= 128) {
        ttlFamily = 'windows';
        osGuess = 'Microsoft Windows (NT Kernel 10/11)';
        deviceType = 'workstation';
        confidence = 78;
        signatureMatch = 'Windows IP Stack Default TTL 128';
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

    // Windows Port Signature: SMB (445) / MSRPC (135) / RDP (3389)
    if (probe.hasSmb || probe.hasRdp) {
      methods.push('Windows NetBIOS / SMB / RDP Protocol Fingerprint');
      if (confidence < 90) {
        if (probe.hasRdp) {
          osGuess = 'Microsoft Windows 10/11 Pro / Enterprise (RDP Active)';
        } else {
          osGuess = 'Microsoft Windows 10/11 (SMB/MSRPC Active)';
        }
        deviceType = 'workstation';
        confidence = 88;
        signatureMatch = 'Active Windows Core RPC & SMB Ports (445/135/3389)';
      }
    }

    // Apple Port Signature: AirPlay / RAOP (5000/7000)
    if (probe.hasAirplay) {
      methods.push('Apple AirPlay / RAOP Bonjour Stack Fingerprint');
      osGuess = 'Apple macOS / iOS (AirPlay Active)';
      deviceType = 'laptop';
      confidence = Math.max(confidence, 88);
      signatureMatch = 'AirPlay Daemon Listening on Ports 5000/7000';
    }

    // Printer CUPS / IPP Signature: 631
    if (probe.hasIpp && (device.vendor.includes('Brother') || device.vendor.includes('HP') || device.vendor.includes('Canon'))) {
      methods.push('Internet Printing Protocol (IPP/CUPS) Fingerprint');
      osGuess = `${device.vendor} Embedded Printer OS`;
      deviceType = 'iot';
      confidence = 90;
      signatureMatch = 'IPP/CUPS Daemon Port 631';
    }

    // 5. Vendor OUI Correlation
    const vendorLower = (device.vendor || '').toLowerCase();
    if (vendorLower.includes('apple')) {
      methods.push('Hardware OUI Vendor Correlation (Apple, Inc.)');
      if (ttlFamily === 'unix' || confidence < 80) {
        const hostLower = (device.hostname || '').toLowerCase();
        if (hostLower.includes('macbook') || hostLower.includes('mac') || hostLower.includes('imac')) {
          osGuess = 'Apple macOS (Darwin)';
          deviceType = 'laptop';
          confidence = Math.max(confidence, 86);
        } else if (hostLower.includes('iphone') || hostLower.includes('ipad')) {
          osGuess = 'Apple iOS / iPadOS';
          deviceType = 'smartphone';
          confidence = Math.max(confidence, 86);
        } else if (confidence < 75) {
          osGuess = 'Apple macOS / iOS (Darwin Kernel)';
          confidence = 78;
        }
      }
    } else if (vendorLower.includes('microsoft')) {
      methods.push('Hardware OUI Vendor Correlation (Microsoft Corporation)');
      osGuess = 'Microsoft Windows';
      deviceType = 'workstation';
      confidence = Math.max(confidence, 85);
    } else if (vendorLower.includes('synology')) {
      methods.push('Hardware OUI Vendor Correlation (Synology Inc.)');
      osGuess = 'Synology DiskStation Manager (DSM / Linux)';
      deviceType = 'server';
      confidence = Math.max(confidence, 90);
    } else if (vendorLower.includes('raspberry')) {
      methods.push('Hardware OUI Vendor Correlation (Raspberry Pi)');
      osGuess = 'Raspberry Pi OS (Linux ARM)';
      deviceType = 'iot';
      confidence = Math.max(confidence, 88);
    } else if (vendorLower.includes('espressif')) {
      methods.push('Hardware OUI Vendor Correlation (Espressif IoT)');
      osGuess = 'FreeRTOS / ESP-IDF (Embedded Microcontroller)';
      deviceType = 'iot';
      confidence = Math.max(confidence, 90);
    } else if (vendorLower.includes('nest') || vendorLower.includes('google')) {
      methods.push('Hardware OUI Vendor Correlation (Google / Nest Labs)');
      if (device.hostname?.includes('cam') || device.hostname?.includes('nest')) {
        osGuess = 'Embedded Linux (Nest OS)';
        deviceType = 'iot';
      } else {
        osGuess = 'Android / ChromeOS (Google)';
        deviceType = 'smartphone';
      }
      confidence = Math.max(confidence, 80);
    } else if (vendorLower.includes('mikrotik')) {
      methods.push('Hardware OUI Vendor Correlation (MikroTik RouterBOARD)');
      osGuess = 'MikroTik RouterOS';
      deviceType = 'router';
      confidence = Math.max(confidence, 95);
    }

    // 6. Hostname Pattern Heuristics
    const host = (device.hostname || '').toLowerCase();
    if (host) {
      if (host.includes('macbook') || host.includes('mac-') || host.includes('imac')) {
        if (!osGuess.includes('macOS')) osGuess = 'Apple macOS (Darwin)';
        deviceType = 'laptop';
        confidence = Math.max(confidence, 82);
        methods.push(`Hostname Pattern Matching ("${device.hostname}")`);
      } else if (host.includes('desktop-') || host.includes('win-') || host.includes('laptop-')) {
        if (!osGuess.includes('Windows')) osGuess = 'Microsoft Windows 10/11';
        deviceType = 'workstation';
        confidence = Math.max(confidence, 80);
        methods.push(`Hostname Pattern Matching ("${device.hostname}")`);
      } else if (host.includes('android') || host.includes('galaxy') || host.includes('pixel')) {
        osGuess = 'Android OS (Linux Kernel)';
        deviceType = 'smartphone';
        confidence = Math.max(confidence, 84);
        methods.push(`Hostname Pattern Matching ("${device.hostname}")`);
      }
    }

    // Default fallback
    if (confidence < 50) {
      osGuess = 'Generic IP Device';
      confidence = 35;
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
