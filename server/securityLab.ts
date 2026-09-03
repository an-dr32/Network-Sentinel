import { db } from './db';
import { detectionEngine } from './detection';
import { collectorManager } from './collectors/collectorManager';
import { Device, NetworkEvent } from './types';

export class SecurityLabEngine {
  /**
   * Scenario 1: Unverified Rogue Device joins subnet
   */
  public simulateNewDevice(customName?: string): { device: Device; event: NetworkEvent } {
    const now = new Date().toISOString();
    const id = `dev_rogue_${Date.now().toString(36)}`;
    const ip = `192.168.1.${Math.floor(Math.random() * 50) + 190}`;
    const mac = `cc:50:e3:${Math.floor(Math.random() * 89 + 10)}:${Math.floor(Math.random() * 89 + 10)}:${Math.floor(Math.random() * 89 + 10)}`;
    const hostname = customName || 'rogue-esp32-node.local';

    const newDevice: Device = {
      id,
      macAddress: mac,
      hostname,
      vendor: 'Espressif Inc. (Generic Microcontroller)',
      ipAddresses: [ip],
      currentIp: ip,
      ipHistory: [{ ip, firstSeen: now, lastSeen: now, leaseType: 'dhcp' }],
      firstSeen: now,
      lastSeen: now,
      status: 'online',
      trustStatus: 'new',
      riskScore: 20,
      riskSeverity: 'normal',
      tags: ['unverified', 'esp32', 'simulated'],
      deviceType: 'iot',
      osGuess: 'FreeRTOS / Espressif IDF',
      openPorts: [
        { port: 80, service: 'http-admin', protocol: 'tcp', state: 'open', riskRating: 'low' },
      ],
      riskEvidence: [
        {
          rule: 'New unverified device',
          points: 20,
          reason: 'Device joined the subnet without prior baseline authorization record.',
          timestamp: now,
        },
      ],
      quarantined: false,
      trafficStats: {
        bytesSent: 4500,
        bytesReceived: 12000,
        packetCount: 88,
        rateKbps: 45,
      },
    };

    const evaluation = detectionEngine.evaluateDeviceRisk(newDevice);
    newDevice.riskScore = evaluation.score;
    newDevice.riskSeverity = evaluation.severity;
    newDevice.riskEvidence = evaluation.evidence;

    db.addDevice(newDevice);

    const event: NetworkEvent = {
      id: `evt_sim_${Date.now()}`,
      timestamp: now,
      type: 'device_discovered',
      deviceId: newDevice.id,
      deviceName: newDevice.hostname,
      deviceIp: newDevice.currentIp,
      severity: 'watch',
      title: `[SIMULATED] New Device Discovered: ${newDevice.hostname}`,
      description: `Unrecognized device with MAC ${newDevice.macAddress} assigned IP ${newDevice.currentIp} via DHCP.`,
      evidence: {
        mac: newDevice.macAddress,
        ip: newDevice.currentIp,
        vendor: newDevice.vendor,
        simulated: true,
      },
      simulated: true,
    };

    collectorManager.broadcastCustomEvent(event);
    detectionEngine.processEvent(event);

    return { device: newDevice, event };
  }

