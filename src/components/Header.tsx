import React, { useState, useRef, useEffect } from 'react';
import {
  Radar,
  RefreshCw,
  Sparkles,
  BookOpen,
  Wifi,
  WifiOff,
  CheckCircle2,
  ChevronDown,
  Clock,
  Play,
  Square,
  X,
  Timer,
} from 'lucide-react';
import { useNetwork } from '../context/NetworkContext';

export const Header: React.FC = () => {
  const {
    activeView,
    status,
    baseline,
    wsConnected,
    startBaselineLearning,
    finishBaselineLearning,
    triggerDiscoveryScan,
    cancelDiscoveryScan,
    isScanning,
    scanRemainingSeconds,
    scanTotalSeconds,
    setActiveView,
  } = useNetwork();

  // Dropdown states & duration quantities (strictly max 60s / 1 min)
  const [isMonitoringMenuOpen, setIsMonitoringMenuOpen] = useState(false);
  const [isScanMenuOpen, setIsScanMenuOpen] = useState(false);
  const [learningDuration, setLearningDuration] = useState<number>(15);
  const [scanDuration, setScanDuration] = useState<number>(0); // 0 = Instant sweep, or 5-60s

  const monitoringMenuRef = useRef<HTMLDivElement>(null);
  const scanMenuRef = useRef<HTMLDivElement>(null);

  // Close menus on outside click or Escape key
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (monitoringMenuRef.current && !monitoringMenuRef.current.contains(e.target as Node)) {
        setIsMonitoringMenuOpen(false);
      }
      if (scanMenuRef.current && !scanMenuRef.current.contains(e.target as Node)) {
        setIsScanMenuOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMonitoringMenuOpen(false);
        setIsScanMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleStartLearning = (duration?: number) => {
    const time = Math.min(60, Math.max(5, duration ?? learningDuration));
    setLearningDuration(time);
    startBaselineLearning(time);
    setIsMonitoringMenuOpen(false);
  };

  const handleTriggerScan = (duration?: number) => {
    const time = duration !== undefined ? Math.min(60, Math.max(0, duration)) : scanDuration;
    setScanDuration(time);
    triggerDiscoveryScan(time);
    setIsScanMenuOpen(false);
  };

  const getTitle = () => {
    switch (activeView) {
      case 'overview':
        return {
          title: 'Network Intelligence Console',
          subtitle: 'Real-time discovery, baseline telemetry, and explainable anomaly detection.',
        };
      case 'devices':
        return {
          title: 'Device Registry & Identity',
          subtitle: 'Persistent multi-signal hardware identities with historical IP bindings.',
        };
      case 'topology':
        return {
          title: 'Network Topology Graph',
          subtitle: 'Live visual map of local infrastructure, subnet links, and threat states.',
        };
      case 'events':
      case 'activity':
        return {
          title: 'Monitor Events & Audit Trail',
          subtitle: 'Live feed of observed packet flows, telemetry pulses, and operational events captured during monitoring.',
        };
      case 'alerts':
        return {
          title: 'Security Alerts & Evidence',
          subtitle: 'Transparent rule-based detections with mathematically grounded reasons.',
        };
      case 'security-lab':
        return {
          title: 'Security Demonstration Laboratory',
          subtitle: 'Controlled simulation sandbox verifying the live IDS/NDR detection pipeline.',
        };
      case 'settings':
        return {
          title: 'Collector & Detection Settings',
          subtitle: 'Configure local subnets, scoring heuristics, and baseline learning rates.',
        };
    }
  };

  const { title, subtitle } = getTitle();
  const isLearning = baseline?.isLearning;

  return (
    <header
      id="app-header"
      className="bg-[#111113] border-b border-[#27272A] px-6 py-3.5 flex items-center justify-between gap-4 sticky top-0 z-20"
    >
      {/* Title & Subtitle */}
      <div>
        <h1 className="text-base font-semibold text-[#FAFAFA] flex items-center gap-2">
          {title}
        </h1>
        <p className="text-xs text-[#71717A] mt-0.5">{subtitle}</p>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2.5">
        {/* WebSocket Connection Status */}
        <div
          id="ws-status-badge"
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono border ${
            wsConnected
              ? 'bg-emerald-950/30 text-emerald-300 border-emerald-800/40'
              : 'bg-zinc-800 text-zinc-400 border-zinc-700'
          }`}
          title={wsConnected ? 'Real-time WebSocket stream active' : 'Polling mode'}
        >
          {wsConnected ? <Wifi className="w-3.5 h-3.5 text-emerald-400" /> : <WifiOff className="w-3.5 h-3.5" />}
          <span>{wsConnected ? 'LIVE' : 'POLLING'}</span>
        </div>

        {/* Monitoring Mode & Baseline Learning Dropdown Button */}
        <div className="relative" ref={monitoringMenuRef}>
          {isLearning ? (
            <div className="flex items-center rounded-md bg-amber-950/40 border border-amber-800/60 text-amber-300 text-xs font-medium">
              <div
                id="learning-mode-indicator"
                className="flex items-center gap-2 px-3 py-1 animate-pulse cursor-pointer"
                onClick={() => setIsMonitoringMenuOpen(!isMonitoringMenuOpen)}
                title="Baseline learning is actively observing subnet traffic"
              >
                <BookOpen className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>Learning ({baseline?.learningProgress || 0}%) • {baseline?.estimatedRemainingSeconds ?? 0}s</span>
              </div>
              <button
                id="monitoring-mode-dropdown-btn"
                onClick={() => setIsMonitoringMenuOpen(!isMonitoringMenuOpen)}
                className="px-1.5 py-1 border-l border-amber-800/60 hover:bg-amber-900/40 text-amber-300 transition-colors"
                title="Learning Options Submenu"
                aria-label="Open Baseline Learning Duration Submenu"
              >
                <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${isMonitoringMenuOpen ? 'rotate-180' : ''}`} />
              </button>
            </div>
          ) : (
            <div className="flex items-center rounded-md bg-[#18181B] hover:bg-zinc-800 border border-[#27272A] text-xs text-[#A1A1AA] hover:text-[#FAFAFA] transition-colors">
              <button
                id="start-learning-btn"
                onClick={() => handleStartLearning()}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs hover:text-white transition-colors"
                title={`Start Baseline Learning for ${learningDuration}s (limit: 1 min max)`}
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Monitoring Mode</span>
              </button>
              <button
                id="monitoring-mode-dropdown-btn"
                onClick={() => setIsMonitoringMenuOpen(!isMonitoringMenuOpen)}
                className="px-1.5 py-1 border-l border-[#27272A] hover:bg-zinc-700/60 text-[#A1A1AA] hover:text-white transition-colors"
                title="Configure Baseline Learning Duration (1 min max)"
                aria-label="Open Baseline Learning Duration Submenu"
              >
                <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${isMonitoringMenuOpen ? 'rotate-180' : ''}`} />
              </button>
            </div>
          )}

          {/* Monitoring Mode / Baseline Learning Duration Submenu */}
          {isMonitoringMenuOpen && (
            <div
              id="monitoring-mode-submenu"
              className="absolute right-0 mt-2 w-80 bg-[#141416] border border-[#27272A] rounded-xl shadow-2xl p-4 z-50 animate-in fade-in zoom-in-95 duration-150 text-left"
            >
              <div className="flex items-center justify-between pb-2.5 border-b border-[#27272A]">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-semibold text-[#FAFAFA]">Baseline Learning Duration</span>
                </div>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-950/60 text-amber-300 border border-amber-800/40 font-semibold">
                  Max 60s
                </span>
              </div>

              <p className="text-[11px] text-[#71717A] mt-2 mb-3">
                Sets observation window for recording normal port activity, DNS rates, and typical subnet device profiles before anomaly scoring.
              </p>

              {/* Quick Presets (Max 1 min each) */}
              <div className="space-y-1 mb-3">
                <span className="text-[10px] uppercase font-mono text-[#71717A] tracking-wider block mb-1">
                  Preset Time Windows
                </span>
                <div className="grid grid-cols-5 gap-1.5">
                  {[
                    { sec: 10, label: '10s' },
                    { sec: 15, label: '15s' },
                    { sec: 30, label: '30s' },
                    { sec: 45, label: '45s' },
                    { sec: 60, label: '60s' },
                  ].map((preset) => (
                    <button
                      key={preset.sec}
                      type="button"
                      onClick={() => setLearningDuration(preset.sec)}
                      className={`px-2 py-1.5 rounded text-xs font-mono font-medium transition-all ${
                        learningDuration === preset.sec
                          ? 'bg-amber-500 text-zinc-950 font-bold shadow-sm'
                          : 'bg-[#18181B] hover:bg-zinc-800 text-[#FAFAFA] border border-[#27272A]'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Interactive Duration Slider (5s to 60s) */}
              <div className="space-y-1.5 bg-[#18181B] p-2.5 rounded-lg border border-[#27272A] mb-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#A1A1AA] text-[11px]">Selected Duration:</span>
                  <span className="font-mono font-bold text-amber-400 text-xs">
                    {learningDuration} seconds {learningDuration === 60 ? '(1 min max)' : ''}
                  </span>
                </div>
                <input
                  type="range"
                  min={5}
                  max={60}
                  step={1}
                  value={learningDuration}
                  onChange={(e) => setLearningDuration(parseInt(e.target.value) || 15)}
                  className="w-full h-1.5 bg-[#27272A] rounded-lg appearance-none cursor-pointer accent-amber-400"
                />
                <div className="flex justify-between text-[10px] font-mono text-[#71717A]">
                  <span>5s min</span>
                  <span>30s</span>
                  <span className="text-amber-400/90 font-semibold">60s (1 min max)</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-1">
                {isLearning ? (
                  <button
                    type="button"
                    onClick={async () => {
                      await finishBaselineLearning();
                      setIsMonitoringMenuOpen(false);
                    }}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-red-950/50 hover:bg-red-900/60 border border-red-800/60 text-red-300 rounded-md text-xs font-medium transition-colors"
                  >
                    <Square className="w-3.5 h-3.5 fill-current" />
                    <span>Finish Learning Early</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleStartLearning(learningDuration)}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 rounded-md text-xs font-semibold transition-colors shadow-sm"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Start Learning ({learningDuration}s)</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>


        {/* Scan Subnet Dropdown Button & Submenu */}
        <div className="relative" ref={scanMenuRef}>
          <div className="flex items-center rounded-md bg-zinc-100 hover:bg-white text-zinc-900 shadow-sm transition-colors">
            <button
              id="trigger-scan-btn"
              onClick={() => handleTriggerScan()}
              disabled={isScanning}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50"
              title={
                isScanning
                  ? 'Subnet discovery is currently active'
                  : scanDuration === 0
                  ? 'Trigger immediate subnet discovery sweep'
                  : `Run timed subnet scan for ${scanDuration}s (limit: 1 min max)`
              }
            >
              <Radar className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin text-zinc-900' : ''}`} />
              <span>
                {isScanning
                  ? scanRemainingSeconds > 0
                    ? `Scanning (${scanRemainingSeconds}s)`
                    : 'Scanning...'
                  : scanDuration === 0
                  ? 'Scan Subnet'
                  : `Scan Subnet (${scanDuration}s)`}
              </span>
            </button>
            <button
              id="scan-subnet-dropdown-btn"
              onClick={() => setIsScanMenuOpen(!isScanMenuOpen)}
              className="px-1.5 py-1 border-l border-zinc-300 hover:bg-zinc-200 text-zinc-900 transition-colors"
              title="Configure Subnet Scan Duration (1 min max)"
              aria-label="Open Subnet Scan Duration Submenu"
            >
              <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${isScanMenuOpen ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {/* Subnet Scan Duration Submenu */}
          {isScanMenuOpen && (
            <div
              id="scan-subnet-submenu"
              className="absolute right-0 mt-2 w-80 bg-[#141416] border border-[#27272A] rounded-xl shadow-2xl p-4 z-50 animate-in fade-in zoom-in-95 duration-150 text-left"
            >
              <div className="flex items-center justify-between pb-2.5 border-b border-[#27272A]">
                <div className="flex items-center gap-2">
                  <Radar className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-semibold text-[#FAFAFA]">Subnet Scan Duration</span>
                </div>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-800/40 font-semibold">
                  Max 60s
                </span>
              </div>

              <p className="text-[11px] text-[#71717A] mt-2 mb-3">
                Choose duration for active ARP probes, port discovery, and OS fingerprint sweeps across local network nodes.
              </p>

              {/* Quick Presets (Max 1 min each) */}
              <div className="space-y-1 mb-3">
                <span className="text-[10px] uppercase font-mono text-[#71717A] tracking-wider block mb-1">
                  Preset Scan Windows
                </span>
                <div className="grid grid-cols-3 gap-1.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setScanDuration(0)}
                    className={`px-2 py-1.5 rounded text-xs font-mono font-medium transition-all ${
                      scanDuration === 0
                        ? 'bg-emerald-500 text-zinc-950 font-bold shadow-sm'
                        : 'bg-[#18181B] hover:bg-zinc-800 text-[#FAFAFA] border border-[#27272A]'
                    }`}
                  >
                    ⚡ Instant
                  </button>
                  <button
                    type="button"
                    onClick={() => setScanDuration(10)}
                    className={`px-2 py-1.5 rounded text-xs font-mono font-medium transition-all ${
                      scanDuration === 10
                        ? 'bg-emerald-500 text-zinc-950 font-bold shadow-sm'
                        : 'bg-[#18181B] hover:bg-zinc-800 text-[#FAFAFA] border border-[#27272A]'
                    }`}
                  >
                    10s Sweep
                  </button>
                  <button
                    type="button"
                    onClick={() => setScanDuration(15)}
                    className={`px-2 py-1.5 rounded text-xs font-mono font-medium transition-all ${
                      scanDuration === 15
                        ? 'bg-emerald-500 text-zinc-950 font-bold shadow-sm'
                        : 'bg-[#18181B] hover:bg-zinc-800 text-[#FAFAFA] border border-[#27272A]'
                    }`}
                  >
                    15s Normal
                  </button>
                  <button
                    type="button"
                    onClick={() => setScanDuration(30)}
                    className={`px-2 py-1.5 rounded text-xs font-mono font-medium transition-all ${
                      scanDuration === 30
                        ? 'bg-emerald-500 text-zinc-950 font-bold shadow-sm'
                        : 'bg-[#18181B] hover:bg-zinc-800 text-[#FAFAFA] border border-[#27272A]'
                    }`}
                  >
                    30s Deep
                  </button>
                  <button
                    type="button"
                    onClick={() => setScanDuration(45)}
                    className={`px-2 py-1.5 rounded text-xs font-mono font-medium transition-all ${
                      scanDuration === 45
                        ? 'bg-emerald-500 text-zinc-950 font-bold shadow-sm'
                        : 'bg-[#18181B] hover:bg-zinc-800 text-[#FAFAFA] border border-[#27272A]'
                    }`}
                  >
                    45s Audit
                  </button>
                  <button
                    type="button"
                    onClick={() => setScanDuration(60)}
                    className={`px-2 py-1.5 rounded text-xs font-mono font-medium transition-all ${
                      scanDuration === 60
                        ? 'bg-emerald-500 text-zinc-950 font-bold shadow-sm'
                        : 'bg-[#18181B] hover:bg-zinc-800 text-[#FAFAFA] border border-[#27272A]'
                    }`}
                  >
                    60s (1 min)
                  </button>
                </div>
              </div>

              {/* Interactive Duration Slider (1s to 60s) */}
              <div className="space-y-1.5 bg-[#18181B] p-2.5 rounded-lg border border-[#27272A] mb-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#A1A1AA] text-[11px]">Selected Duration:</span>
                  <span className="font-mono font-bold text-emerald-400 text-xs">
                    {scanDuration === 0 ? 'Instant single pass' : `${scanDuration} seconds (max 60s)`}
                  </span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={60}
                  step={1}
                  value={scanDuration === 0 ? 1 : scanDuration}
                  onChange={(e) => setScanDuration(parseInt(e.target.value) || 1)}
                  className="w-full h-1.5 bg-[#27272A] rounded-lg appearance-none cursor-pointer accent-emerald-400"
                />
                <div className="flex justify-between text-[10px] font-mono text-[#71717A]">
                  <span>1s quick</span>
                  <span>30s normal</span>
                  <span className="text-emerald-400 font-semibold">60s (1 min max)</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-1">
                {isScanning ? (
                  <button
                    type="button"
                    onClick={() => {
                      cancelDiscoveryScan();
                      setIsScanMenuOpen(false);
                    }}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-red-950/50 hover:bg-red-900/60 border border-red-800/60 text-red-300 rounded-md text-xs font-medium transition-colors"
                  >
                    <Square className="w-3.5 h-3.5 fill-current" />
                    <span>Cancel Active Scan</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleTriggerScan(scanDuration)}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md text-xs font-semibold transition-colors shadow-sm"
                  >
                    <Radar className="w-3.5 h-3.5" />
                    <span>Launch Scan ({scanDuration === 0 ? 'Instant' : `${scanDuration}s`})</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

