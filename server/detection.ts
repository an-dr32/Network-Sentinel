import {
  Device,
  NetworkEvent,
  Alert,
  RiskSeverity,
  RiskEvidenceItem,
} from './types';
import { db } from './db';

export class DetectionEngine {
  /**
   * Evaluates the risk score of a device based on its behavior, state, and recent events.
   * Adheres strictly to the explainable rules in BIBLE.md §6 and ARCHITECTURE.md §8.
   */
  public evaluateDeviceRisk(device: Device): {
    score: number;
    severity: RiskSeverity;
    evidence: RiskEvidenceItem[];
  } {
    const settings = db.getSettings();
    const weights = settings.riskWeights;
    const evidence: RiskEvidenceItem[] = [];
    const now = new Date().toISOString();

    const existingEvidence = device.riskEvidence || [];

    // Helper to find existing evidence by keyword
    const findExisting = (keyword: string) =>
      existingEvidence.find((e) => e.rule.toLowerCase().includes(keyword.toLowerCase()));

    // Rule 1: Trust & Device Authorization State
    if (device.trustStatus === 'suspicious') {
      evidence.push({
        rule: 'Suspicious device trust state',
        points: 35,
        reason: 'Device flagged as suspicious by security operator or automated anomaly detection.',
        timestamp: now,
      });
    } else if (device.trustStatus === 'guest') {
      evidence.push({
        rule: 'Guest network device',
        points: 10,
        reason: 'Temporary guest device connected with restricted subnet access policy.',
        timestamp: now,
      });
    } else if (device.trustStatus === 'new' || (!device.trustStatus && device.deviceType !== 'router')) {
      const existingNew = findExisting('new unverified') || findExisting('new device');
      const points = weights.newDevice || 20;
      evidence.push({
        rule: 'New unverified device',
        points: points,
        reason: existingNew?.reason || 'Device joined the subnet without prior baseline authorization record.',
        timestamp: existingNew?.timestamp || now,
      });
    } else if (device.trustStatus === 'known') {
      const reduction = -Math.abs(weights.trustedBonus || 15);
      evidence.push({
        rule: 'Trusted identity verification',
        points: reduction,
        reason: 'Device identity and MAC binding verified by network administrator.',
        timestamp: now,
      });
    }

    // Rule 2: Undetected Operating System
    const isOsUndetected =
      device.deviceType !== 'router' &&
      (!device.osGuess ||
        device.osGuess === 'Unknown OS' ||
        device.osGuess === 'Generic IP Device' ||
        device.osGuess === 'Unidentified Operating System' ||
        device.osGuess === 'Unidentified OS' ||
        device.osGuess.toLowerCase().includes('unknown') ||
        device.osGuess.toLowerCase().includes('unidentified') ||
        (device.osConfidence !== undefined && device.osConfidence < 50));

    const existingOs = findExisting('operating system') || findExisting('undetected os');
    if (isOsUndetected) {
      const osWeight = (weights as any).unidentifiedOs ?? 20;
      evidence.push({
        rule: 'Undetected Operating System',
        points: osWeight,
        reason:
          existingOs?.reason ||
          'Network stack blocked or failed fingerprinting probes (no standard TTL/service banner match). Assigned risk penalty.',
        timestamp: existingOs?.timestamp || now,
      });

      // Ensure an active security alert is registered for unidentified OS
      const existingAlert = db.getAlerts().find(
        (a) => a.deviceId === device.id && a.title.includes('Unidentified Operating System') && !a.resolved
      );
      if (!existingAlert) {
        db.addAlert({
          id: `alt_os_${device.id}_${Date.now()}`,
          eventId: `evt_os_${device.id}_${Date.now()}`,
          deviceId: device.id,
          deviceName: device.hostname || device.currentIp,
          deviceIp: device.currentIp,
          title: 'Unidentified Operating System Detected',
          description: `Device at ${device.currentIp} (${device.macAddress}) did not match known OS signatures. Flagged with ${osWeight}-point penalty for security review.`,
          severity: 'watch',
          riskScore: Math.min(100, osWeight),
          reasons: [
            'Network stack failed standard passive TTL and active service banner matching.',
            'Unclassified operating system poses potential stealth / anomalous device risk.',
          ],
          resolved: false,
          createdAt: now,
          simulated: false,
        });
      }
    }

    // Rule 3: Compounded Open Listening Ports & Service Exposure
    const openPorts = device.openPorts || [];
    const criticalPorts = [445, 139, 3389, 23, 5900, 4444, 135, 6379, 27017];
    const mediumPorts = [22, 80, 8080, 554, 1900, 5000, 5357];

    const detectedCritical = openPorts.filter((p) => criticalPorts.includes(p.port));
    const detectedMedium = openPorts.filter((p) => mediumPorts.includes(p.port));

    for (const cp of detectedCritical) {
      evidence.push({
        rule: `Vulnerable service exposure: Port ${cp.port} (${cp.service || 'tcp'})`,
        points: 15,
        reason: `Exposed legacy or high-risk administrative service (Port ${cp.port} / ${cp.service}) creates direct attack vectors.`,
        timestamp: now,
      });
    }

    for (const mp of detectedMedium) {
      evidence.push({
        rule: `Open service port: Port ${mp.port} (${mp.service || 'tcp'})`,
        points: 8,
        reason: `Listening service on Port ${mp.port} (${mp.service}) expands the device's attack surface.`,
        timestamp: now,
      });
    }

    if (openPorts.length >= 4) {
      evidence.push({
        rule: `Expanded port attack surface (${openPorts.length} open ports)`,
        points: 8,
        reason: `Device exposes ${openPorts.length} simultaneous listening ports across the local subnet.`,
        timestamp: now,
      });
    }

    // Rule 4: Hardware MAC & Vendor Heuristics
    if (device.macAddress && device.macAddress.length >= 17) {
      const secondChar = device.macAddress.charAt(1).toLowerCase();
      // Locally Administered / Randomized MACs have second character 2, 6, a, or e
      if (['2', '6', 'a', 'e'].includes(secondChar)) {
        evidence.push({
          rule: 'Randomized / Private MAC Address',
          points: 12,
          reason: 'Locally administered / randomized private MAC address detected. Masks hardware vendor provenance and inventory tracking.',
          timestamp: now,
        });
      }
    }

    const isUnknownVendor =
      !device.vendor ||
      device.vendor.toLowerCase().includes('unknown') ||
      device.vendor.toLowerCase().includes('generic');
    if (isUnknownVendor && device.deviceType !== 'router') {
      evidence.push({
        rule: 'Unregistered Hardware Vendor OUI',
        points: 8,
        reason: 'MAC address prefix does not match registered IEEE hardware vendor databases.',
        timestamp: now,
      });
    }

    // Rule 5: Compounded Active Security Alerts
    const activeAlerts = db.getAlerts().filter(
      (a) => a.deviceId === device.id && !a.resolved
    );
    for (const alert of activeAlerts) {
      let alertWeight = 10;
      if (alert.severity === 'critical') alertWeight = 25;
      else if (alert.severity === 'suspicious') alertWeight = 15;
      else alertWeight = 8;

      evidence.push({
        rule: `Active Alert: ${alert.title}`,
        points: alertWeight,
        reason: alert.description || `Unresolved security alert (${(alert.severity || 'NORMAL').toUpperCase()} tier).`,
        timestamp: alert.createdAt || now,
      });
    }

    // Rule 6: Unusual DNS / DGA / Tunneling
    const dnsAnomaly = device.dnsLogs?.some((d) => d.isAnomaly);
    const dnsEvidence = findExisting('dns');
    if (dnsEvidence || dnsAnomaly) {
      evidence.push({
        rule: 'Unusual DNS resolution pattern',
        points: weights.unusualDns || 10,
        reason:
          dnsEvidence?.reason ||
          'Device generated queries matching high-entropy domain generation (DGA) or TXT record tunneling heuristics.',
        timestamp: dnsEvidence?.timestamp || now,
      });
    }

    // Rule 7: Abnormal Outbound Traffic Spike
    const trafficEvidence = findExisting('traffic') || findExisting('exfiltration');
    if (trafficEvidence || (device.trafficStats && device.trafficStats.rateKbps > 5000)) {
      evidence.push({
        rule: 'Abnormal traffic spike',
        points: weights.abnormalTraffic || 15,
        reason:
          trafficEvidence?.reason ||
          `Outbound throughput (${((device.trafficStats?.rateKbps || 0) / 1000).toFixed(1)} Mbps) exceeded 3x historical device baseline.`,
        timestamp: trafficEvidence?.timestamp || now,
      });
    }

    // Rule 8: Unusual Internal Hosts / Lateral Connections
    const unusualConns = device.activeConnections?.filter((c) => c.isUnusual) || [];
    const hostEvidence = findExisting('lateral') || findExisting('unusual host') || findExisting('internal peer');
    if (hostEvidence || unusualConns.length > 0) {
      evidence.push({
        rule: 'Unusual internal peer connections',
        points: weights.unusualHosts || 20,
        reason:
          hostEvidence?.reason ||
          `Initiated direct connections to ${unusualConns.length || 'adjacent'} subnet hosts without prior baseline association.`,
        timestamp: hostEvidence?.timestamp || now,
      });
    }

    // Rule 9: Quarantine Enforcement
    if (device.trustStatus === 'blocked' || device.quarantined) {
      evidence.push({
        rule: 'Quarantine enforcement',
        points: 50,
        reason: 'Device marked as isolated/blocked pending threat remediation.',
        timestamp: now,
      });
    }

    // Rule 10: Established Baseline Compliance Bonus
    const baseline = db.getBaseline();
    if (
      !baseline.isLearning &&
      baseline.confidenceScore > 70 &&
      device.trustStatus === 'known' &&
      !device.quarantined &&
      activeAlerts.length === 0 &&
      detectedCritical.length === 0
    ) {
      const reduction = -Math.abs(weights.baselineBonus || 10);
      evidence.push({
        rule: 'Normal baseline activity',
        points: reduction,
        reason: 'Communication frequency, destination count, and protocol distribution match learned baseline.',
        timestamp: now,
      });
    }

    // Preserve any manual lab simulations or unique evidence not generated above
    for (const item of existingEvidence) {
      const alreadyHas = evidence.some(
        (e) => e.rule.toLowerCase() === item.rule.toLowerCase()
      );
      if (!alreadyHas && item.rule.toLowerCase().includes('simulation')) {
        evidence.push(item);
      }
    }

    // Compounding Sum of All Evidence
    const rawScore = evidence.reduce((sum, item) => sum + item.points, 0);

    // Clamp score strictly between 0 and 100
    const finalScore = Math.max(0, Math.min(100, rawScore));

    // Determine severity based on BIBLE.md §6
    let severity: RiskSeverity = 'normal';
    if (finalScore >= 80) {
      severity = 'critical';
    } else if (finalScore >= 60) {
      severity = 'suspicious';
    } else if (finalScore >= 30) {
      severity = 'watch';
    } else {
      severity = 'normal';
    }

    return {
      score: finalScore,
      severity,
      evidence,
    };
  }

