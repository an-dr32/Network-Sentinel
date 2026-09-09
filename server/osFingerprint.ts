import net from 'net';
import dgram from 'dgram';
import dns from 'dns';
import os from 'os';
import fs from 'fs';
import http from 'http';
import https from 'https';
import { exec } from 'child_process';
import { promisify } from 'util';
import { GoogleGenAI } from '@google/genai';
import { Device, OpenPort, OsDetectionDetails } from './types';
import { lookupOuiVendor, isRandomizedMac, getHardwareArchetype } from './ouiDatabase';

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
  private geminiClient: GoogleGenAI | null = null;

  private getGeminiClient(): GoogleGenAI | null {
    if (!this.geminiClient && process.env.GEMINI_API_KEY) {
      try {
        this.geminiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      } catch (err) {
        console.warn('[Network Sentinel] Failed to initialize Gemini client:', err);
      }
    }
    return this.geminiClient;
  }

  /**
   * Fast ICMP ping to measure initial Time-to-Live (TTL)
   */
  public async measureTtl(ip: string): Promise<number | null> {
    if (!ip || ip === '127.0.0.1' || ip === 'localhost') return 64;

    try {
      const isDarwin = process.platform === 'darwin';
      const cmd = isDarwin
        ? `ping -c 1 -W 600 ${ip} 2>/dev/null`
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
   * Performs reverse DNS (PTR) lookup to find device name as registered in DHCP/DNS
   */
  public async resolveReverseDns(ip: string): Promise<string | null> {
    if (!ip || ip === '127.0.0.1' || ip === 'localhost') return null;
    try {
      const hostnames = await Promise.race([
        dns.promises.reverse(ip),
        new Promise<string[]>((_, reject) =>
          setTimeout(() => reject(new Error('Reverse DNS timeout')), 800)
        ),
      ]);
      if (hostnames && hostnames.length > 0) {
        return hostnames[0];
      }
    } catch {
      // Reverse DNS resolution not available on this subnet
    }
    return null;
  }

  /**
   * Probes a single TCP port with a tight timeout and grabs initial banner if available
   */
  public probeTcpPort(
    ip: string,
    port: number,
    timeoutMs = 600
  ): Promise<{ open: boolean; banner?: string; service: string }> {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      let hasResponded = false;
      let banner = '';

      const serviceMap: Record<number, string> = {
        22: 'ssh',
        23: 'telnet',
        53: 'domain',
        80: 'http',
        135: 'msrpc',
        139: 'netbios-ssn',
        443: 'https',
        445: 'microsoft-ds',
        515: 'lpd-printer',
        548: 'afp',
        554: 'rtsp-camera',
        631: 'ipp-printer',
        1883: 'mqtt-iot',
        3389: 'ms-rdp',
        5000: 'synology-or-airplay',
        5001: 'synology-https',
        5357: 'wsdapi',
        7000: 'airplay-raop',
        8000: 'http-alt',
        8008: 'googlecast',
        8080: 'http-proxy',
        8443: 'https-alt',
        8888: 'http-admin',
        9000: 'portainer-or-router',
        9100: 'jetdirect-printer',
        32400: 'plex-server',
      };

      const service = serviceMap[port] || `tcp-${port}`;
      socket.setTimeout(timeoutMs);

      socket.on('connect', () => {
        hasResponded = true;

        if (port === 22) {
          // SSH server identification string
          socket.once('data', (chunk) => {
            banner = chunk.toString('utf-8').trim().split('\n')[0];
            socket.destroy();
            resolve({ open: true, banner, service });
          });
          setTimeout(() => {
            if (!socket.destroyed) {
              socket.destroy();
              resolve({ open: true, service });
            }
          }, 450);
        } else if (port === 23) {
          // Telnet welcome banner
          socket.once('data', (chunk) => {
            banner = chunk.toString('utf-8').trim().replace(/[\r\n]+/g, ' ').substring(0, 100);
            socket.destroy();
            resolve({ open: true, banner, service });
          });
          setTimeout(() => {
            if (!socket.destroyed) {
              socket.destroy();
              resolve({ open: true, service });
            }
          }, 450);
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
   * Performs an HTTP/HTTPS GET request to capture Server headers and HTML <title>
   */
  public probeHttpBanner(
    ip: string,
    port: number,
    useHttps = false,
    timeoutMs = 900
  ): Promise<{ server?: string; title?: string; poweredBy?: string }> {
    return new Promise((resolve) => {
      const client = useHttps ? https : http;
      const protocol = useHttps ? 'https:' : 'http:';

      const options = {
        hostname: ip,
        port,
        path: '/',
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (NetworkSentinel OS Fingerprinter 2.0)',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          Connection: 'close',
        },
        timeout: timeoutMs,
        rejectUnauthorized: false,
      };

      try {
        const req = client.request(options, (res) => {
          let body = '';
          const server = res.headers['server'] as string | undefined;
          const poweredBy = res.headers['x-powered-by'] as string | undefined;

          res.setEncoding('utf-8');
          res.on('data', (chunk) => {
            body += chunk;
            if (body.length > 8192) {
              // Only need first 8KB for title tag
              req.destroy();
            }
          });

          res.on('end', () => {
            const titleMatch = body.match(/<title[^>]*>([^<]+)<\/title>/i);
            const title = titleMatch ? titleMatch[1].trim() : undefined;
            resolve({ server, title, poweredBy });
          });
        });

        req.on('timeout', () => {
          req.destroy();
          resolve({});
        });

        req.on('error', () => {
          resolve({});
        });

        req.end();
      } catch {
        resolve({});
      }
    });
  }

  /**
   * Queries NetBIOS Name Service (UDP 137 Node Status Request) to identify Windows PCs
   */
  public probeNetBios(ip: string, timeoutMs = 800): Promise<{ netbiosName?: string; isWindows?: boolean }> {
    return new Promise((resolve) => {
      const socket = dgram.createSocket('udp4');
      let resolved = false;

      // RFC 1002 NetBIOS Node Status Query packet
      const packet = Buffer.from([
        0xa2, 0x48, // Transaction ID
        0x00, 0x00, // Flags: 0
        0x00, 0x01, // Questions: 1
        0x00, 0x00, // Answer RRs: 0
        0x00, 0x00, // Authority RRs: 0
        0x00, 0x00, // Additional RRs: 0
        // Name: * (encoded in NetBIOS 32-byte representation)
        0x20, 0x43, 0x4b, 0x41, 0x41, 0x41, 0x41, 0x41, 0x41, 0x41, 0x41, 0x41, 0x41, 0x41, 0x41, 0x41,
        0x41, 0x41, 0x41, 0x41, 0x41, 0x41, 0x41, 0x41, 0x41, 0x41, 0x41, 0x41, 0x41, 0x41, 0x41, 0x41,
        0x41, 0x00,
        0x00, 0x21, // Type: NBSTAT (0x0021)
        0x00, 0x01, // Class: IN (0x0001)
      ]);

      const timer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          try {
            socket.close();
          } catch {}
          resolve({});
        }
      }, timeoutMs);

      socket.on('message', (msg) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          try {
            // NetBIOS Node Status response parsing
            if (msg.length > 56) {
              const numNames = msg[56];
              let offset = 57;
              let netbiosName: string | undefined;

              for (let i = 0; i < numNames && offset + 18 <= msg.length; i++) {
                const nameBytes = msg.subarray(offset, offset + 15);
                const nameType = msg[offset + 15];
                const rawName = nameBytes.toString('utf-8').trim();

                // 0x00 or 0x20 is typically workstation / computer name
                if (rawName && !netbiosName && nameType === 0x00) {
                  netbiosName = rawName;
                }
                offset += 18;
              }

              try {
                socket.close();
              } catch {}
              resolve({ netbiosName, isWindows: true });
              return;
            }
          } catch {}

          try {
            socket.close();
          } catch {}
          resolve({ isWindows: true });
        }
      });

      socket.on('error', () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          try {
            socket.close();
          } catch {}
          resolve({});
        }
      });

      try {
        socket.send(packet, 137, ip);
      } catch {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          try {
            socket.close();
          } catch {}
          resolve({});
        }
      }
    });
  }

  /**
   * Deeply probes targeted signature ports and retrieves web/service banners
   */
  public async probeSignaturePorts(ip: string): Promise<{
    openPorts: OpenPort[];
    banners: Record<string, string>;
    identifiedBanners: string[];
    hasSmb: boolean;
    hasRdp: boolean;
    hasSsh: boolean;
    hasAirplay: boolean;
    hasIpp: boolean;
    hasHttp: boolean;
    hasWsd: boolean;
    hasGoogleCast: boolean;
    hasSynology: boolean;
    httpTitle?: string;
  }> {
    const targetPorts = [
      22, 23, 53, 80, 135, 139, 443, 445, 515, 548, 554, 631, 1883, 3389,
      5000, 5001, 5357, 7000, 8000, 8008, 8080, 8443, 9000, 9100, 32400,
    ];

    const tcpResults = await Promise.all(
      targetPorts.map((port) => this.probeTcpPort(ip, port, 600))
    );

    const openPorts: OpenPort[] = [];
    const banners: Record<string, string> = {};
    const identifiedBanners: string[] = [];

    let hasSmb = false;
    let hasRdp = false;
    let hasSsh = false;
    let hasAirplay = false;
    let hasIpp = false;
    let hasHttp = false;
    let hasWsd = false;
    let hasGoogleCast = false;
    let hasSynology = false;
    let httpTitle: string | undefined;

    for (let i = 0; i < tcpResults.length; i++) {
      const r = tcpResults[i];
      const port = targetPorts[i];

      if (r.open) {
        openPorts.push({
          port,
          service: r.service,
          protocol: 'tcp',
          state: 'open',
          riskRating: [135, 139, 445, 3389].includes(port) ? 'medium' : 'low',
        });

        if (r.banner) {
          banners[r.service] = r.banner;
          identifiedBanners.push(`${r.service.toUpperCase()}: ${r.banner}`);
        }

        if (port === 445 || port === 135 || port === 139) hasSmb = true;
        if (port === 5357) hasWsd = true;
        if (port === 3389) hasRdp = true;
        if (port === 22) hasSsh = true;
        if (port === 7000 || port === 548) hasAirplay = true;
        if (port === 631 || port === 515 || port === 9100) hasIpp = true;
        if (port === 80 || port === 443 || port === 8080 || port === 8000) hasHttp = true;
        if (port === 8008) hasGoogleCast = true;
        if (port === 5000 || port === 5001) hasSynology = true;
      }
    }

    // If HTTP/HTTPS is open, grab Web banner and HTML <title>
    const httpPort = openPorts.find((p) => [80, 8080, 8000, 5000, 9000].includes(p.port));
    const httpsPort = openPorts.find((p) => [443, 8443, 5001].includes(p.port));

    if (httpPort) {
      const httpInfo = await this.probeHttpBanner(ip, httpPort.port, false);
      if (httpInfo.server) {
        banners[`http-${httpPort.port}`] = `Server: ${httpInfo.server}`;
        identifiedBanners.push(`HTTP Server: ${httpInfo.server}`);
      }
      if (httpInfo.title) {
        httpTitle = httpInfo.title;
        banners[`http-title`] = `Title: ${httpInfo.title}`;
        identifiedBanners.push(`HTML Title: "${httpInfo.title}"`);
      }
    } else if (httpsPort) {
      const httpsInfo = await this.probeHttpBanner(ip, httpsPort.port, true);
      if (httpsInfo.server) {
        banners[`https-${httpsPort.port}`] = `Server: ${httpsInfo.server}`;
        identifiedBanners.push(`HTTPS Server: ${httpsInfo.server}`);
      }
      if (httpsInfo.title) {
        httpTitle = httpsInfo.title;
        banners[`https-title`] = `Title: ${httpsInfo.title}`;
        identifiedBanners.push(`HTML Title: "${httpsInfo.title}"`);
      }
    }

    return {
      openPorts,
      banners,
      identifiedBanners,
      hasSmb,
      hasRdp,
      hasSsh,
      hasAirplay,
      hasIpp,
      hasHttp,
      hasWsd,
      hasGoogleCast,
      hasSynology,
      httpTitle,
    };
  }

  /**
   * Fingerprints the given device using a resilient, multi-vector Bayesian scoring system.
   * Synthesizes hardware OUI, randomized MACs, TTL, reverse DNS PTR, port profiles,
   * service banners, and NetBIOS telemetry.
   */
  public async fingerprintDevice(device: Device): Promise<FingerprintResult> {
    const now = new Date().toISOString();
    const methods: string[] = [];

    // 1. Host Machine Detection (Ground Truth 100% confidence)
    if (
      device.tags?.includes('primary-host') ||
      device.currentIp === '127.0.0.1' ||
      device.currentIp === 'localhost'
    ) {
      methods.push('Local Host Kernel & OS Release Inspection');
      let osGuess = 'Local Host OS';
      let deviceType: Device['deviceType'] = 'workstation';
      let signatureMatch = 'Local Host Kernel System API';

      if (process.platform === 'darwin') {
        osGuess = getDarwinMarketingName(os.release());
        deviceType = 'laptop';
        signatureMatch = 'Local macOS Darwin Kernel API';
      } else if (process.platform === 'linux') {
        osGuess = getLinuxPrettyName();
        deviceType = 'server';
        signatureMatch = 'Local Linux /etc/os-release';
      } else if (process.platform === 'win32') {
        osGuess = `Microsoft Windows (${os.release()})`;
        deviceType = 'workstation';
        signatureMatch = 'Local Windows Registry API';
      }

      return {
        osGuess,
        confidence: 99,
        deviceType,
        details: {
          ttl: 64,
          methods,
          confidence: 99,
          fingerprintedAt: now,
          identifiedBanners: [`Host Platform: ${os.type()} ${os.release()} (${os.arch()})`],
          banners: { host: `${os.type()} ${os.release()} (${os.arch()})` },
          signatureMatch,
        },
        openPorts: device.openPorts || [],
      };
    }

    // 2. Hardware Layer & MAC Address Profiling
    const mac = device.macAddress || '';
    const hasRandomMac = isRandomizedMac(mac);
    const ouiVendor = lookupOuiVendor(mac);
    const resolvedVendor = ouiVendor || device.vendor || null;
    const archetype = getHardwareArchetype(resolvedVendor, mac);

    if (hasRandomMac) {
      methods.push('IEEE 802 Locally Administered MAC Detection (Private Wi-Fi Address)');
    }
    if (ouiVendor && !hasRandomMac) {
      methods.push(`IEEE OUI Vendor Identification (${ouiVendor})`);
    }

    // 3. Network Transport Layer: ICMP TTL & Reverse DNS (PTR)
    const [measuredTtl, reverseDns, netbios] = await Promise.all([
      this.measureTtl(device.currentIp),
      this.resolveReverseDns(device.currentIp),
      this.probeNetBios(device.currentIp),
    ]);

    let ttlCategory: 'unix' | 'windows' | 'network' | 'unknown' = 'unknown';
    if (measuredTtl !== null) {
      methods.push(`Passive ICMP TTL Inspection (Observed TTL: ${measuredTtl})`);
      if (measuredTtl >= 50 && measuredTtl <= 64) {
        ttlCategory = 'unix';
      } else if (measuredTtl >= 100 && measuredTtl <= 128) {
        ttlCategory = 'windows';
      } else if (measuredTtl >= 240 && measuredTtl <= 255) {
        ttlCategory = 'network';
      }
    }

    if (reverseDns) {
      methods.push(`Reverse DNS (PTR) Record Resolution ("${reverseDns}")`);
    }

    if (netbios.isWindows) {
      methods.push(`NetBIOS Name Service Response (${netbios.netbiosName || 'Windows PC'})`);
    }

    // 4. Application Layer: Port Scan & Service Banners
    const probe = await this.probeSignaturePorts(device.currentIp);
    const combinedPorts = this.mergePorts(device.openPorts || [], probe.openPorts);

    if (probe.identifiedBanners.length > 0) {
      methods.push(`Service Banner Grabbing (${probe.identifiedBanners.length} banners captured)`);
    }

    // Extract consolidated telemetry strings for multi-vector scoring
    const allBanners = Object.values(probe.banners).join(' ');
    const hostLower = `${device.hostname || ''} ${device.customName || ''} ${reverseDns || ''} ${netbios.netbiosName || ''}`.toLowerCase();
    const vendorLower = (resolvedVendor || '').toLowerCase();
    const titleLower = (probe.httpTitle || '').toLowerCase();

    // 5. Multi-Vector Evidence-Scored Classification System
    // Each candidate OS builds evidence points based on independent vectors.
    interface OsCandidate {
      name: string;
      deviceType: Device['deviceType'];
      score: number;
      signature: string;
      matchedRules: string[];
    }

    const candidates: Record<string, OsCandidate> = {
      macos: { name: 'Apple macOS', deviceType: 'laptop', score: 0, signature: 'Apple macOS Stack', matchedRules: [] },
      ios: { name: 'Apple iOS / iPadOS', deviceType: 'smartphone', score: 0, signature: 'Apple Mobile Device', matchedRules: [] },
      apple_tv: { name: 'Apple tvOS (Apple TV / HomePod)', deviceType: 'iot', score: 0, signature: 'Apple tvOS AirPlay', matchedRules: [] },
      windows_workstation: { name: 'Microsoft Windows 10/11', deviceType: 'workstation', score: 0, signature: 'Windows Workstation Stack', matchedRules: [] },
      windows_server: { name: 'Microsoft Windows Server', deviceType: 'server', score: 0, signature: 'Windows Server Stack', matchedRules: [] },
      ubuntu_linux: { name: 'Ubuntu Linux', deviceType: 'server', score: 0, signature: 'Ubuntu Linux Distribution', matchedRules: [] },
      debian_linux: { name: 'Debian GNU/Linux', deviceType: 'server', score: 0, signature: 'Debian GNU/Linux Distribution', matchedRules: [] },
      raspberry_pi: { name: 'Raspberry Pi OS (Linux ARM)', deviceType: 'iot', score: 0, signature: 'Raspberry Pi Linux System', matchedRules: [] },
      linux_server: { name: 'Linux OS (Linux Kernel)', deviceType: 'server', score: 0, signature: 'POSIX / Linux Network Stack', matchedRules: [] },
      android: { name: 'Android OS', deviceType: 'smartphone', score: 0, signature: 'Android Mobile Linux Stack', matchedRules: [] },
      chromeos: { name: 'Google ChromeOS', deviceType: 'laptop', score: 0, signature: 'Google ChromeOS Device', matchedRules: [] },
      openwrt: { name: 'OpenWrt / Embedded Linux Router', deviceType: 'router', score: 0, signature: 'OpenWrt Network OS', matchedRules: [] },
      mikrotik: { name: 'MikroTik RouterOS', deviceType: 'router', score: 0, signature: 'MikroTik RouterOS', matchedRules: [] },
      pfsense: { name: 'pfSense / OPNsense Firewall (FreeBSD)', deviceType: 'router', score: 0, signature: 'BSD Packet Filter Gateway', matchedRules: [] },
      unifi: { name: 'Ubiquiti UniFi OS', deviceType: 'router', score: 0, signature: 'UniFi Network Infrastructure', matchedRules: [] },
      router_firmware: { name: 'Network Gateway / Router Firmware', deviceType: 'router', score: 0, signature: 'Network Routing Hub', matchedRules: [] },
      printer: { name: 'Network Printer OS (IPP/JetDirect)', deviceType: 'printer', score: 0, signature: 'Network Printing Appliance', matchedRules: [] },
      smart_tv: { name: 'Smart TV / Streaming Device', deviceType: 'iot', score: 0, signature: 'Media Streaming Appliance', matchedRules: [] },
      iot_device: { name: 'Smart Home IoT Appliance', deviceType: 'iot', score: 0, signature: 'Embedded Microcontroller Firmware', matchedRules: [] },
      synology_nas: { name: 'Synology DiskStation Manager (DSM)', deviceType: 'server', score: 0, signature: 'Synology DSM Storage Appliance', matchedRules: [] },
    };

    // Vector A: Service Banners & Application Layer (Highest weight: 50-80 pts)
    if (allBanners.includes('Ubuntu')) {
      candidates.ubuntu_linux.score += 70;
      candidates.ubuntu_linux.signature = `Captured Banner: ${probe.banners['ssh'] || 'Ubuntu'}`;
      candidates.ubuntu_linux.matchedRules.push('Ubuntu Distribution String');
    }
    if (allBanners.includes('Debian')) {
      candidates.debian_linux.score += 70;
      candidates.debian_linux.signature = `Captured Banner: ${probe.banners['ssh'] || 'Debian'}`;
      candidates.debian_linux.matchedRules.push('Debian Distribution String');
    }
    if (allBanners.toLowerCase().includes('raspbian') || allBanners.toLowerCase().includes('raspberry')) {
      candidates.raspberry_pi.score += 75;
      candidates.raspberry_pi.signature = 'Raspberry Pi OS SSH Signature';
      candidates.raspberry_pi.matchedRules.push('Raspbian Banner');
    }
    if (allBanners.toLowerCase().includes('dropbear')) {
      candidates.openwrt.score += 65;
      candidates.openwrt.signature = 'Dropbear Lightweight SSH (OpenWrt/Embedded)';
      candidates.openwrt.matchedRules.push('Dropbear SSH Daemon');
    }
    if (allBanners.toLowerCase().includes('mikrotik') || allBanners.toLowerCase().includes('routeros')) {
      candidates.mikrotik.score += 85;
      candidates.mikrotik.signature = 'MikroTik RouterOS Daemon';
      candidates.mikrotik.matchedRules.push('RouterOS Service Banner');
    }
    if (allBanners.includes('Microsoft-IIS') || allBanners.includes('Microsoft-HTTPAPI')) {
      candidates.windows_server.score += 75;
      candidates.windows_server.signature = 'Microsoft-IIS Web Server Banner';
      candidates.windows_server.matchedRules.push('IIS Web Server');
    }
    if (allBanners.includes('OpenSSH_for_Windows')) {
      candidates.windows_workstation.score += 70;
      candidates.windows_workstation.signature = 'Windows OpenSSH Server Banner';
      candidates.windows_workstation.matchedRules.push('Windows OpenSSH');
    }

    // HTML <title> signatures
    if (titleLower.includes('openwrt') || titleLower.includes('luci')) {
      candidates.openwrt.score += 70;
      candidates.openwrt.signature = `Web GUI: "${probe.httpTitle}"`;
      candidates.openwrt.matchedRules.push('OpenWrt LuCI Title');
    }
    if (titleLower.includes('pfsense') || titleLower.includes('opnsense')) {
      candidates.pfsense.score += 80;
      candidates.pfsense.signature = `Firewall GUI: "${probe.httpTitle}"`;
      candidates.pfsense.matchedRules.push('pfSense/OPNsense Web GUI');
    }
    if (titleLower.includes('synology') || titleLower.includes('dsm')) {
      candidates.synology_nas.score += 80;
      candidates.synology_nas.signature = `NAS Web GUI: "${probe.httpTitle}"`;
      candidates.synology_nas.matchedRules.push('Synology DSM Web GUI');
    }
    if (titleLower.includes('unifi')) {
      candidates.unifi.score += 80;
      candidates.unifi.signature = `UniFi Controller: "${probe.httpTitle}"`;
      candidates.unifi.matchedRules.push('UniFi Title');
    }
    if (titleLower.includes('router') || titleLower.includes('wireless') || titleLower.includes('gateway') || titleLower.includes('asus') || titleLower.includes('netgear') || titleLower.includes('tp-link')) {
      candidates.router_firmware.score += 50;
      candidates.router_firmware.signature = `Router Web Console: "${probe.httpTitle}"`;
      candidates.router_firmware.matchedRules.push('Router Web Title');
    }
    if (titleLower.includes('printer') || titleLower.includes('laserjet') || titleLower.includes('inkjet') || titleLower.includes('deskjet') || titleLower.includes('epson') || titleLower.includes('brother')) {
      candidates.printer.score += 65;
      candidates.printer.signature = `Printer Status Console: "${probe.httpTitle}"`;
      candidates.printer.matchedRules.push('Printer Web Title');
    }

    // Vector B: Open Ports & Characteristic Services
    if (probe.hasSmb) {
      candidates.windows_workstation.score += 35;
      candidates.windows_server.score += 35;
      candidates.windows_workstation.matchedRules.push('SMB/CIFS (Port 445/139)');
    }
    if (probe.hasWsd) {
      candidates.windows_workstation.score += 40;
      candidates.windows_workstation.matchedRules.push('Windows Web Services Discovery (5357)');
    }
    if (probe.hasRdp) {
      candidates.windows_workstation.score += 40;
      candidates.windows_server.score += 45;
      candidates.windows_workstation.matchedRules.push('Remote Desktop (RDP 3389)');
    }
    if (netbios.isWindows) {
      candidates.windows_workstation.score += 45;
      candidates.windows_workstation.matchedRules.push(`NetBIOS Response (${netbios.netbiosName})`);
    }
    if (probe.hasIpp) {
      candidates.printer.score += 55;
      candidates.printer.matchedRules.push('IPP/JetDirect Printing Daemon');
    }
    if (probe.hasAirplay) {
      candidates.macos.score += 30;
      candidates.apple_tv.score += 45;
      candidates.apple_tv.matchedRules.push('Apple AirPlay/RAOP Daemon (7000)');
    }
    if (probe.hasGoogleCast) {
      candidates.smart_tv.score += 60;
      candidates.smart_tv.name = 'Google Cast / Chromecast';
      candidates.smart_tv.matchedRules.push('Google Cast Daemon (8008)');
    }
    if (probe.hasSynology) {
      candidates.synology_nas.score += 55;
      candidates.synology_nas.matchedRules.push('Synology DSM Ports (5000/5001)');
    }
    if (probe.hasSsh) {
      candidates.linux_server.score += 25;
      candidates.ubuntu_linux.score += 20;
      candidates.debian_linux.score += 20;
      candidates.raspberry_pi.score += 20;
      candidates.linux_server.matchedRules.push('OpenSSH Server (Port 22)');
    }

    // Vector C: Transport Layer TTL Stack
    if (ttlCategory === 'windows') {
      candidates.windows_workstation.score += 35;
      candidates.windows_server.score += 35;
      candidates.windows_workstation.matchedRules.push(`Windows TCP/IP Stack (TTL ${measuredTtl})`);
    } else if (ttlCategory === 'unix') {
      candidates.macos.score += 15;
      candidates.ios.score += 15;
      candidates.linux_server.score += 15;
      candidates.ubuntu_linux.score += 15;
      candidates.debian_linux.score += 15;
      candidates.raspberry_pi.score += 15;
      candidates.android.score += 15;
      candidates.openwrt.score += 15;
    } else if (ttlCategory === 'network') {
      candidates.router_firmware.score += 40;
      candidates.router_firmware.matchedRules.push(`Network Infrastructure (TTL ${measuredTtl})`);
    }

    // Vector D: Hardware Archetype & OUI Vendor
    switch (archetype) {
      case 'apple_ecosystem':
        if (hostLower.includes('iphone') || hostLower.includes('ipad')) {
          candidates.ios.score += 60;
          candidates.ios.matchedRules.push('Apple OUI + Mobile Hostname');
        } else if (hostLower.includes('tv') || hostLower.includes('homepod') || probe.hasAirplay) {
          candidates.apple_tv.score += 55;
          candidates.apple_tv.matchedRules.push('Apple OUI + Audio/Video Signature');
        } else {
          candidates.macos.score += 50;
          candidates.macos.matchedRules.push('Apple Inc. OUI Hardware Prefix');
        }
        break;

      case 'samsung_device':
        if (hostLower.includes('tv') || hostLower.includes('tizen') || probe.hasHttp) {
          candidates.smart_tv.score += 55;
          candidates.smart_tv.name = 'Samsung Smart TV (Tizen OS)';
          candidates.smart_tv.matchedRules.push('Samsung Smart TV Profile');
        } else {
          candidates.android.score += 50;
          candidates.android.name = 'Samsung Galaxy (Android OS)';
          candidates.android.matchedRules.push('Samsung Mobile Hardware OUI');
        }
        break;

      case 'google_ecosystem':
        if (hostLower.includes('chromecast') || probe.hasGoogleCast) {
          candidates.smart_tv.score += 65;
          candidates.smart_tv.name = 'Google Chromecast / Google TV';
          candidates.smart_tv.matchedRules.push('Google Streaming Hardware');
        } else if (hostLower.includes('pixel') || hostLower.includes('android')) {
          candidates.android.score += 55;
          candidates.android.name = 'Google Pixel (Android OS)';
          candidates.android.matchedRules.push('Google Pixel Mobile Hardware');
        } else {
          candidates.iot_device.score += 50;
          candidates.iot_device.name = 'Google Nest / Home IoT';
          candidates.iot_device.matchedRules.push('Google Nest Hardware');
        }
        break;

      case 'raspberry_pi_linux':
        candidates.raspberry_pi.score += 70;
        candidates.raspberry_pi.matchedRules.push('Raspberry Pi Foundation Hardware OUI');
        break;

      case 'printer':
        candidates.printer.score += 70;
        if (resolvedVendor) {
          candidates.printer.name = `${resolvedVendor.split(' ')[0]} Embedded Printer OS`;
        }
        candidates.printer.matchedRules.push('Printer Manufacturer OUI Prefix');
        break;

      case 'storage_nas':
        candidates.synology_nas.score += 60;
        candidates.synology_nas.matchedRules.push('Storage Appliance Hardware OUI');
        break;

      case 'smart_tv_streaming':
        candidates.smart_tv.score += 65;
        if (vendorLower.includes('roku')) candidates.smart_tv.name = 'Roku OS (Streaming Player)';
        if (vendorLower.includes('playstation')) candidates.smart_tv.name = 'Sony PlayStation (Orbis/Prospero OS)';
        if (vendorLower.includes('nintendo')) candidates.smart_tv.name = 'Nintendo Switch (Horizon OS)';
        if (vendorLower.includes('xbox')) candidates.smart_tv.name = 'Microsoft Xbox OS';
        if (vendorLower.includes('webos')) candidates.smart_tv.name = 'LG webOS Smart TV';
        candidates.smart_tv.matchedRules.push('Media Streaming / Console OUI');
        break;

      case 'iot_embedded':
        candidates.iot_device.score += 65;
        if (vendorLower.includes('espressif')) candidates.iot_device.name = 'ESP32/ESP8266 Microcontroller (FreeRTOS)';
        if (vendorLower.includes('sonos')) candidates.iot_device.name = 'Sonos Audio OS (Embedded Linux)';
        if (vendorLower.includes('philips') || vendorLower.includes('hue')) candidates.iot_device.name = 'Philips Hue Bridge (Linux)';
        candidates.iot_device.matchedRules.push('Embedded IoT Hardware OUI');
        break;

      case 'router_infrastructure':
        candidates.router_firmware.score += 55;
        if (vendorLower.includes('mikrotik')) candidates.mikrotik.score += 60;
        if (vendorLower.includes('ubiquiti')) candidates.unifi.score += 60;
        if (resolvedVendor) candidates.router_firmware.name = `${resolvedVendor} Router Firmware`;
        candidates.router_firmware.matchedRules.push('Network Gateway Hardware OUI');
        break;

      case 'pc_workstation':
        // Dell, HP, Lenovo, ASUS, Acer PCs:
        // DO NOT unconditionally assume Windows. Weight Windows if SMB/RDP or TTL 128 is present, otherwise split with Linux
        if (ttlCategory === 'windows' || probe.hasSmb || probe.hasRdp || probe.hasWsd) {
          candidates.windows_workstation.score += 35;
          candidates.windows_workstation.matchedRules.push('PC Manufacturer + Windows Stack');
        } else {
          candidates.linux_server.score += 20;
          candidates.windows_workstation.score += 15;
          candidates.linux_server.matchedRules.push('PC Workstation Hardware Architecture');
        }
        break;

      case 'mobile_randomized':
        // Modern smartphone / tablet with Private Wi-Fi Addressing
        if (ttlCategory === 'unix') {
          if (hostLower.includes('iphone') || hostLower.includes('ipad') || hostLower.includes('apple')) {
            candidates.ios.score += 45;
            candidates.ios.matchedRules.push('Private MAC + Apple Signature');
          } else if (hostLower.includes('android') || hostLower.includes('galaxy') || hostLower.includes('pixel')) {
            candidates.android.score += 45;
            candidates.android.matchedRules.push('Private MAC + Android Signature');
          } else {
            // General modern mobile device
            candidates.ios.score += 25;
            candidates.android.score += 25;
            methods.push('Classified as Modern Mobile Device via Private Wi-Fi Address');
          }
        }
        break;

      case 'virtual_machine':
        candidates.linux_server.score += 25;
        candidates.windows_server.score += 25;
        candidates.linux_server.matchedRules.push('Virtualization Hypervisor Stack (VMware/QEMU)');
        break;

      default:
        break;
    }

    // Vector E: Hostname & Reverse DNS Pattern Analysis
    if (hostLower.includes('iphone') || hostLower.includes('ipad')) {
      candidates.ios.score += 50;
      candidates.ios.matchedRules.push(`Hostname Pattern: "${device.hostname || reverseDns}"`);
    } else if (hostLower.includes('macbook') || hostLower.includes('imac') || hostLower.includes('mac-') || hostLower.includes('darwin')) {
      candidates.macos.score += 50;
      candidates.macos.matchedRules.push(`Hostname Pattern: "${device.hostname || reverseDns}"`);
    } else if (hostLower.includes('appletv') || hostLower.includes('apple-tv')) {
      candidates.apple_tv.score += 65;
      candidates.apple_tv.matchedRules.push('Apple TV Hostname Signature');
    } else if (hostLower.includes('android') || hostLower.includes('galaxy') || hostLower.includes('pixel') || hostLower.includes('redmi')) {
      candidates.android.score += 50;
      candidates.android.matchedRules.push(`Hostname Pattern: "${device.hostname || reverseDns}"`);
    } else if (/^(desktop|laptop|win|pc)-[a-z0-9]+/i.test(hostLower) || hostLower.includes('windows')) {
      candidates.windows_workstation.score += 45;
      candidates.windows_workstation.matchedRules.push(`Windows Hostname Pattern: "${device.hostname || reverseDns}"`);
    } else if (hostLower.includes('server') || hostLower.includes('srv-') || hostLower.includes('dc-')) {
      candidates.windows_server.score += 30;
      candidates.linux_server.score += 30;
    } else if (hostLower.includes('ubuntu')) {
      candidates.ubuntu_linux.score += 45;
      candidates.ubuntu_linux.matchedRules.push('Ubuntu Hostname Signature');
    } else if (hostLower.includes('debian')) {
      candidates.debian_linux.score += 45;
      candidates.debian_linux.matchedRules.push('Debian Hostname Signature');
    } else if (hostLower.includes('chromebook') || hostLower.includes('chrome-os')) {
      candidates.chromeos.score += 60;
      candidates.chromeos.matchedRules.push('ChromeOS Hostname Signature');
    }

    // Determine Top Candidate by Aggregated Score
    const ranked = Object.values(candidates).sort((a, b) => b.score - a.score);
    const top = ranked[0];
    const second = ranked[1];

    let osGuess = 'Unidentified Operating System';
    let confidence = 35;
    let deviceType: Device['deviceType'] = 'unknown';
    let signatureMatch = 'Insufficient deterministic network signals';

    if (top && top.score >= 40) {
      osGuess = top.name;
      deviceType = top.deviceType;
      signatureMatch = top.signature || top.matchedRules.join(' + ');

      // Calculate confidence based on evidence score and separation from runner-up
      const separation = second ? top.score - second.score : top.score;
      if (top.score >= 90 || separation >= 40) {
        confidence = Math.min(98, 85 + Math.floor((top.score - 90) / 5));
      } else if (top.score >= 65) {
        confidence = Math.min(88, 75 + Math.floor((top.score - 65) / 3));
      } else {
        confidence = Math.min(74, 55 + Math.floor((top.score - 40) / 2));
      }

      methods.push(...top.matchedRules.map((r) => `Correlated: ${r}`));
    } else {
      // Fallback inference if signals are sparse
      if (archetype === 'mobile_randomized' && ttlCategory === 'unix') {
        osGuess = 'Mobile Device (iOS or Android)';
        deviceType = 'smartphone';
        confidence = 65;
        signatureMatch = 'Private Wi-Fi Address + TTL 64 Unix Stack';
        methods.push('Passive Mobile Fingerprint (Firewalled Device)');
      } else if (device.tags?.includes('gateway') || (device.currentIp.endsWith('.1') && device.tags?.includes('infrastructure'))) {
        osGuess = resolvedVendor && !resolvedVendor.includes('Generic')
          ? `${resolvedVendor} Router Firmware`
          : 'Network Gateway / Router Firmware';
        deviceType = 'router';
        confidence = 75;
        signatureMatch = 'Default Gateway Topology Position';
        methods.push('Network Topology Gateway Position');
      } else if (ttlCategory === 'windows') {
        osGuess = 'Microsoft Windows';
        deviceType = 'workstation';
        confidence = 68;
        signatureMatch = 'Default TCP/IP Stack TTL 128';
        methods.push('Observed TCP/IP TTL 128 Stack');
      } else if (ttlCategory === 'unix') {
        osGuess = 'Linux / Unix OS (POSIX Kernel)';
        deviceType = 'server';
        confidence = 60;
        signatureMatch = 'Default TCP/IP Stack TTL 64';
        methods.push('Observed TCP/IP TTL 64 Stack');
      } else {
        osGuess = 'Unidentified Operating System';
        confidence = 30;
        signatureMatch = 'Inconclusive telemetry (host firewalled)';
        methods.push('OS Signature Analysis Inconclusive');
      }
    }

    // 6. Optional AI Deep Analysis via Gemini (if available & confidence < 80)
    let aiAnalysis: string | undefined;
    const gemini = this.getGeminiClient();
    if (gemini && confidence < 80) {
      try {
        const prompt = `Analyze this defensive network security telemetry and determine the most likely operating system and device type.
Device IP: ${device.currentIp}
MAC: ${device.macAddress} (Randomized: ${hasRandomMac ? 'Yes' : 'No'})
Vendor: ${resolvedVendor || 'Unknown'}
Hostname: ${device.hostname || 'None'}
Reverse DNS: ${reverseDns || 'None'}
ICMP TTL: ${measuredTtl ?? 'Filtered/Unanswered'}
Open Ports: ${combinedPorts.map((p) => `${p.port}/${p.service}`).join(', ') || 'None open'}
Service Banners: ${JSON.stringify(probe.banners)}
HTTP Title: ${probe.httpTitle || 'None'}
NetBIOS: ${netbios.netbiosName || 'None'}

Return a JSON object only in this format:
{"osGuess": "...", "deviceType": "router|workstation|laptop|smartphone|iot|server|printer|unknown", "confidence": 0-100, "reasoning": "..."}`;

        const aiResponse = await gemini.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
          },
        });

        if (aiResponse && aiResponse.text) {
          const parsed = JSON.parse(aiResponse.text.trim());
          if (parsed.osGuess && parsed.confidence >= confidence) {
            osGuess = parsed.osGuess;
            confidence = Math.min(95, parsed.confidence);
            if (parsed.deviceType) deviceType = parsed.deviceType;
            signatureMatch = `AI Multimodal Synthesis: ${parsed.reasoning || 'Gemini Network Analysis'}`;
            aiAnalysis = parsed.reasoning;
            methods.push('Gemini AI Deep Multimodal Telemetry Synthesis');
          }
        }
      } catch (err) {
        console.warn('[Network Sentinel] Gemini OS analysis warning:', err);
      }
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
        identifiedBanners: probe.identifiedBanners.length > 0 ? probe.identifiedBanners : undefined,
        banners: Object.keys(probe.banners).length > 0 ? probe.banners : undefined,
        signatureMatch,
        reverseDns: reverseDns || undefined,
        macRandomized: hasRandomMac,
        httpTitle: probe.httpTitle || undefined,
        aiAnalysis,
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
