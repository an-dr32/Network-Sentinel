import { Device, NetworkEvent } from './types';

export const INITIAL_SUBNET_DEVICES: Device[] = [
  {
    id: 'dev_gw_ubiquiti',
    macAddress: 'b4:fb:e4:1a:28:90',
    hostname: 'unifi-dream-machine.local',
    vendor: 'Ubiquiti Inc.',
    ipAddresses: ['192.168.1.1'],
    currentIp: '192.168.1.1',
    ipHistory: [
      { ip: '192.168.1.1', firstSeen: new Date(Date.now() - 86400000 * 7).toISOString(), lastSeen: new Date().toISOString(), leaseType: 'static' }
    ],
    firstSeen: new Date(Date.now() - 86400000 * 7).toISOString(),
    lastSeen: new Date().toISOString(),
    status: 'online',
    trustStatus: 'known',
    riskScore: 0,
    riskSeverity: 'normal',
    tags: ['gateway', 'dns-server', 'dhcp-server', 'infrastructure'],
    deviceType: 'router',
    osGuess: 'UniFi OS / Linux 5.4',
    osConfidence: 98,
    osDetectionDetails: {
      ttl: 64,
      methods: ['mDNS broadcast', 'TCP fingerprint', 'HTTP server banner'],
      confidence: 98,
      fingerprintedAt: new Date().toISOString(),
      identifiedBanners: ['UniFi-OS-Gateway/3.1.16'],
      signatureMatch: 'Ubiquiti UniFi OS v3.x'
    },
    openPorts: [
      { port: 53, service: 'DNS Resolver', protocol: 'udp', state: 'open', riskRating: 'low' },
      { port: 80, service: 'HTTP Management', protocol: 'tcp', state: 'open', riskRating: 'low' },
      { port: 443, service: 'HTTPS Management', protocol: 'tcp', state: 'open', riskRating: 'low' },
      { port: 8080, service: 'UniFi Controller Inform', protocol: 'tcp', state: 'open', riskRating: 'low' }
    ],
    riskEvidence: [],
    quarantined: false,
    trafficStats: {
      bytesSent: 1450200,
      bytesReceived: 3820400,
      packetCount: 18920,
      rateKbps: 450
    }
  },
  {
    id: 'dev_macbook_pro',
    macAddress: 'f0:18:98:3c:52:11',
    hostname: 'MacBook-Pro-Workstation.local',
    vendor: 'Apple Inc.',
    ipAddresses: ['192.168.1.102'],
    currentIp: '192.168.1.102',
    ipHistory: [
      { ip: '192.168.1.102', firstSeen: new Date(Date.now() - 86400000 * 5).toISOString(), lastSeen: new Date().toISOString(), leaseType: 'dhcp' }
    ],
    firstSeen: new Date(Date.now() - 86400000 * 5).toISOString(),
    lastSeen: new Date().toISOString(),
    status: 'online',
    trustStatus: 'known',
    riskScore: 5,
    riskSeverity: 'normal',
    tags: ['workstation', 'admin', 'developer'],
    deviceType: 'workstation',
    osGuess: 'macOS 14.4 Sonoma',
    osConfidence: 95,
    osDetectionDetails: {
      ttl: 64,
      methods: ['mDNS service discovery', 'TCP SYN packet analysis'],
      confidence: 95,
      fingerprintedAt: new Date().toISOString(),
      identifiedBanners: ['Darwin 23.4.0'],
      signatureMatch: 'Apple macOS Sonoma (XNU Darwin)'
    },
    openPorts: [
      { port: 22, service: 'OpenSSH Server', protocol: 'tcp', state: 'open', riskRating: 'low' },
      { port: 5353, service: 'mDNS Responder (Bonjour)', protocol: 'udp', state: 'open', riskRating: 'low' }
    ],
    riskEvidence: [],
    quarantined: false,
    trafficStats: {
      bytesSent: 940300,
      bytesReceived: 2190400,
      packetCount: 9420,
      rateKbps: 210
    }
  },
  {
    id: 'dev_synology_nas',
    macAddress: '00:11:32:89:af:44',
    hostname: 'Synology-DiskStation.local',
    vendor: 'Synology Inc.',
    ipAddresses: ['192.168.1.150'],
    currentIp: '192.168.1.150',
    ipHistory: [
      { ip: '192.168.1.150', firstSeen: new Date(Date.now() - 86400000 * 6).toISOString(), lastSeen: new Date().toISOString(), leaseType: 'static' }
    ],
    firstSeen: new Date(Date.now() - 86400000 * 6).toISOString(),
    lastSeen: new Date().toISOString(),
    status: 'online',
    trustStatus: 'known',
    riskScore: 10,
    riskSeverity: 'normal',
    tags: ['nas', 'storage', 'backup-server'],
    deviceType: 'server',
    osGuess: 'Linux / Synology DSM 7.2',
    osConfidence: 96,
    osDetectionDetails: {
      ttl: 64,
      methods: ['HTTP header fingerprint', 'UPnP announcement'],
      confidence: 96,
      fingerprintedAt: new Date().toISOString(),
      identifiedBanners: ['Synology-DSM/7.2'],
      signatureMatch: 'Synology DiskStation Manager (DSM)'
    },
    openPorts: [
      { port: 80, service: 'HTTP Redirect', protocol: 'tcp', state: 'open', riskRating: 'low' },
      { port: 443, service: 'HTTPS Web Manager', protocol: 'tcp', state: 'open', riskRating: 'low' },
      { port: 5000, service: 'DSM Web GUI (HTTP)', protocol: 'tcp', state: 'open', riskRating: 'medium' },
      { port: 5001, service: 'DSM Web GUI (HTTPS)', protocol: 'tcp', state: 'open', riskRating: 'low' }
    ],
    riskEvidence: [],
    quarantined: false,
    trafficStats: {
      bytesSent: 480200,
      bytesReceived: 1205000,
      packetCount: 5410,
      rateKbps: 125
    }
  },
  {
    id: 'dev_lg_smart_tv',
    macAddress: 'a8:23:fe:71:0d:32',
    hostname: 'LG-webOS-OLED-TV.local',
    vendor: 'LG Electronics',
    ipAddresses: ['192.168.1.120'],
    currentIp: '192.168.1.120',
    ipHistory: [
      { ip: '192.168.1.120', firstSeen: new Date(Date.now() - 86400000 * 4).toISOString(), lastSeen: new Date().toISOString(), leaseType: 'dhcp' }
    ],
    firstSeen: new Date(Date.now() - 86400000 * 4).toISOString(),
    lastSeen: new Date().toISOString(),
    status: 'online',
    trustStatus: 'known',
    riskScore: 15,
    riskSeverity: 'normal',
    tags: ['iot', 'smart-tv', 'media-streaming'],
    deviceType: 'iot',
    osGuess: 'LG webOS 23',
    osConfidence: 92,
    osDetectionDetails: {
      ttl: 64,
      methods: ['DIAL/SSDP discovery', 'HTTP service banner'],
      confidence: 92,
      fingerprintedAt: new Date().toISOString(),
      identifiedBanners: ['webOS/8.0.0'],
      signatureMatch: 'LG webOS Smart TV Platform'
    },
    openPorts: [
      { port: 8008, service: 'DIAL REST Service', protocol: 'tcp', state: 'open', riskRating: 'low' },
      { port: 8009, service: 'Cast Media Protocol', protocol: 'tcp', state: 'open', riskRating: 'low' }
    ],
    riskEvidence: [],
    quarantined: false,
    trafficStats: {
      bytesSent: 820100,
      bytesReceived: 6204000,
      packetCount: 14200,
      rateKbps: 850
    }
  },
  {
    id: 'dev_amcrest_cam',
    macAddress: '9c:8e:cd:42:19:bb',
    hostname: 'Amcrest-FrontDoor-Cam.local',
    vendor: 'Amcrest Industries',
    ipAddresses: ['192.168.1.185'],
    currentIp: '192.168.1.185',
    ipHistory: [
      { ip: '192.168.1.185', firstSeen: new Date(Date.now() - 86400000 * 3).toISOString(), lastSeen: new Date().toISOString(), leaseType: 'dhcp' }
    ],
    firstSeen: new Date(Date.now() - 86400000 * 3).toISOString(),
    lastSeen: new Date().toISOString(),
    status: 'online',
    trustStatus: 'known',
    riskScore: 25,
    riskSeverity: 'normal',
    tags: ['iot', 'camera', 'rtsp-stream'],
    deviceType: 'camera',
    osGuess: 'Embedded Linux 4.9',
    osConfidence: 88,
    osDetectionDetails: {
      ttl: 64,
      methods: ['RTSP banner', 'ONVIF WS-Discovery'],
      confidence: 88,
      fingerprintedAt: new Date().toISOString(),
      identifiedBanners: ['Amcrest RTSP Server/2.0'],
      signatureMatch: 'Dahua/Amcrest IP Camera Firmware'
    },
    openPorts: [
      { port: 80, service: 'HTTP Camera Web GUI', protocol: 'tcp', state: 'open', riskRating: 'low' },
      { port: 554, service: 'RTSP Video Stream', protocol: 'tcp', state: 'open', riskRating: 'medium' }
    ],
    riskEvidence: [],
    quarantined: false,
    trafficStats: {
      bytesSent: 3400500,
      bytesReceived: 180200,
      packetCount: 8900,
      rateKbps: 420
    }
  },
  {
    id: 'dev_nest_thermostat',
    macAddress: '18:b4:30:5a:7c:89',
    hostname: 'Nest-Thermostat-Hallway.local',
    vendor: 'Google LLC',
    ipAddresses: ['192.168.1.190'],
    currentIp: '192.168.1.190',
    ipHistory: [
      { ip: '192.168.1.190', firstSeen: new Date(Date.now() - 86400000 * 2).toISOString(), lastSeen: new Date().toISOString(), leaseType: 'dhcp' }
    ],
    firstSeen: new Date(Date.now() - 86400000 * 2).toISOString(),
    lastSeen: new Date().toISOString(),
    status: 'online',
    trustStatus: 'known',
    riskScore: 15,
    riskSeverity: 'normal',
    tags: ['iot', 'smart-home', 'thermostat'],
    deviceType: 'iot',
    osGuess: 'Google Weave / Embedded Linux',
    osConfidence: 90,
    osDetectionDetails: {
      ttl: 64,
      methods: ['Weave beacon', 'TLS client hello'],
      confidence: 90,
      fingerprintedAt: new Date().toISOString(),
      identifiedBanners: ['NestOS/6.3'],
      signatureMatch: 'Google Nest Thermostat Firmware'
    },
    openPorts: [
      { port: 443, service: 'HTTPS Cloud Telemetry', protocol: 'tcp', state: 'open', riskRating: 'low' }
    ],
    riskEvidence: [],
    quarantined: false,
    trafficStats: {
      bytesSent: 120400,
      bytesReceived: 98200,
      packetCount: 1400,
      rateKbps: 15
    }
  }
];

