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
import { SystemStatus, TopologyData, TopologyNode, TopologyEdge } from './server/types';

const PORT = 3000;

async function startServer() {
  const app = express();
  app.use(express.json());

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  const clients = new Set<WebSocket>();

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

  // Start background collector
  await collectorManager.start();

  function getSystemStatus(): SystemStatus {
    const devices = db.getDevices();
    const online = devices.filter((d) => d.status === 'online');
    const suspicious = devices.filter((d) => d.riskSeverity === 'suspicious' || d.trustStatus === 'suspicious');
    const critical = devices.filter((d) => d.riskSeverity === 'critical' || d.quarantined);
    const activeAlerts = db.getAlerts().filter((a) => !a.resolved);
    const baseline = db.getBaseline();
    const settings = db.getSettings();

    return {
      collectorType: settings.collectorType,
      collectorActive: true,
      interfaceName: settings.interfaceName,
      subnet: settings.subnet,
      mode: baseline.isLearning ? 'learning' : 'monitoring',
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
    if (devices.length === 0) {
      return {
        nodes: [],
        edges: [],
        lastUpdated: new Date().toISOString(),
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

    for (const d of devices) {
      const isGateway = d.id === hubId;
      nodes.push({
        id: d.id,
        label: d.hostname || d.currentIp,
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
      });

      if (!isGateway) {
        edges.push({
          id: `edge_${hubId}_${d.id}`,
          source: hubId,
          target: d.id,
          trafficKbps: d.trafficStats?.rateKbps || 0,
          active: d.status === 'online' && !d.quarantined,
          protocol: d.openPorts && d.openPorts.length > 0 ? d.openPorts[0].service.toUpperCase() : 'IP',
        });
      }
    }

    return {
      nodes,
      edges,
      lastUpdated: new Date().toISOString(),
    };
  }

  // ==========================================
  // REST API Endpoints
  // ==========================================

  // Status
  app.get('/api/status', (req, res) => {
    res.json(getSystemStatus());
  });

  // Devices
  app.get('/api/devices', (req, res) => {
    res.json(db.getDevices());
  });

  app.get('/api/devices/:id', (req, res) => {
    const device = db.getDeviceById(req.params.id);
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }
    res.json(device);
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

  // Baseline Learning
  app.get('/api/baseline', (req, res) => {
    res.json(db.getBaseline());
  });

  app.post('/api/baseline/start-learning', (req, res) => {
    const duration = parseInt(req.body.durationSeconds) || 15;
    baselineManager.startLearning(duration);
    res.json({ message: `Baseline learning initiated for ${duration} seconds.` });
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
    if (req.body.collectorType) {
      await collectorManager.setCollectorType(req.body.collectorType);
    }
    broadcast('system.status', getSystemStatus());
    res.json(updated);
  });

  // Discovery Trigger
  app.post('/api/discovery/scan', async (req, res) => {
    const devices = await collectorManager.discoverNow();
    broadcast('system.status', getSystemStatus());
    broadcast('topology.updated', generateTopologyData());
    res.json({ count: devices.length, devices });
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
  });
}

startServer();
