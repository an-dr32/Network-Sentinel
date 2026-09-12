/**
 * @file server/observedPorts.ts
 * @description Central manager and catalog for network ports under active observation.
 *
 * Architecture & Developer Notes:
 * 1. Single Source of Truth:
 *    - Maintains COMMON_PORTS_CATALOG (standard services across Web, Remote Access, Databases, IoT, Media, File Sharing).
 *    - Dynamically merges user-defined custom ports persisted in `server/db.ts` (`sentinel_db.json`).
 * 2. Cross-Module Integration:
 *    - `osFingerprint.ts`: When probing subnet nodes, `probeSignaturePorts` queries `observedPortsManager.getActivePortNumbers()`
 *      so that active/custom ports are actively probed with non-blocking TCP socket tests.
 *    - `trafficMonitor.ts`: Passive traffic simulation samples from active observed ports, emulating real protocol traffic.
 *    - `detection.ts`: Detects anomalies when untrusted devices open unexpected ports or active observed ports.
 *    - `server.ts`: REST endpoints (`/api/observed-ports`, `/api/observed-ports/custom`, `/api/observed-ports/batch-probe`)
 *      and WebSocket (`observed_ports.updated`) notify connected frontend clients.
 */

import { ObservedPortConfig } from './types';
import { db } from './db';

