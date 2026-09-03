import { db } from './db';
import { ResponseResult } from './types';
import { detectionEngine } from './detection';

export interface ResponseAdapter {
  quarantineDevice(deviceId: string, reason?: string): Promise<ResponseResult>;
  restoreDevice(deviceId: string): Promise<ResponseResult>;
}

export class MockResponseAdapter implements ResponseAdapter {
  public async quarantineDevice(deviceId: string, reason = 'Administrative isolation due to security alert'): Promise<ResponseResult> {
    const device = db.getDeviceById(deviceId);
    if (!device) {
      throw new Error(`Device with ID ${deviceId} not found`);
    }

    const now = new Date().toISOString();
    const updatedDevice = db.updateDevice(deviceId, {
      quarantined: true,
      trustStatus: 'blocked',
      quarantineDetails: {
        quarantinedAt: now,
        reason,
        method: 'Mock ACL Policy / Simulated ARP Isolation',
        simulated: true,
      },
    });

    if (updatedDevice) {
      const evaluation = detectionEngine.evaluateDeviceRisk(updatedDevice);
      db.updateDevice(deviceId, {
        riskScore: evaluation.score,
        riskSeverity: evaluation.severity,
      });
    }

    const result: ResponseResult = {
      success: true,
      deviceId,
      action: 'quarantine',
      method: 'Simulated Gateway ACL Rule [Drop src=' + device.currentIp + ' / mac=' + device.macAddress + ']',
      timestamp: now,
      simulated: true,
      details: `[SIMULATED] Device ${device.hostname} (${device.currentIp}) was successfully isolated via simulated local firewall/ARP policy.`,
    };

    db.addAction(result);

    // Record response event
    db.addEvent({
      id: `evt_resp_${Date.now()}`,
      timestamp: now,
      type: 'response',
      deviceId: device.id,
      deviceName: device.hostname,
      deviceIp: device.currentIp,
      severity: 'watch',
      title: `[SIMULATED] Device Quarantined: ${device.hostname}`,
      description: `Defensive response executed. Traffic dropped for MAC ${device.macAddress} (IP: ${device.currentIp}).`,
      evidence: {
        action: 'quarantine',
        method: 'Mock ACL Policy',
        simulated: true,
        reason,
      },
      simulated: true,
    });

    return result;
  }

  public async restoreDevice(deviceId: string): Promise<ResponseResult> {
    const device = db.getDeviceById(deviceId);
    if (!device) {
      throw new Error(`Device with ID ${deviceId} not found`);
    }

    const now = new Date().toISOString();
    const updatedDevice = db.updateDevice(deviceId, {
      quarantined: false,
      trustStatus: 'known',
      quarantineDetails: undefined,
    });

    if (updatedDevice) {
      const evaluation = detectionEngine.evaluateDeviceRisk(updatedDevice);
      db.updateDevice(deviceId, {
        riskScore: evaluation.score,
        riskSeverity: evaluation.severity,
      });
    }

    const result: ResponseResult = {
      success: true,
      deviceId,
      action: 'restore',
      method: 'Simulated Gateway ACL Flush',
      timestamp: now,
      simulated: true,
      details: `[SIMULATED] Device ${device.hostname} (${device.currentIp}) access restored to normal network routing.`,
    };

    db.addAction(result);

    db.addEvent({
      id: `evt_resp_${Date.now()}`,
      timestamp: now,
      type: 'response',
      deviceId: device.id,
      deviceName: device.hostname,
      deviceIp: device.currentIp,
      severity: 'info',
      title: `[SIMULATED] Device Restored: ${device.hostname}`,
      description: `Quarantine removed. Normal communication re-enabled for ${device.hostname}.`,
      evidence: {
        action: 'restore',
        method: 'Mock ACL Flush',
        simulated: true,
      },
      simulated: true,
    });

    return result;
  }
}

export const responseAdapter = new MockResponseAdapter();