export function createInitialEvents(devices: Device[]): NetworkEvent[] {
  const events: NetworkEvent[] = [];
  const now = Date.now();

  const domainPool = [
    'api.github.com',
    'time.cloudflare.com',
    'pool.ntp.org',
    'gateway.local',
    'connectivitycheck.gstatic.com',
    'update.apple.com',
    'secure.netflix.com',
    'api.weather.com',
  ];

  devices.forEach((dev, idx) => {
    // 1. Discovery event
    events.push({
      id: `evt_seed_disc_${dev.id}`,
      timestamp: new Date(now - (idx + 1) * 60000 * 12).toISOString(),
      type: 'device_discovered',
      severity: 'info',
      deviceId: dev.id,
      deviceName: dev.hostname,
      deviceIp: dev.currentIp,
      title: `Device Discovered: ${dev.hostname}`,
      description: `Passive collector identified active host at ${dev.currentIp} (${dev.vendor}) on subnet 192.168.1.0/24.`,
      evidence: {
        macAddress: dev.macAddress,
        ipAddress: dev.currentIp,
        vendor: dev.vendor,
        method: 'ARP_DISCOVERY',
        ttl: 64,
      },
      simulated: false,
    });

    // 2. DNS query event
    const domain = domainPool[idx % domainPool.length];
    events.push({
      id: `evt_seed_dns_${dev.id}`,
      timestamp: new Date(now - (idx + 1) * 45000 * 8).toISOString(),
      type: 'monitoring_event',
      severity: 'info',
      deviceId: dev.id,
      deviceName: dev.hostname,
      deviceIp: dev.currentIp,
      title: `DNS Resolution: ${domain}`,
      description: `${dev.hostname} resolved ${domain} via local gateway DNS resolver (192.168.1.1:53).`,
      evidence: {
        protocol: 'DNS',
        port: 53,
        query: domain,
        rcode: 'NOERROR',
        rttMs: parseFloat((Math.random() * 4 + 1).toFixed(2)),
      },
      simulated: false,
    });

    // 3. Keepalive heartbeat
    events.push({
      id: `evt_seed_arp_${dev.id}`,
      timestamp: new Date(now - (idx + 1) * 30000 * 5).toISOString(),
      type: 'monitoring_event',
      severity: 'info',
      deviceId: dev.id,
      deviceName: dev.hostname,
      deviceIp: dev.currentIp,
      title: 'ARP Link Heartbeat',
      description: `Gratuitous ARP keepalive verified binding for ${dev.currentIp} (${dev.macAddress}).`,
      evidence: {
        protocol: 'ARP',
        hardwareType: 'Ethernet',
        mac: dev.macAddress,
        opCode: 'ARP_REPLY',
      },
      simulated: false,
    });

    // 4. Outbound TLS flow
    events.push({
      id: `evt_seed_tls_${dev.id}`,
      timestamp: new Date(now - (idx + 1) * 15000 * 3).toISOString(),
      type: 'monitoring_event',
      severity: 'info',
      deviceId: dev.id,
      deviceName: dev.hostname,
      deviceIp: dev.currentIp,
      title: 'Outbound TLS Flow Established',
      description: `${dev.hostname} opened secure outbound TLS session to port 443.`,
      evidence: {
        protocol: 'TLS 1.3',
        cipher: 'TLS_AES_256_GCM_SHA384',
        dstPort: 443,
        direction: 'outbound',
      },
      simulated: false,
    });
  });

  // Sort descending by timestamp
  return events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}