export const COMMON_PORTS_CATALOG: ObservedPortConfig[] = [
  // Web & Secure Web
  {
    port: 80,
    service: 'HTTP',
    protocol: 'tcp',
    description: 'World Wide Web unencrypted HTTP web server traffic',
    category: 'web',
    enabled: true,
  },
  {
    port: 443,
    service: 'HTTPS',
    protocol: 'tcp',
    description: 'Encrypted Web Traffic (HTTP over TLS/SSL encryption)',
    category: 'web',
    enabled: true,
  },
  {
    port: 8080,
    service: 'HTTP-Proxy',
    protocol: 'tcp',
    description: 'Common alternative HTTP web server and caching proxy',
    category: 'web',
    enabled: true,
  },
  {
    port: 8443,
    service: 'HTTPS-Alt',
    protocol: 'tcp',
    description: 'Alternative HTTPS secure web management console',
    category: 'web',
    enabled: true,
  },
  {
    port: 8000,
    service: 'HTTP-Alt',
    protocol: 'tcp',
    description: 'Alternative HTTP port used for web APIs and dev proxies',
    category: 'web',
    enabled: true,
  },
  {
    port: 3000,
    service: 'Node/Dev-Web',
    protocol: 'tcp',
    description: 'Development web applications, Node.js, and Grafana/React',
    category: 'web',
    enabled: true,
  },
  {
    port: 9000,
    service: 'Portainer/Web',
    protocol: 'tcp',
    description: 'Docker Portainer UI, SonarQube, and PHP-FPM web services',
    category: 'web',
    enabled: true,
  },
  {
    port: 9090,
    service: 'Cockpit/Prometheus',
    protocol: 'tcp',
    description: 'Linux Cockpit web console and Prometheus metrics server',
    category: 'web',
    enabled: false,
  },

  // Remote Access & Administration
  {
    port: 22,
    service: 'SSH',
    protocol: 'tcp',
    description: 'Secure Shell for encrypted remote terminal and file transfer',
    category: 'remote',
    enabled: true,
  },
  {
    port: 23,
    service: 'Telnet',
    protocol: 'tcp',
    description: 'Legacy unencrypted terminal access (High Security Risk)',
    category: 'remote',
    enabled: true,
  },
  {
    port: 3389,
    service: 'RDP',
    protocol: 'tcp',
    description: 'Microsoft Remote Desktop Protocol for graphical desktop login',
    category: 'remote',
    enabled: true,
  },
  {
    port: 5900,
    service: 'VNC',
    protocol: 'tcp',
    description: 'Virtual Network Computing graphical desktop sharing',
    category: 'remote',
    enabled: false,
  },

  // Core Network Services
  {
    port: 53,
    service: 'DNS',
    protocol: 'both',
    description: 'Domain Name System recursive resolver and nameserver',
    category: 'network',
    enabled: true,
  },
  {
    port: 67,
    service: 'DHCP-Server',
    protocol: 'udp',
    description: 'Dynamic Host Configuration Protocol server broadcast',
    category: 'network',
    enabled: false,
  },
  {
    port: 68,
    service: 'DHCP-Client',
    protocol: 'udp',
    description: 'DHCP client response and lease negotiation',
    category: 'network',
    enabled: false,
  },
  {
    port: 123,
    service: 'NTP',
    protocol: 'udp',
    description: 'Network Time Protocol system clock synchronization',
    category: 'network',
    enabled: false,
  },
  {
    port: 135,
    service: 'MS-RPC',
    protocol: 'tcp',
    description: 'Microsoft RPC Endpoint Mapper for Windows inter-process communication',
    category: 'network',
    enabled: true,
  },
  {
    port: 137,
    service: 'NetBIOS-NS',
    protocol: 'udp',
    description: 'NetBIOS Name Service for legacy Windows name resolution',
    category: 'network',
    enabled: false,
  },
  {
    port: 161,
    service: 'SNMP',
    protocol: 'udp',
    description: 'Simple Network Management Protocol queries and traps',
    category: 'network',
    enabled: false,
  },
  {
    port: 389,
    service: 'LDAP',
    protocol: 'tcp',
    description: 'Lightweight Directory Access Protocol authentication',
    category: 'network',
    enabled: false,
  },
  {
    port: 636,
    service: 'LDAPS',
    protocol: 'tcp',
    description: 'Secure LDAP over SSL directory service',
    category: 'network',
    enabled: false,
  },
  {
    port: 5353,
    service: 'mDNS',
    protocol: 'udp',
    description: 'Multicast DNS for Apple Bonjour, Avahi, and smart devices',
    category: 'network',
    enabled: false,
  },
  {
    port: 5357,
    service: 'WSDAPI',
    protocol: 'tcp',
    description: 'Web Services for Devices (Windows discovery API)',
    category: 'network',
    enabled: true,
  },
  {
    port: 515,
    service: 'LPD',
    protocol: 'tcp',
    description: 'Line Printer Daemon for legacy networked printing',
    category: 'network',
    enabled: true,
  },
  {
    port: 631,
    service: 'IPP',
    protocol: 'tcp',
    description: 'Internet Printing Protocol (CUPS / modern network printers)',
    category: 'network',
    enabled: true,
  },
  {
    port: 9100,
    service: 'JetDirect',
    protocol: 'tcp',
    description: 'Raw HP JetDirect network printer stream',
    category: 'network',
    enabled: true,
  },

  // File Sharing & Storage
  {
    port: 21,
    service: 'FTP',
    protocol: 'tcp',
    description: 'File Transfer Protocol control channel (unencrypted)',
    category: 'file',
    enabled: false,
  },
  {
    port: 139,
    service: 'NetBIOS-SSN',
    protocol: 'tcp',
    description: 'NetBIOS Session Service for Windows SMB file sharing',
    category: 'file',
    enabled: true,
  },
  {
    port: 445,
    service: 'SMB',
    protocol: 'tcp',
    description: 'Server Message Block (Windows file and folder sharing)',
    category: 'file',
    enabled: true,
  },
  {
    port: 548,
    service: 'AFP',
    protocol: 'tcp',
    description: 'Apple Filing Protocol (macOS Time Machine and NAS file sharing)',
    category: 'file',
    enabled: true,
  },
  {
    port: 2049,
    service: 'NFS',
    protocol: 'tcp',
    description: 'Network File System for UNIX/Linux shared storage',
    category: 'file',
    enabled: false,
  },

  // Database Systems
  {
    port: 3306,
    service: 'MySQL',
    protocol: 'tcp',
    description: 'MySQL and MariaDB relational database server',
    category: 'database',
    enabled: false,
  },
  {
    port: 5432,
    service: 'PostgreSQL',
    protocol: 'tcp',
    description: 'PostgreSQL object-relational database server',
    category: 'database',
    enabled: false,
  },
  {
    port: 1433,
    service: 'MSSQL',
    protocol: 'tcp',
    description: 'Microsoft SQL Server database engine',
    category: 'database',
    enabled: false,
  },
  {
    port: 1521,
    service: 'Oracle-DB',
    protocol: 'tcp',
    description: 'Oracle Enterprise Database listener',
    category: 'database',
    enabled: false,
  },
  {
    port: 6379,
    service: 'Redis',
    protocol: 'tcp',
    description: 'Redis in-memory key-value data store and cache',
    category: 'database',
    enabled: false,
  },
  {
    port: 27017,
    service: 'MongoDB',
    protocol: 'tcp',
    description: 'MongoDB document-oriented NoSQL database server',
    category: 'database',
    enabled: false,
  },

  // IoT, Home Automation & Streaming
  {
    port: 1883,
    service: 'MQTT',
    protocol: 'tcp',
    description: 'Message Queuing Telemetry Transport for smart home & IoT brokers',
    category: 'iot',
    enabled: true,
  },
  {
    port: 8883,
    service: 'MQTTS',
    protocol: 'tcp',
    description: 'Secure MQTT encrypted over TLS/SSL',
    category: 'iot',
    enabled: false,
  },
  {
    port: 5000,
    service: 'UPnP/Synology',
    protocol: 'tcp',
    description: 'Synology DSM HTTP interface, UPnP, or Python web server',
    category: 'iot',
    enabled: true,
  },
  {
    port: 5001,
    service: 'Synology-HTTPS',
    protocol: 'tcp',
    description: 'Synology DSM secure management interface over HTTPS',
    category: 'iot',
    enabled: true,
  },
  {
    port: 554,
    service: 'RTSP',
    protocol: 'tcp',
    description: 'Real-Time Streaming Protocol for security IP cameras and DVRs',
    category: 'media',
    enabled: true,
  },
  {
    port: 7000,
    service: 'AirPlay',
    protocol: 'tcp',
    description: 'Apple AirPlay / RAOP screen and audio mirroring stream',
    category: 'media',
    enabled: true,
  },
  {
    port: 8008,
    service: 'GoogleCast',
    protocol: 'tcp',
    description: 'Google Chromecast and Nest device API receiver',
    category: 'media',
    enabled: true,
  },
  {
    port: 32400,
    service: 'Plex',
    protocol: 'tcp',
    description: 'Plex Media Server web interface and client streaming',
    category: 'media',
    enabled: true,
  },
];

