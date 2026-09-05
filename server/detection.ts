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

    // Rule 1: New / Untrusted Device
    const existingNew = findExisting('new unverified') || findExisting('new device');
    const isNew = device.trustStatus === 'new' || (!!existingNew && device.trustStatus !== 'known');
    if (isNew && device.trustStatus !== 'known') {
      const points = weights.newDevice;
      evidence.push({
        rule: 'New unverified device',
        points: points,
        reason: existingNew?.reason || 'Device joined the subnet without prior baseline authorization record.',
        timestamp: existingNew?.timestamp || now,
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

    // Rule 3: Port Scan / Suspicious Open Ports
    const highRiskPorts = device.openPorts?.filter((p) => [445, 139, 3389, 23, 8080, 4444].includes(p.port)) || [];
    const scanEvidence = findExisting('port scan') || findExisting('reconnaissance') || findExisting('exposed ports');
    if (scanEvidence || highRiskPorts.length >= 2) {
      evidence.push({
        rule: 'Port scanning activity',
        points: weights.portScan,
        reason:
          scanEvidence?.reason ||
          `Exposed legacy/management ports (${highRiskPorts.map((p) => p.port).join(', ')}) outside baseline standards.`,
        timestamp: scanEvidence?.timestamp || now,
      });
    }

    // Rule 4: Unusual DNS / DGA / Tunneling
    const dnsAnomaly = device.dnsLogs?.some((d) => d.isAnomaly);
    const dnsEvidence = findExisting('dns');
    if (dnsEvidence || dnsAnomaly) {
      evidence.push({
        rule: 'Unusual DNS resolution pattern',
        points: weights.unusualDns,
        reason:
          dnsEvidence?.reason ||
          'Device generated queries matching high-entropy domain generation (DGA) or TXT record tunneling heuristics.',
        timestamp: dnsEvidence?.timestamp || now,
      });
    }

    // Rule 5: Abnormal Outbound Traffic Spike
    const trafficEvidence = findExisting('traffic') || findExisting('exfiltration');
    if (trafficEvidence || (device.trafficStats && device.trafficStats.rateKbps > 5000)) {
      evidence.push({
        rule: 'Abnormal traffic spike',
        points: weights.abnormalTraffic,
        reason:
          trafficEvidence?.reason ||
          `Outbound throughput (${((device.trafficStats?.rateKbps || 0) / 1000).toFixed(1)} Mbps) exceeded 3x historical device baseline.`,
        timestamp: trafficEvidence?.timestamp || now,
      });
    }

    // Rule 6: Unusual Internal Hosts / Lateral Connections
    const unusualConns = device.activeConnections?.filter((c) => c.isUnusual) || [];
    const hostEvidence = findExisting('lateral') || findExisting('unusual host') || findExisting('internal peer');
    if (hostEvidence || unusualConns.length > 0) {
      evidence.push({
        rule: 'Unusual internal peer connections',
        points: weights.unusualHosts,
        reason:
          hostEvidence?.reason ||
          `Initiated direct connections to ${unusualConns.length || 'adjacent'} subnet hosts without prior baseline association.`,
        timestamp: hostEvidence?.timestamp || now,
      });
    }

    // Rule 7: Quarantine Enforcement
    if (device.trustStatus === 'blocked' || device.quarantined) {
      evidence.push({
        rule: 'Quarantine enforcement',
        points: 50,
        reason: 'Device marked as isolated/blocked pending threat remediation.',
        timestamp: now,
      });
    }

    // Rule 8: Known / Trusted Device bonus
    if (device.trustStatus === 'known') {
      const reduction = -Math.abs(weights.trustedBonus);
      evidence.push({
        rule: 'Trusted identity verification',
        points: reduction,
        reason: 'Device MAC and hostname verified by administrator as authorized network node.',
        timestamp: now,
      });
    }

    // Rule 9: Established baseline compliance
    const baseline = db.getBaseline();
    if (
      !baseline.isLearning &&
      baseline.confidenceScore > 70 &&
      device.trustStatus !== 'new' &&
      device.trustStatus !== 'suspicious' &&
      device.trustStatus !== 'blocked' &&
      !device.quarantined
    ) {
      const reduction = -Math.abs(weights.baselineBonus);
      evidence.push({
        rule: 'Normal baseline activity',
        points: reduction,
        reason: 'Communication frequency, destination count, and protocol distribution match learned baseline.',
        timestamp: now,
      });
    }

    // Preserve any custom or specific evidence items not covered by standard rules
    const standardKeywords = [
      'new unverified',
      'new device',
      'operating system',
      'undetected os',
      'port scan',
      'reconnaissance',
      'exposed ports',
      'dns',
      'traffic',
      'exfiltration',
      'lateral',
      'unusual host',
      'internal peer',
      'quarantine',
      'trusted identity',
      'normal baseline',
    ];
    for (const item of existingEvidence) {
      const isStandard = standardKeywords.some((k) => item.rule.toLowerCase().includes(k));
      if (!isStandard && !evidence.some((e) => e.rule === item.rule)) {
        evidence.push(item);
      }
    }

    // Sum ALL detected risk weights accurately
    const rawScore = evidence.reduce((sum, item) => sum + item.points, 0);

    // Clamp score between 0 and 100
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
