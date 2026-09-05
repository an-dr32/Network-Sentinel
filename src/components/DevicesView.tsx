import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  Server,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Radio,
  ExternalLink,
  Laptop,
  Smartphone,
  Router,
  HardDrive,
  Printer,
  Ban,
  RotateCcw,
  Fingerprint,
  RefreshCw,
  Edit2,
  Check,
  X,
  Wifi,
  WifiOff,
  History,
  Clock,
} from 'lucide-react';
import { useNetwork } from '../context/NetworkContext';
import { Device, DeviceTrustStatus, RiskSeverity } from '../types';
import { formatTimeAgo, getRiskBadgeClasses, getTrustStatusClasses, getOsBadgeInfo } from '../utils/formatters';

export const DevicesView: React.FC = () => {
  const {
    devices,
    setSelectedDevice,
    setQuarantineTarget,
    triggerRestore,
    detectDeviceOs,
    detectAllDevicesOs,
    updateDeviceName,
  } = useNetwork();

  const [searchQuery, setSearchQuery] = useState('');
  const [trustFilter, setTrustFilter] = useState<string>('all');
  const [riskFilter, setRiskFilter] = useState<string>('all');
  const [osFilter, setOsFilter] = useState<string>('all');
  const [statusView, setStatusView] = useState<'online' | 'historic' | 'all'>('online');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [isDetectingAll, setIsDetectingAll] = useState(false);
  const [detectingDeviceId, setDetectingDeviceId] = useState<string | null>(null);

  const [editingDeviceId, setEditingDeviceId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>('');
  const [isSavingName, setIsSavingName] = useState<boolean>(false);

  const onlineCount = useMemo(() => devices.filter((d) => d && d.status === 'online').length, [devices]);
  const historicCount = useMemo(() => devices.filter((d) => d && d.status !== 'online').length, [devices]);

  const handleSaveDeviceName = async (deviceId: string, name: string) => {
    setIsSavingName(true);
    try {
      await updateDeviceName(deviceId, name);
      setEditingDeviceId(null);
    } catch (err) {
      console.error('Failed to save device name', err);
    } finally {
      setIsSavingName(false);
    }
  };

  const filteredDevices = useMemo(() => {
    return devices.filter((d) => {
      if (!d) return false;

      // Status view filter: Connected vs Historic
      if (statusView === 'online' && d.status !== 'online') return false;
      if (statusView === 'historic' && d.status === 'online') return false;

      const hostname = d.hostname || '';
      const customName = d.customName || '';
      const currentIp = d.currentIp || '';
      const macAddress = d.macAddress || '';
      const vendor = d.vendor || '';
      const osGuess = d.osGuess || '';
      const tags = Array.isArray(d.tags) ? d.tags : [];
      const query = searchQuery.toLowerCase();

      // Search filter
      const matchesSearch =
        searchQuery === '' ||
        hostname.toLowerCase().includes(query) ||
        customName.toLowerCase().includes(query) ||
        currentIp.includes(query) ||
        macAddress.toLowerCase().includes(query) ||
        vendor.toLowerCase().includes(query) ||
        osGuess.toLowerCase().includes(query) ||
        tags.some((t) => t && t.toLowerCase().includes(query));

      // Trust status filter
      const matchesTrust = trustFilter === 'all' || d.trustStatus === trustFilter;

      // Risk level filter
      const matchesRisk = riskFilter === 'all' || d.riskSeverity === riskFilter;

      // OS family filter
      const osLower = (d.osGuess || '').toLowerCase();
      const vendorLower = (d.vendor || '').toLowerCase();
      const isApple =
        osLower.includes('apple') ||
        osLower.includes('macos') ||
        osLower.includes('ios') ||
        osLower.includes('darwin') ||
        vendorLower.includes('apple');

      const isWindows =
        !isApple &&
        (osLower.includes('windows') ||
          osLower.includes('microsoft') ||
          /\bwin\b/i.test(osLower) ||
          vendorLower.includes('microsoft') ||
          vendorLower.includes('dell') ||
          vendorLower.includes('lenovo') ||
          vendorLower.includes('hewlett-packard'));

      const isLinux =
        !isApple &&
        !isWindows &&
        (osLower.includes('linux') ||
          osLower.includes('ubuntu') ||
          osLower.includes('debian') ||
          osLower.includes('arch') ||
          osLower.includes('fedora') ||
          osLower.includes('raspberry') ||
          osLower.includes('unix'));

      const isRouter =
        d.deviceType === 'router' ||
        osLower.includes('router') ||
        osLower.includes('mikrotik') ||
        osLower.includes('cisco') ||
        osLower.includes('gateway') ||
        osLower.includes('openwrt');

      const isUnidentified =
        !d.osGuess ||
        d.osGuess === 'Unknown OS' ||
        d.osGuess.toLowerCase().includes('unknown') ||
        d.osGuess.toLowerCase().includes('unidentified') ||
        d.osGuess.toLowerCase().includes('generic') ||
        (d.osConfidence !== undefined && d.osConfidence < 50);

      const matchesOs =
        osFilter === 'all' ||
        (osFilter === 'apple' && isApple) ||
        (osFilter === 'windows' && isWindows) ||
        (osFilter === 'linux' && isLinux) ||
        (osFilter === 'router' && isRouter) ||
        (osFilter === 'unidentified' && isUnidentified);

      return matchesSearch && matchesTrust && matchesRisk && matchesOs;
    });
  }, [devices, searchQuery, trustFilter, riskFilter, osFilter, statusView]);

  const getDeviceIcon = (deviceType: string) => {
    switch (deviceType) {
      case 'laptop':
      case 'workstation':
        return Laptop;
      case 'smartphone':
        return Smartphone;
      case 'router':
        return Router;
      case 'server':
        return HardDrive;
      case 'printer':
        return Printer;
      default:
        return Server;
    }
  };

  return (
    <div id="devices-view" className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Subnet Status Segmentation Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#27272A] pb-3">
        <div className="flex items-center gap-2">
          <button
            id="tab-active-connected"
            onClick={() => setStatusView('online')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all border ${
              statusView === 'online'
                ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800 shadow-sm'
                : 'bg-[#18181B] text-[#71717A] hover:text-[#FAFAFA] border-[#27272A]'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Connected Devices</span>
            <span className="font-mono text-[11px] px-1.5 py-0.2 rounded bg-emerald-900/60 text-emerald-200">
              {onlineCount}
            </span>
          </button>

          <button
            id="tab-historic-disconnected"
            onClick={() => setStatusView('historic')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all border ${
              statusView === 'historic'
                ? 'bg-amber-950/40 text-amber-300 border-amber-800 shadow-sm'
                : 'bg-[#18181B] text-[#71717A] hover:text-[#FAFAFA] border-[#27272A]'
            }`}
          >
            <History className="w-3.5 h-3.5 text-amber-400" />
            <span>Historic List</span>
            <span className="font-mono text-[11px] px-1.5 py-0.2 rounded bg-amber-900/60 text-amber-200">
              {historicCount}
            </span>
          </button>

          <button
            id="tab-all-devices"
            onClick={() => setStatusView('all')}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all border ${
              statusView === 'all'
                ? 'bg-zinc-700 text-white border-zinc-500'
                : 'bg-[#18181B] text-[#71717A] hover:text-[#FAFAFA] border-[#27272A]'
            }`}
          >
            <span>All Devices</span>
            <span className="font-mono text-[11px] text-zinc-400">
              ({devices.length})
            </span>
          </button>
        </div>

        <div className="text-xs text-[#71717A] flex items-center gap-2 font-mono text-[11px]">
          {statusView === 'online' && (
            <span className="text-emerald-400 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Showing active connected devices on subnet
            </span>
          )}
          {statusView === 'historic' && (
            <span className="text-amber-400 flex items-center gap-1.5">
              <WifiOff className="w-3.5 h-3.5 text-amber-400" />
              Preserved historic devices not detected on current scan
            </span>
          )}
          {statusView === 'all' && (
            <span>Showing all active and historic devices</span>
          )}
        </div>
      </div>

      {/* Search & Filter Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-[#111113] p-4 rounded-lg border border-[#27272A]">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#71717A] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            id="device-search-input"
            type="text"
            placeholder="Search by custom name, hostname, IP address, MAC, or vendor..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#18181B] border border-[#27272A] rounded-md pl-9 pr-4 py-2 text-xs text-[#FAFAFA] placeholder:text-[#71717A] focus:outline-none focus:border-zinc-500 font-mono"
          />
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Trust Filter */}
          <select
            id="trust-filter-select"
            value={trustFilter}
            onChange={(e) => setTrustFilter(e.target.value)}
            className="bg-[#18181B] border border-[#27272A] text-xs text-[#FAFAFA] rounded-md px-2.5 py-2 focus:outline-none focus:border-zinc-500"
          >
            <option value="all">All Trust States</option>
            <option value="known">Known / Trusted</option>
            <option value="new">New Discovered</option>
            <option value="guest">Guest</option>
            <option value="suspicious">Suspicious</option>
            <option value="blocked">Blocked / Isolated</option>
          </select>

          {/* Risk Filter */}
          <select
            id="risk-filter-select"
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value)}
            className="bg-[#18181B] border border-[#27272A] text-xs text-[#FAFAFA] rounded-md px-2.5 py-2 focus:outline-none focus:border-zinc-500"
          >
            <option value="all">All Risk Tiers</option>
            <option value="normal">Normal (0-29)</option>
            <option value="watch">Watch (30-59)</option>
            <option value="suspicious">Suspicious (60-79)</option>
            <option value="critical">Critical (80-100)</option>
          </select>

          {/* OS Family Filter */}
          <select
            id="os-filter-select"
            value={osFilter}
            onChange={(e) => setOsFilter(e.target.value)}
            className="bg-[#18181B] border border-[#27272A] text-xs text-[#FAFAFA] rounded-md px-2.5 py-2 focus:outline-none focus:border-zinc-500 font-mono"
          >
            <option value="all">All OS Families</option>
            <option value="apple">Apple (macOS/Darwin)</option>
            <option value="windows">Microsoft Windows</option>
            <option value="linux">Linux / Unix</option>
            <option value="router">Routers / Gateways</option>
            <option value="unidentified">Unidentified OS</option>
          </select>

          {/* Batch Fingerprint All Button */}
          <button
            id="btn-detect-all-os"
            onClick={async () => {
              setIsDetectingAll(true);
              try {
                await detectAllDevicesOs();
              } finally {
                setIsDetectingAll(false);
              }
            }}
            disabled={isDetectingAll}
            className="flex items-center gap-1.5 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-emerald-400 rounded-md border border-zinc-700 text-xs transition-colors font-mono"
            title="Perform passive TTL and active port probe fingerprinting on all subnet devices"
          >
            <Fingerprint className={`w-3.5 h-3.5 ${isDetectingAll ? 'animate-spin' : ''}`} />
            <span>{isDetectingAll ? 'Fingerprinting...' : 'Fingerprint All OS'}</span>
          </button>

          {/* Toggle View Mode */}
          <div className="flex items-center bg-[#18181B] p-0.5 rounded-md border border-[#27272A]">
            <button
              onClick={() => setViewMode('table')}
              className={`px-2.5 py-1 text-xs rounded transition-colors ${
                viewMode === 'table' ? 'bg-zinc-700 text-white' : 'text-[#71717A] hover:text-[#FAFAFA]'
              }`}
            >
              Table
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`px-2.5 py-1 text-xs rounded transition-colors ${
                viewMode === 'cards' ? 'bg-zinc-700 text-white' : 'text-[#71717A] hover:text-[#FAFAFA]'
              }`}
            >
              Cards
            </button>
          </div>
        </div>
      </div>

      {/* Results Count & Subnet Notice */}
      <div className="flex items-center justify-between text-xs text-[#71717A] px-1">
        <span>
          Showing <strong className="text-[#FAFAFA]">{filteredDevices.length}</strong> of {devices.length} registered subnet identities
        </span>
        <span className="font-mono text-[11px]">Primary Key: MAC / Hardware Continuity (IP is not identity)</span>
      </div>

      {/* Table View */}
      {viewMode === 'table' ? (
        <div className="bg-[#111113] border border-[#27272A] rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#18181B] text-[#71717A] uppercase font-mono border-b border-[#27272A]">
                <tr>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Device Name & Hardware</th>
                  <th className="px-3 py-3">Current IP</th>
                  <th className="px-3 py-3">Hardware MAC</th>
                  <th className="px-3 py-3">OS Stack</th>
                  <th className="px-3 py-3">Trust State</th>
                  <th className="px-3 py-3">Last Active</th>
                  <th className="px-3 py-3">Risk Tier</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#27272A]">
                {filteredDevices.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-[#71717A]">
                      {statusView === 'online'
                        ? 'No connected devices currently match filters. Check "Historic List" for disconnected nodes.'
                        : 'No devices match current filters.'}
                    </td>
                  </tr>
                ) : (
                  filteredDevices.map((device) => {
                    const Icon = getDeviceIcon(device.deviceType);
                    const riskStyle = getRiskBadgeClasses(device.riskSeverity);
                    const trustStyle = getTrustStatusClasses(device.trustStatus);
                    const osInfo = getOsBadgeInfo(device.osGuess);
                    const isOnline = device.status === 'online';

                    return (
                      <tr
                        key={device.id}
                        className={`hover:bg-[#18181B] transition-colors ${
                          device.quarantined ? 'bg-red-950/10' : ''
                        }`}
                      >
                        {/* Status Icon */}
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2">
                            <span
                              className={`w-2 h-2 rounded-full ${
                                isOnline ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50' : 'bg-zinc-600'
                              }`}
                              title={isOnline ? 'Online / Connected' : 'Offline / Disconnected'}
                            />
                            <Icon className="w-4 h-4 text-[#71717A]" />
                          </div>
                        </td>

                        {/* Device Name, Custom Name Input & Vendor */}
                        <td
                          className="px-4 py-3.5 cursor-pointer"
                          onClick={() => setSelectedDevice(device)}
                        >
                          {editingDeviceId === device.id ? (
                            <div
                              className="flex items-center gap-1.5"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <input
                                type="text"
                                value={editingName}
                                onChange={(e) => setEditingName(e.target.value)}
                                placeholder={device.hostname}
                                className="bg-[#18181B] text-[#FAFAFA] text-xs px-2 py-0.5 rounded border border-emerald-500 focus:outline-none"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveDeviceName(device.id, editingName);
                                  if (e.key === 'Escape') setEditingDeviceId(null);
                                }}
                              />
                              <button
                                onClick={() => handleSaveDeviceName(device.id, editingName)}
                                disabled={isSavingName}
                                className="p-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white"
                                title="Save name"
                              >
                                <Check className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => setEditingDeviceId(null)}
                                className="p-1 rounded bg-[#27272A] text-[#A1A1AA]"
                                title="Cancel"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <div className="group flex items-center gap-1.5">
                              <span className="font-semibold text-[#FAFAFA] hover:text-emerald-400 transition-colors">
                                {device.customName || device.hostname || 'Unnamed Device'}
                              </span>
                              {device.customName && (
                                <span className="text-[11px] text-[#71717A] font-mono">
                                  ({device.hostname})
                                </span>
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingDeviceId(device.id);
                                  setEditingName(device.customName || device.hostname || '');
                                }}
                                className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-emerald-400 text-zinc-500 transition-opacity"
                                title="Set friendly device name"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                              {Array.isArray(device.ipHistory) && device.ipHistory.length > 1 && (
                                <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-zinc-800 text-zinc-400">
                                  {device.ipHistory.length} IPs
                                </span>
                              )}
                            </div>
                          )}
                          <div className="text-[11px] text-[#71717A]">{device.vendor}</div>
                        </td>

                        {/* Current IP */}
                        <td className="px-3 py-3.5 font-mono text-[#FAFAFA]">
                          {device.currentIp}
                        </td>

                        {/* MAC Address */}
                        <td className="px-3 py-3.5 font-mono text-[#71717A] text-[11px]">
                          {device.macAddress}
                        </td>

                        {/* OS Stack */}
                        <td className="px-3 py-3.5">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-mono border truncate max-w-[130px] ${osInfo.bg} ${osInfo.text} ${osInfo.border}`}
                              title={device.osGuess || 'Unidentified OS'}
                            >
                              {device.osGuess || 'Unidentified'}
                            </span>
                            {device.osConfidence !== undefined && (
                              <span className="text-[10px] font-mono text-zinc-400">
                                {device.osConfidence}%
                              </span>
                            )}
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                setDetectingDeviceId(device.id);
                                try {
                                  await detectDeviceOs(device.id);
                                } finally {
                                  setDetectingDeviceId(null);
                                }
                              }}
                              disabled={detectingDeviceId === device.id}
                              className="p-1 hover:bg-zinc-800 text-zinc-400 hover:text-emerald-400 rounded transition-colors"
                              title="Run OS fingerprint probe on this device"
                            >
                              <Fingerprint className={`w-3.5 h-3.5 ${detectingDeviceId === device.id ? 'animate-spin text-emerald-400' : ''}`} />
                            </button>
                          </div>
                        </td>

                        {/* Trust State */}
                        <td className="px-3 py-3.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase border ${trustStyle.bg} ${trustStyle.text} ${trustStyle.border}`}
                          >
                            {device.quarantined ? 'QUARANTINED' : device.trustStatus}
                          </span>
                        </td>

                        {/* Last Seen */}
                        <td className="px-3 py-3.5 font-mono text-[#71717A] text-[11px]">
                          {formatTimeAgo(device.lastSeen)}
                        </td>

                        {/* Risk Score */}
                        <td className="px-3 py-3.5">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono border ${riskStyle.bg} ${riskStyle.text} ${riskStyle.border}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${riskStyle.dot}`} />
                            {device.riskScore}/100
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3.5 text-right space-x-2">
                          <button
                            onClick={() => setSelectedDevice(device)}
                            className="px-2.5 py-1 bg-[#18181B] hover:bg-zinc-700 text-[#FAFAFA] rounded border border-[#27272A] text-xs transition-colors"
                          >
                            Inspect
                          </button>
                          {device.quarantined ? (
                            <button
                              onClick={() => triggerRestore(device.id)}
                              className="px-2.5 py-1 bg-emerald-950/60 hover:bg-emerald-900 text-emerald-300 rounded border border-emerald-800/60 text-xs transition-colors"
                              title="Restore network access"
                            >
                              Restore
                            </button>
                          ) : (
                            <button
                              onClick={() => setQuarantineTarget(device)}
                              className="px-2.5 py-1 bg-red-950/40 hover:bg-red-900/60 text-red-300 rounded border border-red-800/50 text-xs transition-colors"
                              title="Isolate device from local network"
                            >
                              Quarantine
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Cards View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDevices.map((device) => {
            const Icon = getDeviceIcon(device.deviceType);
            const riskStyle = getRiskBadgeClasses(device.riskSeverity);
            const trustStyle = getTrustStatusClasses(device.trustStatus);
            const osInfo = getOsBadgeInfo(device.osGuess);
            const isOnline = device.status === 'online';

            return (
              <div
                key={device.id}
                className={`bg-[#111113] border rounded-lg p-4 transition-all hover:border-zinc-500 ${
                  device.quarantined ? 'border-red-800/60 bg-red-950/10' : 'border-[#27272A]'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-[#18181B] border border-[#27272A] flex items-center justify-center text-[#FAFAFA] relative">
                      <Icon className="w-5 h-5 text-emerald-400" />
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#111113] ${
                          isOnline ? 'bg-emerald-500' : 'bg-zinc-600'
                        }`}
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 group">
                        <h4 className="font-semibold text-sm text-[#FAFAFA] truncate max-w-[160px]">
                          {device.customName || device.hostname || 'Unnamed Device'}
                        </h4>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedDevice(device);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-emerald-400 text-zinc-500 transition-opacity"
                          title="Rename / Inspect"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                      </div>
                      <p className="text-[11px] text-[#71717A] truncate max-w-[160px]">
                        {device.customName ? `${device.hostname} • ${device.vendor}` : device.vendor}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono border ${riskStyle.bg} ${riskStyle.text} ${riskStyle.border}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${riskStyle.dot}`} />
                    {device.riskScore}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs font-mono bg-[#18181B] p-2.5 rounded border border-[#27272A] mb-3">
                  <div className="flex justify-between">
                    <span className="text-[#71717A]">IP:</span>
                    <span className="text-[#FAFAFA]">{device.currentIp}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#71717A]">MAC:</span>
                    <span className="text-[#A1A1AA] text-[11px]">{device.macAddress}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[#71717A]">OS:</span>
                    <div className="flex items-center gap-1">
                      <span className={`px-1.5 py-0.2 rounded text-[10px] border truncate max-w-[130px] ${osInfo.bg} ${osInfo.text} ${osInfo.border}`}>
                        {device.osGuess || 'Unidentified'}
                      </span>
                      {device.osConfidence !== undefined && (
                        <span className="text-[10px] text-zinc-400 font-mono">({device.osConfidence}%)</span>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[#71717A]">Status:</span>
                    <span
                      className={`px-1.5 py-0.2 rounded text-[10px] uppercase border font-mono ${
                        isOnline
                          ? 'bg-emerald-950/50 text-emerald-400 border-emerald-800/60'
                          : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                      }`}
                    >
                      {isOnline ? 'Online' : 'Historic (Offline)'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#71717A]">Trust:</span>
                    <span
                      className={`px-1.5 py-0.2 rounded text-[10px] uppercase border ${trustStyle.bg} ${trustStyle.text} ${trustStyle.border}`}
                    >
                      {device.quarantined ? 'QUARANTINED' : device.trustStatus}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#27272A]">
                  <span className="text-[11px] text-[#71717A] font-mono">
                    {formatTimeAgo(device.lastSeen)}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        setDetectingDeviceId(device.id);
                        try {
                          await detectDeviceOs(device.id);
                        } finally {
                          setDetectingDeviceId(null);
                        }
                      }}
                      disabled={detectingDeviceId === device.id}
                      className="p-1.5 bg-[#18181B] hover:bg-zinc-700 text-zinc-400 hover:text-emerald-400 rounded border border-[#27272A] text-xs transition-colors"
                      title="Fingerprint device OS"
                    >
                      <Fingerprint className={`w-3.5 h-3.5 ${detectingDeviceId === device.id ? 'animate-spin text-emerald-400' : ''}`} />
                    </button>
                    <button
                      onClick={() => setSelectedDevice(device)}
                      className="px-2.5 py-1 bg-[#18181B] hover:bg-zinc-700 text-[#FAFAFA] rounded border border-[#27272A] text-xs transition-colors"
                    >
                      Inspect
                    </button>
                    {device.quarantined ? (
                      <button
                        onClick={() => triggerRestore(device.id)}
                        className="px-2.5 py-1 bg-emerald-950/60 hover:bg-emerald-900 text-emerald-300 rounded border border-emerald-800/60 text-xs"
                      >
                        Restore
                      </button>
                    ) : (
                      <button
                        onClick={() => setQuarantineTarget(device)}
                        className="px-2.5 py-1 bg-red-950/40 hover:bg-red-900/60 text-red-300 rounded border border-red-800/50 text-xs"
                      >
                        Quarantine
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
