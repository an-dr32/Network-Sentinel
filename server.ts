import express from 'express';
import http from 'http';
import path from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import { db } from './server/db';
import { detectionEngine } from './server/detection';
import { baselineManager } from './server/baseline';
import { responseAdapter } from './server/response';
import { collectorManager } from './server/collectors/collectorManager';
import { securityLabEngine } from './server/securityLab';
import { osFingerprintEngine } from './server/osFingerprint';
import { trafficMonitor } from './server/trafficMonitor';
import { SystemStatus, TopologyData, TopologyNode, TopologyEdge, NetworkEvent } from './server/types';
import {
  getSystemNetworkInterfaces,
  resolveTargetInterface,
  NetworkInterfaceInfo,
} from './server/interfaceDetector';

const PORT = 3000;

async function startServer() {
  const app = express();
  app.use(express.json());

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  const clients = new Set<WebSocket>();

  let activeInterfaceInfo: {
    name: string;
    displayName: string;
    type: 'ethernet' | 'wifi' | 'loopback' | 'virtual' | 'link-local' | 'other';
    isEthernet: boolean;
    isWifi: boolean;
    subnet: string;
  } = {
    name: 'auto',
    displayName: 'Auto-Detect',
    type: 'other',
    isEthernet: false,
    isWifi: false,
    subnet: '',
  };

  let clientNetworkHint = {
    connectionState: 'wifi' as 'wifi' | 'ethernet' | 'both' | 'offline',
    isOnline: true,
    hasEthernet: false,
    hasWifi: false,
    networkType: '',
  };

  async function refreshActiveInterface() {
    try {
      const settings = db.getSettings();
      const resolved = await resolveTargetInterface(settings.interfaceName);
      activeInterfaceInfo = {
        name: resolved.name,
        displayName: resolved.displayName,
        type: resolved.isEthernet ? 'ethernet' : (resolved.isWifi ? 'wifi' : 'other'),
        isEthernet: resolved.isEthernet,
        isWifi: resolved.isWifi,
        subnet: resolved.subnet || settings.subnet || '',
      };
    } catch {}
  }

  await refreshActiveInterface();

  wss.on('connection', (ws) => {
    clients.add(ws);

    // Send initial snapshot
    ws.send(
      JSON.stringify({
        type: 'system.status',
        data: getSystemStatus(),
      })
    );

    ws.on('close', () => {
      clients.delete(ws);
    });
  });

  function broadcast(type: string, data: unknown) {
    const payload = JSON.stringify({ type, data });
    for (const client of clients) {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(payload);
        } catch {
          // ignore closed socket
        }
      }
    }
  }

  // Subscribe baseline updates to websocket
  baselineManager.setUpdateListener((baseline) => {
    broadcast('baseline.updated', baseline);
    broadcast('system.status', getSystemStatus());
  });

  // Subscribe network events from collectors to websocket
  collectorManager.subscribe((event) => {
    broadcast('event.created', event);

    // Check if alert was generated
    const alert = detectionEngine.processEvent(event);
    if (alert) {
      broadcast('alert.created', alert);
    }

    broadcast('topology.updated', generateTopologyData());
    broadcast('system.status', getSystemStatus());
  });

  // Start background collector & real-time router request monitor
  await collectorManager.start();
  trafficMonitor.start();

  // Broadcast real-time router interactions to WebSocket clients
  trafficMonitor.onRouterRequest((reqEvent, summary) => {
    broadcast('router.request', reqEvent);
    broadcast('topology.traffic', summary);
  });

  function getSystemStatus(): SystemStatus {
    const devices = db.getDevices();
    const online = devices.filter((d) => d.status === 'online');
    const suspicious = devices.filter((d) => d.riskSeverity === 'suspicious' || d.trustStatus === 'suspicious');
    const critical = devices.filter((d) => d.riskSeverity === 'critical' || d.quarantined);
    const activeAlerts = db.getAlerts().filter((a) => !a.resolved);
    const baseline = db.getBaseline();
    const settings = db.getSettings();

    const isCollectorRunning = collectorManager.getIsMonitoring();
    const effectiveInterface = settings.interfaceName === 'auto'
      ? `auto (${activeInterfaceInfo.name})`
      : (settings.interfaceName || activeInterfaceInfo.name);

    const hostHasEthernet = Boolean(activeInterfaceInfo.isEthernet);
    const hostHasWifi = Boolean(activeInterfaceInfo.isWifi);
    const hasHostPhysical = hostHasEthernet || hostHasWifi;

    let hasEthernet = false;
    let hasWifi = false;
    let isOffline = false;
    let connectionState: 'wifi' | 'ethernet' | 'both' | 'offline' = 'wifi';

    if (hasHostPhysical) {
      hasEthernet = hostHasEthernet;
      hasWifi = hostHasWifi;
      if (hasEthernet && hasWifi) {
        connectionState = 'both';
      } else if (hasEthernet) {
        connectionState = 'ethernet';
      } else if (hasWifi) {
        connectionState = 'wifi';
      } else {
        connectionState = 'offline';
        isOffline = true;
      }
    } else {
      // In container sandbox or when no physical host NIC: use client-side detection
      if (!clientNetworkHint.isOnline || clientNetworkHint.connectionState === 'offline') {
        connectionState = 'offline';
        isOffline = true;
        hasEthernet = false;
        hasWifi = false;
      } else {
        connectionState = clientNetworkHint.connectionState;
        hasEthernet = clientNetworkHint.hasEthernet || connectionState === 'ethernet' || connectionState === 'both';
        hasWifi = clientNetworkHint.hasWifi || connectionState === 'wifi' || connectionState === 'both';
        isOffline = false;
      }
    }

    return {
      collectorType: settings.collectorType,
      collectorActive: isCollectorRunning,
      interfaceName: effectiveInterface,
      interfaceDisplayName: activeInterfaceInfo.displayName,
      interfaceType: activeInterfaceInfo.type,
      isEthernet: hasEthernet,
      isWifi: hasWifi,
      connectionState,
      hasEthernet,
      hasWifi,
      isOffline,
      subnet: settings.subnet,
      mode: baseline.isLearning ? 'learning' : (isCollectorRunning ? 'monitoring' : 'paused'),
      totalDevices: devices.length,
      onlineDevices: online.length,
      suspiciousDevices: suspicious.length,
      criticalDevices: critical.length,
      activeAlerts: activeAlerts.length,
      uptimeSeconds: Math.floor(process.uptime()),
      lastScanTimestamp: new Date().toISOString(),
    };
  }

  function generateTopologyData(): TopologyData {
    const devices = db.getDevices();
    const trafficSummary = trafficMonitor.getTrafficSummary();

    if (devices.length === 0) {
      return {
        nodes: [],
        edges: [],
        lastUpdated: new Date().toISOString(),
        trafficSummary,
      };
    }

    // Find the detected gateway/router if any
    const gatewayDevice = devices.find(
      (d) =>
        d.tags?.includes('gateway') ||
        d.deviceType === 'router' ||
        d.currentIp?.endsWith('.1')
    );

    const nodes: TopologyNode[] = [];
    const edges: TopologyEdge[] = [];

    // The central hub node: if gateway is detected, use it; otherwise use the first device
    const hubId = gatewayDevice ? gatewayDevice.id : devices[0].id;

    // Only active/connected devices are shown as topology nodes (offline devices are in historic list)
    const connectedDevices = devices.filter((d) => d.status === 'online' || d.id === hubId);

    for (const d of connectedDevices) {
      const isGateway = d.id === hubId;
      const deviceReqStats = trafficSummary.deviceStats[d.id];

      nodes.push({
        id: d.id,
        label: d.customName || d.hostname || d.currentIp,
        customName: d.customName,
        type: isGateway ? 'gateway' : 'device',
        ip: d.currentIp,
        mac: d.macAddress,
        status: d.status,
        trustStatus: d.trustStatus,
        riskScore: d.riskScore,
        riskSeverity: d.riskSeverity,
        deviceType: isGateway ? 'router' : d.deviceType,
        vendor: d.vendor,
        quarantined: d.quarantined,
        routerTraffic: deviceReqStats,
      });

      if (!isGateway) {
        let topType: any = undefined;
        let topCount = 0;
        if (deviceReqStats?.typeCounts) {
          for (const [t, c] of Object.entries(deviceReqStats.typeCounts)) {
            if (c > topCount) {
              topCount = c;
              topType = t;
            }
          }
        }

        edges.push({
          id: `edge_${hubId}_${d.id}`,
          source: hubId,
          target: d.id,
          trafficKbps: d.trafficStats?.rateKbps || 0,
          active: d.status === 'online' && !d.quarantined,
          protocol: d.openPorts && d.openPorts.length > 0 ? d.openPorts[0].service.toUpperCase() : 'IP',
          totalRequests: deviceReqStats?.totalRequests || 0,
          requestsPerMinute: deviceReqStats?.requestsPerMinute || 0,
          requestTypeCounts: deviceReqStats?.typeCounts || {},
          topRequestType: topType,
          lastRequest: deviceReqStats?.lastRequest,
        });
      }
    }

    return {
      nodes,
      edges,
      lastUpdated: new Date().toISOString(),
      trafficSummary,
    };
  }

  // ==========================================
  // REST API Endpoints
  // ==========================================

  // Status
  app.get('/api/status', (req, res) => {
    res.json(getSystemStatus());
  });

  // Client Network Hint Reporting (Synchronizes browser-detected Ethernet / Wi-Fi / Offline)
  app.post('/api/client-network', (req, res) => {
    try {
      const { connectionState, isOnline, hasEthernet, hasWifi, networkType } = req.body;
      clientNetworkHint = {
        connectionState: connectionState || (isOnline === false ? 'offline' : 'wifi'),
        isOnline: isOnline !== undefined ? Boolean(isOnline) : true,
        hasEthernet: Boolean(hasEthernet),
        hasWifi: Boolean(hasWifi),
        networkType: networkType || '',
      };
      broadcast('system.status', getSystemStatus());
      res.json({ success: true, status: getSystemStatus() });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to update client network hint' });
    }
  });

  // Network Interfaces (Ethernet & Wi-Fi Enumeration)
  app.get('/api/interfaces', async (req, res) => {
    try {
      const ifaces = await getSystemNetworkInterfaces();
      // Filter out internal loopback and internal link-local interfaces to prevent fake data
      const physicalOrRoutable = ifaces.filter(
        (i) => i.type !== 'loopback' && i.type !== 'link-local' && i.type !== 'virtual'
      );
      await refreshActiveInterface();
      res.json(physicalOrRoutable);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to enumerate network interfaces' });
    }
  });

  // Interface Selection Endpoint
  app.post('/api/interfaces/select', async (req, res) => {
    try {
      const { interfaceName, autoUpdateSubnet = true } = req.body;
      if (!interfaceName) {
        return res.status(400).json({ error: 'interfaceName is required' });
      }

      const ifaces = await getSystemNetworkInterfaces();
      const match = ifaces.find((i) => i.name === interfaceName);

      const updates: any = { interfaceName };
      if (autoUpdateSubnet && match?.subnet) {
        updates.subnet = match.subnet;
      }

      db.updateSettings(updates);
      await refreshActiveInterface();

      broadcast('system.status', getSystemStatus());
      res.json({
        success: true,
        status: getSystemStatus(),
        selected: match || { name: interfaceName },
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to select network interface' });
    }
  });

  // Monitoring Mode Status & Toggle
  app.get('/api/monitoring', (req, res) => {
    res.json({
      active: collectorManager.getIsMonitoring(),
      mode: getSystemStatus().mode,
    });
  });

  app.post('/api/monitoring/toggle', async (req, res) => {
    const currentState = collectorManager.getIsMonitoring();
    const targetState = req.body?.enabled !== undefined ? Boolean(req.body.enabled) : !currentState;

    if (targetState) {
      await collectorManager.start();
      trafficMonitor.start();
    } else {
      await collectorManager.stop();
      trafficMonitor.stop();
    }

    const event: NetworkEvent = {
      id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      timestamp: new Date().toISOString(),
      type: 'monitoring_event',
      severity: 'info',
      title: targetState ? 'Monitoring Mode Resumed' : 'Monitoring Mode Turned Off',
      description: targetState
        ? 'Real-time packet inspection, traffic telemetry, and active anomaly heuristics have been enabled.'
        : 'Active network monitoring has been turned off. Background telemetry and packet capture are suspended.',
      evidence: {
        action: targetState ? 'resume' : 'pause',
        collectorActive: targetState,
        timestamp: new Date().toISOString(),
      },
      simulated: false,
    };
    db.addEvent(event);

    const status = getSystemStatus();
    broadcast('monitoring.updated', { active: targetState, mode: status.mode });
    broadcast('system.status', status);
    broadcast('event.created', event);

    res.json({ active: targetState, mode: status.mode, status });
  });

  // Devices
  app.get('/api/devices', (req, res) => {
    const devices = db.getDevices();
    // Dynamically evaluate compounded risk scores so they reflect current ports, alerts, and trust status
    const evaluated = devices.map((dev) => {
      const evaluation = detectionEngine.evaluateDeviceRisk(dev);
      if (
        dev.riskScore !== evaluation.score ||
        dev.riskSeverity !== evaluation.severity ||
        (dev.riskEvidence?.length || 0) !== evaluation.evidence.length
      ) {
        db.updateDevice(dev.id, {
          riskScore: evaluation.score,
          riskSeverity: evaluation.severity,
          riskEvidence: evaluation.evidence,
        });
        return {
          ...dev,
          riskScore: evaluation.score,
          riskSeverity: evaluation.severity,
          riskEvidence: evaluation.evidence,
        };
      }
      return dev;
    });
    res.json(evaluated);
  });

  app.get('/api/devices/:id', (req, res) => {
    const device = db.getDeviceById(req.params.id);
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }
    const evaluation = detectionEngine.evaluateDeviceRisk(device);
    const updated = db.updateDevice(device.id, {
      riskScore: evaluation.score,
      riskSeverity: evaluation.severity,
      riskEvidence: evaluation.evidence,
    }) || device;
    res.json(updated);
  });

  app.post('/api/devices/:id/trust', (req, res) => {
    const { trustStatus } = req.body;
    if (!['known', 'new', 'guest', 'suspicious', 'blocked'].includes(trustStatus)) {
      return res.status(400).json({ error: 'Invalid trust status' });
    }

    const device = db.updateDevice(req.params.id, { trustStatus });
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    const evaluation = detectionEngine.evaluateDeviceRisk(device);
    const updated = db.updateDevice(device.id, {
      riskScore: evaluation.score,
      riskSeverity: evaluation.severity,
      riskEvidence: evaluation.evidence,
    })!;

    broadcast('device.updated', updated);
    broadcast('system.status', getSystemStatus());
    broadcast('topology.updated', generateTopologyData());

    res.json(updated);
  });

  // Assign Custom Name / Alias to Device
  app.post('/api/devices/:id/name', (req, res) => {
    const { customName } = req.body;
    const device = db.getDeviceById(req.params.id);
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    const trimmed = typeof customName === 'string' ? customName.trim() : '';
    const updated = db.updateDevice(device.id, {
      customName: trimmed || undefined,
    })!;

    broadcast('device.updated', updated);
    broadcast('system.status', getSystemStatus());
    broadcast('topology.updated', generateTopologyData());

    res.json(updated);
  });

  // Toggle or Update Device Online / Offline Status
  app.post('/api/devices/:id/status', (req, res) => {
    const { status } = req.body;
    if (status !== 'online' && status !== 'offline') {
      return res.status(400).json({ error: 'Status must be online or offline' });
    }

    const device = db.getDeviceById(req.params.id);
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    const now = new Date().toISOString();
    const updated = db.updateDevice(device.id, {
      status,
      lastSeen: status === 'online' ? now : device.lastSeen,
    })!;

    broadcast('device.updated', updated);
    broadcast('devices.updated', db.getDevices());
    broadcast('system.status', getSystemStatus());
    broadcast('topology.updated', generateTopologyData());

    res.json(updated);
  });

  // Defensive Response: Quarantine
  app.post('/api/devices/:id/quarantine', async (req, res) => {
    const { reason } = req.body;
    try {
      const result = await responseAdapter.quarantineDevice(req.params.id, reason);
      const device = db.getDeviceById(req.params.id);
      broadcast('response.updated', result);
      broadcast('device.updated', device);
      broadcast('system.status', getSystemStatus());
      broadcast('topology.updated', generateTopologyData());
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Quarantine failed' });
    }
  });

  // Defensive Response: Restore
  app.post('/api/devices/:id/restore', async (req, res) => {
    try {
      const result = await responseAdapter.restoreDevice(req.params.id);
      const device = db.getDeviceById(req.params.id);
      broadcast('response.updated', result);
      broadcast('device.updated', device);
      broadcast('system.status', getSystemStatus());
      broadcast('topology.updated', generateTopologyData());
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Restore failed' });
    }
  });

  // Network Events
  app.get('/api/events', (req, res) => {
    const limit = parseInt(req.query.limit as string) || 100;
    res.json(db.getEvents(limit));
  });

  // Clear Network Events History
  app.post('/api/events/clear', (req, res) => {
    db.clearEvents();
    broadcast('events.cleared', {});
    broadcast('system.status', getSystemStatus());
    res.json({ success: true, message: 'Event history cleared successfully' });
  });

  app.delete('/api/events', (req, res) => {
    db.clearEvents();
    broadcast('events.cleared', {});
    broadcast('system.status', getSystemStatus());
    res.json({ success: true, message: 'Event history cleared successfully' });
  });

  // Security Alerts
  app.get('/api/alerts', (req, res) => {
    res.json(db.getAlerts());
  });

  app.post('/api/alerts/:id/resolve', (req, res) => {
    const { resolvedBy } = req.body;
    const alert = db.resolveAlert(req.params.id, resolvedBy || 'Administrator');
    if (!alert) {
      return res.status(404).json({ error: 'Alert not found' });
    }
    broadcast('alert.resolved', alert);
    broadcast('system.status', getSystemStatus());
    res.json(alert);
  });

  // Topology Graph Data
  app.get('/api/topology', (req, res) => {
    res.json(generateTopologyData());
  });

  // Real-Time Router Interaction Telemetry
  app.get('/api/topology/traffic', (req, res) => {
    res.json(trafficMonitor.getTrafficSummary());
  });

  app.post('/api/topology/record-request', (req, res) => {
    const event = trafficMonitor.recordRequest(req.body);
    res.json(event);
  });

  // Baseline Learning
  app.get('/api/baseline', (req, res) => {
    res.json(db.getBaseline());
  });

  app.post('/api/baseline/start-learning', (req, res) => {
    const isIndefinite = req.body?.indefinite === true || req.body?.durationSeconds === 0;
    const raw = parseInt(req.body?.durationSeconds);
    const duration = isIndefinite
      ? 0
      : (raw && raw > 0 ? Math.max(5, raw) : (db.getSettings()?.baselineDurationSeconds || 15));
    baselineManager.startLearning(duration);
    res.json({
      message: isIndefinite
        ? 'Baseline learning initiated indefinitely (overdrive mode).'
        : `Baseline learning initiated for ${duration} seconds.`,
      durationSeconds: duration,
      isIndefinite,
    });
  });

  app.post('/api/baseline/finish-learning', (req, res) => {
    const updated = baselineManager.finishLearning();
    res.json(updated);
  });

  // Security Lab Scenarios (Deterministic & Explainable)
  app.post('/api/security-lab/events', (req, res) => {
    const { scenario, targetDeviceId, customName } = req.body;

    let outcome: any;
    if (scenario === 'new_device') {
      outcome = securityLabEngine.simulateNewDevice(customName);
    } else if (scenario === 'port_scan') {
      outcome = securityLabEngine.simulatePortScan(targetDeviceId);
    } else if (scenario === 'dns_anomaly') {
      outcome = securityLabEngine.simulateDnsAnomaly(targetDeviceId);
    } else if (scenario === 'traffic_spike') {
      outcome = securityLabEngine.simulateTrafficSpike(targetDeviceId);
    } else if (scenario === 'ip_change') {
      outcome = securityLabEngine.simulateIpChange(targetDeviceId);
    } else {
      return res.status(400).json({ error: `Unknown scenario: ${scenario}` });
    }

    broadcast('device.updated', outcome.device);
    broadcast('system.status', getSystemStatus());
    broadcast('topology.updated', generateTopologyData());

    res.json(outcome);
  });

  // Security Lab Reset
  app.post('/api/security-lab/reset', (req, res) => {
    db.resetDatabase();
    broadcast('system.status', getSystemStatus());
    broadcast('topology.updated', generateTopologyData());
    broadcast('baseline.updated', db.getBaseline());
    res.json({ message: 'Security laboratory and network database reset to baseline defaults.' });
  });

  // Settings
  app.get('/api/settings', (req, res) => {
    res.json(db.getSettings());
  });

  app.post('/api/settings', async (req, res) => {
    const updated = db.updateSettings(req.body);
    await refreshActiveInterface();
    if (req.body.collectorType) {
      await collectorManager.setCollectorType(req.body.collectorType);
    }

    // Re-evaluate all devices with updated risk weights so scores recalculate immediately
    const devices = db.getDevices();
    for (const dev of devices) {
      const evaluation = detectionEngine.evaluateDeviceRisk(dev);
      db.updateDevice(dev.id, {
        riskScore: evaluation.score,
        riskSeverity: evaluation.severity,
        riskEvidence: evaluation.evidence,
      });
    }

    broadcast('devices.updated', db.getDevices());
    broadcast('system.status', getSystemStatus());
    broadcast('topology.updated', generateTopologyData());
    res.json(updated);
  });

  // OS Detection & Fingerprinting for a Specific Device
  app.post('/api/devices/:id/detect-os', async (req, res) => {
    const device = db.getDeviceById(req.params.id);
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    try {
      const result = await osFingerprintEngine.fingerprintDevice(device);
      const intermediate = db.updateDevice(device.id, {
        osGuess: result.osGuess,
        osConfidence: result.confidence,
        osDetectionDetails: result.details,
        deviceType: result.deviceType,
        openPorts: result.openPorts,
      })!;

      const evaluation = detectionEngine.evaluateDeviceRisk(intermediate);
      const updated = db.updateDevice(intermediate.id, {
        riskScore: evaluation.score,
        riskSeverity: evaluation.severity,
        riskEvidence: evaluation.evidence,
      })!;

      const event: NetworkEvent = {
        id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        timestamp: new Date().toISOString(),
        type: 'os_fingerprinted',
        deviceId: device.id,
        deviceName: device.hostname,
        deviceIp: device.currentIp,
        severity: 'info',
        title: `OS Fingerprinted: ${result.osGuess}`,
        description: `Identified OS for ${device.hostname} (${device.currentIp}) with ${result.confidence}% confidence via ${result.details.methods.join(', ')}.`,
        evidence: {
          osGuess: result.osGuess,
          confidence: result.confidence,
          signatureMatch: result.details.signatureMatch,
          ttl: result.details.ttl,
          openPorts: result.openPorts.map((p) => p.port),
          methods: result.details.methods,
        },
        simulated: false,
      };
      db.addEvent(event);

      broadcast('device.updated', updated);
      broadcast('event.new', event);
      broadcast('system.status', getSystemStatus());
      broadcast('topology.updated', generateTopologyData());

      res.json({ device: updated, fingerprint: result });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to detect device OS' });
    }
  });

  // Batch OS Detection Across All Devices
  app.post('/api/discovery/detect-all-os', async (req, res) => {
    const devices = db.getDevices();
    const results = [];

    for (const dev of devices) {
      try {
        const fp = await osFingerprintEngine.fingerprintDevice(dev);
        const intermediate = db.updateDevice(dev.id, {
          osGuess: fp.osGuess,
          osConfidence: fp.confidence,
          osDetectionDetails: fp.details,
          deviceType: fp.deviceType,
          openPorts: fp.openPorts,
        })!;
        const evaluation = detectionEngine.evaluateDeviceRisk(intermediate);
        const updated = db.updateDevice(intermediate.id, {
          riskScore: evaluation.score,
          riskSeverity: evaluation.severity,
          riskEvidence: evaluation.evidence,
        })!;
        results.push(updated);
        broadcast('device.updated', updated);
      } catch (err) {
        console.warn(`Fingerprint failed for ${dev.hostname}:`, err);
      }
    }

    broadcast('system.status', getSystemStatus());
    broadcast('topology.updated', generateTopologyData());
    res.json({ count: results.length, devices: results });
  });

  // Discovery Trigger
  app.post('/api/discovery/scan', async (req, res) => {
    const raw = req.body?.durationSeconds !== undefined ? parseInt(req.body.durationSeconds) : 0;
    const durationSeconds = raw > 0 ? raw : 0;
    const activeDiscoveredDevices = await collectorManager.discoverNow();

    // Set of active discovered MAC addresses
    const activeMacs = new Set(
      activeDiscoveredDevices.map((d) => d.macAddress.toLowerCase())
    );

    const now = new Date().toISOString();
    const allDbDevices = db.getDevices();

    // Mark active devices as online, and devices not discovered as offline (preserved in historic list)
    for (const dev of allDbDevices) {
      if (activeMacs.has(dev.macAddress.toLowerCase())) {
        db.updateDevice(dev.id, {
          status: 'online',
          lastSeen: now,
        });
      } else {
        db.updateDevice(dev.id, {
          status: 'offline',
        });
      }
    }

    // Automatically enrich devices with OS fingerprinting if not yet fingerprinted
    for (const dev of db.getDevices()) {
      if (dev.status === 'online' && (!dev.osDetectionDetails || !dev.osGuess)) {
        try {
          const fp = await osFingerprintEngine.fingerprintDevice(dev);
          db.updateDevice(dev.id, {
            osGuess: fp.osGuess,
            osConfidence: fp.confidence,
            osDetectionDetails: fp.details,
            deviceType: fp.deviceType,
            openPorts: fp.openPorts,
          });
        } catch {}
      }
    }

    // Re-evaluate risk for all devices so compounding scores update immediately
    for (const dev of db.getDevices()) {
      const evaluation = detectionEngine.evaluateDeviceRisk(dev);
      db.updateDevice(dev.id, {
        riskScore: evaluation.score,
        riskSeverity: evaluation.severity,
        riskEvidence: evaluation.evidence,
      });
    }

    const currentDevices = db.getDevices();
    broadcast('devices.updated', currentDevices);
    broadcast('system.status', getSystemStatus());
    broadcast('topology.updated', generateTopologyData());
    res.json({ count: currentDevices.length, devices: currentDevices, durationSeconds });
  });

  // Vite Middleware in dev or static serving in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[Network Sentinel] Server running on http://0.0.0.0:${PORT}`);

    // Perform initial discovery so disconnected or historic nodes are cleanly catalogued
    setTimeout(async () => {
      try {
        await collectorManager.discoverNow();
        broadcast('devices.updated', db.getDevices());
        broadcast('system.status', getSystemStatus());
        broadcast('topology.updated', generateTopologyData());
      } catch (err) {
        console.warn('[Network Sentinel] Initial discovery sweep warning:', err);
      }
    }, 1200);
  });
}

startServer();
