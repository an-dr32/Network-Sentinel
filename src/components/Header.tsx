import React, { useState, useRef, useEffect } from 'react';
import {
  Radar,
  RefreshCw,
  Sparkles,
  BookOpen,
  Wifi,
  WifiOff,
  Cable,
  CheckCircle2,
  ChevronDown,
  Clock,
  Play,
  Square,
  X,
  Timer,
  Activity,
  PowerOff,
  AlertTriangle,
  Zap,
} from 'lucide-react';
import { useNetwork } from '../context/NetworkContext';

export const Header: React.FC = () => {
  const {
    activeView,
    status,
    connectionState,
    hasEthernet,
    hasWifi,
    isOffline,
    baseline,
    wsConnected,
    finishBaselineLearning,
    triggerDiscoveryScan,
    cancelDiscoveryScan,
    isScanning,
    scanRemainingSeconds,
    scanTotalSeconds,
    setActiveView,
    isMonitoringActive,
    toggleMonitoringMode,
  } = useNetwork();

  // Dropdown states & duration quantities
  const [isScanMenuOpen, setIsScanMenuOpen] = useState(false);
  const [scanDuration, setScanDuration] = useState<number>(0); // 0 = Instant sweep, or seconds

  // Time Overdrive state (>60s / indefinite) for Scan Subnet only
  const [isScanOverdrive, setIsScanOverdrive] = useState(false);
  const [scanIsIndefinite, setScanIsIndefinite] = useState(false);

  // Hold-to-turn-off Monitoring Mode state (requires 4 seconds continuous hold)
  const HOLD_OFF_DURATION = 4000;
  const [isHoldingOff, setIsHoldingOff] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0); // 0 to 100%

  const holdStartTimeRef = useRef<number>(0);
  const holdRafRef = useRef<number | null>(null);
  const holdCompletedRef = useRef<boolean>(false);
  const ignoreClickUntilRef = useRef<number>(0);
  const isMonitoringActiveRef = useRef(isMonitoringActive);
  isMonitoringActiveRef.current = isMonitoringActive;

  const cancelHold = () => {
    if (holdRafRef.current !== null) {
      cancelAnimationFrame(holdRafRef.current);
      holdRafRef.current = null;
    }
    setIsHoldingOff(false);
    setHoldProgress(0);
  };

  const handleMonitoringPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return; // Primary button only
    if (!isMonitoringActiveRef.current) {
      // Normal click will activate monitoring mode
      return;
    }

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // safe fallback
    }

    holdCompletedRef.current = false;
    setIsHoldingOff(true);
    setHoldProgress(0);
    holdStartTimeRef.current = performance.now();

    const updateLoop = (now: number) => {
      const elapsed = now - holdStartTimeRef.current;
      const progress = Math.min(100, (elapsed / HOLD_OFF_DURATION) * 100);
      setHoldProgress(progress);

      if (elapsed >= HOLD_OFF_DURATION) {
        holdCompletedRef.current = true;
        // Suppress trailing click event from toggling monitoring right back on
        ignoreClickUntilRef.current = Date.now() + 1500;
        cancelHold();
        toggleMonitoringMode(false).catch((err) => {
          console.error('Failed to turn off monitoring:', err);
        });
        return;
      }
      holdRafRef.current = requestAnimationFrame(updateLoop);
    };

    holdRafRef.current = requestAnimationFrame(updateLoop);
  };

  const handleMonitoringPointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // safe fallback
    }

    if (!isMonitoringActiveRef.current) return;
    if (isHoldingOff && !holdCompletedRef.current) {
      // Released before 4 seconds reached: cancel and reset animation
      cancelHold();
    }
  };

  const handleMonitoringPointerCancel = (e: React.PointerEvent<HTMLButtonElement>) => {
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // safe fallback
    }
    if (isHoldingOff && !holdCompletedRef.current) {
      cancelHold();
    }
  };

  const handleMonitoringClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    // If the 4-second hold was just completed, ignore the trailing click event completely
    if (Date.now() < ignoreClickUntilRef.current || holdCompletedRef.current) {
      holdCompletedRef.current = false;
      return;
    }

    // When monitoring is OFF, clicking turns it ON immediately
    if (!isMonitoringActiveRef.current) {
      toggleMonitoringMode(true).catch((err) => {
        console.error('Failed to turn on monitoring:', err);
      });
    }
    // When monitoring is ON, simple clicks do nothing (operator must hold for 4 seconds)
  };

  // Cleanup hold animation frame on unmount
  useEffect(() => {
    return () => {
      if (holdRafRef.current !== null) cancelAnimationFrame(holdRafRef.current);
    };
  }, []);

  const scanMenuRef = useRef<HTMLDivElement>(null);

  // Close scan menu on outside click or Escape key
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (scanMenuRef.current && !scanMenuRef.current.contains(e.target as Node)) {
        setIsScanMenuOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
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

  const handleTriggerScan = (duration?: number, indefinite?: boolean) => {
    const isIndef = indefinite !== undefined ? indefinite : scanIsIndefinite;
    const time = isIndef ? 0 : (duration !== undefined ? duration : scanDuration);
    setScanDuration(time);
    triggerDiscoveryScan(time, isIndef);
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
        {/* Auto-detected Network Connection Indicator (Ethernet / Wi-Fi / Both / Offline) */}
        <button
          id="active-interface-badge"
          onClick={() => setActiveView('settings')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono border transition-all ${
            connectionState === 'offline' || isOffline
              ? 'bg-rose-950/40 text-rose-300 border-rose-800/60 hover:bg-rose-900/50 shadow-[0_0_10px_rgba(244,63,94,0.15)]'
              : connectionState === 'both'
              ? 'bg-cyan-950/30 text-cyan-300 border-cyan-800/50 hover:bg-cyan-900/40'
              : connectionState === 'ethernet'
              ? 'bg-blue-950/30 text-blue-300 border-blue-800/50 hover:bg-blue-900/40'
              : 'bg-emerald-950/30 text-emerald-300 border-emerald-800/50 hover:bg-emerald-900/40'
          }`}
          title={
            connectionState === 'offline' || isOffline
              ? 'No Ethernet or Wi-Fi connection detected (Offline). Click to inspect in Settings.'
              : connectionState === 'both'
              ? 'Both Wired Ethernet and Wi-Fi connections detected. Click to configure in Settings.'
              : connectionState === 'ethernet'
              ? 'Wired Ethernet connection active. Click to configure in Settings.'
              : 'Wi-Fi connection active. Click to configure in Settings.'
          }
        >
          {connectionState === 'offline' || isOffline ? (
            <>
              <WifiOff className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
              <span>OFFLINE</span>
            </>
          ) : connectionState === 'both' ? (
            <>
              <Cable className="w-3.5 h-3.5 text-cyan-400" />
              <Wifi className="w-3.5 h-3.5 text-cyan-400" />
              <span>ETHERNET + WI-FI</span>
            </>
          ) : connectionState === 'ethernet' ? (
            <>
              <Cable className="w-3.5 h-3.5 text-blue-400" />
              <span>ETHERNET</span>
            </>
          ) : (
            <>
              <Wifi className="w-3.5 h-3.5 text-emerald-400" />
              <span>WI-FI</span>
            </>
          )}
        </button>

        {/* Scan Subnet Dropdown Button & Submenu (placed to the left of monitoring mode) */}
        <div className="relative" ref={scanMenuRef}>
          {isScanning && scanIsIndefinite ? (
            <div className="flex items-center rounded-md bg-amber-500 hover:bg-amber-400 text-zinc-950 shadow-sm transition-colors font-medium">
              <button
                id="trigger-scan-btn"
                onClick={() => cancelDiscoveryScan()}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold"
                title="Subnet discovery is running indefinitely in overdrive mode. Click to stop."
              >
                <Radar className="w-3.5 h-3.5 animate-spin text-zinc-950" />
                <span>Scanning Indefinitely</span>
                <Square className="w-3 h-3 fill-current ml-0.5 text-zinc-950" />
              </button>
              <button
                id="scan-subnet-dropdown-btn"
                onClick={() => setIsScanMenuOpen(!isScanMenuOpen)}
                className="px-1.5 py-1 border-l border-zinc-900/20 hover:bg-amber-600/30 text-zinc-950 transition-colors"
                title="Subnet Scan Duration Options"
                aria-label="Open Subnet Scan Duration Submenu"
              >
                <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${isScanMenuOpen ? 'rotate-180' : ''}`} />
              </button>
            </div>
          ) : (
            <div className="flex items-center rounded-md bg-zinc-100 hover:bg-white text-zinc-900 shadow-sm transition-colors">
              <button
                id="trigger-scan-btn"
                onClick={() => handleTriggerScan()}
                disabled={isScanning}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50"
                title={
                  isScanning
                    ? 'Subnet discovery is currently active'
                    : scanIsIndefinite
                    ? 'Launch continuous indefinite subnet discovery sweep'
                    : scanDuration === 0
                    ? 'Trigger immediate subnet discovery sweep'
                    : `Run timed subnet scan for ${scanDuration}s`
                }
              >
                <Radar className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin text-zinc-900' : ''}`} />
                <span>
                  {isScanning
                    ? scanRemainingSeconds > 0
                      ? `Scanning (${scanRemainingSeconds}s)`
                      : 'Scanning...'
                    : scanIsIndefinite
                    ? 'Scan (Indefinite)'
                    : scanDuration === 0
                    ? 'Scan Subnet'
                    : `Scan Subnet (${scanDuration}s)`}
                </span>
              </button>
              <button
                id="scan-subnet-dropdown-btn"
                onClick={() => setIsScanMenuOpen(!isScanMenuOpen)}
                className="px-1.5 py-1 border-l border-zinc-300 hover:bg-zinc-200 text-zinc-900 transition-colors"
                title="Configure Subnet Scan Duration"
                aria-label="Open Subnet Scan Duration Submenu"
              >
                <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${isScanMenuOpen ? 'rotate-180' : ''}`} />
              </button>
            </div>
          )}

          {/* Subnet Scan Duration Submenu */}
          {isScanMenuOpen && (
            <div
              id="scan-subnet-submenu"
              className="absolute right-0 mt-2 w-84 bg-[#141416] border border-[#27272A] rounded-xl shadow-2xl p-4 z-50 animate-in fade-in zoom-in-95 duration-150 text-left space-y-3"
            >
              <div className="flex items-center justify-between pb-2 border-b border-[#27272A]">
                <div className="flex items-center gap-2">
                  <Radar className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-semibold text-[#FAFAFA]">Subnet Scan Duration</span>
                </div>
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-semibold ${
                    isScanOverdrive
                      ? 'bg-amber-950/80 text-amber-300 border border-amber-800/60'
                      : 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/40'
                  }`}
                >
                  {isScanOverdrive ? 'Overdrive (>60s)' : 'Standard Max 60s'}
                </span>
              </div>

              {/* Time Overdrive Switch for Scan Subnet */}
              <div className="rounded-lg bg-[#18181B] border border-[#27272A] p-2.5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className={`w-4 h-4 ${isScanOverdrive ? 'text-amber-400' : 'text-zinc-500'}`} />
                    <div>
                      <div className="text-xs font-semibold text-[#FAFAFA] flex items-center gap-1.5">
                        <span>Time Overdrive</span>
                        {isScanOverdrive && (
                          <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-amber-950 text-amber-300 border border-amber-800">
                            ACTIVE
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-[#71717A]">
                        Scan for more than 60 seconds or indefinitely
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    id="scan-overdrive-switch-btn"
                    onClick={() => {
                      const next = !isScanOverdrive;
                      setIsScanOverdrive(next);
                      if (next) {
                        setScanIsIndefinite(true);
                        setScanDuration(0);
                      } else {
                        setScanIsIndefinite(false);
                        setScanDuration(15);
                      }
                    }}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      isScanOverdrive ? 'bg-amber-500' : 'bg-zinc-700'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-zinc-950 shadow ring-0 transition duration-200 ease-in-out ${
                        isScanOverdrive ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {isScanOverdrive && (
                  <div className="flex items-start gap-2 p-2.5 rounded bg-amber-950/40 border border-amber-600/40 text-amber-200/90 text-[11px] leading-relaxed">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-amber-300 font-semibold">Resource &amp; Data Warning:</strong> Time Overdrive scans for extended durations or indefinitely, which may consume excessive CPU, network bandwidth, and ARP/socket telemetry.
                    </div>
                  </div>
                )}
              </div>

              {isScanOverdrive ? (
                <>
                  {/* Overdrive Scan Presets */}
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-mono text-[#71717A] tracking-wider block">
                      Overdrive Windows
                    </span>
                    <div className="grid grid-cols-4 gap-1.5 text-xs">
                      {[
                        { sec: 120, label: '120s (2m)', indefinite: false },
                        { sec: 300, label: '300s (5m)', indefinite: false },
                        { sec: 600, label: '600s (10m)', indefinite: false },
                        { sec: 0, label: 'Indefinite', indefinite: true },
                      ].map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => {
                            setScanIsIndefinite(preset.indefinite);
                            setScanDuration(preset.sec);
                          }}
                          className={`px-1.5 py-1.5 rounded text-xs font-mono font-medium transition-all ${
                            (preset.indefinite && scanIsIndefinite) || (!preset.indefinite && !scanIsIndefinite && scanDuration === preset.sec)
                              ? 'bg-amber-500 text-zinc-950 font-bold shadow-sm'
                              : 'bg-[#18181B] hover:bg-zinc-800 text-[#FAFAFA] border border-[#27272A]'
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Overdrive Slider if not indefinite */}
                  {!scanIsIndefinite ? (
                    <div className="space-y-1.5 bg-[#18181B] p-2.5 rounded-lg border border-[#27272A]">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[#A1A1AA] text-[11px]">Overdrive Duration:</span>
                        <span className="font-mono font-bold text-amber-400 text-xs">
                          {scanDuration} seconds ({Math.round(scanDuration / 60)} min)
                        </span>
                      </div>
                      <input
                        type="range"
                        min={60}
                        max={600}
                        step={30}
                        value={scanDuration < 60 ? 120 : scanDuration}
                        onChange={(e) => {
                          setScanIsIndefinite(false);
                          setScanDuration(parseInt(e.target.value) || 120);
                        }}
                        className="w-full h-1.5 bg-[#27272A] rounded-lg appearance-none cursor-pointer accent-amber-400"
                      />
                      <div className="flex justify-between text-[10px] font-mono text-[#71717A]">
                        <span>60s (1m)</span>
                        <span>300s (5m)</span>
                        <span className="text-amber-400 font-semibold">600s (10m)</span>
                      </div>
                    </div>
                  ) : (
                    <div className="p-2.5 rounded-lg bg-[#18181B] border border-amber-800/40 text-[11px] text-amber-300 flex items-center justify-between font-mono">
                      <span>Continuous Periodic Sweeps</span>
                      <span className="px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 font-bold border border-amber-700/60">
                        Indefinitely
                      </span>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <p className="text-[11px] text-[#71717A]">
                    Standard duration for active ARP probes, port discovery, and OS fingerprint sweeps across local network nodes.
                  </p>

                  {/* Standard Quick Presets (Max 1 min each) */}
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-mono text-[#71717A] tracking-wider block">
                      Preset Scan Windows
                    </span>
                    <div className="grid grid-cols-3 gap-1.5 text-xs">
                      <button
                        type="button"
                        onClick={() => {
                          setScanIsIndefinite(false);
                          setScanDuration(0);
                        }}
                        className={`px-2 py-1.5 rounded text-xs font-mono font-medium transition-all ${
                          scanDuration === 0 && !scanIsIndefinite
                            ? 'bg-emerald-500 text-zinc-950 font-bold shadow-sm'
                            : 'bg-[#18181B] hover:bg-zinc-800 text-[#FAFAFA] border border-[#27272A]'
                        }`}
                      >
                        ⚡ Instant
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setScanIsIndefinite(false);
                          setScanDuration(10);
                        }}
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
                        onClick={() => {
                          setScanIsIndefinite(false);
                          setScanDuration(15);
                        }}
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
                        onClick={() => {
                          setScanIsIndefinite(false);
                          setScanDuration(30);
                        }}
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
                        onClick={() => {
                          setScanIsIndefinite(false);
                          setScanDuration(45);
                        }}
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
                        onClick={() => {
                          setScanIsIndefinite(false);
                          setScanDuration(60);
                        }}
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

                  {/* Standard Interactive Duration Slider (1s to 60s) */}
                  <div className="space-y-1.5 bg-[#18181B] p-2.5 rounded-lg border border-[#27272A]">
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
                      onChange={(e) => {
                        setScanIsIndefinite(false);
                        setScanDuration(parseInt(e.target.value) || 1);
                      }}
                      className="w-full h-1.5 bg-[#27272A] rounded-lg appearance-none cursor-pointer accent-emerald-400"
                    />
                    <div className="flex justify-between text-[10px] font-mono text-[#71717A]">
                      <span>1s quick</span>
                      <span>30s normal</span>
                      <span className="text-emerald-400 font-semibold">60s (1 min max)</span>
                    </div>
                  </div>
                </>
              )}

              {/* Scan Action Buttons */}
              <div className="flex items-center gap-2 pt-1 border-t border-[#27272A]">
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
                    onClick={() => handleTriggerScan(scanIsIndefinite ? 0 : scanDuration, scanIsIndefinite)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-xs font-semibold transition-colors shadow-sm ${
                      isScanOverdrive
                        ? 'bg-amber-500 hover:bg-amber-400 text-zinc-950'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <Radar className="w-3.5 h-3.5" />
                      <span>Launch Scan</span>
                    </div>
                    {isScanOverdrive && scanIsIndefinite ? (
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-zinc-950 text-amber-400 border border-amber-400/40">
                        Indefinitely
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono">
                        {scanDuration === 0 ? 'Instant' : `${scanDuration}s`}
                      </span>
                    )}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Active Baseline Learning Indicator (if learning is in progress) */}
        {isLearning && (
          <div className="flex items-center rounded-md bg-amber-950/40 border border-amber-800/60 text-amber-300 text-xs font-medium">
            <div
              id="learning-mode-indicator"
              className="flex items-center gap-2 px-3 py-1.5 animate-pulse"
              title="Baseline learning is actively observing and profiling subnet traffic"
            >
              <BookOpen className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>
                Learning ({baseline?.learningProgress || 0}%)
              </span>
              {baseline?.isIndefinite ? (
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-500 text-zinc-950 font-bold">
                  Indefinitely
                </span>
              ) : (
                <span>• {baseline?.estimatedRemainingSeconds ?? 0}s</span>
              )}
            </div>
            <button
              type="button"
              id="finish-learning-btn"
              onClick={async (e) => {
                e.stopPropagation();
                await finishBaselineLearning();
              }}
              className="px-2.5 py-1.5 border-l border-amber-800/60 hover:bg-red-950/60 text-amber-300 hover:text-red-200 transition-colors flex items-center gap-1 text-[11px] font-semibold"
              title="Stop Baseline Learning"
            >
              <Square className="w-3 h-3 fill-current" />
              <span>Stop</span>
            </button>
          </div>
        )}

        {/* Monitoring Mode Button with 4-Second Hold Deactivation */}
        <div className="relative">
          <button
            type="button"
            id="toggle-monitoring-btn"
            onClick={handleMonitoringClick}
            onPointerDown={handleMonitoringPointerDown}
            onPointerUp={handleMonitoringPointerUp}
            onPointerCancel={handleMonitoringPointerCancel}
            className={`relative overflow-hidden select-none flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
              isMonitoringActive
                ? isHoldingOff
                  ? 'bg-red-950/90 border border-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.45)] ring-1 ring-red-500/60'
                  : 'bg-emerald-950/40 hover:bg-emerald-900/50 border border-emerald-700/60 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.15)]'
                : 'bg-[#18181B] hover:bg-zinc-800 border border-zinc-700/70 text-zinc-400 hover:text-zinc-200'
            }`}
            title={
              isMonitoringActive
                ? 'Monitoring Mode is ON. Hold button pressed for 4 seconds to turn OFF.'
                : 'Monitoring Mode is OFF. Click to turn ON.'
            }
          >
            {/* Animated Fill Overlay when holding to turn off */}
            {isMonitoringActive && isHoldingOff && (
              <>
                <div
                  className="absolute inset-0 bg-gradient-to-r from-red-600 via-rose-600 to-red-500 opacity-90 transition-[width] duration-75 ease-linear pointer-events-none"
                  style={{ width: `${holdProgress}%` }}
                />
                {/* Glowing Leading Edge */}
                <div
                  className="absolute top-0 bottom-0 w-1 bg-white shadow-[0_0_8px_#ffffff] pointer-events-none transition-[left] duration-75 ease-linear"
                  style={{ left: `calc(${holdProgress}% - 2px)` }}
                />
                {/* Bottom Highlight Accent */}
                <div
                  className="absolute bottom-0 left-0 h-0.5 bg-red-200 shadow-[0_0_6px_#fca5a5] pointer-events-none"
                  style={{ width: `${holdProgress}%` }}
                />
              </>
            )}

            {isMonitoringActive ? (
              isHoldingOff ? (
                <div className="relative z-10 flex items-center gap-2 text-white font-semibold">
                  <PowerOff className="w-3.5 h-3.5 text-red-200 animate-spin shrink-0" />
                  <span>Hold to Turn Off</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-black/50 text-red-100 border border-red-400/50 tabular-nums">
                    {(Math.max(0, 4 - (holdProgress / 100) * 4)).toFixed(1)}s
                  </span>
                </div>
              ) : (
                <div className="relative z-10 flex items-center gap-2">
                  <Activity className="w-3.5 h-3.5 text-emerald-400 animate-pulse shrink-0" />
                  <span>Monitoring Mode</span>
                  <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                    ON
                  </span>
                </div>
              )
            ) : (
              <div className="flex items-center gap-2">
                <PowerOff className="w-3.5 h-3.5 text-amber-400/80 shrink-0" />
                <span>Monitoring Mode</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-zinc-800 text-zinc-400 border border-zinc-700">
                  OFF
                </span>
              </div>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};

