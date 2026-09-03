import React from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  Server,
  Network,
  Activity,
  ArrowUpRight,
  TrendingUp,
  Cpu,
  ChevronRight,
  Radio,
  Sparkles,
} from 'lucide-react';
import { useNetwork } from '../context/NetworkContext';
import { formatBytes, formatRate, formatTimeAgo, getRiskBadgeClasses, getTrustStatusClasses } from '../utils/formatters';

export const OverviewView: React.FC = () => {
  const {
    devices,
    events,
    alerts,
    status,
    baseline,
    setSelectedDevice,
    setActiveView,
  } = useNetwork();

  const totalDevices = devices.length;
  const knownDevices = devices.filter((d) => d.trustStatus === 'known').length;
  const newDevices = devices.filter((d) => d.trustStatus === 'new').length;
  const suspiciousDevices = devices.filter(
    (d) => d.riskSeverity === 'suspicious' || d.trustStatus === 'suspicious'
  ).length;
  const criticalDevices = devices.filter(
    (d) => d.riskSeverity === 'critical' || d.quarantined
  ).length;

  const activeAlerts = alerts.filter((a) => !a.resolved);
  const recentEvents = events.slice(0, 7);

  // Aggregate network rate
  const totalThroughputKbps = devices.reduce((acc, d) => acc + (d.trafficStats?.rateKbps || 0), 0);

  return (
    <div id="overview-view" className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* 5 Key Metric Cards */}
      <div id="metrics-grid" className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
        {/* Total Devices */}
        <div
          id="stat-total-devices"
          onClick={() => setActiveView('devices')}
          className="bg-[#111113] border border-[#27272A] p-4 rounded-lg hover:border-zinc-600 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-[#71717A] mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Total Nodes</span>
            <Server className="w-4 h-4 text-zinc-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-[#FAFAFA] font-mono">{totalDevices}</span>
            <span className="text-xs text-emerald-400 font-mono">
              {devices.filter((d) => d.status === 'online').length} online
            </span>
          </div>
        </div>

        {/* Known & Verified */}
        <div
          id="stat-known-devices"
          onClick={() => setActiveView('devices')}
          className="bg-[#111113] border border-[#27272A] p-4 rounded-lg hover:border-zinc-600 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-[#71717A] mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Verified</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-emerald-400 font-mono">{knownDevices}</span>
            <span className="text-xs text-[#71717A] font-mono">baseline</span>
          </div>
        </div>

        {/* New / Unverified */}
        <div
          id="stat-new-devices"
          onClick={() => setActiveView('devices')}
          className="bg-[#111113] border border-[#27272A] p-4 rounded-lg hover:border-zinc-600 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-[#71717A] mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">New</span>
            <Radio className="w-4 h-4 text-blue-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-blue-400 font-mono">{newDevices}</span>
            <span className="text-xs text-[#71717A] font-mono">evaluating</span>
          </div>
        </div>

        {/* Suspicious / Watch */}
        <div
          id="stat-suspicious-devices"
          onClick={() => setActiveView('devices')}
          className="bg-[#111113] border border-[#27272A] p-4 rounded-lg hover:border-zinc-600 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-[#71717A] mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Suspicious</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl font-semibold font-mono ${suspiciousDevices > 0 ? 'text-amber-400' : 'text-[#FAFAFA]'}`}>
              {suspiciousDevices}
            </span>
            <span className="text-xs text-[#71717A] font-mono">watch tier</span>
          </div>
        </div>

        {/* Critical / Blocked */}
        <div
          id="stat-critical-devices"
          onClick={() => setActiveView('alerts')}
          className="bg-[#111113] border border-[#27272A] p-4 rounded-lg hover:border-zinc-600 transition-colors cursor-pointer col-span-2 md:col-span-1"
        >
          <div className="flex items-center justify-between text-[#71717A] mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Critical</span>
            <AlertTriangle className="w-4 h-4 text-red-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl font-semibold font-mono ${criticalDevices > 0 ? 'text-red-400' : 'text-[#FAFAFA]'}`}>
              {criticalDevices}
            </span>
            <span className="text-xs text-[#71717A] font-mono">threats</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Left (Threat Radar & Device Table) + Right (Active Alerts & Event Stream) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns */}
        <div className="lg:col-span-2 space-y-6">
          {/* Active Devices Overview Table */}
          <div className="bg-[#111113] border border-[#27272A] rounded-lg overflow-hidden">
            <div className="p-4 border-b border-[#27272A] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Server className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-semibold text-[#FAFAFA]">Discovered Subnet Nodes</h3>
                <span className="text-xs text-[#71717A] font-mono">({status?.subnet || '192.168.1.0/24'})</span>
              </div>
              <button
                onClick={() => setActiveView('devices')}
                className="text-xs text-[#A1A1AA] hover:text-[#FAFAFA] flex items-center gap-1 transition-colors"
              >
                <span>View all ({devices.length})</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#18181B] text-[#71717A] uppercase font-mono border-b border-[#27272A]">
                  <tr>
                    <th className="px-4 py-2.5">Node</th>
                    <th className="px-3 py-2.5">Current IP</th>
                    <th className="px-3 py-2.5">Hardware MAC</th>
                    <th className="px-3 py-2.5">Trust State</th>
                    <th className="px-3 py-2.5 text-right">Risk Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#27272A]">
                  {devices.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-[#71717A]">
                        <p className="text-xs mb-1 font-medium text-zinc-300">No devices detected on subnet</p>
                        <p className="text-[11px] text-zinc-500">Scan subnet from the header to discover active hardware nodes.</p>
                      </td>
                    </tr>
                  ) : (
                    devices.slice(0, 6).map((device) => {
                      const riskStyle = getRiskBadgeClasses(device.riskSeverity);
                      const trustStyle = getTrustStatusClasses(device.trustStatus);
                      return (
                        <tr
                          key={device.id}
                          onClick={() => setSelectedDevice(device)}
                          className="hover:bg-[#18181B] cursor-pointer transition-colors"
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <span
                                className={`w-2 h-2 rounded-full ${
                                  device.status === 'online' ? 'bg-emerald-500' : 'bg-zinc-600'
                                }`}
                              />
                              <div>
                                <div className="font-medium text-[#FAFAFA] truncate max-w-[150px]">
                                  {device.hostname}
                                </div>
                                <div className="text-[11px] text-[#71717A] truncate max-w-[150px]">
                                  {device.vendor}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-3 font-mono text-[#FAFAFA]">{device.currentIp}</td>
                          <td className="px-3 py-3 font-mono text-[#71717A] text-[11px]">
                            {device.macAddress}
                          </td>
                          <td className="px-3 py-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase border ${trustStyle.bg} ${trustStyle.text} ${trustStyle.border}`}
                            >
                              {device.quarantined ? 'ISOLATED' : device.trustStatus}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-right">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono border ${riskStyle.bg} ${riskStyle.text} ${riskStyle.border}`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${riskStyle.dot}`} />
                              {device.riskScore}/100
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Network Activity & Throughput Mini-Card */}
          <div className="bg-[#111113] border border-[#27272A] p-4 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue-400" />
                <h3 className="text-sm font-semibold text-[#FAFAFA]">Subnet Telemetry & Traffic Rate</h3>
              </div>
              <div className="text-xs font-mono text-emerald-400">
                Current: {formatRate(totalThroughputKbps)}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 text-xs mb-3">
              <div className="bg-[#18181B] p-2.5 rounded border border-[#27272A]">
                <span className="text-[#71717A] font-mono block text-[10px] uppercase">Learned Subnet</span>
                <span className="font-mono text-[#FAFAFA] font-medium">{baseline?.knownSubnets[0] || '192.168.1.0/24'}</span>
              </div>
              <div className="bg-[#18181B] p-2.5 rounded border border-[#27272A]">
                <span className="text-[#71717A] font-mono block text-[10px] uppercase">Baseline Confidence</span>
                <span className="font-mono text-emerald-400 font-medium">{baseline?.confidenceScore || 90}%</span>
              </div>
              <div className="bg-[#18181B] p-2.5 rounded border border-[#27272A]">
                <span className="text-[#71717A] font-mono block text-[10px] uppercase">Observed Ports</span>
                <span className="font-mono text-[#FAFAFA] font-medium">{baseline?.typicalPorts.join(', ') || '53, 80, 443'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right 1 Column: Security Alerts & Live Activity */}
        <div className="space-y-6">
          {/* Active Security Alerts */}
          <div className="bg-[#111113] border border-[#27272A] rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-semibold text-[#FAFAFA]">Security Alerts</h3>
              </div>
              {activeAlerts.length > 0 && (
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-red-950/80 border border-red-800/60 text-red-300 font-semibold">
                  {activeAlerts.length} Active
                </span>
              )}
            </div>

            {activeAlerts.length === 0 ? (
              <div className="p-4 rounded border border-[#27272A] bg-[#18181B]/40 text-center">
                <ShieldCheck className="w-8 h-8 text-emerald-400 mx-auto mb-1.5 opacity-80" />
                <p className="text-xs font-medium text-[#FAFAFA]">No Security Alerts</p>
                <p className="text-[11px] text-[#71717A] mt-0.5">
                  Subnet traffic conforms to established behavioral baseline.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                {activeAlerts.map((alert) => {
                  const isCrit = alert.severity === 'critical';
                  return (
                    <div
                      key={alert.id}
                      onClick={() => setActiveView('alerts')}
                      className={`p-3 rounded border transition-colors cursor-pointer ${
                        isCrit
                          ? 'bg-red-950/20 border-red-800/50 hover:bg-red-950/30'
                          : 'bg-amber-950/20 border-amber-800/50 hover:bg-amber-950/30'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span
                          className={`text-[10px] font-mono uppercase px-1.5 py-0.2 rounded font-semibold ${
                            isCrit ? 'bg-red-950 text-red-300' : 'bg-amber-950 text-amber-300'
                          }`}
                        >
                          {alert.severity} ({alert.riskScore} pts)
                        </span>
                        <span className="text-[10px] font-mono text-[#71717A]">
                          {formatTimeAgo(alert.createdAt)}
                        </span>
                      </div>
                      <h4 className="text-xs font-semibold text-[#FAFAFA] truncate">
                        {alert.title}
                      </h4>
                      <p className="text-[11px] text-[#A1A1AA] line-clamp-2 mt-0.5">
                        {alert.description}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Real-Time Event Audit Feed */}
          <div className="bg-[#111113] border border-[#27272A] rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-semibold text-[#FAFAFA]">Live Event Stream</h3>
              </div>
              <button
                onClick={() => setActiveView('activity')}
                className="text-xs text-[#A1A1AA] hover:text-[#FAFAFA] flex items-center gap-1"
              >
                <span>Audit Trail</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {recentEvents.length === 0 ? (
                <div className="text-center py-6 text-[#71717A] text-xs">
                  No events recorded yet. Ready to capture packets and anomalies.
                </div>
              ) : (
                recentEvents.map((evt) => (
                  <div
                    key={evt.id}
                    className="p-2.5 rounded bg-[#18181B] border border-[#27272A] text-xs flex items-start gap-2.5"
                  >
                    <div className="mt-0.5">
                      {evt.severity === 'critical' ? (
                        <span className="w-2 h-2 rounded-full bg-red-500 block" />
                      ) : evt.severity === 'suspicious' ? (
                        <span className="w-2 h-2 rounded-full bg-amber-500 block" />
                      ) : evt.severity === 'watch' ? (
                        <span className="w-2 h-2 rounded-full bg-yellow-500 block" />
                      ) : (
                        <span className="w-2 h-2 rounded-full bg-emerald-500 block" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-medium text-[#FAFAFA] truncate">{evt.title}</span>
                        <span className="text-[#71717A] font-mono shrink-0 ml-2">
                          {formatTimeAgo(evt.timestamp)}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#A1A1AA] truncate mt-0.5">{evt.description}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