  /**
   * Scenario 2: Lateral Port Scan on Local Subnet
   */
  public simulatePortScan(targetDeviceId?: string): { device: Device; event: NetworkEvent } {
    const devices = db.getDevices();
    let device = targetDeviceId ? db.getDeviceById(targetDeviceId) : devices.find((d) => d.trustStatus === 'new') || devices[devices.length - 1];

    if (!device) {
      const created = this.simulateNewDevice('kali-probe.local');
      device = created.device;
    }

    const now = new Date().toISOString();
    const scannedPorts = [21, 22, 23, 135, 139, 445, 1433, 3389, 8080, 8443];

    // Add scanned ports to openPorts
    const updatedOpenPorts = [...device.openPorts];
    for (const p of [445, 139, 3389]) {
      if (!updatedOpenPorts.some((op) => op.port === p)) {
        updatedOpenPorts.push({
          port: p,
          service: p === 445 ? 'microsoft-ds' : p === 139 ? 'netbios-ssn' : 'ms-wbt-server',
          protocol: 'tcp',
          state: 'open',
          riskRating: 'high',
        });
      }
    }

    const activeConnections = [
      { targetIp: '192.168.1.1', targetPort: 445, protocol: 'TCP SYN', bytesSent: 240, bytesReceived: 0, timestamp: now, isUnusual: true },
      { targetIp: '192.168.1.50', targetPort: 445, protocol: 'TCP SYN', bytesSent: 240, bytesReceived: 0, timestamp: now, isUnusual: true },
      { targetIp: '192.168.1.104', targetPort: 139, protocol: 'TCP SYN', bytesSent: 240, bytesReceived: 0, timestamp: now, isUnusual: true },
    ];

    const currentEvidence = device.riskEvidence.filter((e) => !e.rule.includes('Port scan'));
    currentEvidence.push({
      rule: 'Port scanning activity',
      points: 30,
      reason: `Probed ${scannedPorts.length} destination ports (including SMB 445, RDP 3389) across 4 subnet hosts within 800ms.`,
      timestamp: now,
    });

    db.updateDevice(device.id, {
      trustStatus: 'suspicious',
      openPorts: updatedOpenPorts,
      activeConnections,
      riskEvidence: currentEvidence,
    });

    const updated = db.getDeviceById(device.id)!;
    const evaluation = detectionEngine.evaluateDeviceRisk(updated);
    db.updateDevice(device.id, {
      riskScore: evaluation.score,
      riskSeverity: evaluation.severity,
      riskEvidence: evaluation.evidence,
    });

    const event: NetworkEvent = {
      id: `evt_sim_scan_${Date.now()}`,
      timestamp: now,
      type: 'port_scan',
      deviceId: updated.id,
      deviceName: updated.hostname,
      deviceIp: updated.currentIp,
      severity: 'critical',
      title: `[SIMULATED] Port Scan Detected from ${updated.hostname}`,
      description: `Rapid TCP SYN sweep observed originating from ${updated.currentIp} targeting internal services (SMB/RDP/NetBIOS).`,
      evidence: {
        sourceIp: updated.currentIp,
        scannedPorts,
        ratePacketsPerSec: 140,
        targets: ['192.168.1.1', '192.168.1.50', '192.168.1.104'],
        simulated: true,
      },
      simulated: true,
    };

    collectorManager.broadcastCustomEvent(event);
    detectionEngine.processEvent(event);

    return { device: db.getDeviceById(device.id)!, event };
  }

  /**
   * Scenario 3: DNS Data Exfiltration / DGA Queries
   */
  public simulateDnsAnomaly(targetDeviceId?: string): { device: Device; event: NetworkEvent } {
    const devices = db.getDevices();
    let device = targetDeviceId ? db.getDeviceById(targetDeviceId) : devices.find((d) => d.trustStatus === 'new' || d.trustStatus === 'suspicious') || devices[devices.length - 1];

    if (!device) {
      const created = this.simulateNewDevice('covert-agent.local');
      device = created.device;
    }

    const now = new Date().toISOString();
    const maliciousDomains = [
      'a89f91a0c4e.exfil.darknet-c2.top',
      'b77c22e91d0.exfil.darknet-c2.top',
      'dga-sync-9492.cloud-payload.biz',
      'x-tunnel-chunk01.dns-covert.cc',
    ];

    const currentDnsLogs = device.dnsLogs ? [...device.dnsLogs] : [];
    for (const domain of maliciousDomains) {
      currentDnsLogs.unshift({
        domain,
        queryType: 'TXT',
        timestamp: now,
        resolvedIp: '198.51.100.44',
        isAnomaly: true,
        anomalyReason: 'High Shannon entropy domain and non-standard Base64 TXT payload resolution.',
      });
    }

    const currentEvidence = device.riskEvidence.filter((e) => !e.rule.includes('DNS'));
    currentEvidence.push({
      rule: 'Unusual DNS resolution pattern',
      points: 10,
      reason: 'Repeated high-entropy subdomain requests matching DNS tunneling and DGA signatures.',
      timestamp: now,
    });

    db.updateDevice(device.id, {
      trustStatus: device.trustStatus === 'known' ? 'suspicious' : device.trustStatus,
      dnsLogs: currentDnsLogs.slice(0, 20),
      riskEvidence: currentEvidence,
    });

    const updated = db.getDeviceById(device.id)!;
    const evaluation = detectionEngine.evaluateDeviceRisk(updated);
    db.updateDevice(device.id, {
      riskScore: evaluation.score,
      riskSeverity: evaluation.severity,
      riskEvidence: evaluation.evidence,
    });

    const event: NetworkEvent = {
      id: `evt_sim_dns_${Date.now()}`,
      timestamp: now,
      type: 'dns_anomaly',
      deviceId: updated.id,
      deviceName: updated.hostname,
      deviceIp: updated.currentIp,
      severity: 'suspicious',
      title: `[SIMULATED] DNS Tunneling / DGA Anomaly: ${updated.hostname}`,
      description: `Suspicious high-entropy TXT domain queries observed from ${updated.currentIp}.`,
      evidence: {
        sourceIp: updated.currentIp,
        queriedDomains: maliciousDomains,
        entropyScore: 4.82,
        simulated: true,
      },
      simulated: true,
    };

    collectorManager.broadcastCustomEvent(event);
    detectionEngine.processEvent(event);

    return { device: db.getDeviceById(device.id)!, event };
  }

