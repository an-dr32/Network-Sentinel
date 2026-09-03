import React, { useState } from 'react';
import {
  AlertTriangle,
  ShieldCheck,
  CheckCircle2,
  ExternalLink,
  Search,
  Check,
  ShieldAlert,
  Server,
} from 'lucide-react';
import { useNetwork } from '../context/NetworkContext';
import { Alert } from '../types';
import { formatTimeAgo, getRiskBadgeClasses } from '../utils/formatters';

export const AlertsView: React.FC = () => {
  const { alerts, devices, resolveAlert, setSelectedDevice, setQuarantineTarget } = useNetwork();
  const [filter, setFilter] = useState<'all' | 'active' | 'resolved'>('active');

  const filteredAlerts = alerts.filter((a) => {
    if (filter === 'active') return !a.resolved;
    if (filter === 'resolved') return a.resolved;
    return true;
  });

  const handleInvestigate = (deviceId?: string) => {
    if (!deviceId) return;
    const device = devices.find((d) => d.id === deviceId);
    if (device) {
      setSelectedDevice(device);
    }
  };

  return (
    <div id="alerts-view" className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header & Filter Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#111113] p-4 rounded-lg border border-[#27272A]">
        <div>
          <h2 className="text-sm font-semibold text-[#FAFAFA] flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span>Security Alerts & Evidence Console</span>
          </h2>
          <p className="text-xs text-[#71717A] mt-0.5">
            Rule-based detections with explainable mathematical justifications and defensive remediation.
          </p>
        </div>

        {/* Tab Filters */}
        <div className="flex items-center bg-[#18181B] p-0.5 rounded-md border border-[#27272A] text-xs">
          <button
            onClick={() => setFilter('active')}
            className={`px-3 py-1.5 rounded transition-colors ${
              filter === 'active' ? 'bg-zinc-700 text-white font-medium' : 'text-[#71717A] hover:text-[#FAFAFA]'
            }`}
          >
            Active ({alerts.filter((a) => !a.resolved).length})
          </button>
          <button
            onClick={() => setFilter('resolved')}
            className={`px-3 py-1.5 rounded transition-colors ${
              filter === 'resolved' ? 'bg-zinc-700 text-white font-medium' : 'text-[#71717A] hover:text-[#FAFAFA]'
            }`}
          >
            Resolved ({alerts.filter((a) => a.resolved).length})
          </button>
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded transition-colors ${
              filter === 'all' ? 'bg-zinc-700 text-white font-medium' : 'text-[#71717A] hover:text-[#FAFAFA]'
            }`}
          >
            All History ({alerts.length})
          </button>
        </div>
      </div>

      {/* Alerts Stream */}
      <div className="space-y-4">
        {filteredAlerts.length === 0 ? (
          <div className="bg-[#111113] border border-[#27272A] rounded-lg p-12 text-center">
            <ShieldCheck className="w-10 h-10 text-emerald-400 mx-auto mb-2 opacity-80" />
            <h3 className="text-sm font-semibold text-[#FAFAFA]">No Security Alerts</h3>
            <p className="text-xs text-[#71717A] mt-1 max-w-md mx-auto">
              Everything looks normal on your local subnet. No behavioral anomalies or policy violations detected.
            </p>
          </div>
        ) : (
          filteredAlerts.map((alert) => {
            const isCrit = alert.severity === 'critical';
            const riskStyle = getRiskBadgeClasses(alert.severity);

            return (
              <div
                key={alert.id}
                className={`bg-[#111113] border rounded-lg p-5 transition-all ${
                  alert.resolved
                    ? 'border-[#27272A] opacity-60'
                    : isCrit
                    ? 'border-red-800/60 bg-red-950/10'
                    : 'border-amber-800/60 bg-amber-950/10'
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  {/* Left Alert Info */}
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded border font-semibold ${riskStyle.bg} ${riskStyle.text} ${riskStyle.border}`}
                      >
                        {alert.severity} • {alert.riskScore} pts
                      </span>
                      {alert.simulated && (
                        <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-800/60 font-medium">
                          SIMULATED
                        </span>
                      )}
                      <span className="text-xs text-[#71717A] font-mono">
                        {formatTimeAgo(alert.createdAt)}
                      </span>
                    </div>

                    <h3 className="text-sm font-semibold text-[#FAFAFA]">{alert.title}</h3>
                    <p className="text-xs text-[#A1A1AA]">{alert.description}</p>

                    {/* "Why am I seeing this?" Evidence Card */}
                    <div className="bg-[#18181B] p-3.5 rounded-md border border-[#27272A] mt-3 space-y-1.5">
                      <span className="text-[10px] font-medium uppercase font-mono text-[#71717A] block">
                        Why am I seeing this alert? (Evidence Justifications)
                      </span>
                      <ul className="space-y-1 text-xs text-[#FAFAFA]">
                        {alert.reasons.map((reason, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="text-amber-400 mt-0.5">•</span>
                            <span>{reason}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Right Action Buttons */}
                  <div className="flex flex-row md:flex-col items-end gap-2 shrink-0">
                    {alert.deviceId && (
                      <button
                        onClick={() => handleInvestigate(alert.deviceId)}
                        className="w-full sm:w-auto px-3.5 py-1.5 bg-[#18181B] hover:bg-zinc-700 text-[#FAFAFA] rounded-md border border-[#27272A] text-xs font-medium transition-colors flex items-center justify-center gap-1.5"
                      >
                        <Server className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Investigate Node</span>
                      </button>
                    )}

                    {!alert.resolved && (
                      <button
                        onClick={() => resolveAlert(alert.id)}
                        className="w-full sm:w-auto px-3.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-[#FAFAFA] rounded-md border border-zinc-600 text-xs font-medium transition-colors flex items-center justify-center gap-1.5"
                      >
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Resolve Alert</span>
                      </button>
                    )}

                    {alert.resolved && (
                      <div className="text-[11px] text-[#71717A] font-mono">
                        Resolved by {alert.resolvedBy || 'Operator'}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
