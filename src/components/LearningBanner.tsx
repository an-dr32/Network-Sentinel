import React from 'react';
import { BookOpen, Sparkles, CheckCircle2, ShieldCheck, Activity } from 'lucide-react';
import { useNetwork } from '../context/NetworkContext';

export const LearningBanner: React.FC = () => {
  const { baseline } = useNetwork();

  if (!baseline || !baseline.isLearning) {
    return null;
  }

  const progress = baseline.learningProgress;
  const remainingSec = baseline.estimatedRemainingSeconds;

  return (
    <div
      id="learning-mode-banner"
      className="bg-[#18181B] border-b border-amber-800/40 p-4 relative overflow-hidden"
    >
      {/* Background Accent glow */}
      <div className="absolute top-0 right-0 w-64 h-full bg-amber-500/5 blur-2xl pointer-events-none" />

      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left Explanation */}
        <div className="flex items-start gap-3.5">
          <div className="w-9 h-9 rounded-lg bg-amber-950/60 border border-amber-800/60 flex items-center justify-center text-amber-400 shrink-0 mt-0.5">
            <BookOpen className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono uppercase px-2 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-800/60 font-semibold">
                Network Learning Active
              </span>
              <span className="text-xs text-[#A1A1AA]">
                Establishing statistical behavioral baseline
              </span>
            </div>
            <p className="text-xs text-[#FAFAFA] mt-1 font-medium">
              Network Sentinel is observing normal device traffic distributions, port access frequencies, and DNS patterns before calculating anomaly scores.
            </p>
          </div>
        </div>

        {/* Right Stats & Progress Bar */}
        <div className="flex flex-col sm:flex-row items-center gap-6 shrink-0">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="bg-[#111113] border border-[#27272A] px-3 py-1.5 rounded-md">
              <span className="text-[10px] text-[#71717A] uppercase font-mono block">Devices</span>
              <span className="text-sm font-semibold text-[#FAFAFA] font-mono">{baseline.devicesLearned}</span>
            </div>
            <div className="bg-[#111113] border border-[#27272A] px-3 py-1.5 rounded-md">
              <span className="text-[10px] text-[#71717A] uppercase font-mono block">Events</span>
              <span className="text-sm font-semibold text-[#FAFAFA] font-mono">{baseline.eventsAnalyzed}</span>
            </div>
            <div className="bg-[#111113] border border-[#27272A] px-3 py-1.5 rounded-md">
              <span className="text-[10px] text-[#71717A] uppercase font-mono block">Est. Left</span>
              <span className="text-sm font-semibold text-amber-400 font-mono">{remainingSec}s</span>
            </div>
          </div>

          <div className="w-full sm:w-48">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-[#A1A1AA]">Confidence</span>
              <span className="font-mono font-medium text-amber-300">{baseline.confidenceScore}%</span>
            </div>
            <div className="w-full bg-[#111113] h-2 rounded-full overflow-hidden border border-[#27272A]">
              <div
                className="bg-gradient-to-r from-amber-500 to-emerald-400 h-full transition-all duration-500 rounded-full"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
