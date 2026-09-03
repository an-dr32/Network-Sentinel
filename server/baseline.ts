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

    const startTime = new Date().toISOString();
    let currentBaseline = db.updateBaseline({
      isLearning: true,
      learningProgress: 0,
      confidenceScore: 10,
      startTime,
      estimatedRemainingSeconds: durationSeconds,
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
      const progress = Math.min(100, Math.round((elapsed / durationSeconds) * 100));
      const remaining = Math.max(0, durationSeconds - elapsed);
      const devices = db.getDevices().length;
      const confidence = Math.min(95, Math.round(30 + (progress / 100) * 65));

      currentBaseline = db.updateBaseline({
        isLearning: remaining > 0,
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

      if (remaining <= 0) {
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