export class ObservedPortsManager {
  private observedPorts: ObservedPortConfig[] = [];

  constructor() {
    this.load();
  }

  public load() {
    const saved = db.getObservedPorts();
    if (saved && saved.length > 0) {
      // Merge with COMMON_PORTS_CATALOG to ensure all known metadata is present
      const map = new Map<number, ObservedPortConfig>();
      for (const p of COMMON_PORTS_CATALOG) {
        map.set(p.port, { ...p, enabled: false });
      }
      for (const s of saved) {
        const existing = map.get(s.port);
        if (existing) {
          map.set(s.port, { ...existing, ...s });
        } else {
          // Custom port
          map.set(s.port, { ...s, isCustom: true });
        }
      }
      this.observedPorts = Array.from(map.values());
    } else {
      this.observedPorts = COMMON_PORTS_CATALOG.map((p) => ({ ...p }));
      db.saveObservedPorts(this.observedPorts);
    }
    this.syncTypicalPorts();
  }

  public getObservedPorts(): ObservedPortConfig[] {
    return [...this.observedPorts];
  }

  public getActivePortNumbers(): number[] {
    return this.observedPorts
      .filter((p) => p.enabled)
      .map((p) => p.port)
      .sort((a, b) => a - b);
  }

  public getServiceMap(): Record<number, string> {
    const map: Record<number, string> = {};
    for (const p of this.observedPorts) {
      map[p.port] = p.service;
    }
    return map;
  }

  public setObservedPorts(ports: ObservedPortConfig[]): ObservedPortConfig[] {
    this.observedPorts = ports;
    db.saveObservedPorts(this.observedPorts);
    this.syncTypicalPorts();
    return this.observedPorts;
  }

  public updateActivePorts(portNumbers: number[]): ObservedPortConfig[] {
    const numSet = new Set(portNumbers);
    this.observedPorts = this.observedPorts.map((p) => ({
      ...p,
      enabled: numSet.has(p.port),
    }));
    db.saveObservedPorts(this.observedPorts);
    this.syncTypicalPorts();
    return this.observedPorts;
  }

  public addCustomPort(params: {
    port: number;
    service: string;
    protocol?: 'tcp' | 'udp' | 'both';
    description?: string;
    category?: 'custom' | 'web' | 'remote' | 'file' | 'database' | 'iot' | 'network' | 'media' | 'other';
  }): ObservedPortConfig {
    const port = Math.floor(Number(params.port));
    if (isNaN(port) || port < 1 || port > 65535) {
      throw new Error('Port number must be an integer between 1 and 65535.');
    }

    const service = (params.service || `custom-${port}`).trim();
    const existingIndex = this.observedPorts.findIndex((p) => p.port === port);

    const newPortConfig: ObservedPortConfig = {
      port,
      service,
      protocol: params.protocol || 'tcp',
      description: params.description?.trim() || `User-defined custom monitored service on port ${port}`,
      category: params.category || 'custom',
      isCustom: true,
      enabled: true,
    };

    if (existingIndex >= 0) {
      this.observedPorts[existingIndex] = {
        ...this.observedPorts[existingIndex],
        ...newPortConfig,
      };
    } else {
      this.observedPorts.push(newPortConfig);
    }

    db.saveObservedPorts(this.observedPorts);
    this.syncTypicalPorts();
    return newPortConfig;
  }

  public removePort(portNumber: number): boolean {
    const initialLength = this.observedPorts.length;
    this.observedPorts = this.observedPorts.filter((p) => p.port !== portNumber);
    if (this.observedPorts.length !== initialLength) {
      db.saveObservedPorts(this.observedPorts);
      this.syncTypicalPorts();
      return true;
    }
    return false;
  }

  public togglePort(portNumber: number, enabled?: boolean): ObservedPortConfig | undefined {
    const target = this.observedPorts.find((p) => p.port === portNumber);
    if (target) {
      target.enabled = enabled !== undefined ? enabled : !target.enabled;
      db.saveObservedPorts(this.observedPorts);
      this.syncTypicalPorts();
      return target;
    }
    return undefined;
  }

  private syncTypicalPorts() {
    const active = this.getActivePortNumbers();
    db.updateBaseline({ typicalPorts: active });
  }
}

export const observedPortsManager = new ObservedPortsManager();
