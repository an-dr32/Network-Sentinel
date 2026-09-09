import React, { useState, useEffect } from 'react';
import {
  X,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Server,
  Activity,
  Globe,
  Clock,
  History,
  Lock,
  Unlock,
  AlertTriangle,
  Cpu,
  Layers,
  Check,
  Fingerprint,
  RefreshCw,
  CheckCircle,
  Terminal,
  Edit2,
  Edit3,
  Sparkles,
  BadgeCheck,
  Wifi,
  WifiOff,
  Trash2,
} from 'lucide-react';
import { Device, DeviceTrustStatus } from '../types';
import { useNetwork } from '../context/NetworkContext';
import { formatBytes, formatRate, formatTimeAgo, getRiskBadgeClasses, getTrustStatusClasses, getOsBadgeInfo } from '../utils/formatters';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { DisconnectConfirmModal } from './DisconnectConfirmModal';

interface DeviceDetailModalProps {
  device: Device;
  onClose: () => void;
}

export const DeviceDetailModal: React.FC<DeviceDetailModalProps> = ({ device, onClose }) => {
  const {
    updateDeviceTrust,
    updateDeviceName,
    updateDeviceStatus,
    setQuarantineTarget,
    triggerRestore,
    detectDeviceOs,
    overrideDeviceOs,
    deleteDevice,
  } = useNetwork();
  const [activeTab, setActiveTab] = useState<'overview' | 'os' | 'risk' | 'ports' | 'dns' | 'history'>('overview');
  const [isDetectingOs, setIsDetectingOs] = useState(false);
  const [detectSuccessMsg, setDetectSuccessMsg] = useState<string | null>(null);

  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(device.customName || '');
  const [isSavingName, setIsSavingName] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const [isEditingOs, setIsEditingOs] = useState(false);
  const [osInput, setOsInput] = useState(device.osGuess || '');
  const [deviceTypeInput, setDeviceTypeInput] = useState(device.deviceType || 'unknown');
  const [isSavingOs, setIsSavingOs] = useState(false);

  useEffect(() => {
    setNameInput(device.customName || '');
  }, [device.customName]);

  useEffect(() => {
    setOsInput(device.osGuess || '');
    setDeviceTypeInput(device.deviceType || 'unknown');
  }, [device.osGuess, device.deviceType]);

  const handleSaveName = async () => {
    setIsSavingName(true);
    try {
      await updateDeviceName(device.id, nameInput);
      setIsEditingName(false);
    } catch (err) {
      console.error('Failed to update device name', err);
    } finally {
      setIsSavingName(false);
    }
  };

  const handleSaveOsOverride = async (selectedOs?: string, selectedType?: string) => {
    setIsSavingOs(true);
    const targetOs = selectedOs || osInput;
    const targetType = selectedType || deviceTypeInput;
    try {
      await overrideDeviceOs(device.id, targetOs, targetType);
      setDetectSuccessMsg(`OS verified & assigned: "${targetOs}"`);
      setIsEditingOs(false);
      setTimeout(() => setDetectSuccessMsg(null), 4000);
    } catch (err: any) {
      console.error('Failed to override OS:', err);
    } finally {
      setIsSavingOs(false);
    }
  };

  const handleToggleStatus = async () => {
    setIsUpdatingStatus(true);
    try {
      const nextStatus = device.status === 'online' ? 'offline' : 'online';
      await updateDeviceStatus(device.id, nextStatus);
    } catch (err) {
      console.error('Failed to update status', err);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const riskStyle = getRiskBadgeClasses(device.riskSeverity);
  const trustStyle = getTrustStatusClasses(device.trustStatus);
  const osInfo = getOsBadgeInfo(device.osGuess);

  const handleTrustChange = async (newTrust: string) => {
    await updateDeviceTrust(device.id, newTrust);
  };

  const handleFingerprintOs = async () => {
    setIsDetectingOs(true);
    setDetectSuccessMsg(null);
    try {
      const res = await detectDeviceOs(device.id);
      setDetectSuccessMsg(`Fingerprinted as ${res.fingerprint.osGuess} (${res.fingerprint.confidence}% confidence)`);
      setTimeout(() => setDetectSuccessMsg(null), 4000);
    } catch (err: any) {
      console.error('OS fingerprint failed:', err);
    } finally {
      setIsDetectingOs(false);
    }
  };

  return (
    <div
      id="device-detail-overlay"
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        id="device-detail-modal"
        className="bg-[#111113] border border-[#27272A] rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-5 border-b border-[#27272A] bg-[#18181B]/60 flex items-start justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-lg bg-[#18181B] border border-[#27272A] flex items-center justify-center text-emerald-400">
              <Server className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                {isEditingName ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      placeholder={device.hostname || 'Device Name'}
                      className="bg-[#18181B] text-[#FAFAFA] text-sm font-semibold px-2 py-0.5 rounded border border-emerald-500 focus:outline-none"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveName();
                        if (e.key === 'Escape') setIsEditingName(false);
                      }}
                    />
                    <button
                      onClick={handleSaveName}
                      disabled={isSavingName}
                      className="p-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white"
                      title="Save name"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        setNameInput(device.customName || '');
                        setIsEditingName(false);
                      }}
                      className="p-1 rounded bg-[#27272A] hover:bg-[#3F3F46] text-[#A1A1AA]"
                      title="Cancel"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <h2 className="text-base font-semibold text-[#FAFAFA]">
                      {device.customName || device.hostname}
                    </h2>
                    {device.customName && (
                      <span className="text-xs text-[#71717A] font-mono">({device.hostname})</span>
                    )}
                    <button
                      onClick={() => {
                        setNameInput(device.customName || device.hostname);
                        setIsEditingName(true);
                      }}
                      className="p-1 rounded text-[#71717A] hover:text-[#FAFAFA] hover:bg-[#27272A] transition-colors"
                      title="Edit device name / alias"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase border ${
                    device.status === 'online'
                      ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800'
                      : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                  }`}
                >
                  {device.status === 'online' ? 'CONNECTED' : 'DISCONNECTED / HISTORIC'}
                </span>

                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase border ${trustStyle.bg} ${trustStyle.text} ${trustStyle.border}`}
                >
                  {device.quarantined ? 'ISOLATED' : device.trustStatus}
                </span>
                {device.osGuess && (
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono border ${osInfo.bg} ${osInfo.text} ${osInfo.border}`}
                  >
                    {device.osGuess}
                  </span>
                )}
                {device.quarantined && (
                  <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-red-950 text-red-300 border border-red-800 font-semibold">
                    [SIMULATED QUARANTINE]
                  </span>
                )}
              </div>
              <p className="text-xs text-[#71717A] mt-0.5 flex items-center gap-2">
                <span>{device.vendor}</span>
                <span>•</span>
                <span className="font-mono text-[#A1A1AA]">{device.macAddress}</span>
                <span>•</span>
                <span className="font-mono text-emerald-400">{device.currentIp}</span>
                {device.osConfidence !== undefined && (
                  <>
                    <span>•</span>
                    <span className="text-zinc-400 font-mono text-[11px]">{device.osConfidence}% OS match</span>
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Risk Score Pill */}
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-mono ${riskStyle.bg} ${riskStyle.text} ${riskStyle.border}`}
            >
              <span className={`w-2 h-2 rounded-full ${riskStyle.dot}`} />
              <span className="text-xs font-semibold">Risk: {device.riskScore}/100</span>
              <span className="text-[10px] uppercase font-bold">({device.riskSeverity})</span>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#71717A] hover:text-[#FAFAFA] hover:bg-[#18181B] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Navigation Tabs */}
        <div className="flex items-center border-b border-[#27272A] px-5 bg-[#111113] overflow-x-auto text-xs">
          {[
            { id: 'overview', label: 'Identity & Telemetry' },
            {
              id: 'os',
              label: device.osGuess
                ? `OS Fingerprint (${device.osConfidence || 0}%)`
                : 'OS Fingerprint',
            },
            { id: 'risk', label: `Explainable Risk (${device.riskEvidence.length})` },
            { id: 'ports', label: `Open Ports (${device.openPorts.length})` },
            { id: 'dns', label: `DNS Activity (${device.dnsLogs?.length || 0})` },
            { id: 'history', label: `IP History (${device.ipHistory.length})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-3 px-4 font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-emerald-500 text-[#FAFAFA]'
                  : 'border-transparent text-[#71717A] hover:text-[#A1A1AA]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Friendly Alias & Connectivity Controls */}
              <div className="bg-[#18181B] p-4 rounded-lg border border-[#27272A] space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-[#FAFAFA] flex items-center gap-2">
                      <Edit2 className="w-3.5 h-3.5 text-emerald-400" />
                      Device Name & Custom Alias
                    </h3>
                    <p className="text-xs text-[#71717A] mt-0.5">
                      Assign a personalized name to easily identify this device across all tables and topology graphs.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (device.status === 'online') {
                          setShowDisconnectModal(true);
                        } else {
                          handleToggleStatus();
                        }
                      }}
                      disabled={isUpdatingStatus}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono transition-colors border ${
                        device.status === 'online'
                          ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-zinc-700'
                          : 'bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-400 border-emerald-800'
                      }`}
                      title={device.status === 'online' ? 'Disconnect to historic list' : 'Reconnect device'}
                    >
                      {device.status === 'online' ? (
                        <>
                          <WifiOff className="w-3.5 h-3.5 text-amber-400" />
                          <span>Disconnect (Move to Historic)</span>
                        </>
                      ) : (
                        <>
                          <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Reconnect (Mark Online)</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    placeholder={device.hostname || 'e.g., Living Room TV, CEO MacBook Pro, Office Printer...'}
                    className="flex-1 bg-[#111113] text-[#FAFAFA] text-xs px-3 py-2 rounded border border-[#27272A] focus:outline-none focus:border-emerald-500 font-medium"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveName();
                    }}
                  />
                  <button
                    onClick={handleSaveName}
                    disabled={isSavingName}
                    className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded text-xs font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap"
                  >
                    {isSavingName ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    <span>Save Name</span>
                  </button>
                  {device.customName && (
                    <button
                      onClick={async () => {
                        setNameInput('');
                        await updateDeviceName(device.id, '');
                      }}
                      className="px-2.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded text-xs transition-colors"
                      title="Clear custom alias and reset to network hostname"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>

              {/* Identity & Discovery Facts */}
              <div>
                <h3 className="text-xs font-medium uppercase tracking-wider text-[#71717A] mb-3">
                  Hardware Identity Evidence
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="bg-[#18181B] p-3 rounded-lg border border-[#27272A]">
                    <span className="text-[#71717A] font-mono text-[10px] uppercase block">Hardware MAC</span>
                    <span className="font-mono text-[#FAFAFA] font-medium">{device.macAddress}</span>
                  </div>
                  <div className="bg-[#18181B] p-3 rounded-lg border border-[#27272A]">
                    <span className="text-[#71717A] font-mono text-[10px] uppercase block">Current Lease IP</span>
                    <span className="font-mono text-[#FAFAFA] font-medium">{device.currentIp}</span>
                  </div>
                  <div className="bg-[#18181B] p-3 rounded-lg border border-[#27272A]">
                    <span className="text-[#71717A] font-mono text-[10px] uppercase block">Operating System</span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={`px-1.5 py-0.2 rounded text-[11px] font-mono border truncate max-w-[120px] ${osInfo.bg} ${osInfo.text} ${osInfo.border}`}>
                        {device.osGuess || 'Unknown OS'}
                      </span>
                      {device.osConfidence !== undefined && (
                        <span className="font-mono text-[10px] text-zinc-400">({device.osConfidence}%)</span>
                      )}
                    </div>
                  </div>
                  <div className="bg-[#18181B] p-3 rounded-lg border border-[#27272A]">
                    <span className="text-[#71717A] font-mono text-[10px] uppercase block">Device Category</span>
                    <span className="text-[#FAFAFA] uppercase font-mono">{device.deviceType}</span>
                  </div>
                </div>
              </div>

              {/* OS Fingerprint & TCP/IP Diagnostics Card */}
              <div className="bg-[#18181B] p-4 rounded-lg border border-[#27272A] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Fingerprint className="w-4 h-4 text-emerald-400" />
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-[#FAFAFA]">
                      OS Fingerprint & TCP/IP Stack Diagnostics
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsEditingOs(!isEditingOs)}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs transition-colors border ${
                        isEditingOs
                          ? 'bg-emerald-950/60 text-emerald-300 border-emerald-700'
                          : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-zinc-700'
                      }`}
                      title="Manually correct or verify operating system label"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{isEditingOs ? 'Close Editor' : 'Correct OS'}</span>
                    </button>
                    <button
                      onClick={handleFingerprintOs}
                      disabled={isDetectingOs}
                      className="flex items-center gap-1.5 px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-emerald-400 rounded border border-zinc-700 text-xs transition-colors"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isDetectingOs ? 'animate-spin' : ''}`} />
                      <span>{isDetectingOs ? 'Probing...' : 'Re-probe OS'}</span>
                    </button>
                  </div>
                </div>

                {/* Inline Manual OS Override Form */}
                {isEditingOs && (
                  <div className="p-3.5 rounded-lg bg-[#111113] border border-emerald-900/60 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-300">
                        <BadgeCheck className="w-4 h-4" />
                        <span>Administrator Operating System Override & Ground Truth</span>
                      </div>
                      <span className="text-[10px] text-zinc-400 font-mono">100% verified certainty</span>
                    </div>

                    {/* Quick Presets */}
                    <div className="space-y-1">
                      <span className="text-[10px] uppercase font-mono text-[#71717A] block">Quick Presets</span>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          { name: 'Ubuntu Linux', type: 'server' },
                          { name: 'Debian GNU/Linux', type: 'server' },
                          { name: 'macOS Sequoia 15', type: 'workstation' },
                          { name: 'macOS Sonoma 14', type: 'laptop' },
                          { name: 'Microsoft Windows 11', type: 'workstation' },
                          { name: 'Microsoft Windows 10', type: 'workstation' },
                          { name: 'Microsoft Windows Server', type: 'server' },
                          { name: 'Apple iOS / iPadOS', type: 'smartphone' },
                          { name: 'Android OS', type: 'smartphone' },
                          { name: 'OpenWrt Router', type: 'router' },
                          { name: 'Raspberry Pi OS', type: 'iot' },
                          { name: 'Network Printer / MFP', type: 'printer' },
                        ].map((preset) => (
                          <button
                            key={preset.name}
                            type="button"
                            onClick={() => {
                              setOsInput(preset.name);
                              setDeviceTypeInput(preset.type);
                            }}
                            className="px-2 py-0.5 text-[11px] rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-700 transition-colors font-mono"
                          >
                            {preset.name}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <div>
                        <label className="text-[10px] uppercase font-mono text-[#71717A] block mb-1">
                          Operating System Label
                        </label>
                        <input
                          type="text"
                          value={osInput}
                          onChange={(e) => setOsInput(e.target.value)}
                          placeholder="e.g. Ubuntu 24.04 LTS, Windows 11 Pro..."
                          className="w-full bg-[#18181B] border border-zinc-700 rounded px-2.5 py-1.5 text-xs text-[#FAFAFA] font-mono focus:border-emerald-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] uppercase font-mono text-[#71717A] block mb-1">
                          Device Category
                        </label>
                        <select
                          value={deviceTypeInput}
                          onChange={(e) => setDeviceTypeInput(e.target.value)}
                          className="w-full bg-[#18181B] border border-zinc-700 rounded px-2.5 py-1.5 text-xs text-[#FAFAFA] font-mono focus:border-emerald-500 focus:outline-none"
                        >
                          <option value="workstation">Workstation</option>
                          <option value="laptop">Laptop</option>
                          <option value="server">Server</option>
                          <option value="smartphone">Smartphone / Tablet</option>
                          <option value="router">Router / Gateway</option>
                          <option value="printer">Network Printer</option>
                          <option value="iot">IoT / Embedded</option>
                          <option value="unknown">Unknown</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setIsEditingOs(false)}
                        className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-xs transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={isSavingOs || !osInput.trim()}
                        onClick={() => handleSaveOsOverride()}
                        className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded text-xs font-medium transition-colors flex items-center gap-1.5"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>{isSavingOs ? 'Saving...' : 'Save & Verify OS'}</span>
                      </button>
                    </div>
                  </div>
                )}

                {detectSuccessMsg && (
                  <div className="p-2 rounded bg-emerald-950/40 border border-emerald-800/50 text-emerald-300 text-xs flex items-center gap-2">
                    <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{detectSuccessMsg}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="bg-[#111113] p-3 rounded border border-[#27272A]">
                    <div className="flex items-center justify-between">
                      <span className="text-[#71717A] text-[10px] uppercase font-mono block">Classified OS</span>
                      {device.osDetectionDetails?.manuallyVerified && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] bg-emerald-950/80 border border-emerald-800 text-emerald-300 font-mono">
                          Verified
                        </span>
                      )}
                    </div>
                    <span className="text-sm font-medium text-[#FAFAFA] block mt-0.5">{device.osGuess || 'Unidentified'}</span>
                    <span className="text-[11px] text-[#71717A] block mt-0.5">{device.osDetectionDetails?.signatureMatch || 'Signature analysis pending'}</span>
                    {device.osDetectionDetails?.macRandomized && (
                      <span className="inline-block mt-1 px-1.5 py-0.2 rounded text-[9px] font-mono bg-indigo-950/60 border border-indigo-800/50 text-indigo-300">
                        Private Wi-Fi MAC
                      </span>
                    )}
                  </div>
                  <div className="bg-[#111113] p-3 rounded border border-[#27272A]">
                    <span className="text-[#71717A] text-[10px] uppercase font-mono block">Fingerprint Confidence</span>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            (device.osConfidence || 0) >= 80 ? 'bg-emerald-500' : (device.osConfidence || 0) >= 50 ? 'bg-amber-500' : 'bg-zinc-500'
                          }`}
                          style={{ width: `${device.osConfidence || 15}%` }}
                        />
                      </div>
                      <span className="font-mono text-xs text-[#FAFAFA]">{device.osConfidence || 0}%</span>
                    </div>
                    <span className="text-[10px] text-[#71717A] block mt-1">
                      {device.osDetectionDetails?.manuallyVerified
                        ? 'Administrator Verified Ground Truth'
                        : (device.osConfidence || 0) >= 80
                        ? 'High certainty match'
                        : (device.osConfidence || 0) >= 50
                        ? 'Moderate certainty'
                        : 'Low certainty heuristic'}
                    </span>
                  </div>
                  <div className="bg-[#111113] p-3 rounded border border-[#27272A]">
                    <span className="text-[#71717A] text-[10px] uppercase font-mono block">Measured ICMP TTL</span>
                    <span className="text-sm font-mono font-medium text-emerald-400 block mt-0.5">
                      {device.osDetectionDetails?.ttl ? `TTL=${device.osDetectionDetails.ttl}` : 'N/A (ICMP filtered)'}
                    </span>
                    <span className="text-[10px] text-[#71717A] block mt-0.5">
                      {device.osDetectionDetails?.ttl
                        ? device.osDetectionDetails.ttl <= 64
                          ? 'Linux/Unix/Darwin (64 default)'
                          : device.osDetectionDetails.ttl <= 128
                          ? 'Windows NT/SMB (128 default)'
                          : 'Network Router/Infrastructure (255)'
                        : 'ICMP echo filtered or offline'}
                    </span>
                  </div>
                </div>

                {/* Discovered Host Metadata (Reverse DNS & Web Title) */}
                {(device.osDetectionDetails?.reverseDns || device.osDetectionDetails?.httpTitle) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-2.5 rounded bg-[#111113] border border-[#27272A] text-xs font-mono">
                    {device.osDetectionDetails.reverseDns && (
                      <div>
                        <span className="text-[10px] uppercase text-[#71717A] block">Reverse DNS (PTR)</span>
                        <span className="text-zinc-200 truncate block mt-0.5">{device.osDetectionDetails.reverseDns}</span>
                      </div>
                    )}
                    {device.osDetectionDetails.httpTitle && (
                      <div>
                        <span className="text-[10px] uppercase text-[#71717A] block">Web Console Title</span>
                        <span className="text-emerald-300 truncate block mt-0.5">{device.osDetectionDetails.httpTitle}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* AI Cybersecurity Synthesis if present */}
                {device.osDetectionDetails?.aiAnalysis && (
                  <div className="p-3 rounded-lg bg-indigo-950/30 border border-indigo-800/40 text-xs space-y-1">
                    <div className="flex items-center gap-1.5 text-indigo-300 font-semibold">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Gemini AI Multimodal Synthesis</span>
                    </div>
                    <p className="text-zinc-300 leading-relaxed text-[11px]">{device.osDetectionDetails.aiAnalysis}</p>
                  </div>
                )}

                {device.osDetectionDetails?.methods && device.osDetectionDetails.methods.length > 0 && (
                  <div>
                    <span className="text-[10px] font-mono text-[#71717A] uppercase block mb-1.5">Detection Heuristics Applied</span>
                    <div className="flex flex-wrap gap-1.5">
                      {device.osDetectionDetails.methods.map((method, idx) => (
                        <span key={idx} className="px-2 py-0.5 rounded text-[11px] bg-zinc-900 border border-zinc-800 text-zinc-300 font-mono">
                          ✓ {method}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Traffic Telemetry */}
              <div>
                <h3 className="text-xs font-medium uppercase tracking-wider text-[#71717A] mb-3">
                  Observed Traffic & Data Volume
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="bg-[#18181B] p-3 rounded-lg border border-[#27272A]">
                    <span className="text-[#71717A] font-mono text-[10px] uppercase block">Current Throughput</span>
                    <span className="font-mono text-emerald-400 font-medium">{formatRate(device.trafficStats.rateKbps)}</span>
                  </div>
                  <div className="bg-[#18181B] p-3 rounded-lg border border-[#27272A]">
                    <span className="text-[#71717A] font-mono text-[10px] uppercase block">Total Sent</span>
                    <span className="font-mono text-[#FAFAFA]">{formatBytes(device.trafficStats.bytesSent)}</span>
                  </div>
                  <div className="bg-[#18181B] p-3 rounded-lg border border-[#27272A]">
                    <span className="text-[#71717A] font-mono text-[10px] uppercase block">Total Received</span>
                    <span className="font-mono text-[#FAFAFA]">{formatBytes(device.trafficStats.bytesReceived)}</span>
                  </div>
                  <div className="bg-[#18181B] p-3 rounded-lg border border-[#27272A]">
                    <span className="text-[#71717A] font-mono text-[10px] uppercase block">Observed Packets</span>
                    <span className="font-mono text-[#FAFAFA]">{device.trafficStats.packetCount.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Trust Classification Control */}
              <div className="bg-[#18181B] p-4 rounded-lg border border-[#27272A]">
                <h3 className="text-xs font-medium uppercase tracking-wider text-[#FAFAFA] mb-2">
                  Administrative Trust Override
                </h3>
                <p className="text-xs text-[#71717A] mb-3">
                  Assigning trust modifies risk scoring heuristics. Known devices receive a -20 pt baseline reduction.
                </p>
                <div className="flex flex-wrap gap-2">
                  {(['known', 'new', 'guest', 'suspicious', 'blocked'] as DeviceTrustStatus[]).map((t) => (
                    <button
                      key={t}
                      onClick={() => handleTrustChange(t)}
                      className={`px-3 py-1.5 rounded-md text-xs font-mono uppercase transition-colors border ${
                        device.trustStatus === t
                          ? 'bg-zinc-100 text-zinc-900 border-white font-semibold'
                          : 'bg-[#111113] hover:bg-zinc-800 text-[#A1A1AA] border-[#27272A]'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: OS FINGERPRINT & TCP/IP STACK */}
          {activeTab === 'os' && (
            <div className="space-y-5">
              {/* Header Hero Banner */}
              <div className="bg-[#18181B] p-5 rounded-lg border border-[#27272A] flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="w-12 h-12 rounded-lg bg-[#111113] border border-[#27272A] flex items-center justify-center text-emerald-400">
                    <Fingerprint className="w-7 h-7" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-lg font-semibold text-[#FAFAFA]">
                        {device.osGuess || 'Unidentified Operating System'}
                      </h3>
                      <span className={`px-2 py-0.5 rounded text-xs font-mono border ${osInfo.bg} ${osInfo.text} ${osInfo.border}`}>
                        {osInfo.displayName}
                      </span>
                      {device.osDetectionDetails?.manuallyVerified && (
                        <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-950/80 border border-emerald-700 text-emerald-300 font-mono flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          Verified Ground Truth
                        </span>
                      )}
                      {device.osDetectionDetails?.macRandomized && (
                        <span className="px-2 py-0.5 rounded text-[10px] bg-indigo-950/70 border border-indigo-800 text-indigo-300 font-mono">
                          Private Wi-Fi Address (Randomized)
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#71717A] mt-1">
                      {device.osDetectionDetails?.signatureMatch || 'Heuristic multi-vector TCP/IP analysis'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right hidden sm:block">
                    <span className="text-[10px] font-mono text-[#71717A] uppercase block">Detection Confidence</span>
                    <span className="text-sm font-mono font-semibold text-emerald-400">
                      {device.osConfidence || 0}% Certainty
                    </span>
                  </div>
                  <button
                    onClick={() => setIsEditingOs(!isEditingOs)}
                    className={`flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors border ${
                      isEditingOs
                        ? 'bg-emerald-950/60 text-emerald-300 border-emerald-700'
                        : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-zinc-700'
                    }`}
                  >
                    <Edit3 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{isEditingOs ? 'Close Editor' : 'Correct OS'}</span>
                  </button>
                  <button
                    onClick={handleFingerprintOs}
                    disabled={isDetectingOs}
                    className="flex items-center gap-2 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition-colors shadow-sm"
                  >
                    <RefreshCw className={`w-4 h-4 ${isDetectingOs ? 'animate-spin' : ''}`} />
                    <span>{isDetectingOs ? 'Scanning Network Stack...' : 'Probe Device OS'}</span>
                  </button>
                </div>
              </div>

              {/* Inline Manual OS Override Form for Tab 2 */}
              {isEditingOs && (
                <div className="p-4 rounded-lg bg-[#111113] border border-emerald-800/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-300">
                      <BadgeCheck className="w-4 h-4" />
                      <span>Administrator Operating System Override & Ground Truth</span>
                    </div>
                    <span className="text-[10px] text-zinc-400 font-mono">100% verified certainty</span>
                  </div>

                  {/* Quick Presets */}
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-mono text-[#71717A] block">Quick Presets</span>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { name: 'Ubuntu Linux', type: 'server' },
                        { name: 'Debian GNU/Linux', type: 'server' },
                        { name: 'macOS Sequoia 15', type: 'workstation' },
                        { name: 'macOS Sonoma 14', type: 'laptop' },
                        { name: 'Microsoft Windows 11', type: 'workstation' },
                        { name: 'Microsoft Windows 10', type: 'workstation' },
                        { name: 'Microsoft Windows Server', type: 'server' },
                        { name: 'Apple iOS / iPadOS', type: 'smartphone' },
                        { name: 'Android OS', type: 'smartphone' },
                        { name: 'OpenWrt Router', type: 'router' },
                        { name: 'Raspberry Pi OS', type: 'iot' },
                        { name: 'Network Printer / MFP', type: 'printer' },
                      ].map((preset) => (
                        <button
                          key={preset.name}
                          type="button"
                          onClick={() => {
                            setOsInput(preset.name);
                            setDeviceTypeInput(preset.type);
                          }}
                          className="px-2 py-0.5 text-[11px] rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-700 transition-colors font-mono"
                        >
                          {preset.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="text-[10px] uppercase font-mono text-[#71717A] block mb-1">
                        Operating System Label
                      </label>
                      <input
                        type="text"
                        value={osInput}
                        onChange={(e) => setOsInput(e.target.value)}
                        placeholder="e.g. Ubuntu 24.04 LTS, Windows 11 Pro..."
                        className="w-full bg-[#18181B] border border-zinc-700 rounded px-2.5 py-1.5 text-xs text-[#FAFAFA] font-mono focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-mono text-[#71717A] block mb-1">
                        Device Category
                      </label>
                      <select
                        value={deviceTypeInput}
                        onChange={(e) => setDeviceTypeInput(e.target.value)}
                        className="w-full bg-[#18181B] border border-zinc-700 rounded px-2.5 py-1.5 text-xs text-[#FAFAFA] font-mono focus:border-emerald-500 focus:outline-none"
                      >
                        <option value="workstation">Workstation</option>
                        <option value="laptop">Laptop</option>
                        <option value="server">Server</option>
                        <option value="smartphone">Smartphone / Tablet</option>
                        <option value="router">Router / Gateway</option>
                        <option value="printer">Network Printer</option>
                        <option value="iot">IoT / Embedded</option>
                        <option value="unknown">Unknown</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsEditingOs(false)}
                      className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-xs transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={isSavingOs || !osInput.trim()}
                      onClick={() => handleSaveOsOverride()}
                      className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded text-xs font-medium transition-colors flex items-center gap-1.5"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>{isSavingOs ? 'Saving...' : 'Save & Verify OS'}</span>
                    </button>
                  </div>
                </div>
              )}

              {detectSuccessMsg && (
                <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 text-xs flex items-center gap-2.5">
                  <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span>{detectSuccessMsg}</span>
                </div>
              )}

              {/* 3 Core Forensic Pillars */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                {/* Pillar 1: ICMP TTL */}
                <div className="bg-[#18181B] p-4 rounded-lg border border-[#27272A] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono uppercase text-[#71717A]">Pillar 1: TCP/IP Stack TTL</span>
                    <span className="text-[10px] font-mono text-emerald-400">Layer 3</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-mono font-bold text-[#FAFAFA]">
                      {device.osDetectionDetails?.ttl ? device.osDetectionDetails.ttl : 'N/A'}
                    </span>
                    <span className="text-xs text-[#71717A] font-mono">
                      {device.osDetectionDetails?.ttl
                        ? device.osDetectionDetails.ttl <= 64
                          ? '(Unix/Linux/Darwin base 64)'
                          : device.osDetectionDetails.ttl <= 128
                          ? '(Windows NT base 128)'
                          : '(Network Gateway base 255)'
                        : 'Unreachable via ICMP'}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#A1A1AA] leading-relaxed">
                    Operating system TCP/IP network stacks initialize IP packets with distinct default TTL values: Linux/Darwin use 64, Windows NT uses 128, and embedded routers use 255.
                  </p>
                </div>

                {/* Pillar 2: Open Service Ports */}
                <div className="bg-[#18181B] p-4 rounded-lg border border-[#27272A] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono uppercase text-[#71717A]">Pillar 2: Listening Ports</span>
                    <span className="text-[10px] font-mono text-emerald-400">Layer 4</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-mono font-bold text-[#FAFAFA]">
                      {device.openPorts.length}
                    </span>
                    <span className="text-xs text-[#71717A] font-mono">Discovered Ports</span>
                  </div>
                  <div className="flex flex-wrap gap-1 pt-1">
                    {device.openPorts.length === 0 ? (
                      <span className="text-[11px] text-[#71717A]">No listening ports exposed or filtered by firewall</span>
                    ) : (
                      device.openPorts.map((p) => (
                        <span
                          key={p.port}
                          className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-zinc-900 border border-zinc-700 text-zinc-200"
                        >
                          {p.port}/{p.service}
                        </span>
                      ))
                    )}
                  </div>
                </div>

                {/* Pillar 3: OUI & Hostname Analysis */}
                <div className="bg-[#18181B] p-4 rounded-lg border border-[#27272A] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono uppercase text-[#71717A]">Pillar 3: Vendor & Host Heuristics</span>
                    <span className="text-[10px] font-mono text-emerald-400">Layer 2/7</span>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs font-semibold text-[#FAFAFA] truncate">{device.vendor || 'Unknown Vendor'}</div>
                    <div className="text-xs font-mono text-zinc-400 truncate">{device.hostname}</div>
                  </div>
                  <p className="text-[11px] text-[#A1A1AA] leading-relaxed">
                    Correlates IEEE Organizationally Unique Identifier (OUI) hardware manufacturing records with NetBIOS/mDNS hostname conventions.
                  </p>
                </div>
              </div>

              {/* Discovered DNS & Web Application Evidence */}
              {(device.osDetectionDetails?.reverseDns || device.osDetectionDetails?.httpTitle) && (
                <div className="bg-[#18181B] p-4 rounded-lg border border-[#27272A] space-y-3">
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-emerald-400" />
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-[#FAFAFA]">
                      Host Telemetry & Application Titles
                    </h4>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
                    {device.osDetectionDetails.reverseDns && (
                      <div className="p-3 rounded bg-[#111113] border border-[#27272A]">
                        <span className="text-[#71717A] text-[10px] uppercase block">Reverse DNS (PTR Record)</span>
                        <span className="text-zinc-200 block mt-1 break-all font-semibold">{device.osDetectionDetails.reverseDns}</span>
                      </div>
                    )}
                    {device.osDetectionDetails.httpTitle && (
                      <div className="p-3 rounded bg-[#111113] border border-[#27272A]">
                        <span className="text-[#71717A] text-[10px] uppercase block">HTTP Web Console HTML &lt;title&gt;</span>
                        <span className="text-emerald-300 block mt-1 break-all font-semibold">{device.osDetectionDetails.httpTitle}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Multimodal AI Synthesis */}
              {device.osDetectionDetails?.aiAnalysis && (
                <div className="bg-[#18181B] p-4 rounded-lg border border-indigo-800/50 space-y-2">
                  <div className="flex items-center gap-2 text-indigo-300">
                    <Sparkles className="w-4 h-4" />
                    <h4 className="text-xs font-semibold uppercase tracking-wider">
                      Gemini Multimodal Cybersecurity Reasoning
                    </h4>
                  </div>
                  <p className="text-xs text-zinc-300 leading-relaxed bg-[#111113] p-3 rounded border border-[#27272A]">
                    {device.osDetectionDetails.aiAnalysis}
                  </p>
                </div>
              )}

              {/* Service Banners Retrieved */}
              {device.osDetectionDetails?.banners && Object.keys(device.osDetectionDetails.banners).length > 0 && (
                <div className="bg-[#18181B] p-4 rounded-lg border border-[#27272A] space-y-3">
                  <div className="flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-emerald-400" />
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-[#FAFAFA]">
                      Captured Service Banners & Handshake Evidence
                    </h4>
                  </div>
                  <div className="space-y-2">
                    {Object.entries(device.osDetectionDetails.banners).map(([service, banner]) => (
                      <div key={service} className="p-2.5 rounded bg-[#111113] border border-[#27272A] font-mono text-xs">
                        <span className="text-[#71717A] uppercase text-[10px] block">{service} Banner</span>
                        <span className="text-emerald-400 block mt-0.5 break-all">{banner}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Applied Detection Methods */}
              <div className="bg-[#18181B] p-4 rounded-lg border border-[#27272A] space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-[#FAFAFA]">
                  Applied Fingerprinting Pipelines
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {[
                    {
                      name: 'Passive ICMP TTL Stack Analysis',
                      active: device.osDetectionDetails?.methods.some((m) => m.toLowerCase().includes('ttl')),
                      desc: 'Measures Time-to-Live on ICMP responses to classify Unix (64), Windows (128), or Gateway (255).',
                    },
                    {
                      name: 'Active TCP SYN/ACK Probing',
                      active: device.osDetectionDetails?.methods.some((m) => m.toLowerCase().includes('port') || m.toLowerCase().includes('service')),
                      desc: 'Tests standard management ports (22 SSH, 80 HTTP, 445 SMB, 135 RPC, 3389 RDP).',
                    },
                    {
                      name: 'Service Banner Inspection',
                      active: device.osDetectionDetails?.methods.some((m) => m.toLowerCase().includes('banner')),
                      desc: 'Parses SSH daemon strings, HTTP Server headers, and protocol responses for OS signatures.',
                    },
                    {
                      name: 'IEEE OUI Hardware Vendor Profiling',
                      active: device.osDetectionDetails?.methods.some((m) => m.toLowerCase().includes('vendor') || m.toLowerCase().includes('oui')),
                      desc: 'Queries IEEE registered MAC prefixes to establish hardware manufacture identity.',
                    },
                    {
                      name: 'Reverse DNS PTR Lookup',
                      active: Boolean(device.osDetectionDetails?.reverseDns) || device.osDetectionDetails?.methods.some((m) => m.toLowerCase().includes('dns')),
                      desc: 'Resolves IP in-addr.arpa PTR records to identify operating systems via host naming schemes.',
                    },
                    {
                      name: 'NetBIOS Name Service Telemetry',
                      active: device.osDetectionDetails?.methods.some((m) => m.toLowerCase().includes('netbios')),
                      desc: 'Probes UDP 137 to detect active Windows NT Workgroup & Server domain members.',
                    },
                    {
                      name: 'Administrator Verified Ground Truth',
                      active: Boolean(device.osDetectionDetails?.manuallyVerified),
                      desc: 'Confirmed manual OS ground truth override supplied by network security operator.',
                    },
                    {
                      name: 'Local Host Kernel System Inspection',
                      active: device.osDetectionDetails?.methods.some((m) => m.toLowerCase().includes('kernel') || m.toLowerCase().includes('host')),
                      desc: 'Examines native kernel platform release, architecture, and network interface metadata.',
                    },
                  ].map((pipe, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded border flex items-start gap-2.5 ${
                        pipe.active ? 'bg-emerald-950/20 border-emerald-800/40 text-[#FAFAFA]' : 'bg-[#111113] border-[#27272A] text-zinc-500'
                      }`}
                    >
                      <div className="mt-0.5">
                        {pipe.active ? (
                          <Check className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <div className="w-3.5 h-3.5 rounded-full border border-zinc-700" />
                        )}
                      </div>
                      <div>
                        <div className={`font-medium ${pipe.active ? 'text-[#FAFAFA]' : 'text-zinc-500'}`}>
                          {pipe.name}
                        </div>
                        <div className="text-[11px] text-[#71717A] mt-0.5 leading-normal">{pipe.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sentinel Agentless Engine Methodology Note */}
              <div className="p-4 rounded-lg bg-zinc-900/60 border border-zinc-800 text-xs text-zinc-400 space-y-1.5">
                <div className="font-semibold text-[#FAFAFA] flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Agentless, Non-Intrusive Fingerprinting Architecture</span>
                </div>
                <p className="leading-relaxed text-[11px]">
                  Network Sentinel operates without installing client agents or proprietary drivers on observed network endpoints. By synthesizing RFC-compliant Layer 2 ARP frames, Layer 3 ICMP TTL characteristics, Layer 4 TCP port probes, and Layer 7 protocol banners, Sentinel constructs a high-fidelity operating system profile while minimizing network overhead.
                </p>
              </div>
            </div>
          )}

          {/* TAB 3: EXPLAINABLE RISK BREAKDOWN */}
          {activeTab === 'risk' && (
            <div className="space-y-4">
              <div className="bg-[#18181B] p-4 rounded-lg border border-[#27272A] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-[#FAFAFA]">Calculated Risk Score: {device.riskScore}/100</h3>
                    <span className="text-xs font-mono text-zinc-400">
                      (Total detected weight: {device.riskEvidence.reduce((acc, curr) => acc + curr.points, 0) > 0 ? `+${device.riskEvidence.reduce((acc, curr) => acc + curr.points, 0)}` : device.riskEvidence.reduce((acc, curr) => acc + curr.points, 0)} pts)
                    </span>
                  </div>
                  <p className="text-xs text-[#71717A] mt-0.5">
                    Sums all active risk weights detected across device properties, open ports, and anomalies (clamped 0-100).
                  </p>
                </div>
                <div className={`px-3 py-1 rounded text-xs font-mono uppercase border self-start sm:self-auto ${riskStyle.bg} ${riskStyle.text} ${riskStyle.border}`}>
                  {device.riskSeverity} tier
                </div>
              </div>

              <div className="space-y-2.5">
                <h4 className="text-xs font-medium uppercase tracking-wider text-[#71717A]">
                  Evidence Itemization & Point Calculations
                </h4>
                {device.riskEvidence.length === 0 ? (
                  <div className="p-4 rounded bg-[#18181B] border border-[#27272A] text-xs text-[#71717A] text-center">
                    No suspicious anomalies or policy violations detected for this device.
                  </div>
                ) : (
                  device.riskEvidence.map((item, idx) => {
                    const isPositive = item.points > 0;
                    return (
                      <div
                        key={idx}
                        className="p-3.5 rounded-lg bg-[#18181B] border border-[#27272A] flex items-start justify-between gap-4"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-xs text-[#FAFAFA]">{item.rule}</span>
                            <span className="text-[10px] font-mono text-[#71717A]">
                              {formatTimeAgo(item.timestamp)}
                            </span>
                          </div>
                          <p className="text-xs text-[#A1A1AA] mt-1">{item.reason}</p>
                        </div>
                        <div
                          className={`font-mono text-xs font-semibold px-2 py-1 rounded border ${
                            isPositive
                              ? 'bg-red-950/60 text-red-300 border-red-800/60'
                              : 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60'
                          }`}
                        >
                          {isPositive ? `+${item.points}` : `${item.points}`} pts
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* TAB 3: OPEN PORTS */}
          {activeTab === 'ports' && (
            <div className="space-y-4">
              <h4 className="text-xs font-medium uppercase tracking-wider text-[#71717A]">
                Discovered Services & Listening Ports
              </h4>
              {device.openPorts.length === 0 ? (
                <div className="p-6 rounded bg-[#18181B] border border-[#27272A] text-xs text-[#71717A] text-center">
                  No open listening ports detected during passive observation.
                </div>
              ) : (
                <div className="bg-[#18181B] rounded-lg border border-[#27272A] overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#111113] text-[#71717A] uppercase font-mono border-b border-[#27272A]">
                      <tr>
                        <th className="px-4 py-2.5">Port</th>
                        <th className="px-3 py-2.5">Protocol</th>
                        <th className="px-3 py-2.5">Service Name</th>
                        <th className="px-3 py-2.5">State</th>
                        <th className="px-3 py-2.5 text-right">Risk Assessment</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#27272A] font-mono">
                      {device.openPorts.map((port, idx) => (
                        <tr key={idx} className="hover:bg-[#111113]/50">
                          <td className="px-4 py-2.5 font-semibold text-[#FAFAFA]">{port.port}</td>
                          <td className="px-3 py-2.5 text-[#71717A] uppercase">{port.protocol}</td>
                          <td className="px-3 py-2.5 text-[#A1A1AA] font-sans">{port.service}</td>
                          <td className="px-3 py-2.5 text-emerald-400">{port.state}</td>
                          <td className="px-3 py-2.5 text-right">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] uppercase font-mono ${
                                port.riskRating === 'high'
                                  ? 'bg-red-950 text-red-300 border border-red-800'
                                  : port.riskRating === 'medium'
                                  ? 'bg-amber-950 text-amber-300 border border-amber-800'
                                  : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                              }`}
                            >
                              {port.riskRating || 'low'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: DNS ACTIVITY */}
          {activeTab === 'dns' && (
            <div className="space-y-4">
              <h4 className="text-xs font-medium uppercase tracking-wider text-[#71717A]">
                Recent DNS Resolution Queries
              </h4>
              {!device.dnsLogs || device.dnsLogs.length === 0 ? (
                <div className="p-6 rounded bg-[#18181B] border border-[#27272A] text-xs text-[#71717A] text-center">
                  No anomalous DNS queries logged for this device.
                </div>
              ) : (
                <div className="space-y-2">
                  {device.dnsLogs.map((dns, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-lg border font-mono text-xs ${
                        dns.isAnomaly
                          ? 'bg-red-950/20 border-red-800/60 text-red-200'
                          : 'bg-[#18181B] border-[#27272A] text-[#FAFAFA]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="px-1.5 py-0.2 rounded bg-zinc-800 text-[10px] text-zinc-300">
                            {dns.queryType}
                          </span>
                          <span className="font-semibold">{dns.domain}</span>
                        </div>
                        <span className="text-[11px] text-[#71717A]">{formatTimeAgo(dns.timestamp)}</span>
                      </div>
                      {dns.isAnomaly && (
                        <p className="text-[11px] text-red-300 font-sans mt-1.5">
                          ⚠️ {dns.anomalyReason}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 5: IP HISTORY */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              <div className="bg-[#18181B] p-3 rounded-lg border border-[#27272A]">
                <p className="text-xs text-[#A1A1AA]">
                  <strong>BIBLE.md Rule 4 (IP is not identity):</strong> Network Sentinel tracks historical DHCP lease shifts while maintaining continuous device hardware identity.
                </p>
              </div>

              <div className="bg-[#18181B] rounded-lg border border-[#27272A] overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#111113] text-[#71717A] uppercase font-mono border-b border-[#27272A]">
                    <tr>
                      <th className="px-4 py-2.5">IP Address</th>
                      <th className="px-3 py-2.5">Lease Type</th>
                      <th className="px-3 py-2.5">First Observed</th>
                      <th className="px-3 py-2.5">Last Active</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#27272A] font-mono">
                    {device.ipHistory.map((item, idx) => (
                      <tr key={idx} className="hover:bg-[#111113]/50">
                        <td className="px-4 py-2.5 font-semibold text-[#FAFAFA] flex items-center gap-2">
                          <span>{item.ip}</span>
                          {item.ip === device.currentIp && (
                            <span className="text-[9px] px-1 py-0.2 bg-emerald-950 text-emerald-300 border border-emerald-800 rounded">
                              CURRENT
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-[#71717A] uppercase">{item.leaseType || 'dhcp'}</td>
                        <td className="px-3 py-2.5 text-[#A1A1AA]">{formatTimeAgo(item.firstSeen)}</td>
                        <td className="px-3 py-2.5 text-[#A1A1AA]">{formatTimeAgo(item.lastSeen)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="p-4 border-t border-[#27272A] bg-[#18181B]/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xs text-[#71717A] font-mono">ID: {device.id}</span>
            <button
              id="detail-modal-delete-btn"
              type="button"
              onClick={() => setShowDeleteModal(true)}
              className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-md text-xs font-medium transition-colors shadow-sm flex items-center gap-1.5"
              title="Delete Device Record"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Record</span>
            </button>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-[#18181B] hover:bg-zinc-800 text-[#FAFAFA] rounded-md border border-[#27272A] text-xs transition-colors"
            >
              Close
            </button>
            {device.quarantined ? (
              <button
                onClick={() => {
                  triggerRestore(device.id);
                  onClose();
                }}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md text-xs font-medium transition-colors shadow-sm"
              >
                Restore Access
              </button>
            ) : (
              <button
                onClick={() => {
                  setQuarantineTarget(device);
                  onClose();
                }}
                className="px-4 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-md text-xs font-medium transition-colors shadow-sm"
              >
                Quarantine Device
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Modals */}
      {showDeleteModal && (
        <DeleteConfirmModal
          device={device}
          onClose={() => setShowDeleteModal(false)}
          onConfirm={async () => {
            await deleteDevice(device.id);
            onClose();
          }}
        />
      )}

      {showDisconnectModal && (
        <DisconnectConfirmModal
          device={device}
          onClose={() => setShowDisconnectModal(false)}
          onConfirm={async () => {
            await handleToggleStatus();
          }}
        />
      )}
    </div>
  );
};
