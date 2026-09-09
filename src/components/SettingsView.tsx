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
  Play,
  Square,
  Timer,
  Sparkles,
  Cable,
  Wifi,
  WifiOff,
  RefreshCw,
  Check,
  Zap,
} from 'lucide-react';
import { useNetwork } from '../context/NetworkContext';
import { api } from '../utils/api';
import { NetworkInterfaceInfo } from '../types';

export const SettingsView: React.FC = () => {
  const {
    status,
    connectionState,
    hasEthernet,
    hasWifi,
    isOffline,
    refreshAll,
    resetSecurityLab,
    baseline,
    startBaselineLearning,
    finishBaselineLearning,
  } = useNetwork();

  const [settings, setSettings] = useState<any>({
    subnet: status?.subnet || '',
    interfaceName: 'auto',
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

  const [interfaces, setInterfaces] = useState<NetworkInterfaceInfo[]>([]);
  const [isLoadingInterfaces, setIsLoadingInterfaces] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const loadInterfaces = async () => {
    setIsLoadingInterfaces(true);
    try {
      const data = await api.getInterfaces();
      if (Array.isArray(data)) {
        setInterfaces(data);
      }
    } catch (err) {
      console.warn('Failed to load network interfaces:', err);
    } finally {
      setIsLoadingInterfaces(false);
    }
  };

  useEffect(() => {
    api.getSettings().then((data) => {
      if (data) setSettings(data);
    });
    loadInterfaces();
  }, []);

  const handleSelectInterface = async (ifaceName: string, subnet?: string) => {
    setSettings((prev: any) => ({
      ...prev,
      interfaceName: ifaceName,
      ...(subnet ? { subnet } : {}),
    }));

    try {
      await api.selectInterface(ifaceName, Boolean(subnet));
      await refreshAll();
    } catch (err) {
      console.warn('Interface selection error:', err);
    }
  };

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

      {/* Network Collector & Interface Settings */}
      <div className="bg-[#111113] border border-[#27272A] rounded-lg p-5 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-[#27272A]">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#FAFAFA] flex items-center gap-2">
              <Server className="w-4 h-4 text-emerald-400" />
              <span>Network Interface & Ethernet Routing</span>
            </h3>
            <p className="text-[11px] text-[#71717A] mt-0.5">
              Select your active wired Ethernet adapter or Wi-Fi card. The discovery engine binds probes to the chosen interface and primes the OS neighbor cache.
            </p>
          </div>

          <button
            onClick={loadInterfaces}
            disabled={isLoadingInterfaces}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#18181B] hover:bg-zinc-800 border border-[#27272A] text-[#FAFAFA] rounded-md text-xs font-medium transition-colors self-start sm:self-auto"
            title="Scan for connected Ethernet and Wi-Fi interfaces"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingInterfaces ? 'animate-spin text-emerald-400' : 'text-zinc-400'}`} />
            <span>{isLoadingInterfaces ? 'Detecting Interfaces...' : 'Refresh Interfaces'}</span>
          </button>
        </div>

        {/* Live Network State Banner */}
        <div
          id="connection-state-banner"
          className={`flex items-center justify-between p-3 rounded-lg border text-xs font-mono ${
            connectionState === 'offline' || isOffline
              ? 'bg-rose-950/30 border-rose-800/50 text-rose-300'
              : connectionState === 'both'
              ? 'bg-cyan-950/20 border-cyan-800/40 text-cyan-300'
              : connectionState === 'ethernet'
              ? 'bg-blue-950/20 border-blue-800/40 text-blue-300'
              : 'bg-emerald-950/20 border-emerald-800/40 text-emerald-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {connectionState === 'offline' || isOffline ? (
              <WifiOff className="w-4 h-4 text-rose-400 animate-pulse" />
            ) : connectionState === 'both' ? (
              <div className="flex items-center gap-1">
                <Cable className="w-4 h-4 text-cyan-400" />
                <Wifi className="w-4 h-4 text-cyan-400" />
              </div>
            ) : connectionState === 'ethernet' ? (
              <Cable className="w-4 h-4 text-blue-400" />
            ) : (
              <Wifi className="w-4 h-4 text-emerald-400" />
            )}
            <div>
              <span className="font-semibold uppercase tracking-wider">
                Connection Status:{' '}
                {connectionState === 'offline' || isOffline
                  ? 'Offline (No Ethernet or Wi-Fi)'
                  : connectionState === 'both'
                  ? 'Connected via Both Wired Ethernet + Wi-Fi'
                  : connectionState === 'ethernet'
                  ? 'Connected via Wired Ethernet'
                  : 'Connected via Wi-Fi'}
              </span>
              <p className="text-[11px] text-zinc-400 font-sans mt-0.5">
                {connectionState === 'offline' || isOffline
                  ? 'No network connectivity detected. Local host discovery is idle.'
                  : 'Automatic network inspection active. No simulated or mock interfaces are displayed.'}
              </p>
            </div>
          </div>

          <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-zinc-900/80 border border-zinc-700/60">
            {(connectionState || 'offline').toUpperCase()}
          </span>
        </div>

        {/* Interface Picker Cards */}
        <div className="space-y-2">
          <label className="text-[11px] font-mono text-[#A1A1AA] block uppercase tracking-wider">
            Detected Hardware Interfaces (Ethernet & Wi-Fi)
          </label>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Auto Mode Card */}
            <div
              onClick={() => handleSelectInterface('auto')}
              className={`p-3.5 rounded-lg border transition-all cursor-pointer flex flex-col justify-between ${
                settings.interfaceName === 'auto'
                  ? 'bg-emerald-950/20 border-emerald-500/80 shadow-[0_0_12px_rgba(16,185,129,0.15)]'
                  : 'bg-[#18181B] border-[#27272A] hover:border-zinc-600'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-md bg-emerald-950/60 border border-emerald-800/40 text-emerald-400">
                    <Zap className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-[#FAFAFA]">Auto-Detect (Prefers Ethernet)</span>
                    <span className="text-[10px] font-mono text-emerald-400 block">
                      Active: {(connectionState || 'offline').toUpperCase()}
                    </span>
                  </div>
                </div>
                {settings.interfaceName === 'auto' && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-500 text-zinc-950">
                    <Check className="w-3 h-3" /> Active
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#71717A] mt-2">
                Prioritizes wired Ethernet whenever an Ethernet cable or adapter is detected; automatically uses Wi-Fi or both when available.
              </p>
            </div>

            {/* Individual Interfaces or Empty State */}
            {interfaces.length === 0 ? (
              <div className="p-3.5 rounded-lg border border-[#27272A] bg-[#18181B]/50 flex flex-col justify-between">
                <div className="flex items-center gap-2 text-[#71717A]">
                  <Server className="w-4 h-4 text-zinc-500" />
                  <span className="text-xs font-medium text-zinc-400">No Physical Host NICs Listed</span>
                </div>
                <p className="text-[11px] text-zinc-500 mt-2">
                  Host system reports no secondary physical network cards. Real-time client network probing is active ({(connectionState || 'offline').toUpperCase()}). Only genuinely detected hardware is displayed.
                </p>
              </div>
            ) : (
              interfaces.map((iface) => {
                const isSelected = settings.interfaceName === iface.name;
                const isEthernet = iface.isEthernet;

                return (
                  <div
                    key={iface.name}
                    onClick={() => handleSelectInterface(iface.name, iface.subnet)}
                    className={`p-3.5 rounded-lg border transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'bg-blue-950/25 border-blue-500/80 shadow-[0_0_12px_rgba(59,130,246,0.15)]'
                        : 'bg-[#18181B] border-[#27272A] hover:border-zinc-600'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div
                          className={`p-1.5 rounded-md border ${
                            isEthernet
                              ? 'bg-blue-950/60 border-blue-800/40 text-blue-400'
                              : 'bg-purple-950/60 border-purple-800/40 text-purple-400'
                          }`}
                        >
                          {isEthernet ? <Cable className="w-4 h-4" /> : <Wifi className="w-4 h-4" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-[#FAFAFA] font-mono">{iface.name}</span>
                            <span
                              className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-medium border ${
                                isEthernet
                                  ? 'bg-blue-950/60 text-blue-300 border-blue-800/40'
                                  : 'bg-purple-950/60 text-purple-300 border-purple-800/40'
                              }`}
                            >
                              {isEthernet ? 'ETHERNET (WIRED)' : 'WI-FI (WIRELESS)'}
                            </span>
                          </div>
                          <span className="text-[11px] text-[#A1A1AA] block">{iface.displayName || iface.name}</span>
                        </div>
                      </div>

                      {isSelected ? (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-blue-500 text-white">
                          <Check className="w-3 h-3" /> Selected
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectInterface(iface.name, iface.subnet);
                          }}
                          className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 transition-colors"
                        >
                          Use Interface
                        </button>
                      )}
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-[#27272A]/70 grid grid-cols-2 gap-2 text-[10px] font-mono text-[#71717A]">
                      <div>
                        <span className="text-[#52525B]">IP: </span>
                        <span className="text-zinc-200">{iface.ipAddress || 'Not assigned'}</span>
                      </div>
                      <div>
                        <span className="text-[#52525B]">Subnet: </span>
                        <span className="text-zinc-200">{iface.subnet || 'Unknown'}</span>
                      </div>
                      <div>
                        <span className="text-[#52525B]">MAC: </span>
                        <span className="text-zinc-400">{iface.macAddress || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-[#52525B]">Status: </span>
                        <span className={iface.isDefaultRoute || iface.ipAddress ? 'text-emerald-400' : 'text-zinc-500'}>
                          {iface.isDefaultRoute ? 'Default Gateway' : iface.ipAddress ? 'Connected' : 'Disconnected'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Manual Fine-Tuning & Driver selection */}
        <div className="pt-3 border-t border-[#27272A]">
          <span className="text-[11px] font-mono text-[#71717A] block uppercase tracking-wider mb-2">
            Manual Override & Driver Tuning
          </span>
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
              <label className="text-[#71717A] font-mono block mb-1">Active Interface Identifier</label>
              <input
                type="text"
                value={settings.interfaceName}
                onChange={(e) => setSettings({ ...settings, interfaceName: e.target.value })}
                placeholder="auto, en0, eth0, etc."
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
                <option value="macos">macOS Native Neighbor Table (arp -an)</option>
                <option value="windows">Windows IP Neighbor Table</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Detection Engine Heuristic Scoring Weights */}
      <div className="bg-[#111113] border border-[#27272A] rounded-lg p-5 space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[#FAFAFA] flex items-center gap-2">
            <Sliders className="w-4 h-4 text-amber-400" />
            <span>Detection Engine Heuristic Scoring Weights</span>
          </h3>
          <span className="text-[11px] text-[#71717A] font-mono">Compounded 0–100 pts</span>
        </div>

        {/* Section divider */}
        <div className="pt-2 border-t border-[#27272A] flex items-center justify-between">
          <span className="text-xs font-semibold text-[#FAFAFA] uppercase tracking-wider">
            Heuristic Risk Weights (Points)
          </span>
          <span className="text-[11px] font-mono text-[#71717A]">
            Configured points added or subtracted per anomaly signal
          </span>
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
            <label className="text-[#71717A] block text-[11px] mb-1">Unidentified OS (+pts)</label>
            <input
              type="number"
              value={(settings.riskWeights as any)?.unidentifiedOs ?? 20}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  riskWeights: { ...settings.riskWeights, unidentifiedOs: parseInt(e.target.value) || 0 } as any,
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
