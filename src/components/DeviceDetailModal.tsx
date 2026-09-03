import React, { useState } from 'react';
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
} from 'lucide-react';
import { Device, DeviceTrustStatus } from '../types';
import { useNetwork } from '../context/NetworkContext';
import { formatBytes, formatRate, formatTimeAgo, getRiskBadgeClasses, getTrustStatusClasses } from '../utils/formatters';

interface DeviceDetailModalProps {
  device: Device;
  onClose: () => void;
}

export const DeviceDetailModal: React.FC<DeviceDetailModalProps> = ({ device, onClose }) => {
  const { updateDeviceTrust, setQuarantineTarget, triggerRestore } = useNetwork();
  const [activeTab, setActiveTab] = useState<'overview' | 'risk' | 'ports' | 'dns' | 'history'>('overview');

  const riskStyle = getRiskBadgeClasses(device.riskSeverity);
  const trustStyle = getTrustStatusClasses(device.trustStatus);

  const handleTrustChange = async (newTrust: string) => {
    await updateDeviceTrust(device.id, newTrust);
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
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-[#FAFAFA]">{device.hostname}</h2>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase border ${trustStyle.bg} ${trustStyle.text} ${trustStyle.border}`}
                >
                  {device.quarantined ? 'ISOLATED' : device.trustStatus}
                </span>
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
                    <span className="text-[#FAFAFA] truncate block">{device.osGuess || 'Unknown Device OS'}</span>
                  </div>
                  <div className="bg-[#18181B] p-3 rounded-lg border border-[#27272A]">
                    <span className="text-[#71717A] font-mono text-[10px] uppercase block">Device Category</span>
                    <span className="text-[#FAFAFA] uppercase font-mono">{device.deviceType}</span>
                  </div>
                </div>
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

          {/* TAB 2: EXPLAINABLE RISK BREAKDOWN */}
          {activeTab === 'risk' && (
            <div className="space-y-4">
              <div className="bg-[#18181B] p-4 rounded-lg border border-[#27272A] flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-[#FAFAFA]">Calculated Risk Score: {device.riskScore}/100</h3>
                  <p className="text-xs text-[#71717A] mt-0.5">
                    Evaluated by the transparent rule engine according to BIBLE.md §6 & ARCHITECTURE.md §8.
                  </p>
                </div>
                <div className={`px-3 py-1 rounded text-xs font-mono uppercase border ${riskStyle.bg} ${riskStyle.text} ${riskStyle.border}`}>
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
          <span className="text-xs text-[#71717A] font-mono">ID: {device.id}</span>
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
    </div>
  );
};
