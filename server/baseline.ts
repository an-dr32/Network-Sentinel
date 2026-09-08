import { db } from './db';
import { BaselineFeatures } from './types';

export class BaselineManager {
  private learningTimer: NodeJS.Timeout | null = null;
  private onUpdateCallback?: (baseline: BaselineFeatures) => void;

  public setUpdateListener(callback: (baseline: BaselineFeatures) => void) {
    this.onUpdateCallback = callback;
  }

  public getBaseline(): BaselineFeatures {
    return db.getBaseline();
  }

  public startLearning(durationSeconds = 15) {
    if (this.learningTimer) {
      clearInterval(this.learningTimer);
    }

    const isIndefinite = durationSeconds <= 0;
    const startTime = new Date().toISOString();
    let currentBaseline = db.updateBaseline({
      isLearning: true,
      isIndefinite,
      learningProgress: 0,
      confidenceScore: 10,
      startTime,
      estimatedRemainingSeconds: isIndefinite ? 0 : durationSeconds,
      eventsAnalyzed: 0,
      totalObservedPackets: 0,
    });

    if (this.onUpdateCallback) {
      this.onUpdateCallback(currentBaseline);
    }

    let elapsed = 0;
    const intervalMs = 1000;

    this.learningTimer = setInterval(() => {
      elapsed += 1;
      const devices = db.getDevices().length;

      let progress: number;
      let remaining: number;
      let confidence: number;

      if (isIndefinite) {
        // Continuous overdrive learning: progress steadily climbs to 99% and maintains active calibration
        progress = Math.min(99, Math.round(15 + Math.min(84, Math.log10(elapsed + 1) * 35)));
        remaining = 0;
        confidence = Math.min(95, Math.round(40 + Math.min(55, Math.log10(elapsed + 1) * 25)));
      } else {
        progress = Math.min(100, Math.round((elapsed / durationSeconds) * 100));
        remaining = Math.max(0, durationSeconds - elapsed);
        confidence = Math.min(95, Math.round(30 + (progress / 100) * 65));
      }

      currentBaseline = db.updateBaseline({
        isLearning: true,
        isIndefinite,
        learningProgress: progress,
        confidenceScore: confidence,
        devicesLearned: devices,
        eventsAnalyzed: elapsed * 8 + devices * 12,
        totalObservedPackets: elapsed * 1250,
        estimatedRemainingSeconds: remaining,
      });

      if (this.onUpdateCallback) {
        this.onUpdateCallback(currentBaseline);
      }

      if (!isIndefinite && remaining <= 0) {
        if (this.learningTimer) {
          clearInterval(this.learningTimer);
          this.learningTimer = null;
        }
        this.finishLearning();
      }
    }, intervalMs);
  }

  public finishLearning() {
    if (this.learningTimer) {
      clearInterval(this.learningTimer);
      this.learningTimer = null;
    }

    const devices = db.getDevices();
    const updated = db.updateBaseline({
      isLearning: false,
      isIndefinite: false,
      learningProgress: 100,
      confidenceScore: 94,
      devicesLearned: devices.length,
      estimatedRemainingSeconds: 0,
    });

    if (this.onUpdateCallback) {
      this.onUpdateCallback(updated);
    }
    return updated;
  }
}

export const baselineManager = new BaselineManager();
