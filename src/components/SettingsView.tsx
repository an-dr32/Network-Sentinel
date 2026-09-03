import React, { useState, useEffect } from 'react';
import {
  Settings,
  Save,
  RotateCcw,
  Download,
  Server,
  Sliders,
  Shield,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import { useNetwork } from '../context/NetworkContext';
import { api } from '../utils/api';

export const SettingsView: React.FC = () => {
  const { status, refreshAll, resetSecurityLab } = useNetwork();

  const [settings, setSettings] = useState<any>({
    subnet: '192.168.1.0/24',
    interfaceName: 'eth0',
    collectorType: 'mock',
    autoScanIntervalSeconds: 8,
    baselineDurationSeconds: 15,
    riskWeights: {
      newDevice: 20,
      portScan: 30,
      unusualHosts: 20,
      unusualDns: 10,
      abnormalTraffic: 15,
      trustedBonus: 20,
      baselineBonus: 10,
    },
  });

  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    api.getSettings().then((data) => {
      if (data) setSettings(data);
    });
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await api.updateSettings(settings);
      setIsSaved(true);
      await refreshAll();
      setTimeout(() => setIsSaved(false), 2000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportData = async () => {
    const devices = await api.getDevices();
    const events = await api.getEvents(500);
    const alerts = await api.getAlerts();
    const exportBlob = new Blob(
      [JSON.stringify({ devices, events, alerts, exportedAt: new Date().toISOString() }, null, 2)],
      { type: 'application/json' }
    );
    const url = URL.createObjectURL(exportBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sentinel_network_audit_${Date.now()}.json`;
    a.click();
  };

  return (
    <div id="settings-view" className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between bg-[#111113] p-4 rounded-lg border border-[#27272A]">
        <div>
          <h2 className="text-sm font-semibold text-[#FAFAFA] flex items-center gap-2">
            <Settings className="w-4 h-4 text-emerald-400" />
            <span>Collector & Detection Configuration</span>
          </h2>
          <p className="text-xs text-[#71717A] mt-0.5">
            Configure local network interfaces, rule engine weights, and local data persistence.
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md text-xs font-medium transition-colors shadow-sm"
        >
          {isSaved ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
          <span>{isSaved ? 'Saved Settings' : isSaving ? 'Saving...' : 'Save Changes'}</span>
        </button>
      </div>

      {/* Network Collector Settings */}
      <div className="bg-[#111113] border border-[#27272A] rounded-lg p-5 space-y-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[#FAFAFA] flex items-center gap-2">
          <Server className="w-4 h-4 text-zinc-400" />
          <span>Network Interface & Subnet Discovery</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="text-[#71717A] font-mono block mb-1">Subnet Range</label>
            <input
              type="text"
              value={settings.subnet}
              onChange={(e) => setSettings({ ...settings, subnet: e.target.value })}
              className="w-full bg-[#18181B] border border-[#27272A] rounded-md px-3 py-2 text-[#FAFAFA] font-mono focus:outline-none focus:border-zinc-500"
            />
          </div>

          <div>
            <label className="text-[#71717A] font-mono block mb-1">Network Interface</label>
            <input
              type="text"
              value={settings.interfaceName}
              onChange={(e) => setSettings({ ...settings, interfaceName: e.target.value })}
              className="w-full bg-[#18181B] border border-[#27272A] rounded-md px-3 py-2 text-[#FAFAFA] font-mono focus:outline-none focus:border-zinc-500"
            />
          </div>

          <div>
            <label className="text-[#71717A] font-mono block mb-1">Collector Driver</label>
            <select
              value={settings.collectorType}
              onChange={(e) => setSettings({ ...settings, collectorType: e.target.value })}
              className="w-full bg-[#18181B] border border-[#27272A] rounded-md px-3 py-2 text-[#FAFAFA] focus:outline-none focus:border-zinc-500"
            >
              <option value="mock">Mock / Security Lab Demo Driver</option>
              <option value="linux">Host Linux Neighbor Table (/proc/net/arp)</option>
              <option value="macos">macOS ARP Neighbor Table</option>
              <option value="windows">Windows IP Neighbor Table</option>
            </select>
          </div>
        </div>
      </div>

      {/* Detection Engine Scoring Weights (BIBLE.md §6) */}
      <div className="bg-[#111113] border border-[#27272A] rounded-lg p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[#FAFAFA] flex items-center gap-2">
            <Sliders className="w-4 h-4 text-amber-400" />
            <span>Detection Engine Scoring Weights (BIBLE.md §6)</span>
          </h3>
          <span className="text-[11px] text-[#71717A] font-mono">Clamped 0–100 pts</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div className="bg-[#18181B] p-3 rounded-lg border border-[#27272A]">
            <label className="text-[#71717A] block text-[11px] mb-1">New Device (+pts)</label>
            <input
              type="number"
              value={settings.riskWeights?.newDevice || 20}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  riskWeights: { ...settings.riskWeights, newDevice: parseInt(e.target.value) || 0 },
                })
              }
              className="w-full bg-[#111113] border border-[#27272A] rounded px-2.5 py-1 text-[#FAFAFA] font-mono"
            />
          </div>

          <div className="bg-[#18181B] p-3 rounded-lg border border-[#27272A]">
            <label className="text-[#71717A] block text-[11px] mb-1">Port Scan (+pts)</label>
            <input
              type="number"
              value={settings.riskWeights?.portScan || 30}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  riskWeights: { ...settings.riskWeights, portScan: parseInt(e.target.value) || 0 },
                })
              }
              className="w-full bg-[#111113] border border-[#27272A] rounded px-2.5 py-1 text-[#FAFAFA] font-mono"
            />
          </div>

          <div className="bg-[#18181B] p-3 rounded-lg border border-[#27272A]">
            <label className="text-[#71717A] block text-[11px] mb-1">Unusual Hosts (+pts)</label>
            <input
              type="number"
              value={settings.riskWeights?.unusualHosts || 20}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  riskWeights: { ...settings.riskWeights, unusualHosts: parseInt(e.target.value) || 0 },
                })
              }
              className="w-full bg-[#111113] border border-[#27272A] rounded px-2.5 py-1 text-[#FAFAFA] font-mono"
            />
          </div>

          <div className="bg-[#18181B] p-3 rounded-lg border border-[#27272A]">
            <label className="text-[#71717A] block text-[11px] mb-1">Unusual DNS (+pts)</label>
            <input
              type="number"
              value={settings.riskWeights?.unusualDns || 10}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  riskWeights: { ...settings.riskWeights, unusualDns: parseInt(e.target.value) || 0 },
                })
              }
              className="w-full bg-[#111113] border border-[#27272A] rounded px-2.5 py-1 text-[#FAFAFA] font-mono"
            />
          </div>

          <div className="bg-[#18181B] p-3 rounded-lg border border-[#27272A]">
            <label className="text-[#71717A] block text-[11px] mb-1">Traffic Spike (+pts)</label>
            <input
              type="number"
              value={settings.riskWeights?.abnormalTraffic || 15}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  riskWeights: { ...settings.riskWeights, abnormalTraffic: parseInt(e.target.value) || 0 },
                })
              }
              className="w-full bg-[#111113] border border-[#27272A] rounded px-2.5 py-1 text-[#FAFAFA] font-mono"
            />
          </div>

          <div className="bg-[#18181B] p-3 rounded-lg border border-[#27272A]">
            <label className="text-[#71717A] block text-[11px] mb-1">Trusted Bonus (-pts)</label>
            <input
              type="number"
              value={settings.riskWeights?.trustedBonus || 20}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  riskWeights: { ...settings.riskWeights, trustedBonus: parseInt(e.target.value) || 0 },
                })
              }
              className="w-full bg-[#111113] border border-[#27272A] rounded px-2.5 py-1 text-[#FAFAFA] font-mono"
            />
          </div>

          <div className="bg-[#18181B] p-3 rounded-lg border border-[#27272A]">
            <label className="text-[#71717A] block text-[11px] mb-1">Baseline Match (-pts)</label>
            <input
              type="number"
              value={settings.riskWeights?.baselineBonus || 10}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  riskWeights: { ...settings.riskWeights, baselineBonus: parseInt(e.target.value) || 0 },
                })
              }
              className="w-full bg-[#111113] border border-[#27272A] rounded px-2.5 py-1 text-[#FAFAFA] font-mono"
            />
          </div>

          <div className="bg-[#18181B] p-3 rounded-lg border border-[#27272A]">
            <label className="text-[#71717A] block text-[11px] mb-1">Learning Time (sec)</label>
            <input
              type="number"
              value={settings.baselineDurationSeconds || 15}
              onChange={(e) =>
                setSettings({ ...settings, baselineDurationSeconds: parseInt(e.target.value) || 15 })
              }
              className="w-full bg-[#111113] border border-[#27272A] rounded px-2.5 py-1 text-[#FAFAFA] font-mono"
            />
          </div>
        </div>
      </div>

      {/* Local Data Management */}
      <div className="bg-[#111113] border border-[#27272A] rounded-lg p-5 space-y-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[#FAFAFA] flex items-center gap-2">
          <Shield className="w-4 h-4 text-emerald-400" />
          <span>Local Storage & Data Privacy (BIBLE.md Rule 2 & 15)</span>
        </h3>
        <p className="text-xs text-[#71717A]">
          Network Sentinel strictly operates locally without sending network topology or device telemetry to any remote servers or third parties.
        </p>

        <div className="flex flex-wrap gap-3 pt-2">
          <button
            onClick={handleExportData}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-[#18181B] hover:bg-zinc-800 text-[#FAFAFA] rounded-md border border-[#27272A] text-xs font-medium transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Database (JSON)</span>
          </button>

          <button
            onClick={resetSecurityLab}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-red-950/40 hover:bg-red-900/50 text-red-300 rounded-md border border-red-800/50 text-xs font-medium transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Local Database</span>
          </button>
        </div>
      </div>
    </div>
  );
};
