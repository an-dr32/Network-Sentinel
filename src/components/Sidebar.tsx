import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  Shield,
  LayoutDashboard,
  Server,
  Network,
  Activity,
  AlertTriangle,
  FlaskConical,
  Settings,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useNetwork } from '../context/NetworkContext';

export const Sidebar: React.FC = () => {
  const { activeView, setActiveView, devices, events, alerts, status } = useNetwork();
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('sentinel_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('sentinel_sidebar_collapsed', isCollapsed ? 'true' : 'false');
    } catch {}
  }, [isCollapsed]);

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
      badge: devices.filter((d) => d.status === 'online').length.toString(),
      badgeColor: suspiciousDevicesCount > 0 ? 'bg-amber-950/80 text-amber-300 border border-amber-800/50' : 'bg-zinc-800 text-zinc-400',
    },
    {
      id: 'topology' as const,
      label: 'Topology',
      icon: Network,
    },
    {
      id: 'events' as const,
      label: 'Events',
      icon: Activity,
      badge: events.length > 0 ? (events.length > 99 ? '99+' : events.length.toString()) : undefined,
      badgeColor: 'bg-zinc-800 text-zinc-300 border border-zinc-700/60 font-mono',
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
      className={`${
        isCollapsed ? 'w-[72px]' : 'w-64'
      } bg-[#111113] border-r border-[#27272A] flex flex-col shrink-0 h-screen sticky top-0 left-0 select-none transition-all duration-300 ease-in-out relative z-30 overflow-hidden`}
    >
      {/* Brand Header with Animated Collapse Logo Button */}
      <div
        id="brand-header"
        className={`p-3.5 border-b border-[#27272A] flex items-center ${
          isCollapsed ? 'justify-center' : 'justify-between'
        } transition-all duration-300`}
      >
        <motion.button
          id="sidebar-logo-toggle"
          onClick={() => setIsCollapsed(!isCollapsed)}
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.90 }}
          title={isCollapsed ? 'Click logo to expand side menu' : 'Click logo to collapse side menu to icons'}
          className="group relative flex items-center gap-3 p-1.5 rounded-xl text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 transition-all cursor-pointer"
        >
          {/* Animated Shield Logo Icon with noticeable pulse and wiggle */}
          <motion.div
            animate={isCollapsed ? { rotate: [0, -10, 10, 0] } : {}}
            transition={{ duration: 0.4 }}
            className="relative w-9 h-9 rounded-lg bg-zinc-900 border border-zinc-700/80 group-hover:border-emerald-500 flex items-center justify-center text-zinc-100 shadow-inner group-hover:shadow-[0_0_16px_rgba(16,185,129,0.35)] transition-all duration-200"
          >
            <Shield className="w-5 h-5 text-emerald-400 transition-all duration-300 group-hover:scale-110 group-hover:text-emerald-300" />
            
            {/* Collapse indicator micro-arrow pill that animates rotation */}
            <motion.span
              animate={{ rotate: isCollapsed ? 180 : 0 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-zinc-800 border border-zinc-600 group-hover:bg-emerald-950 group-hover:border-emerald-500/80 flex items-center justify-center text-zinc-300 group-hover:text-emerald-300 transition-colors shadow-sm"
            >
              <ChevronLeft className="w-2.5 h-2.5" />
            </motion.span>
          </motion.div>

          {/* Expanded Brand Name & Subnet Label */}
          {!isCollapsed && (
            <div className="min-w-0 flex-1 overflow-hidden">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-sm tracking-tight text-[#FAFAFA] group-hover:text-emerald-300 transition-colors">
                  Network Sentinel
                </span>
                <span className="text-[10px] px-1 py-0.2 rounded bg-zinc-800 text-zinc-400 font-mono">
                  v1.0
                </span>
              </div>
              <p className="text-[11px] text-[#71717A] truncate font-mono mt-0.5">
                {status?.subnet || '192.168.1.0/24'}
              </p>
            </div>
          )}
        </motion.button>

        {/* Dedicated subtle collapse button when expanded */}
        {!isCollapsed && (
          <button
            onClick={() => setIsCollapsed(true)}
            className="p-1 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/60 rounded-md transition-colors"
            title="Collapse sidebar to icons"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Navigation Links */}
      <nav id="sidebar-nav" className="flex-1 p-2 space-y-1 overflow-y-auto">
        {!isCollapsed ? (
          <div className="text-[10px] font-mono uppercase tracking-wider text-[#71717A] px-2.5 py-1">
            Monitoring
          </div>
        ) : (
          <div className="w-8 mx-auto border-t border-[#27272A] my-2" />
        )}

        {navItems.slice(0, 5).map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id || (item.id === 'events' && activeView === 'activity');
          return (
            <button
              key={item.id}
              id={`nav-item-${item.id}`}
              onClick={() => setActiveView(item.id)}
              title={isCollapsed ? `${item.label}${item.badge ? ` (${item.badge})` : ''}` : undefined}
              className={`w-full flex items-center ${
                isCollapsed ? 'justify-center p-2.5' : 'justify-between px-3 py-2'
              } rounded-md text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-[#18181B] text-[#FAFAFA] border border-[#27272A] shadow-sm'
                  : 'text-[#A1A1AA] hover:text-[#FAFAFA] hover:bg-[#18181B]/50'
              }`}
            >
              <div className="relative flex items-center gap-2.5">
                <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-400' : 'text-[#71717A]'}`} />
                {!isCollapsed && <span>{item.label}</span>}
                {isCollapsed && item.badge && (
                  <span className={`absolute -top-1.5 -right-2 text-[9px] font-mono px-1 rounded-full ${item.badgeColor}`}>
                    {item.badge}
                  </span>
                )}
              </div>
              {!isCollapsed && item.badge && (
                <span className={`text-[11px] font-mono px-2 py-0.5 rounded-full ${item.badgeColor}`}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}

        {!isCollapsed ? (
          <div className="text-[10px] font-mono uppercase tracking-wider text-[#71717A] px-2.5 pt-4 pb-1">
            Laboratory & Config
          </div>
        ) : (
          <div className="w-8 mx-auto border-t border-[#27272A] my-3" />
        )}

        {navItems.slice(5).map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              id={`nav-item-${item.id}`}
              onClick={() => setActiveView(item.id)}
              title={isCollapsed ? `${item.label}${item.tag ? ` [${item.tag}]` : ''}` : undefined}
              className={`w-full flex items-center ${
                isCollapsed ? 'justify-center p-2.5' : 'justify-between px-3 py-2'
              } rounded-md text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-[#18181B] text-[#FAFAFA] border border-[#27272A] shadow-sm'
                  : 'text-[#A1A1AA] hover:text-[#FAFAFA] hover:bg-[#18181B]/50'
              }`}
            >
              <div className="relative flex items-center gap-2.5">
                <Icon className={`w-4 h-4 ${isActive ? 'text-amber-400' : 'text-[#71717A]'}`} />
                {!isCollapsed && <span>{item.label}</span>}
                {isCollapsed && item.tag && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-400" />
                )}
              </div>
              {!isCollapsed && item.tag && (
                <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-amber-950/60 border border-amber-800/50 text-amber-300">
                  {item.tag}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Collector Status Footer */}
      <div
        id="sidebar-footer"
        className={`border-t border-[#27272A] bg-[#09090B]/60 transition-all duration-300 ${
          isCollapsed ? 'p-2.5 flex flex-col items-center' : 'p-3'
        }`}
        title={`Collector: ${status?.collectorType || 'mock'} | Interface: ${status?.interfaceName || 'eth0'} | ${status?.onlineDevices || 0} online`}
      >
        {!isCollapsed ? (
          <>
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
          </>
        ) : (
          <div className="flex flex-col items-center gap-1.5 py-1">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="text-[9px] font-mono text-zinc-400">
              {status?.onlineDevices || 0}
            </span>
          </div>
        )}
      </div>
    </aside>
  );
};
