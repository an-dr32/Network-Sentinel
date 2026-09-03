import React, { useState } from 'react';
import {
  Radar,
  RefreshCw,
  Sparkles,
  BookOpen,
  Wifi,
  WifiOff,
  CheckCircle2,
} from 'lucide-react';
import { useNetwork } from '../context/NetworkContext';

export const Header: React.FC = () => {
  const {
    activeView,
    status,
    baseline,
    wsConnected,
    startBaselineLearning,
    triggerDiscoveryScan,
    setActiveView,
  } = useNetwork();

  const [isScanning, setIsScanning] = useState(false);

  const handleScan = async () => {
    setIsScanning(true);
    try {
      await triggerDiscoveryScan();
    } finally {
      setTimeout(() => setIsScanning(false), 800);
    }
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
      case 'activity':
        return {
          title: 'Real-Time Activity Audit Trail',
          subtitle: 'Chronological feed of observed packet flows, anomalies, and policy events.',
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

        {/* Learning vs Monitoring Mode Badge */}
        {isLearning ? (
          <div
            id="learning-mode-indicator"
            className="flex items-center gap-2 px-3 py-1 rounded-md bg-amber-950/40 border border-amber-800/60 text-amber-300 text-xs font-medium animate-pulse"
          >
            <BookOpen className="w-3.5 h-3.5 text-amber-400" />
            <span>Learning Baseline ({baseline?.learningProgress || 0}%)</span>
          </div>
        ) : (
          <button
            id="start-learning-btn"
            onClick={() => startBaselineLearning(15)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#18181B] hover:bg-zinc-800 border border-[#27272A] text-xs text-[#A1A1AA] hover:text-[#FAFAFA] transition-colors"
            title="Re-learn behavioral baseline from active subnet traffic"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Monitoring Mode</span>
          </button>
        )}

        {/* 1-Click Guided Demo Trigger Button */}
        <button
          id="quick-demo-walkthrough-btn"
          onClick={() => setActiveView('security-lab')}
          className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-medium transition-colors"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>Demo Lab</span>
        </button>

        {/* Discovery Scan Trigger */}
        <button
          id="trigger-scan-btn"
          onClick={handleScan}
          disabled={isScanning}
          className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-zinc-100 hover:bg-white text-zinc-900 text-xs font-medium transition-colors disabled:opacity-50 shadow-sm"
        >
          <Radar className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin text-zinc-900' : ''}`} />
          <span>{isScanning ? 'Scanning...' : 'Scan Subnet'}</span>
        </button>
      </div>
    </header>
  );
};
