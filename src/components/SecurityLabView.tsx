import React, { useState } from 'react';
import {
  FlaskConical,
  Play,
  RotateCcw,
  Sparkles,
  Radio,
  Search,
  Globe,
  Activity,
  ShieldAlert,
  CheckCircle2,
  ArrowRight,
  Zap,
} from 'lucide-react';
import { useNetwork } from '../context/NetworkContext';

export const SecurityLabView: React.FC = () => {
  const {
    runSecurityLabScenario,
    resetSecurityLab,
    startBaselineLearning,
    setActiveView,
    setSelectedDevice,
    devices,
  } = useNetwork();

  const [isRunningScenario, setIsRunningScenario] = useState<string | null>(null);
  const [demoStep, setDemoStep] = useState<number>(0);
  const [demoStatusMessage, setDemoStatusMessage] = useState<string>('');

  const handleRunScenario = async (
    scenario: 'new_device' | 'port_scan' | 'dns_anomaly' | 'traffic_spike' | 'ip_change',
    customName?: string
  ) => {
    setIsRunningScenario(scenario);
    try {
      const outcome = await runSecurityLabScenario(scenario, { customName });
      if (outcome?.device) {
        setSelectedDevice(outcome.device);
      }
    } finally {
      setTimeout(() => setIsRunningScenario(null), 600);
    }
  };

  const handleReset = async () => {
    setIsRunningScenario('reset');
    try {
      await resetSecurityLab();
      setDemoStep(0);
      setDemoStatusMessage('Laboratory reset to clean baseline state.');
    } finally {
      setTimeout(() => setIsRunningScenario(null), 500);
    }
  };

  // 1-Click Guided Hackathon Demo Sequence (BIBLE.md §23)
  const runGuidedDemoStep = async (step: number) => {
    setDemoStep(step);
    if (step === 1) {
      setDemoStatusMessage('Step 1: Starting Sentinel in Baseline Learning Mode...');
      await startBaselineLearning(10);
    } else if (step === 2) {
      setDemoStatusMessage('Step 2: Subnet devices observed & verified under normal baseline.');
    } else if (step === 3) {
      setDemoStatusMessage('Step 3: Simulating unverified Rogue IoT Sensor joining subnet...');
      const outcome = await runSecurityLabScenario('new_device', { customName: 'rogue-esp32-sensor.local' });
      if (outcome?.device) setSelectedDevice(outcome.device);
    } else if (step === 4) {
      setDemoStatusMessage('Step 4: Launching lateral TCP port scan against internal nodes...');
      const outcome = await runSecurityLabScenario('port_scan');
      if (outcome?.device) setSelectedDevice(outcome.device);
    } else if (step === 5) {
      setDemoStatusMessage('Step 5: Alert created & Risk spiked to Critical with explainable evidence.');
      setActiveView('alerts');
    }
  };

  return (
    <div id="security-lab-view" className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* SIMULATED Environment Banner required by BIBLE.md Rule 5 */}
      <div className="bg-amber-950/30 border border-amber-800/60 p-4 rounded-lg flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <FlaskConical className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono uppercase px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800 font-bold">
                SIMULATED ENVIRONMENT
              </span>
              <span className="text-xs font-semibold text-[#FAFAFA]">
                Controlled IDS/NDR Security Testbed
              </span>
            </div>
            <p className="text-xs text-[#A1A1AA] mt-1">
              All scenarios in this laboratory flow through the <strong>real rule-based detection engine</strong> and <strong>local SQLite database</strong> to test alerting and explainable risk scores safely.
            </p>
          </div>
        </div>

        <button
          onClick={handleReset}
          disabled={isRunningScenario !== null}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#18181B] hover:bg-zinc-800 text-[#FAFAFA] rounded-md border border-[#27272A] text-xs font-medium transition-colors shrink-0"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset Lab</span>
        </button>
      </div>

      {/* 1-Click Guided Hackathon Demo Sequence (BIBLE.md §23) */}
      <div className="bg-[#111113] border border-[#27272A] rounded-lg p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-semibold text-[#FAFAFA]">
              Guided Hackathon Demonstration Sequence (BIBLE.md §23)
            </h3>
          </div>
          <span className="text-xs font-mono text-amber-400">Step {demoStep} of 5</span>
        </div>

        <p className="text-xs text-[#71717A] mb-4">
          Click the steps sequentially to demonstrate the complete lifecycle: Discovery → Baseline Learning → Rogue Device → Lateral Port Scan → Risk Scoring Spike → Remediation.
        </p>

        {/* Stepper Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5">
          <button
            onClick={() => runGuidedDemoStep(1)}
            className={`p-3 rounded-lg border text-left transition-all ${
              demoStep === 1
                ? 'bg-amber-950/40 border-amber-500 text-amber-200'
                : 'bg-[#18181B] border-[#27272A] text-[#A1A1AA] hover:border-zinc-500'
            }`}
          >
            <span className="text-[10px] font-mono block uppercase text-[#71717A]">Step 1</span>
            <span className="text-xs font-semibold text-[#FAFAFA] block mt-0.5">Start & Baseline</span>
          </button>

          <button
            onClick={() => runGuidedDemoStep(2)}
            className={`p-3 rounded-lg border text-left transition-all ${
              demoStep === 2
                ? 'bg-amber-950/40 border-amber-500 text-amber-200'
                : 'bg-[#18181B] border-[#27272A] text-[#A1A1AA] hover:border-zinc-500'
            }`}
          >
            <span className="text-[10px] font-mono block uppercase text-[#71717A]">Step 2</span>
            <span className="text-xs font-semibold text-[#FAFAFA] block mt-0.5">Subnet Verified</span>
          </button>

          <button
            onClick={() => runGuidedDemoStep(3)}
            className={`p-3 rounded-lg border text-left transition-all ${
              demoStep === 3
                ? 'bg-amber-950/40 border-amber-500 text-amber-200'
                : 'bg-[#18181B] border-[#27272A] text-[#A1A1AA] hover:border-zinc-500'
            }`}
          >
            <span className="text-[10px] font-mono block uppercase text-[#71717A]">Step 3</span>
            <span className="text-xs font-semibold text-[#FAFAFA] block mt-0.5">Rogue Device</span>
          </button>

          <button
            onClick={() => runGuidedDemoStep(4)}
            className={`p-3 rounded-lg border text-left transition-all ${
              demoStep === 4
                ? 'bg-amber-950/40 border-amber-500 text-amber-200'
                : 'bg-[#18181B] border-[#27272A] text-[#A1A1AA] hover:border-zinc-500'
            }`}
          >
            <span className="text-[10px] font-mono block uppercase text-[#71717A]">Step 4</span>
            <span className="text-xs font-semibold text-[#FAFAFA] block mt-0.5">Port Scan Probe</span>
          </button>

          <button
            onClick={() => runGuidedDemoStep(5)}
            className={`p-3 rounded-lg border text-left transition-all ${
              demoStep === 5
                ? 'bg-amber-950/40 border-amber-500 text-amber-200'
                : 'bg-[#18181B] border-[#27272A] text-[#A1A1AA] hover:border-zinc-500'
            }`}
          >
            <span className="text-[10px] font-mono block uppercase text-[#71717A]">Step 5</span>
            <span className="text-xs font-semibold text-[#FAFAFA] block mt-0.5">Inspect Alert</span>
          </button>
        </div>

        {demoStatusMessage && (
          <div className="mt-3 p-2.5 rounded bg-[#18181B] border border-[#27272A] text-xs font-mono text-emerald-400">
            {demoStatusMessage}
          </div>
        )}
      </div>

      {/* Individual Scenario Trigger Cards */}
      <div>
        <h3 className="text-xs font-medium uppercase tracking-wider text-[#71717A] mb-3">
          Individual IDS/NDR Anomaly Scenarios
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Scenario 1: New Unknown Device */}
          <div className="bg-[#111113] border border-[#27272A] rounded-lg p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <Radio className="w-5 h-5 text-blue-400" />
                <span className="text-[10px] font-mono text-blue-300 bg-blue-950/80 px-2 py-0.5 rounded border border-blue-800/60">
                  +20 pts
                </span>
              </div>
              <h4 className="text-xs font-semibold text-[#FAFAFA]">1. Rogue Subnet Device</h4>
              <p className="text-xs text-[#71717A] mt-1">
                Simulates an unknown microcontroller or unauthorized laptop connecting to the local DHCP pool.
              </p>
            </div>
            <button
              onClick={() => handleRunScenario('new_device', 'rogue-esp32-sensor.local')}
              disabled={isRunningScenario !== null}
              className="w-full mt-4 py-2 bg-[#18181B] hover:bg-zinc-800 text-[#FAFAFA] rounded-md border border-[#27272A] text-xs font-medium transition-colors"
            >
              Simulate New Device
            </button>
          </div>

          {/* Scenario 2: Port Scanning */}
          <div className="bg-[#111113] border border-[#27272A] rounded-lg p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <Search className="w-5 h-5 text-red-400" />
                <span className="text-[10px] font-mono text-red-300 bg-red-950/80 px-2 py-0.5 rounded border border-red-800/60">
                  +30 pts
                </span>
              </div>
              <h4 className="text-xs font-semibold text-[#FAFAFA]">2. Lateral TCP Port Scan</h4>
              <p className="text-xs text-[#71717A] mt-1">
                Simulates internal reconnaissance probing sensitive ports (SMB 445, RDP 3389, NetBIOS 139).
              </p>
            </div>
            <button
              onClick={() => handleRunScenario('port_scan')}
              disabled={isRunningScenario !== null}
              className="w-full mt-4 py-2 bg-[#18181B] hover:bg-zinc-800 text-[#FAFAFA] rounded-md border border-[#27272A] text-xs font-medium transition-colors"
            >
              Simulate Port Scan
            </button>
          </div>

          {/* Scenario 3: DNS Anomaly */}
          <div className="bg-[#111113] border border-[#27272A] rounded-lg p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <Globe className="w-5 h-5 text-amber-400" />
                <span className="text-[10px] font-mono text-amber-300 bg-amber-950/80 px-2 py-0.5 rounded border border-amber-800/60">
                  +10 pts
                </span>
              </div>
              <h4 className="text-xs font-semibold text-[#FAFAFA]">3. DNS Tunneling & DGA</h4>
              <p className="text-xs text-[#71717A] mt-1">
                Generates high-entropy domain queries and Base64 TXT exfiltration heuristics.
              </p>
            </div>
            <button
              onClick={() => handleRunScenario('dns_anomaly')}
              disabled={isRunningScenario !== null}
              className="w-full mt-4 py-2 bg-[#18181B] hover:bg-zinc-800 text-[#FAFAFA] rounded-md border border-[#27272A] text-xs font-medium transition-colors"
            >
              Simulate DNS Anomaly
            </button>
          </div>

          {/* Scenario 4: Traffic Spike */}
          <div className="bg-[#111113] border border-[#27272A] rounded-lg p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <Activity className="w-5 h-5 text-amber-400" />
                <span className="text-[10px] font-mono text-amber-300 bg-amber-950/80 px-2 py-0.5 rounded border border-amber-800/60">
                  +15 pts
                </span>
              </div>
              <h4 className="text-xs font-semibold text-[#FAFAFA]">4. Abnormal Outbound Spike</h4>
              <p className="text-xs text-[#71717A] mt-1">
                Simulates sudden 18.5 Mbps burst transmission deviating from historical baseline.
              </p>
            </div>
            <button
              onClick={() => handleRunScenario('traffic_spike')}
              disabled={isRunningScenario !== null}
              className="w-full mt-4 py-2 bg-[#18181B] hover:bg-zinc-800 text-[#FAFAFA] rounded-md border border-[#27272A] text-xs font-medium transition-colors"
            >
              Simulate Traffic Spike
            </button>
          </div>

          {/* Scenario 5: IP Lease Shift */}
          <div className="bg-[#111113] border border-[#27272A] rounded-lg p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <Zap className="w-5 h-5 text-emerald-400" />
                <span className="text-[10px] font-mono text-emerald-300 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800/60">
                  Identity Test
                </span>
              </div>
              <h4 className="text-xs font-semibold text-[#FAFAFA]">5. DHCP Dynamic IP Shift</h4>
              <p className="text-xs text-[#71717A] mt-1">
                Proves BIBLE.md Rule 4: Device IP changes while continuous MAC identity is preserved.
              </p>
            </div>
            <button
              onClick={() => handleRunScenario('ip_change')}
              disabled={isRunningScenario !== null}
              className="w-full mt-4 py-2 bg-[#18181B] hover:bg-zinc-800 text-[#FAFAFA] rounded-md border border-[#27272A] text-xs font-medium transition-colors"
            >
              Simulate IP Change
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
