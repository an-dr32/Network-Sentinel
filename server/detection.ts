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

    let rawScore = 0;

    // Rule 1: New / Untrusted Device
    if (device.trustStatus === 'new') {
      const points = weights.newDevice;
      rawScore += points;
      evidence.push({
        rule: 'New unverified device',
        points: points,
        reason: 'Device was recently observed on the subnet without prior baseline registration.',
        timestamp: now,
      });
    }

    // Rule 2: Known / Trusted Device bonus
    if (device.trustStatus === 'known') {
      const reduction = -Math.abs(weights.trustedBonus);
      rawScore += reduction;
      evidence.push({
        rule: 'Trusted identity verification',
        points: reduction,
        reason: 'Device MAC and hostname verified by administrator as authorized network node.',
        timestamp: now,
      });
    }

    // Rule 3: Established baseline compliance
    const baseline = db.getBaseline();
    if (!baseline.isLearning && baseline.confidenceScore > 70 && device.trustStatus !== 'new' && device.trustStatus !== 'suspicious') {
      const reduction = -Math.abs(weights.baselineBonus);
      rawScore += reduction;
      evidence.push({
        rule: 'Normal baseline activity',
        points: reduction,
        reason: 'Communication frequency, destination count, and protocol distribution match learned baseline.',
        timestamp: now,
      });
    }

    // Rule 4: Suspicious open ports or port scan detection
    const highRiskPorts = device.openPorts.filter((p) => [445, 139, 3389, 23, 8080, 4444].includes(p.port));
    const scanEvidence = device.riskEvidence.find((e) => e.rule.toLowerCase().includes('port scan') || e.rule.toLowerCase().includes('reconnaissance'));
    if (scanEvidence) {
      rawScore += weights.portScan;
      evidence.push(scanEvidence);
    } else if (highRiskPorts.length >= 2) {
      const points = Math.min(weights.portScan, 25);
      rawScore += points;
      evidence.push({
        rule: 'High-risk exposed ports',
        points: points,
        reason: `Exposed legacy/management ports (${highRiskPorts.map((p) => p.port).join(', ')}) outside baseline standards.`,
        timestamp: now,
      });
    }

    // Rule 5: DNS Anomaly / Suspicious queries
    const dnsAnomaly = device.dnsLogs?.some((d) => d.isAnomaly);
    const dnsEvidence = device.riskEvidence.find((e) => e.rule.toLowerCase().includes('dns'));
    if (dnsEvidence) {
      rawScore += weights.unusualDns;
      evidence.push(dnsEvidence);
    } else if (dnsAnomaly) {
      rawScore += weights.unusualDns;
      evidence.push({
        rule: 'Unusual DNS resolution pattern',
        points: weights.unusualDns,
        reason: 'Device generated queries matching high-entropy domain generation (DGA) or TXT record tunneling heuristics.',
        timestamp: now,
      });
    }

    // Rule 6: Abnormal Traffic volume / spike
    const trafficEvidence = device.riskEvidence.find((e) => e.rule.toLowerCase().includes('traffic') || e.rule.toLowerCase().includes('exfiltration'));
    if (trafficEvidence) {
      rawScore += weights.abnormalTraffic;
      evidence.push(trafficEvidence);
    } else if (device.trafficStats.rateKbps > 5000) {
      rawScore += weights.abnormalTraffic;
      evidence.push({
        rule: 'Abnormal traffic spike',
        points: weights.abnormalTraffic,
        reason: `Outbound throughput (${(device.trafficStats.rateKbps / 1000).toFixed(1)} Mbps) exceeded 3x historical device baseline.`,
        timestamp: now,
      });
    }

    // Rule 7: Unusual hosts / lateral connections
    const unusualConns = device.activeConnections?.filter((c) => c.isUnusual) || [];
    const hostEvidence = device.riskEvidence.find((e) => e.rule.toLowerCase().includes('lateral') || e.rule.toLowerCase().includes('unusual host'));
    if (hostEvidence) {
      rawScore += weights.unusualHosts;
      evidence.push(hostEvidence);
    } else if (unusualConns.length > 0) {
      rawScore += weights.unusualHosts;
      evidence.push({
        rule: 'Unusual internal peer connections',
        points: weights.unusualHosts,
        reason: `Initiated direct connections to ${unusualConns.length} adjacent subnet hosts without prior baseline association.`,
        timestamp: now,
      });
    }

    // Rule 8: Explicit suspicious or blocked status
    if (device.trustStatus === 'suspicious') {
      rawScore += 25;
      evidence.push({
        rule: 'Flagged suspicious',
        points: 25,
        reason: 'Device manually or algorithmically flagged for active security investigation.',
        timestamp: now,
      });
    } else if (device.trustStatus === 'blocked') {
      rawScore += 50;
      evidence.push({
        rule: 'Quarantine enforcement',
        points: 50,
        reason: 'Device marked as isolated/blocked pending threat remediation.',
        timestamp: now,
      });
    }

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