  /**
   * Scenario 4: Abnormal High-Volume Outbound Data Spike
   */
  public simulateTrafficSpike(targetDeviceId?: string): { device: Device; event: NetworkEvent } {
    const devices = db.getDevices();
    let device = targetDeviceId ? db.getDeviceById(targetDeviceId) : devices.find((d) => d.trustStatus === 'new' || d.trustStatus === 'suspicious') || devices[devices.length - 1];

    if (!device) {
      const created = this.simulateNewDevice('data-leaker.local');
      device = created.device;
    }

    const now = new Date().toISOString();
    const spikeRateKbps = 18500; // 18.5 Mbps

    const currentEvidence = device.riskEvidence.filter((e) => !e.rule.includes('Abnormal traffic'));
    currentEvidence.push({
      rule: 'Abnormal traffic spike',
      points: 15,
      reason: `Outbound burst rate reached 18.5 Mbps (baseline average: 0.15 Mbps) to unclassified external IP.`,
      timestamp: now,
    });

    db.updateDevice(device.id, {
      trustStatus: device.trustStatus === 'known' ? 'suspicious' : device.trustStatus,
      trafficStats: {
        bytesSent: device.trafficStats.bytesSent + 84000000,
        bytesReceived: device.trafficStats.bytesReceived + 1200000,
        packetCount: device.trafficStats.packetCount + 65000,
        rateKbps: spikeRateKbps,
      },
      riskEvidence: currentEvidence,
    });

    const updated = db.getDeviceById(device.id)!;
    const evaluation = detectionEngine.evaluateDeviceRisk(updated);
    db.updateDevice(device.id, {
      riskScore: evaluation.score,
      riskSeverity: evaluation.severity,
      riskEvidence: evaluation.evidence,
    });

    const event: NetworkEvent = {
      id: `evt_sim_traffic_${Date.now()}`,
      timestamp: now,
      type: 'traffic_anomaly',
      deviceId: updated.id,
      deviceName: updated.hostname,
      deviceIp: updated.currentIp,
      severity: 'suspicious',
      title: `[SIMULATED] Outbound Traffic Anomaly: ${updated.hostname}`,
      description: `Sustained high-bandwidth outbound transmission (18.5 Mbps) flagged against device baseline.`,
      evidence: {
        sourceIp: updated.currentIp,
        destinationIp: '203.0.113.88',
        burstRateKbps: spikeRateKbps,
        totalBurstBytes: 84000000,
        simulated: true,
      },
      simulated: true,
    };

    collectorManager.broadcastCustomEvent(event);
    detectionEngine.processEvent(event);

    return { device: db.getDeviceById(device.id)!, event };
  }

  /**
   * Scenario 5: Dynamic IP Lease Shift
   */
  public simulateIpChange(targetDeviceId?: string): { device: Device; event: NetworkEvent } {
    const devices = db.getDevices();
    const device = targetDeviceId ? db.getDeviceById(targetDeviceId) : devices.find((d) => d.trustStatus === 'known' && d.deviceType === 'laptop') || devices[1];

    if (!device) {
      throw new Error('No device available for IP change');
    }

    const now = new Date().toISOString();
    const oldIp = device.currentIp;
    const newIp = `192.168.1.${Math.floor(Math.random() * 40) + 110}`;

    const newHistory = [
      ...device.ipHistory,
      { ip: newIp, firstSeen: now, lastSeen: now, leaseType: 'dhcp' as const },
    ];

    db.updateDevice(device.id, {
      currentIp: newIp,
      ipAddresses: Array.from(new Set([...device.ipAddresses, newIp])),
      ipHistory: newHistory,
      lastSeen: now,
    });

    const event: NetworkEvent = {
      id: `evt_sim_ip_${Date.now()}`,
      timestamp: now,
      type: 'ip_changed',
      deviceId: device.id,
      deviceName: device.hostname,
      deviceIp: newIp,
      severity: 'info',
      title: `[SIMULATED] IP Address Updated: ${device.hostname}`,
      description: `DHCP lease renewal: MAC ${device.macAddress} transitioned from ${oldIp} to ${newIp}. Historical device identity preserved.`,
      evidence: {
        mac: device.macAddress,
        oldIp,
        newIp,
        identityPreservedBy: 'MAC & DHCP Session Match',
        simulated: true,
      },
      simulated: true,
    };

    collectorManager.broadcastCustomEvent(event);

    return { device: db.getDeviceById(device.id)!, event };
  }
}

export const securityLabEngine = new SecurityLabEngine();