  /**
   * Processes a raw network event and triggers alerts if suspicious or critical threshold is breached.
   */
  public processEvent(event: NetworkEvent): Alert | null {
    if (event.severity === 'info') {
      return null;
    }

    const alertId = `alt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const reasons: string[] = [];

    if (event.type === 'device_discovered') {
      reasons.push('Unrecognized MAC / IP combination joined subnet.');
    } else if (event.type === 'port_scan') {
      reasons.push('Rapid sequential SYN probe observed across multiple standard service ports.');
    } else if (event.type === 'dns_anomaly') {
      reasons.push('High-entropy subdomains or DGA queries directed to non-standard upstream resolvers.');
    } else if (event.type === 'traffic_anomaly') {
      reasons.push('Sudden outbound telemetry volume spike deviating from learned baseline model.');
    } else if (event.type === 'ip_changed') {
      reasons.push('IP address lease shifted unexpectedly or possible ARP dispute.');
    } else {
      reasons.push(event.description);
    }

    let riskScore = 40;
    if (event.severity === 'critical') riskScore = 85;
    else if (event.severity === 'suspicious') riskScore = 65;

    const alert: Alert = {
      id: alertId,
      eventId: event.id,
      deviceId: event.deviceId,
      deviceName: event.deviceName,
      deviceIp: event.deviceIp,
      title: event.title,
      description: event.description,
      severity: event.severity,
      riskScore,
      reasons,
      resolved: false,
      createdAt: event.timestamp,
      simulated: event.simulated,
    };

    db.addAlert(alert);
    return alert;
  }
}

export const detectionEngine = new DetectionEngine();
