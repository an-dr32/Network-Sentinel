import React, { useState, useMemo } from 'react';
import {
  Network,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Globe,
  Router,
  Server,
  Laptop,
  Smartphone,
  ShieldAlert,
  Info,
  Radio,
  Zap,
  Activity,
  ArrowRight,
  Filter,
  CheckCircle2,
  Clock,
  Layers,
} from 'lucide-react';
import { useNetwork } from '../context/NetworkContext';
import { TopologyNode, RouterRequestType, RouterRequestEvent } from '../types';

export const TopologyView: React.FC = () => {
  const {
    topology,
    devices,
    recentRouterRequests,
    topologyTraffic,
    setSelectedDevice,
    triggerDiscoveryScan,
  } = useNetwork();

  const [zoom, setZoom] = useState(1);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [protocolFilter, setProtocolFilter] = useState<string>('ALL');
  const [showPulses, setShowPulses] = useState(true);

  const handleScan = async () => {
    setIsScanning(true);
    try {
      await triggerDiscoveryScan();
    } finally {
      setTimeout(() => setIsScanning(false), 800);
    }
  };

  const nodes = (topology?.nodes || []).filter((n) => n.status === 'online');

  // Categorize nodes
  const gatewayNode = nodes.find((n) => n.type === 'gateway');
  const deviceNodes = nodes.filter((n) => n.type === 'device');
  const historicCount = devices.filter((d) => d.status !== 'online').length;

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);
  const selectedFullDevice = devices.find((d) => d.id === selectedNodeId);

  // Position nodes in a radial arc layout below gateway
  const layout = useMemo(() => {
    const centerX = 450;
    const centerY = 260;
    const radius = 210;

    const positionedNodes: (TopologyNode & { x: number; y: number })[] = [];

    // WAN / Internet Node
    const wanX = centerX;
    const wanY = 55;

    // Gateway / Router Node
    const gwX = centerX;
    const gwY = 145;

    if (gatewayNode) {
      positionedNodes.push({ ...gatewayNode, x: gwX, y: gwY });
    }

    // Devices arranged in an arc below gateway
    const count = deviceNodes.length;
    deviceNodes.forEach((node, idx) => {
      let angle: number;
      if (count === 1) {
        angle = Math.PI / 2;
      } else {
        const startAngle = Math.PI * 0.12;
        const endAngle = Math.PI * 0.88;
        angle = startAngle + ((endAngle - startAngle) / (count - 1)) * idx;
      }

      const x = centerX + Math.cos(angle) * radius * 1.55;
      const y = centerY + Math.sin(angle) * (radius * 0.9);

      positionedNodes.push({ ...node, x, y });
    });

    return { wanX, wanY, gwX, gwY, nodes: positionedNodes };
  }, [gatewayNode, deviceNodes]);

  // Traffic summary data
  const trafficSummary = topology?.trafficSummary || topologyTraffic;
  const totalSubnetRequests = trafficSummary?.totalRequests || 0;
  const requestsRate = trafficSummary?.requestsPerMinute || 0;

  // Filtered live router requests
  const filteredRequests = useMemo(() => {
    const list = recentRouterRequests.length > 0 ? recentRouterRequests : trafficSummary?.recentRequests || [];
    if (protocolFilter === 'ALL') return list;
    return list.filter((r) => r.requestType === protocolFilter);
  }, [recentRouterRequests, trafficSummary, protocolFilter]);

  // Get protocol badge color
  const getProtocolColor = (type?: string) => {
    switch (type) {
      case 'DNS':
        return 'bg-blue-950/70 text-blue-300 border-blue-800/60';
      case 'HTTPS':
        return 'bg-emerald-950/70 text-emerald-300 border-emerald-800/60';
      case 'HTTP':
        return 'bg-amber-950/70 text-amber-300 border-amber-800/60';
      case 'NTP':
        return 'bg-purple-950/70 text-purple-300 border-purple-800/60';
      case 'DHCP':
        return 'bg-cyan-950/70 text-cyan-300 border-cyan-800/60';
      case 'ICMP':
        return 'bg-rose-950/70 text-rose-300 border-rose-800/60';
      case 'mDNS':
      case 'SSDP':
        return 'bg-indigo-950/70 text-indigo-300 border-indigo-800/60';
      default:
        return 'bg-zinc-800 text-zinc-300 border-zinc-700';
    }
  };

  const getDeviceIcon = (dev: TopologyNode) => {
    const type = (dev.deviceType || '').toLowerCase();
    const os = (dev.vendor || '').toLowerCase();
    if (type.includes('phone') || os.includes('iphone') || os.includes('android')) {
      return Smartphone;
    }
    if (type.includes('laptop') || type.includes('workstation') || os.includes('apple') || os.includes('macbook')) {
      return Laptop;
    }
    return Server;
  };

  return (
    <div id="topology-view" className="p-6 space-y-6 max-w-7xl mx-auto select-none">
      {/* Top Header & Live Telemetry Metrics */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#111113] p-4 rounded-lg border border-[#27272A]">
        <div>
          <div className="flex items-center gap-2">
            <Network className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-semibold text-[#FAFAFA]">Subnet Topology & Router Traffic Stream</h2>
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-950/80 text-emerald-300 border border-emerald-800/50">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              LIVE
            </span>
          </div>
          <p className="text-xs text-[#71717A] mt-0.5">
            Real-time visual monitoring of machine requests, request types, and traffic volume routing to gateway.
          </p>
        </div>

        {/* Global Router Request Counters & Node Status */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="bg-[#18181B] px-3 py-1.5 rounded-md border border-emerald-950/60 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[#71717A]">Connected Nodes:</span>
            <span className="font-mono font-bold text-emerald-300">{nodes.length}</span>
          </div>

          {historicCount > 0 && (
            <div className="bg-[#18181B] px-3 py-1.5 rounded-md border border-zinc-800 flex items-center gap-2" title="Disconnected nodes safely tracked in Historic list">
              <span className="w-2 h-2 rounded-full bg-zinc-600" />
              <span className="text-[#71717A]">Historic:</span>
              <span className="font-mono font-medium text-zinc-400">{historicCount}</span>
            </div>
          )}

          <div className="bg-[#18181B] px-3 py-1.5 rounded-md border border-[#27272A] flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-[#71717A]">Router Total:</span>
            <span className="font-mono font-bold text-[#FAFAFA]">{totalSubnetRequests} reqs</span>
          </div>

          <div className="bg-[#18181B] px-3 py-1.5 rounded-md border border-[#27272A] flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-[#71717A]">Active Rate:</span>
            <span className="font-mono font-semibold text-emerald-300">{requestsRate} req/m</span>
          </div>

          {/* Zoom & Reset Controls */}
          <div className="flex items-center bg-[#18181B] rounded-md border border-[#27272A]">
            <button
              onClick={() => setZoom((z) => Math.max(0.7, z - 0.15))}
              className="p-1.5 text-[#71717A] hover:text-[#FAFAFA] transition-colors"
              title="Zoom out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-xs font-mono text-[#FAFAFA] px-2 min-w-[45px] text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom((z) => Math.min(1.5, z + 0.15))}
              className="p-1.5 text-[#71717A] hover:text-[#FAFAFA] transition-colors"
              title="Zoom in"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={() => setZoom(1)}
            className="p-1.5 bg-[#18181B] hover:bg-zinc-800 text-[#71717A] hover:text-[#FAFAFA] rounded-md border border-[#27272A] transition-colors"
            title="Reset zoom"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Canvas + Inspector Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* SVG Canvas Area */}
        <div className="lg:col-span-3 bg-[#111113] border border-[#27272A] rounded-lg p-3 overflow-hidden relative min-h-[500px] flex flex-col justify-between">
          {/* Canvas Sub-Header / Filters */}
          <div className="flex items-center justify-between z-10 px-2 py-1 bg-[#18181B]/80 backdrop-blur rounded-md border border-[#27272A]/70 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-[#71717A] font-medium flex items-center gap-1">
                <Filter className="w-3 h-3 text-zinc-400" />
                Filter Request Type:
              </span>
              <div className="flex items-center gap-1 overflow-x-auto">
                {['ALL', 'DNS', 'HTTPS', 'NTP', 'ICMP'].map((proto) => (
                  <button
                    key={proto}
                    onClick={() => setProtocolFilter(proto)}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors ${
                      protocolFilter === proto
                        ? 'bg-zinc-100 text-zinc-950 font-semibold shadow-sm'
                        : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
                    }`}
                  >
                    {proto}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 text-[11px] text-[#71717A]">
              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showPulses}
                  onChange={(e) => setShowPulses(e.target.checked)}
                  className="rounded bg-zinc-900 border-zinc-700 text-emerald-500 focus:ring-0 w-3 h-3"
                />
                <span>Live Request Pulses</span>
              </label>
            </div>
          </div>

          {/* Subtle Grid Background */}
          <div
            className="absolute inset-0 opacity-15 pointer-events-none"
            style={{
              backgroundImage: 'radial-gradient(#3F3F46 1px, transparent 1px)',
              backgroundSize: '24px 24px',
            }}
          />

          {nodes.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center p-8 z-10 max-w-md mx-auto my-auto">
              <div className="w-14 h-14 rounded-full bg-zinc-900 border border-zinc-700 flex items-center justify-center mb-4">
                <Network className="w-7 h-7 text-zinc-500" />
              </div>
              <h3 className="text-sm font-semibold text-[#FAFAFA] mb-1">No Active Nodes Detected</h3>
              <p className="text-xs text-[#71717A] mb-5 leading-relaxed">
                Scan your subnet to identify connected machines, gateway pathing, and observe live traffic requests.
              </p>
              <button
                onClick={handleScan}
                disabled={isScanning}
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-md transition-colors shadow-sm disabled:opacity-50"
              >
                <Radio className="w-3.5 h-3.5" />
                <span>{isScanning ? 'Scanning Subnet...' : 'Scan Subnet Now'}</span>
              </button>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center relative my-2 overflow-hidden">
              <svg
                viewBox="0 0 900 500"
                className="w-full h-full max-h-[480px] transition-transform duration-200"
                style={{ transform: `scale(${zoom})` }}
              >
                <defs>
                  <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                </defs>

                {/* WAN -> Gateway Link */}
                <line
                  x1={layout.wanX}
                  y1={layout.wanY}
                  x2={layout.gwX}
                  y2={layout.gwY}
                  stroke="#3F3F46"
                  strokeWidth="2"
                  strokeDasharray="4 4"
                />

                {/* Gateway -> Device Links & Traffic Counters */}
                {layout.nodes
                  .filter((n) => n.type === 'device')
                  .map((dev) => {
                    const isCrit = dev.riskSeverity === 'critical' || dev.quarantined;
                    const isSusp = dev.riskSeverity === 'suspicious';
                    const strokeColor = isCrit ? '#EF4444' : isSusp ? '#F59E0B' : '#10B981';

                    // Device request metrics
                    const devStats = dev.routerTraffic || trafficSummary?.deviceStats?.[dev.id];
                    const reqCount = devStats?.totalRequests || 0;
                    const lastReq = devStats?.lastRequest;
                    const topReqType = lastReq?.requestType || 'DNS';

                    // Link midpoint for request label
                    const midX = (layout.gwX + dev.x) / 2;
                    const midY = (layout.gwY + dev.y) / 2;

                    return (
                      <g key={`link_${dev.id}`} className="group">
                        {/* Physical / Logical Connection Line */}
                        <line
                          x1={layout.gwX}
                          y1={layout.gwY}
                          x2={dev.x}
                          y2={dev.y}
                          stroke={strokeColor}
                          strokeWidth={dev.quarantined ? '1.5' : '2.5'}
                          strokeDasharray={dev.quarantined ? '4 4' : 'none'}
                          opacity={dev.quarantined ? 0.25 : 0.65}
                          className="transition-all group-hover:opacity-90"
                        />

                        {/* Animated Request Pulses Traveling from Machine to Router */}
                        {showPulses && dev.status === 'online' && !dev.quarantined && (
                          <>
                            {/* Device -> Router Request Pulse */}
                            <circle r="3.5" fill={strokeColor} filter="url(#glow)">
                              <animateMotion
                                path={`M ${dev.x} ${dev.y} L ${layout.gwX} ${layout.gwY}`}
                                dur={`${2.0 + (dev.id.charCodeAt(0) % 5) * 0.4}s`}
                                repeatCount="indefinite"
                              />
                            </circle>
                            {/* Secondary router reply return pulse */}
                            <circle r="2.5" fill="#60A5FA" opacity="0.8">
                              <animateMotion
                                path={`M ${layout.gwX} ${layout.gwY} L ${dev.x} ${dev.y}`}
                                dur={`${2.4 + (dev.id.charCodeAt(0) % 5) * 0.4}s`}
                                repeatCount="indefinite"
                              />
                            </circle>
                          </>
                        )}

                        {/* Midpoint Traffic Badge: Quantity of Requests + Top Protocol */}
                        {!dev.quarantined && (
                          <g transform={`translate(${midX}, ${midY})`} className="cursor-pointer">
                            <rect
                              x="-34"
                              y="-10"
                              width="68"
                              height="20"
                              rx="10"
                              fill="#18181B"
                              stroke="#27272A"
                              strokeWidth="1"
                              className="transition-all group-hover:stroke-emerald-500 group-hover:fill-zinc-900"
                            />
                            <text
                              textAnchor="middle"
                              y="3"
                              fill="#FAFAFA"
                              fontSize="9"
                              fontWeight="600"
                              fontFamily="JetBrains Mono"
                            >
                              {reqCount} req • {topReqType}
                            </text>
                          </g>
                        )}
                      </g>
                    );
                  })}

                {/* WAN Node */}
                <g transform={`translate(${layout.wanX}, ${layout.wanY})`} className="cursor-default">
                  <circle r="22" fill="#18181B" stroke="#3F3F46" strokeWidth="2" />
                  <Globe className="w-5 h-5 text-blue-400" x="-10" y="-10" />
                  <text y="36" textAnchor="middle" fill="#A1A1AA" fontSize="10" fontFamily="JetBrains Mono">
                    WAN Gateway
                  </text>
                </g>

                {/* Central Router / Gateway Node */}
                {gatewayNode && (
                  <g
                    transform={`translate(${layout.gwX}, ${layout.gwY})`}
                    onClick={() => setSelectedNodeId(gatewayNode.id)}
                    className="cursor-pointer group"
                  >
                    <circle
                      r="28"
                      fill="#111113"
                      stroke="#10B981"
                      strokeWidth="2.5"
                      className="transition-all group-hover:stroke-emerald-400 group-hover:scale-105 shadow-lg"
                    />
                    <Router className="w-6 h-6 text-emerald-400" x="-12" y="-12" />
                    <text y="42" textAnchor="middle" fill="#FAFAFA" fontSize="11" fontWeight="600" fontFamily="Geist">
                      {gatewayNode.label || gatewayNode.ip || 'Gateway Router'}
                    </text>
                    <text y="54" textAnchor="middle" fill="#10B981" fontSize="9" fontFamily="JetBrains Mono">
                      {gatewayNode.ip || '192.168.1.1'}
                    </text>
                  </g>
                )}

                {/* Connected Devices with Live Metrics */}
                {layout.nodes
                  .filter((n) => n.type === 'device')
                  .map((node) => {
                    const isSelected = node.id === selectedNodeId;
                    const isCrit = node.riskSeverity === 'critical' || node.quarantined;
                    const isSusp = node.riskSeverity === 'suspicious';
                    const strokeColor = isCrit ? '#EF4444' : isSusp ? '#F59E0B' : '#10B981';

                    const DevIcon = getDeviceIcon(node);
                    const devStats = node.routerTraffic || trafficSummary?.deviceStats?.[node.id];
                    const count = devStats?.totalRequests || 0;

                    return (
                      <g
                        key={node.id}
                        transform={`translate(${node.x}, ${node.y})`}
                        onClick={() => setSelectedNodeId(node.id)}
                        className="cursor-pointer group"
                      >
                        {/* Outer Selection Ring */}
                        {isSelected && (
                          <circle r="32" fill="none" stroke="#FAFAFA" strokeWidth="1.5" strokeDasharray="3 3" />
                        )}

                        {/* Node Body Circle */}
                        <circle
                          r="22"
                          fill="#18181B"
                          stroke={strokeColor}
                          strokeWidth={isSelected ? '3' : '2'}
                          className="transition-all group-hover:scale-110"
                        />

                        {/* Hardware Icon */}
                        <DevIcon className="w-5 h-5 text-[#FAFAFA]" x="-10" y="-10" />

                        {/* Router Request Count Badge (Top-Right) */}
                        <g transform="translate(14, -18)">
                          <rect
                            x="-14"
                            y="-8"
                            width="28"
                            height="15"
                            rx="7.5"
                            fill="#09090B"
                            stroke="#3F3F46"
                            strokeWidth="1"
                          />
                          <text
                            textAnchor="middle"
                            y="3"
                            fill="#FBBF24"
                            fontSize="8.5"
                            fontWeight="bold"
                            fontFamily="JetBrains Mono"
                          >
                            ⚡{count}
                          </text>
                        </g>

                        {/* Threat Indicator Dot */}
                        {node.riskScore > 20 && (
                          <circle cx="-16" cy="-16" r="5" fill={strokeColor} />
                        )}

                        {/* Labels */}
                        <text
                          y="36"
                          textAnchor="middle"
                          fill="#FAFAFA"
                          fontSize="11"
                          fontWeight="500"
                          fontFamily="Geist"
                        >
                          {node.label.length > 14 ? node.label.substring(0, 14) + '...' : node.label}
                        </text>
                        <text
                          y="48"
                          textAnchor="middle"
                          fill="#71717A"
                          fontSize="9.5"
                          fontFamily="JetBrains Mono"
                        >
                          {node.ip}
                        </text>
                      </g>
                    );
                  })}
              </svg>
            </div>
          )}

          {/* Real-time Subnet Request Ticker / Bottom Bar */}
          <div className="bg-[#18181B] border border-[#27272A] rounded-md p-2.5 flex items-center justify-between text-xs font-mono">
            <div className="flex items-center gap-2 truncate">
              <span className="text-[#71717A] text-[10px] uppercase tracking-wider flex items-center gap-1 shrink-0">
                <Clock className="w-3 h-3 text-emerald-400" />
                Latest Request:
              </span>
              {filteredRequests.length > 0 ? (
                <div className="flex items-center gap-2 truncate text-[11px]">
                  <span className="text-[#FAFAFA] font-medium truncate">
                    {filteredRequests[0].sourceHost || filteredRequests[0].sourceIp}
                  </span>
                  <ArrowRight className="w-3 h-3 text-[#71717A] shrink-0" />
                  <span className={`px-1.5 py-0.2 rounded text-[10px] border ${getProtocolColor(filteredRequests[0].requestType)}`}>
                    {filteredRequests[0].requestType}
                  </span>
                  <span className="text-[#A1A1AA] truncate hidden sm:inline">
                    {filteredRequests[0].summary}
                  </span>
                </div>
              ) : (
                <span className="text-[#71717A] italic">Awaiting router requests...</span>
              )}
            </div>

            <div className="text-[10px] text-[#71717A] shrink-0 hidden md:block">
              {filteredRequests.length} logged events in buffer
            </div>
          </div>
        </div>

        {/* Node & Router Request Inspector Panel */}
        <div className="bg-[#111113] border border-[#27272A] rounded-lg p-4 flex flex-col justify-between max-h-[640px] overflow-y-auto">
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#27272A]">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-semibold text-[#FAFAFA]">
                  {selectedNode?.type === 'gateway' ? 'Router Gateway Inspector' : 'Device Inspector'}
                </h3>
              </div>
              {selectedNode && (
                <span className={`px-2 py-0.5 rounded text-[10px] font-mono border ${
                  selectedNode.status === 'online' ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/40' : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                }`}>
                  {selectedNode.status}
                </span>
              )}
            </div>

            {selectedNode ? (
              <div className="space-y-4 text-xs">
                {/* Node Identity */}
                <div>
                  <span className="text-[#71717A] text-[10px] uppercase font-mono block">Selected Machine</span>
                  <span className="font-semibold text-sm text-[#FAFAFA] block mt-0.5">{selectedNode.label}</span>
                  <span className="text-[11px] text-[#71717A] font-mono">{selectedNode.ip}</span>
                </div>

                {/* Router Request Telemetry Section */}
                <div className="bg-[#18181B] p-3 rounded-lg border border-[#27272A] space-y-2.5">
                  <div className="flex items-center justify-between border-b border-[#27272A] pb-2">
                    <span className="text-[11px] font-semibold text-[#FAFAFA] flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-amber-400" />
                      Router Interactions
                    </span>
                    <span className="font-mono text-xs font-bold text-amber-300">
                      {selectedNode.routerTraffic?.totalRequests || trafficSummary?.deviceStats?.[selectedNode.id]?.totalRequests || 0} reqs
                    </span>
                  </div>

                  {/* Protocol breakdown for this machine */}
                  {(() => {
                    const stats = selectedNode.routerTraffic || trafficSummary?.deviceStats?.[selectedNode.id];
                    const typeCounts = (stats?.typeCounts || {}) as Record<string, number>;
                    const entries = Object.entries(typeCounts).filter(([_, count]) => Number(count) > 0);

                    if (entries.length === 0) {
                      return <p className="text-[11px] text-[#71717A] italic py-1">No requests recorded yet.</p>;
                    }

                    return (
                      <div className="space-y-1.5 pt-1">
                        <span className="text-[10px] uppercase font-mono text-[#71717A] block">Request Type Distribution</span>
                        <div className="grid grid-cols-2 gap-1.5 font-mono text-[11px]">
                          {entries.map(([type, count]) => (
                            <div key={type} className="flex items-center justify-between bg-[#111113] px-2 py-1 rounded border border-zinc-800">
                              <span className="text-zinc-400 text-[10px]">{type}:</span>
                              <span className="font-semibold text-zinc-200">{count}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Latest Request Details */}
                  {(() => {
                    const stats = selectedNode.routerTraffic || trafficSummary?.deviceStats?.[selectedNode.id];
                    const lastReq = stats?.lastRequest;
                    if (!lastReq) return null;

                    return (
                      <div className="mt-2 pt-2 border-t border-[#27272A] text-[11px]">
                        <span className="text-[10px] uppercase font-mono text-[#71717A] block mb-1">Last Request to Router</span>
                        <div className="bg-[#111113] p-2 rounded border border-[#27272A] space-y-1">
                          <div className="flex justify-between font-mono">
                            <span className="text-[#71717A]">Type:</span>
                            <span className={`px-1 rounded text-[10px] border ${getProtocolColor(lastReq.requestType)}`}>
                              {lastReq.requestType} ({lastReq.protocol})
                            </span>
                          </div>
                          <div className="flex justify-between font-mono">
                            <span className="text-[#71717A]">Target Port:</span>
                            <span className="text-zinc-300">{lastReq.port}</span>
                          </div>
                          <p className="text-[10px] text-zinc-400 mt-1 truncate">
                            {lastReq.summary}
                          </p>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Hardware & Security Specs */}
                <div className="space-y-1 font-mono text-[11px] bg-[#18181B] p-2.5 rounded border border-[#27272A]">
                  <div className="flex justify-between">
                    <span className="text-[#71717A]">MAC:</span>
                    <span className="text-[#A1A1AA]">{selectedNode.mac || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#71717A]">Vendor:</span>
                    <span className="text-[#A1A1AA] truncate max-w-[120px]">{selectedNode.vendor || 'Unknown'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#71717A]">Trust:</span>
                    <span className="uppercase text-emerald-400">{selectedNode.trustStatus}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#71717A]">Risk:</span>
                    <span className="font-bold text-[#FAFAFA]">{selectedNode.riskScore}/100</span>
                  </div>
                </div>

                {selectedFullDevice && (
                  <div>
                    <span className="text-[#71717A] text-[10px] uppercase font-mono block mb-1">Open Services</span>
                    <div className="flex flex-wrap gap-1">
                      {selectedFullDevice.openPorts.map((p, i) => (
                        <span key={i} className="px-1.5 py-0.2 rounded bg-zinc-800 font-mono text-[10px] text-zinc-300">
                          {p.service}:{p.port}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12 text-[#71717A] text-xs space-y-2">
                <p>Click any machine or the router to inspect its live request counts, protocols, and details.</p>
                <div className="pt-4 border-t border-[#27272A] text-left">
                  <span className="text-[10px] uppercase font-mono text-[#71717A] block mb-2">Subnet Request Types</span>
                  <div className="space-y-1.5">
                    {Object.entries(trafficSummary?.globalTypeCounts || {}).map(([t, count]) => (
                      <div key={t} className="flex justify-between text-[11px] font-mono">
                        <span className="text-zinc-400">{t}</span>
                        <span className="text-zinc-200 font-medium">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {selectedFullDevice && (
            <button
              onClick={() => setSelectedDevice(selectedFullDevice)}
              className="w-full mt-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md text-xs font-medium transition-colors shadow-sm"
            >
              Open Device Overview
            </button>
          )}
        </div>
      </div>

      {/* Live Real-Time Router Request Log Stream Table */}
      <div className="bg-[#111113] border border-[#27272A] rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#FAFAFA]">
              Real-Time Router Telemetry Log Stream
            </h3>
          </div>
          <span className="text-[11px] font-mono text-[#71717A]">
            Updating live over WebSocket
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#27272A] text-[11px] font-mono text-[#71717A]">
                <th className="pb-2 font-medium">Time</th>
                <th className="pb-2 font-medium">Source Machine</th>
                <th className="pb-2 font-medium">Protocol / Type</th>
                <th className="pb-2 font-medium">Destination Port</th>
                <th className="pb-2 font-medium">Packet Size</th>
                <th className="pb-2 font-medium">Request Summary</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#27272A]/40 font-mono text-[11px]">
              {filteredRequests.slice(0, 8).map((req) => (
                <tr key={req.id} className="hover:bg-[#18181B]/50 transition-colors">
                  <td className="py-2 text-[#71717A] whitespace-nowrap">
                    {new Date(req.timestamp).toLocaleTimeString()}
                  </td>
                  <td className="py-2 whitespace-nowrap">
                    <span className="text-[#FAFAFA] font-medium">{req.sourceHost || req.sourceIp}</span>
                    <span className="text-[#71717A] text-[10px] block">{req.sourceIp}</span>
                  </td>
                  <td className="py-2 whitespace-nowrap">
                    <span className={`px-2 py-0.5 rounded text-[10px] border ${getProtocolColor(req.requestType)}`}>
                      {req.requestType} ({req.protocol})
                    </span>
                  </td>
                  <td className="py-2 text-[#A1A1AA] whitespace-nowrap">
                    Port {req.port}
                  </td>
                  <td className="py-2 text-[#71717A] whitespace-nowrap">
                    {req.sizeBytes} B
                  </td>
                  <td className="py-2 text-zinc-300">
                    {req.summary}
                  </td>
                </tr>
              ))}
              {filteredRequests.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-4 text-center text-[#71717A] italic font-sans text-xs">
                    No router requests logged for this filter yet. Active traffic will appear here in real time.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
