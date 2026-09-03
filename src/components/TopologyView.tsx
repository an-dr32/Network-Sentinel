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
  HardDrive,
  Printer,
  ShieldAlert,
  Info,
  Radio,
} from 'lucide-react';
import { useNetwork } from '../context/NetworkContext';
import { TopologyNode } from '../types';
import { getRiskBadgeClasses } from '../utils/formatters';

export const TopologyView: React.FC = () => {
  const { topology, devices, setSelectedDevice, triggerDiscoveryScan } = useNetwork();
  const [zoom, setZoom] = useState(1);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  const handleScan = async () => {
    setIsScanning(true);
    try {
      await triggerDiscoveryScan();
    } finally {
      setTimeout(() => setIsScanning(false), 800);
    }
  };

  const nodes = topology?.nodes || [];

  // Categorize nodes
  const gatewayNode = nodes.find((n) => n.type === 'gateway');
  const deviceNodes = nodes.filter((n) => n.type === 'device');

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);
  const selectedFullDevice = devices.find((d) => d.id === selectedNodeId);

  // Position nodes in a clean radial / tree 2D layout
  const layout = useMemo(() => {
    const centerX = 450;
    const centerY = 280;
    const radius = 220;

    const positionedNodes: (TopologyNode & { x: number; y: number })[] = [];

    // WAN / Internet Node
    const wanX = centerX;
    const wanY = 70;

    // Gateway / Router Node
    const gwX = centerX;
    const gwY = 160;

    if (gatewayNode) {
      positionedNodes.push({ ...gatewayNode, x: gwX, y: gwY });
    }

    // Devices arranged in arc below gateway
    const count = deviceNodes.length;
    deviceNodes.forEach((node, idx) => {
      let angle: number;
      if (count === 1) {
        angle = Math.PI / 2;
      } else {
        const startAngle = Math.PI * 0.15;
        const endAngle = Math.PI * 0.85;
        angle = startAngle + ((endAngle - startAngle) / (count - 1)) * idx;
      }

      const x = centerX + Math.cos(angle) * radius * 1.5;
      const y = centerY + Math.sin(angle) * (radius * 0.85);

      positionedNodes.push({ ...node, x, y });
    });

    return { wanX, wanY, gwX, gwY, nodes: positionedNodes };
  }, [gatewayNode, deviceNodes]);

  return (
    <div id="topology-view" className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#111113] p-4 rounded-lg border border-[#27272A]">
        <div>
          <h2 className="text-sm font-semibold text-[#FAFAFA] flex items-center gap-2">
            <Network className="w-4 h-4 text-emerald-400" />
            <span>Interactive 2D Subnet Topology</span>
          </h2>
          <p className="text-xs text-[#71717A] mt-0.5">
            Click any network node to inspect hardware properties, active connections, and threat levels.
          </p>
        </div>

        {/* Zoom & Reset Controls */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-[#18181B] rounded-md border border-[#27272A]">
            <button
              onClick={() => setZoom((z) => Math.max(0.7, z - 0.15))}
              className="p-1.5 text-[#71717A] hover:text-[#FAFAFA] transition-colors"
              title="Zoom out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-xs font-mono text-[#FAFAFA] px-2 min-w-[50px] text-center">
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
        <div className="lg:col-span-3 bg-[#111113] border border-[#27272A] rounded-lg p-4 overflow-hidden relative min-h-[520px] flex items-center justify-center">
          {/* Subtle Grid Background */}
          <div
            className="absolute inset-0 opacity-20 pointer-events-none"
            style={{
              backgroundImage: 'radial-gradient(#3F3F46 1px, transparent 1px)',
              backgroundSize: '24px 24px',
            }}
          />

          {nodes.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center p-8 z-10 max-w-md">
              <div className="w-14 h-14 rounded-full bg-zinc-900 border border-zinc-700 flex items-center justify-center mb-4">
                <Network className="w-7 h-7 text-zinc-500" />
              </div>
              <h3 className="text-sm font-semibold text-[#FAFAFA] mb-1">No Active Nodes Detected</h3>
              <p className="text-xs text-[#71717A] mb-5 leading-relaxed">
                All default mock nodes have been cleared. Perform a subnet scan to discover active hardware nodes on your local network.
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
            <svg
              viewBox="0 0 900 520"
              className="w-full h-full max-h-[500px] transition-transform duration-200"
              style={{ transform: `scale(${zoom})` }}
            >
              <defs>
                <linearGradient id="linkGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#10B981" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#059669" stopOpacity="0.1" />
                </linearGradient>
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

              {/* Gateway -> Device Links */}
              {layout.nodes
                .filter((n) => n.type === 'device')
                .map((dev) => {
                  const isCrit = dev.riskSeverity === 'critical' || dev.quarantined;
                  const isSusp = dev.riskSeverity === 'suspicious';
                  const strokeColor = isCrit ? '#EF4444' : isSusp ? '#F59E0B' : '#10B981';

                  return (
                    <g key={`link_${dev.id}`}>
                      <line
                        x1={layout.gwX}
                        y1={layout.gwY}
                        x2={dev.x}
                        y2={dev.y}
                        stroke={strokeColor}
                        strokeWidth={dev.quarantined ? '1.5' : '2'}
                        strokeDasharray={dev.quarantined ? '4 4' : 'none'}
                        opacity={dev.quarantined ? 0.3 : 0.6}
                      />
                      {/* Animated Pulse along link if online & active */}
                      {dev.status === 'online' && !dev.quarantined && (
                        <circle r="3" fill={strokeColor}>
                          <animateMotion
                            path={`M ${layout.gwX} ${layout.gwY} L ${dev.x} ${dev.y}`}
                            dur={`${2.5 + Math.random()}s`}
                            repeatCount="indefinite"
                          />
                        </circle>
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

              {/* Gateway Node */}
              {gatewayNode && (
                <g
                  transform={`translate(${layout.gwX}, ${layout.gwY})`}
                  onClick={() => setSelectedNodeId(gatewayNode.id)}
                  className="cursor-pointer group"
                >
                  <circle
                    r="26"
                    fill="#111113"
                    stroke="#10B981"
                    strokeWidth="2.5"
                    className="transition-all group-hover:stroke-emerald-400 group-hover:scale-105"
                  />
                  <Router className="w-6 h-6 text-emerald-400" x="-12" y="-12" />
                  <text y="42" textAnchor="middle" fill="#FAFAFA" fontSize="11" fontWeight="600" fontFamily="Geist">
                    {gatewayNode.label || gatewayNode.ip || 'Gateway'}
                  </text>
                </g>
              )}

            {/* Connected Devices */}
            {layout.nodes
              .filter((n) => n.type === 'device')
              .map((node) => {
                const isSelected = node.id === selectedNodeId;
                const isCrit = node.riskSeverity === 'critical' || node.quarantined;
                const isSusp = node.riskSeverity === 'suspicious';
                const strokeColor = isCrit ? '#EF4444' : isSusp ? '#F59E0B' : '#10B981';

                return (
                  <g
                    key={node.id}
                    transform={`translate(${node.x}, ${node.y})`}
                    onClick={() => setSelectedNodeId(node.id)}
                    className="cursor-pointer group"
                  >
                    {/* Outer Selection Highlight */}
                    {isSelected && (
                      <circle r="30" fill="none" stroke="#FAFAFA" strokeWidth="1.5" strokeDasharray="3 3" />
                    )}

                    <circle
                      r="22"
                      fill="#18181B"
                      stroke={strokeColor}
                      strokeWidth={isSelected ? '3' : '2'}
                      className="transition-all group-hover:scale-110"
                    />

                    <Server className="w-5 h-5 text-[#FAFAFA]" x="-10" y="-10" />

                    {/* Threat indicator badge */}
                    {node.riskScore > 20 && (
                      <circle cx="16" cy="-16" r="6" fill={strokeColor} />
                    )}

                    {/* Node Labels */}
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
          )}
        </div>

        {/* Node Inspector Panel */}
        <div className="bg-[#111113] border border-[#27272A] rounded-lg p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 pb-3 mb-3 border-b border-[#27272A]">
              <Info className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-semibold text-[#FAFAFA]">Node Inspector</h3>
            </div>

            {selectedNode ? (
              <div className="space-y-3.5 text-xs">
                <div>
                  <span className="text-[#71717A] text-[10px] uppercase font-mono block">Node Hostname</span>
                  <span className="font-semibold text-sm text-[#FAFAFA]">{selectedNode.label}</span>
                </div>

                <div className="space-y-1 font-mono text-[11px] bg-[#18181B] p-2.5 rounded border border-[#27272A]">
                  <div className="flex justify-between">
                    <span className="text-[#71717A]">IP:</span>
                    <span className="text-[#FAFAFA]">{selectedNode.ip || 'N/A'}</span>
                  </div>
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
              <div className="text-center py-10 text-[#71717A] text-xs">
                Click any device node on the topology canvas to inspect details.
              </div>
            )}
          </div>

          {selectedFullDevice && (
            <button
              onClick={() => setSelectedDevice(selectedFullDevice)}
              className="w-full mt-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md text-xs font-medium transition-colors shadow-sm"
            >
              Deep Inspection
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
