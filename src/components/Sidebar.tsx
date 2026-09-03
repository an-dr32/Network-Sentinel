import React from 'react';
import {
  Shield,
  LayoutDashboard,
  Server,
  Network,
  Activity,
  AlertTriangle,
  FlaskConical,
  Settings,
  Radio,
} from 'lucide-react';
import { useNetwork } from '../context/NetworkContext';

export const Sidebar: React.FC = () => {
  const { activeView, setActiveView, devices, alerts, status } = useNetwork();

  const activeAlertsCount = alerts.filter((a) => !a.resolved).length;
  const suspiciousDevicesCount = devices.filter(
    (d) => d.riskSeverity === 'suspicious' || d.riskSeverity === 'critical' || d.trustStatus === 'suspicious'
  ).length;

  const navItems = [
    {
      id: 'overview' as const,
      label: 'Overview',
      icon: LayoutDashboard,
    },
    {
      id: 'devices' as const,
      label: 'Devices',
      icon: Server,
      badge: devices.length.toString(),
      badgeColor: suspiciousDevicesCount > 0 ? 'bg-amber-950/80 text-amber-300 border border-amber-800/50' : 'bg-zinc-800 text-zinc-400',
    },
    {
      id: 'topology' as const,
      label: 'Topology',
      icon: Network,
    },
    {
      id: 'activity' as const,
      label: 'Activity Stream',
      icon: Activity,
    },
    {
      id: 'alerts' as const,
      label: 'Security Alerts',
      icon: AlertTriangle,
      badge: activeAlertsCount > 0 ? activeAlertsCount.toString() : undefined,
      badgeColor: activeAlertsCount > 0 ? 'bg-red-950/80 text-red-300 border border-red-800/60 font-semibold' : undefined,
    },
    {
      id: 'security-lab' as const,
      label: 'Security Lab',
      icon: FlaskConical,
      tag: 'SIMULATED',
    },
    {
      id: 'settings' as const,
      label: 'Settings',
      icon: Settings,
    },
  ];

  return (
    <aside
      id="sidebar-container"
      className="w-64 bg-[#111113] border-r border-[#27272A] flex flex-col shrink-0 min-h-screen select-none"
    >
      {/* Brand Header */}
      <div id="brand-header" className="p-4 border-b border-[#27272A] flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-700 flex items-center justify-center text-zinc-100 shadow-inner">
          <Shield className="w-4 h-4 text-emerald-400" />
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-sm tracking-tight text-[#FAFAFA]">Network Sentinel</span>
            <span className="text-[10px] px-1 py-0.2 rounded bg-zinc-800 text-zinc-400 font-mono">v1.0</span>
          </div>
          <p className="text-[11px] text-[#71717A] truncate font-mono">
            {status?.subnet || '192.168.1.0/24'}
          </p>
        </div>
      </div>

      {/* Navigation Links */}
      <nav id="sidebar-nav" className="flex-1 p-3 space-y-1 overflow-y-auto">
        <div className="text-[11px] font-medium text-[#71717A] px-3 py-1 uppercase tracking-wider">
          Monitoring
        </div>
        {navItems.slice(0, 5).map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              id={`nav-item-${item.id}`}
              onClick={() => setActiveView(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-[#18181B] text-[#FAFAFA] border border-[#27272A] shadow-sm'
                  : 'text-[#A1A1AA] hover:text-[#FAFAFA] hover:bg-[#18181B]/50'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-400' : 'text-[#71717A]'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span className={`text-[11px] font-mono px-2 py-0.5 rounded-full ${item.badgeColor}`}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}

        <div className="text-[11px] font-medium text-[#71717A] px-3 pt-4 pb-1 uppercase tracking-wider">
          Laboratory & Config
        </div>
        {navItems.slice(5).map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              id={`nav-item-${item.id}`}
              onClick={() => setActiveView(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-[#18181B] text-[#FAFAFA] border border-[#27272A] shadow-sm'
                  : 'text-[#A1A1AA] hover:text-[#FAFAFA] hover:bg-[#18181B]/50'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Icon className={`w-4 h-4 ${isActive ? 'text-amber-400' : 'text-[#71717A]'}`} />
                <span>{item.label}</span>
              </div>
              {item.tag && (
                <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-amber-950/60 border border-amber-800/50 text-amber-300">
                  {item.tag}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Collector Status Footer */}
      <div id="sidebar-footer" className="p-3 border-t border-[#27272A] bg-[#09090B]/50">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-xs text-[#FAFAFA] font-medium">Passive Collector</span>
          </div>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 uppercase">
            {status?.collectorType || 'mock'}
          </span>
        </div>
        <div className="flex items-center justify-between text-[11px] text-[#71717A] font-mono">
          <span>Interface: {status?.interfaceName || 'eth0'}</span>
          <span>{status?.onlineDevices || 0} online</span>
        </div>
      </div>
    </aside>
  );
};
