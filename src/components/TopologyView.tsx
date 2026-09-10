import React, { useState, useMemo, useRef, useEffect } from 'react';
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
  ArrowUp,
  ArrowDown,
  Filter,
  CheckCircle2,
  Clock,
  Layers,
  Move,
  LayoutGrid,
  MousePointerClick,
} from 'lucide-react';
import { useNetwork } from '../context/NetworkContext';
import { TopologyNode, RouterRequestType, RouterRequestEvent } from '../types';

type SortField = 'timestamp' | 'source' | 'requestType' | 'port' | 'sizeBytes' | 'summary' | null;
type SortDirection = 'asc' | 'desc' | null;

export const TopologyView: React.FC = () => {
  const {
    topology,
    devices,
    recentRouterRequests,
    topologyTraffic,
    setSelectedDevice,
    triggerDiscoveryScan,
  } = useNetwork();

  // Canvas navigation & interactivity (atomic pan/zoom transform)
  const [transform, setTransform] = useState<{ zoom: number; panX: number; panY: number }>({
    zoom: 1,
    panX: 0,
    panY: 0,
  });
  const [isCanvasActive, setIsCanvasActive] = useState(false);
  const isCanvasActiveRef = useRef(isCanvasActive);
  const [isPanning, setIsPanning] = useState(false);
  const [nodePositions, setNodePositions] = useState<Record<string, { x: number; y: number }>>({});
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [showPulses, setShowPulses] = useState(true);

  // Table filtering & sorting (tri-state cycle: 1st sort -> 2nd reverse -> 3rd off)
  const [protocolFilter, setProtocolFilter] = useState<string>('ALL');
  const [sortField, setSortField] = useState<SortField>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [pageSize, setPageSize] = useState<number>(10);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inspectorRef = useRef<HTMLDivElement | null>(null);

  const touchStateRef = useRef<{
    initialDist: number;
    initialZoom: number;
    initialPanX: number;
    initialPanY: number;
    cursor: { x: number; y: number };
  } | null>(null);

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

  // Position nodes in radial arc layout with custom drag position overrides
  const layout = useMemo(() => {
    const centerX = 450;
    const centerY = 270;
    const radius = 210;

    const positionedNodes: (TopologyNode & { x: number; y: number })[] = [];

    // WAN / Internet Node
    const wanX = centerX;
    const wanY = 55;
    const customWan = nodePositions['wan-gateway'];
    const actualWanX = customWan ? customWan.x : wanX;
    const actualWanY = customWan ? customWan.y : wanY;

    // Gateway / Router Node
    const gwX = centerX;
    const gwY = 150;
    let actualGwX = gwX;
    let actualGwY = gwY;

    if (gatewayNode) {
      const customGw = nodePositions[gatewayNode.id];
      actualGwX = customGw ? customGw.x : gwX;
      actualGwY = customGw ? customGw.y : gwY;
      positionedNodes.push({ ...gatewayNode, x: actualGwX, y: actualGwY });
    }

    // Devices arranged in an arc below gateway
    const count = deviceNodes.length;
    deviceNodes.forEach((node, idx) => {
      let defaultX: number;
      let defaultY: number;
      if (count === 1) {
        defaultX = centerX;
        defaultY = centerY + radius * 0.9;
      } else {
        const startAngle = Math.PI * 0.12;
        const endAngle = Math.PI * 0.88;
        const angle = startAngle + ((endAngle - startAngle) / (count - 1)) * idx;
        defaultX = centerX + Math.cos(angle) * radius * 1.55;
        defaultY = centerY + Math.sin(angle) * (radius * 0.9);
      }

      const customPos = nodePositions[node.id];
      positionedNodes.push({
        ...node,
        x: customPos ? customPos.x : defaultX,
        y: customPos ? customPos.y : defaultY,
      });
    });

    return {
      wanX: actualWanX,
      wanY: actualWanY,
      gwX: actualGwX,
      gwY: actualGwY,
      nodes: positionedNodes,
    };
  }, [gatewayNode, deviceNodes, nodePositions]);

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

  // Sorted and filtered router requests for the table
  const sortedRequests = useMemo(() => {
    if (!sortField || !sortDirection) {
      return filteredRequests;
    }
    const list = [...filteredRequests];
    list.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'timestamp':
          comparison = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
          break;
        case 'source': {
          const nameA = (a.sourceHost || a.sourceIp || '').toLowerCase();
          const nameB = (b.sourceHost || b.sourceIp || '').toLowerCase();
          comparison = nameA.localeCompare(nameB);
          break;
        }
        case 'requestType':
          comparison = (a.requestType || '').localeCompare(b.requestType || '');
          break;
        case 'port':
          comparison = (a.port || 0) - (b.port || 0);
          break;
        case 'sizeBytes':
          comparison = (a.sizeBytes || 0) - (b.sizeBytes || 0);
          break;
        case 'summary':
          comparison = (a.summary || '').localeCompare(b.summary || '');
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    return list;
  }, [filteredRequests, sortField, sortDirection]);

  // Tri-state column sorting:
  // Step 1: Click column -> sort in primary direction (desc for time/size, asc for text/port)
  // Step 2: Click same column -> reverse direction
  // Step 3: Click 3rd time -> toggle off sorting (restore natural real-time stream order)
  const handleSort = (field: Exclude<SortField, null>) => {
    const isFirstDirDesc = field === 'timestamp' || field === 'sizeBytes';
    const firstDir: SortDirection = isFirstDirDesc ? 'desc' : 'asc';
    const secondDir: SortDirection = isFirstDirDesc ? 'asc' : 'desc';

    if (sortField === field) {
      if (sortDirection === firstDir) {
        // Step 2: Reverse direction
        setSortDirection(secondDir);
      } else {
        // Step 3: Toggle off sorting
        setSortField(null);
        setSortDirection(null);
      }
    } else {
      // Step 1: Set new column
      setSortField(field);
      setSortDirection(firstDir);
    }
  };

  // Accurately convert screen client coordinates to SVG viewBox coordinates (0..900, 0..520)
  const getSvgCursorPoint = (clientX: number, clientY: number): { x: number; y: number } => {
    if (!svgRef.current) return { x: 450, y: 260 };
    const ctm = svgRef.current.getScreenCTM();
    if (!ctm) {
      const rect = svgRef.current.getBoundingClientRect();
      return {
        x: ((clientX - rect.left) / (rect.width || 1)) * 900,
        y: ((clientY - rect.top) / (rect.height || 1)) * 520,
      };
    }
    const pt = svgRef.current.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const svgP = pt.matrixTransform(ctm.inverse());
    return { x: svgP.x, y: svgP.y };
  };

  // Keep ref synchronized
  useEffect(() => {
    isCanvasActiveRef.current = isCanvasActive;
  }, [isCanvasActive]);

  // Click outside or Escape key deactivates canvas zoom mode and deselects node
  useEffect(() => {
    const handlePointerDownOutside = (e: PointerEvent) => {
      const targetNode = e.target as Node;
      const isInsideCanvas = containerRef.current?.contains(targetNode);
      const isInsideInspector = inspectorRef.current?.contains(targetNode);

      if (!isInsideCanvas) {
        setIsCanvasActive(false);
        if (!isInsideInspector) {
          setSelectedNodeId(null);
        }
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsCanvasActive(false);
        setSelectedNodeId(null);
      }
    };

    document.addEventListener('pointerdown', handlePointerDownOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDownOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Wheel zoom and Magic Mouse left/right pan anchored in SVG coordinate space
  // - Magic Mouse / trackpad horizontal swipe (deltaX) moves graph left and right smoothly
  // - Always prevents macOS browser history back/forward reload on horizontal swipes
  // - Vertical wheel zooms the graph when active; scrolls page naturally when inactive
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onWheel = (e: WheelEvent) => {
      // Magic Mouse / Trackpad / Shift-wheel horizontal scroll detection
      const effectiveDeltaX = e.deltaX !== 0 ? e.deltaX : (e.shiftKey ? e.deltaY : 0);
      const isHorizontalPan = Math.abs(effectiveDeltaX) > 0.3;

      // Always block browser history back/forward navigation on macOS Magic Mouse / trackpad horizontal swipes
      if (isHorizontalPan) {
        e.preventDefault();
        e.stopPropagation();

        if (!svgRef.current) return;
        const ctm = svgRef.current.getScreenCTM();
        const rect = svgRef.current.getBoundingClientRect();
        const scaleX = ctm && ctm.a > 0 ? ctm.a : (rect.width > 0 ? rect.width / 900 : 1);
        const dxSvg = effectiveDeltaX / scaleX;

        setTransform((prev) => ({
          ...prev,
          panX: +(prev.panX - dxSvg).toFixed(2),
        }));
        return;
      }

      // Vertical Wheel Movement:
      // If canvas is inactive, let the website scroll naturally!
      if (!isCanvasActiveRef.current) {
        return;
      }

      // Canvas is active -> zoom anchored to pointer location
      e.preventDefault();
      e.stopPropagation();
      if (!svgRef.current) return;

      const cursor = getSvgCursorPoint(e.clientX, e.clientY);

      // Smooth zoom handling: support continuous Magic Mouse / trackpad swipes and discrete clicks
      let zoomMultiplier = 1;
      if (Math.abs(e.deltaY) < 15) {
        zoomMultiplier = Math.min(1.12, Math.max(0.88, 1 - e.deltaY * 0.008));
      } else {
        zoomMultiplier = e.deltaY < 0 ? 1.12 : 0.88;
      }

      setTransform((prev) => {
        const newZoom = Math.min(3.5, Math.max(0.35, +(prev.zoom * zoomMultiplier).toFixed(3)));
        if (newZoom === prev.zoom) return prev;
        const scaleRatio = newZoom / prev.zoom;
        return {
          zoom: newZoom,
          panX: cursor.x - (cursor.x - prev.panX) * scaleRatio,
          panY: cursor.y - (cursor.y - prev.panY) * scaleRatio,
        };
      });
    };

    container.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', onWheel);
    };
  }, [nodes.length]);

  // Canvas Pan Handlers (exact 1:1 screen-to-SVG mapping)
  const handleCanvasPointerDown = (e: React.PointerEvent) => {
    setIsCanvasActive(true);
    if (e.button !== 0) return;
    setIsPanning(true);

    const startClientX = e.clientX;
    const startClientY = e.clientY;
    const initialPanX = transform.panX;
    const initialPanY = transform.panY;

    const ctm = svgRef.current?.getScreenCTM();
    const scaleX = ctm ? ctm.a : 1;
    const scaleY = ctm ? ctm.d : 1;

    let hasMoved = false;

    const onPointerMove = (ev: PointerEvent) => {
      const dxScreen = ev.clientX - startClientX;
      const dyScreen = ev.clientY - startClientY;
      if (Math.hypot(dxScreen, dyScreen) > 4) {
        hasMoved = true;
      }
      const dxSvg = dxScreen / scaleX;
      const dySvg = dyScreen / scaleY;

      setTransform((prev) => ({
        ...prev,
        panX: initialPanX + dxSvg,
        panY: initialPanY + dySvg,
      }));
    };

    const onPointerUp = () => {
      if (!hasMoved) {
        // Clicked away on empty canvas background: deselect node (returns to green)
        setSelectedNodeId(null);
      }
      setIsPanning(false);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
  };

  // Node Drag Handlers (reorganize & move nodes with exact zoom-scaled cursor tracking)
  const handleNodePointerDown = (
    e: React.PointerEvent,
    nodeId: string,
    initialX: number,
    initialY: number
  ) => {
    setIsCanvasActive(true);
    if (e.button !== 0) return;
    e.stopPropagation();

    const startClientX = e.clientX;
    const startClientY = e.clientY;
    let hasMoved = false;

    setDraggingNodeId(nodeId);

    const ctm = svgRef.current?.getScreenCTM();
    const scaleX = ctm ? ctm.a : 1;
    const scaleY = ctm ? ctm.d : 1;
    const currentZoom = transform.zoom;

    const onPointerMove = (ev: PointerEvent) => {
      const dxScreen = ev.clientX - startClientX;
      const dyScreen = ev.clientY - startClientY;

      const dxLocal = (dxScreen / scaleX) / currentZoom;
      const dyLocal = (dyScreen / scaleY) / currentZoom;

      if (Math.hypot(dxLocal, dyLocal) > 3) {
        hasMoved = true;
      }

      const newX = Math.round(initialX + dxLocal);
      const newY = Math.round(initialY + dyLocal);

      setNodePositions((prev) => ({
        ...prev,
        [nodeId]: {
          x: newX, y: newY,
        },
      }));
    };

    const onPointerUp = () => {
      if (!hasMoved) {
        if (nodeId !== 'wan-gateway') {
          // Toggle node selection if clicking the same node, or select the new node
          setSelectedNodeId((prev) => (prev === nodeId ? null : nodeId));
        }
      }
      setDraggingNodeId(null);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
  };

  // Touch handlers for mobile pinch-to-zoom & two-finger pan
  const handleTouchStart = (e: React.TouchEvent) => {
    setIsCanvasActive(true);
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      const cursor = getSvgCursorPoint(midX, midY);

      touchStateRef.current = {
        initialDist: dist,
        initialZoom: transform.zoom,
        initialPanX: transform.panX,
        initialPanY: transform.panY,
        cursor,
      };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchStateRef.current) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      if (touchStateRef.current.initialDist > 0) {
        const ratio = dist / touchStateRef.current.initialDist;
        const newZoom = Math.min(3.5, Math.max(0.35, +(touchStateRef.current.initialZoom * ratio).toFixed(3)));
        const scaleRatio = newZoom / touchStateRef.current.initialZoom;
        const { cursor, initialPanX, initialPanY } = touchStateRef.current;

        setTransform({
          zoom: newZoom,
          panX: cursor.x - (cursor.x - initialPanX) * scaleRatio,
          panY: cursor.y - (cursor.y - initialPanY) * scaleRatio,
        });
      }
    }
  };

  const handleTouchEnd = () => {
    touchStateRef.current = null;
  };

  // Step zoom in or out relative to canvas center
  const handleZoomStep = (direction: 'in' | 'out') => {
    setIsCanvasActive(true);
    const factor = direction === 'in' ? 1.15 : 0.87;
    setTransform((prev) => {
      const newZoom = Math.min(3.5, Math.max(0.35, +(prev.zoom * factor).toFixed(3)));
      const scaleRatio = newZoom / prev.zoom;
      const centerX = 450;
      const centerY = 260;
      return {
        zoom: newZoom,
        panX: centerX - (centerX - prev.panX) * scaleRatio,
        panY: centerY - (centerY - prev.panY) * scaleRatio,
      };
    });
  };

  // Reset view to default zoom and pan
  const handleResetView = () => {
    setIsCanvasActive(true);
    setTransform({ zoom: 1, panX: 0, panY: 0 });
  };

  // Reset rearranged node positions back to initial arc layout
  const handleResetNodePositions = () => {
    setNodePositions({});
  };

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

  const hasCustomPositions = Object.keys(nodePositions).length > 0;

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
            Interactive topology: Drag & reorganize nodes, scroll or drag canvas to zoom & navigate around.
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

          {/* Reset rearranged node positions button */}
          {hasCustomPositions && (
            <button
              onClick={handleResetNodePositions}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#18181B] hover:bg-zinc-800 text-amber-300 hover:text-amber-200 rounded-md border border-amber-900/60 transition-colors text-xs font-mono"
              title="Reset dragged node positions back to initial arc layout"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Reset Layout</span>
            </button>
          )}

          {/* Zoom & Reset Controls */}
          <div className="flex items-center bg-[#18181B] rounded-md border border-[#27272A]">
            <button
              onClick={() => handleZoomStep('out')}
              className="p-1.5 text-[#71717A] hover:text-[#FAFAFA] transition-colors cursor-pointer"
              title="Zoom out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-xs font-mono text-[#FAFAFA] px-2 min-w-[45px] text-center">
              {Math.round(transform.zoom * 100)}%
            </span>
            <button
              onClick={() => handleZoomStep('in')}
              className="p-1.5 text-[#71717A] hover:text-[#FAFAFA] transition-colors cursor-pointer"
              title="Zoom in"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={handleResetView}
            className="p-1.5 bg-[#18181B] hover:bg-zinc-800 text-[#71717A] hover:text-[#FAFAFA] rounded-md border border-[#27272A] transition-colors cursor-pointer"
            title="Reset pan and zoom to center"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Canvas + Inspector Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Interactive SVG Canvas Area */}
        <div className="lg:col-span-3 bg-[#111113] border border-[#27272A] rounded-lg p-3 overflow-hidden relative min-h-[520px] flex flex-col justify-between">
          {/* Canvas Sub-Header Toolbar (Interactivity Hints & Live Pulses Toggle) */}
          <div className="flex items-center justify-between z-10 px-3 py-1.5 bg-[#18181B]/90 backdrop-blur rounded-md border border-[#27272A]/80 text-xs">
            <div className="flex items-center gap-2 text-zinc-300 font-mono text-[11px]">
              {isCanvasActive ? (
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 shadow-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="font-semibold">Zoom & Pan Active</span>
                    <span className="text-emerald-400/80 hidden sm:inline">• Scroll to zoom • Magic Mouse swipe left/right</span>
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsCanvasActive(false);
                    }}
                    className="text-[10px] text-zinc-400 hover:text-zinc-200 bg-zinc-800/70 hover:bg-zinc-800 px-2 py-0.5 rounded border border-zinc-700/50 transition-colors cursor-pointer"
                    title="Switch back to scrolling the webpage (or press Esc / click outside)"
                  >
                    Scroll Webpage (Esc)
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsCanvasActive(true)}
                  className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] bg-zinc-800/80 hover:bg-zinc-800 text-zinc-300 hover:text-zinc-100 border border-zinc-700/60 transition-colors cursor-pointer group"
                  title="Click graph to enable zoom & pan mode"
                >
                  <MousePointerClick className="w-3.5 h-3.5 text-emerald-400 group-hover:scale-110 transition-transform" />
                  <span>Click graph to enable zoom</span>
                  <span className="text-zinc-500 hidden sm:inline">• Magic Mouse swipe moves left/right</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-3 text-[11px] text-[#71717A]">
              {hasCustomPositions && (
                <button
                  onClick={handleResetNodePositions}
                  className="text-[10px] font-mono text-amber-400/90 hover:text-amber-300 underline underline-offset-2 transition-colors cursor-pointer"
                >
                  Reset Node Positions
                </button>
              )}
              <label className="flex items-center gap-1.5 cursor-pointer select-none text-zinc-300">
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
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-md transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
              >
                <Radio className="w-3.5 h-3.5" />
                <span>{isScanning ? 'Scanning Subnet...' : 'Scan Subnet Now'}</span>
              </button>
            </div>
          ) : (
            <div
              ref={containerRef}
              onClick={() => setIsCanvasActive(true)}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onPointerDown={handleCanvasPointerDown}
              style={{
                overscrollBehavior: 'none',
                overscrollBehaviorX: 'none',
                touchAction: 'none',
              }}
              className={`flex-1 relative my-2 overflow-hidden select-none h-[490px] rounded-md transition-all duration-200 bg-[#0c0c0e] overscroll-none overscroll-x-none ${
                isCanvasActive
                  ? 'border border-emerald-500/50 ring-1 ring-emerald-500/30'
                  : 'border border-zinc-800/60 hover:border-zinc-700/80'
              } ${
                isPanning ? 'cursor-grabbing' : 'cursor-grab'
              }`}
            >
              <svg
                ref={svgRef}
                viewBox="0 0 900 520"
                className="w-full h-full"
                style={{ overscrollBehavior: 'none' }}
              >
                <defs>
                  <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                </defs>

                {/* Transformed Content Group for Pan and Zoom */}
                <g transform={`translate(${transform.panX}, ${transform.panY}) scale(${transform.zoom})`}>
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
                      const isSelected = dev.id === selectedNodeId;
                      const isCrit = dev.riskSeverity === 'critical' || dev.quarantined;
                      const isSusp = dev.riskSeverity === 'suspicious';
                      const strokeColor = isCrit
                        ? '#EF4444'
                        : isSusp
                        ? '#F59E0B'
                        : isSelected
                        ? '#F97316'
                        : '#10B981';

                      // Device request metrics
                      const devStats = dev.routerTraffic || trafficSummary?.deviceStats?.[dev.id];
                      const reqCount = devStats?.totalRequests || 0;
                      const lastReq = devStats?.lastRequest;
                      const topReqType = lastReq?.requestType || 'DNS';

                      // Link midpoint for request badge
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
                            strokeWidth={dev.quarantined ? '1.5' : isSelected ? '3' : '2.5'}
                            strokeDasharray={dev.quarantined ? '4 4' : 'none'}
                            opacity={dev.quarantined ? 0.25 : isSelected ? 0.95 : 0.65}
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

                  {/* WAN Gateway Node (Draggable) */}
                  <g
                    transform={`translate(${layout.wanX}, ${layout.wanY})`}
                    onPointerDown={(e) => handleNodePointerDown(e, 'wan-gateway', layout.wanX, layout.wanY)}
                    className={`group ${draggingNodeId === 'wan-gateway' ? 'cursor-grabbing' : 'cursor-grab'}`}
                  >
                    <circle
                      r="24"
                      fill="#18181B"
                      stroke="#3F3F46"
                      strokeWidth={draggingNodeId === 'wan-gateway' ? '3' : '2'}
                      className="transition-all group-hover:stroke-blue-400 group-hover:scale-105"
                    />
                    <Globe className="w-5 h-5 text-blue-400 pointer-events-none" x="-10" y="-10" />
                    <text y="38" textAnchor="middle" fill="#A1A1AA" fontSize="10" fontFamily="JetBrains Mono" className="pointer-events-none">
                      WAN Gateway
                    </text>
                  </g>

                  {/* Central Router / Gateway Node (Draggable) */}
                  {gatewayNode && (() => {
                    const isGwSelected = selectedNodeId === gatewayNode.id;
                    const gwStrokeColor = isGwSelected ? '#F97316' : '#10B981';
                    return (
                      <g
                        transform={`translate(${layout.gwX}, ${layout.gwY})`}
                        onPointerDown={(e) => handleNodePointerDown(e, gatewayNode.id, layout.gwX, layout.gwY)}
                        className={`group ${draggingNodeId === gatewayNode.id ? 'cursor-grabbing' : 'cursor-grab'}`}
                      >
                        <circle
                          r="28"
                          fill="#111113"
                          stroke={gwStrokeColor}
                          strokeWidth={isGwSelected || draggingNodeId === gatewayNode.id ? '3.5' : '2.5'}
                          className={`transition-all ${isGwSelected ? 'group-hover:stroke-orange-400' : 'group-hover:stroke-emerald-400'} group-hover:scale-105 shadow-lg`}
                        />
                        <Router className={`w-6 h-6 ${isGwSelected ? 'text-orange-400' : 'text-emerald-400'} pointer-events-none`} x="-12" y="-12" />
                        <text y="44" textAnchor="middle" fill="#FAFAFA" fontSize="11" fontWeight="600" fontFamily="Geist" className="pointer-events-none">
                          {gatewayNode.label || gatewayNode.ip || 'Gateway Router'}
                        </text>
                        <text y="56" textAnchor="middle" fill={isGwSelected ? '#FB923C' : '#10B981'} fontSize="9" fontFamily="JetBrains Mono" className="pointer-events-none">
                          {gatewayNode.ip || '192.168.1.1'}
                        </text>
                      </g>
                    );
                  })()}

                  {/* Connected Devices with Live Metrics (Draggable) */}
                  {layout.nodes
                    .filter((n) => n.type === 'device')
                    .map((node) => {
                      const isSelected = node.id === selectedNodeId;
                      const isDragging = node.id === draggingNodeId;
                      const isCrit = node.riskSeverity === 'critical' || node.quarantined;
                      const isSusp = node.riskSeverity === 'suspicious';
                      // When selected, turn what's green on the node into orange (#F97316)
                      const strokeColor = isCrit
                        ? '#EF4444'
                        : isSusp
                        ? '#F59E0B'
                        : isSelected
                        ? '#F97316'
                        : '#10B981';

                      const DevIcon = getDeviceIcon(node);
                      const devStats = node.routerTraffic || trafficSummary?.deviceStats?.[node.id];
                      const count = devStats?.totalRequests || 0;

                      return (
                        <g
                          key={node.id}
                          transform={`translate(${node.x}, ${node.y})`}
                          onPointerDown={(e) => handleNodePointerDown(e, node.id, node.x, node.y)}
                          className={`group ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                        >
                          {/* Node Body Circle */}
                          <circle
                            r="22"
                            fill="#18181B"
                            stroke={strokeColor}
                            strokeWidth={isSelected || isDragging ? '3.5' : '2'}
                            className="transition-all group-hover:scale-110"
                          />

                          {/* Hardware Icon */}
                          <DevIcon className={`w-5 h-5 ${isSelected ? 'text-orange-400' : 'text-[#FAFAFA]'} pointer-events-none`} x="-10" y="-10" />

                          {/* Router Request Count Badge (Top-Right) */}
                          <g transform="translate(14, -18)" className="pointer-events-none">
                            <rect
                              x="-14"
                              y="-8"
                              width="28"
                              height="15"
                              rx="7.5"
                              fill="#09090B"
                              stroke={isSelected ? '#F97316' : '#3F3F46'}
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
                            <circle cx="-16" cy="-16" r="5" fill={strokeColor} className="pointer-events-none" />
                          )}

                          {/* Labels */}
                          <text
                            y="36"
                            textAnchor="middle"
                            fill="#FAFAFA"
                            fontSize="11"
                            fontWeight={isSelected ? '600' : '500'}
                            fontFamily="Geist"
                            className="pointer-events-none"
                          >
                            {node.label.length > 14 ? node.label.substring(0, 14) + '...' : node.label}
                          </text>
                          <text
                            y="48"
                            textAnchor="middle"
                            fill={isSelected ? '#FB923C' : '#71717A'}
                            fontSize="9.5"
                            fontFamily="JetBrains Mono"
                            className="pointer-events-none"
                          >
                            {node.ip}
                          </text>
                        </g>
                      );
                    })}
                </g>
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
        <div ref={inspectorRef} className="bg-[#111113] border border-[#27272A] rounded-lg p-4 flex flex-col justify-between max-h-[640px] overflow-y-auto">
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#27272A]">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-semibold text-[#FAFAFA]">
                  {selectedNode?.type === 'gateway' ? 'Router Gateway Inspector' : 'Device Inspector'}
                </h3>
              </div>
              {selectedNode && (
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono border ${
                    selectedNode.status === 'online' ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/40' : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                  }`}>
                    {selectedNode.status}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedNodeId(null)}
                    className="text-zinc-400 hover:text-zinc-200 text-xs px-1.5 py-0.5 rounded hover:bg-zinc-800 transition-colors cursor-pointer"
                    title="Deselect node (Esc)"
                  >
                    ✕
                  </button>
                </div>
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
                <p>Click or drag any machine or router to inspect its live request counts, protocols, and details.</p>
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
              className="w-full mt-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md text-xs font-medium transition-colors shadow-sm cursor-pointer"
            >
              Open Device Overview
            </button>
          )}
        </div>
      </div>

      {/* Live Real-Time Router Request Log Stream Table */}
      <div className="bg-[#111113] border border-[#27272A] rounded-lg p-4 space-y-4">
        {/* Table Header & Controls (With Filters moved here!) */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-[#27272A]">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-400" />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[#FAFAFA]">
                  Real-Time Router Telemetry Logs Stream
                </h3>
                <span className="text-[10px] font-mono text-emerald-400/90 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800/40">
                  LIVE STREAM
                </span>
                {sortField && sortDirection && (
                  <button
                    onClick={() => {
                      setSortField(null);
                      setSortDirection(null);
                    }}
                    className="text-[10px] font-mono text-emerald-300 hover:text-emerald-100 bg-emerald-950/80 hover:bg-emerald-900/90 px-2 py-0.5 rounded border border-emerald-800/60 transition-colors cursor-pointer flex items-center gap-1"
                    title="Click to clear sort and return to live stream order"
                  >
                    <span>Sorted ({sortDirection === 'asc' ? 'Asc' : 'Desc'})</span>
                    <span className="text-emerald-400 font-bold ml-0.5">✕</span>
                  </button>
                )}
              </div>
              <span className="text-[11px] text-[#71717A] font-mono">
                Click any column to sort (3 steps: sort, reverse, toggle off). Showing {Math.min(pageSize, sortedRequests.length)} of {sortedRequests.length} logged packets.
              </span>
            </div>
          </div>

          {/* Request Type Filters (Moved here as requested!) */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 bg-[#18181B] p-1 rounded-md border border-[#27272A]">
              <span className="text-[10px] text-[#71717A] font-mono px-1.5 flex items-center gap-1 font-medium">
                <Filter className="w-3 h-3 text-zinc-400" />
                Filter:
              </span>
              {(['ALL', 'DNS', 'HTTPS', 'HTTP', 'NTP', 'DHCP', 'ICMP'] as const).map((proto) => (
                <button
                  key={proto}
                  onClick={() => setProtocolFilter(proto)}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono transition-all cursor-pointer ${
                    protocolFilter === proto
                      ? 'bg-emerald-600 text-white font-semibold shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
                  }`}
                >
                  {proto}
                </button>
              ))}
            </div>

            {/* Page Size Selector */}
            <div className="flex items-center gap-1 text-[11px] font-mono bg-[#18181B] p-1 rounded-md border border-[#27272A]">
              <span className="text-[#71717A] px-1 text-[10px]">Show:</span>
              {[10, 25, 50].map((size) => (
                <button
                  key={size}
                  onClick={() => setPageSize(size)}
                  className={`px-1.5 py-0.5 rounded text-[10px] transition-colors cursor-pointer ${
                    pageSize === size
                      ? 'bg-zinc-700 text-[#FAFAFA] font-bold'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Telemetry Logs Table with Sortable Columns */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#27272A] text-[11px] font-mono text-[#71717A]">
                {/* Time Column */}
                <th
                  onClick={() => handleSort('timestamp')}
                  className="pb-2.5 font-medium cursor-pointer hover:text-[#FAFAFA] transition-colors select-none group"
                  title="Click to sort by Time"
                >
                  <div className="flex items-center gap-1">
                    <span className={sortField === 'timestamp' ? 'text-emerald-400 font-bold' : 'group-hover:text-zinc-200'}>
                      Time
                    </span>
                    {sortField === 'timestamp' && (
                      sortDirection === 'asc' ? (
                        <ArrowUp className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <ArrowDown className="w-3.5 h-3.5 text-emerald-400" />
                      )
                    )}
                  </div>
                </th>

                {/* Source Machine Column */}
                <th
                  onClick={() => handleSort('source')}
                  className="pb-2.5 font-medium cursor-pointer hover:text-[#FAFAFA] transition-colors select-none group"
                  title="Click to sort by Source Machine"
                >
                  <div className="flex items-center gap-1">
                    <span className={sortField === 'source' ? 'text-emerald-400 font-bold' : 'group-hover:text-zinc-200'}>
                      Source Machine
                    </span>
                    {sortField === 'source' && (
                      sortDirection === 'asc' ? (
                        <ArrowUp className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <ArrowDown className="w-3.5 h-3.5 text-emerald-400" />
                      )
                    )}
                  </div>
                </th>

                {/* Protocol / Type Column */}
                <th
                  onClick={() => handleSort('requestType')}
                  className="pb-2.5 font-medium cursor-pointer hover:text-[#FAFAFA] transition-colors select-none group"
                  title="Click to sort by Protocol / Type"
                >
                  <div className="flex items-center gap-1">
                    <span className={sortField === 'requestType' ? 'text-emerald-400 font-bold' : 'group-hover:text-zinc-200'}>
                      Protocol / Type
                    </span>
                    {sortField === 'requestType' && (
                      sortDirection === 'asc' ? (
                        <ArrowUp className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <ArrowDown className="w-3.5 h-3.5 text-emerald-400" />
                      )
                    )}
                  </div>
                </th>

                {/* Destination Port Column */}
                <th
                  onClick={() => handleSort('port')}
                  className="pb-2.5 font-medium cursor-pointer hover:text-[#FAFAFA] transition-colors select-none group"
                  title="Click to sort by Destination Port"
                >
                  <div className="flex items-center gap-1">
                    <span className={sortField === 'port' ? 'text-emerald-400 font-bold' : 'group-hover:text-zinc-200'}>
                      Destination Port
                    </span>
                    {sortField === 'port' && (
                      sortDirection === 'asc' ? (
                        <ArrowUp className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <ArrowDown className="w-3.5 h-3.5 text-emerald-400" />
                      )
                    )}
                  </div>
                </th>

                {/* Packet Size Column */}
                <th
                  onClick={() => handleSort('sizeBytes')}
                  className="pb-2.5 font-medium cursor-pointer hover:text-[#FAFAFA] transition-colors select-none group"
                  title="Click to sort by Packet Size"
                >
                  <div className="flex items-center gap-1">
                    <span className={sortField === 'sizeBytes' ? 'text-emerald-400 font-bold' : 'group-hover:text-zinc-200'}>
                      Packet Size
                    </span>
                    {sortField === 'sizeBytes' && (
                      sortDirection === 'asc' ? (
                        <ArrowUp className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <ArrowDown className="w-3.5 h-3.5 text-emerald-400" />
                      )
                    )}
                  </div>
                </th>

                {/* Request Summary Column */}
                <th
                  onClick={() => handleSort('summary')}
                  className="pb-2.5 font-medium cursor-pointer hover:text-[#FAFAFA] transition-colors select-none group"
                  title="Click to sort by Request Summary"
                >
                  <div className="flex items-center gap-1">
                    <span className={sortField === 'summary' ? 'text-emerald-400 font-bold' : 'group-hover:text-zinc-200'}>
                      Request Summary
                    </span>
                    {sortField === 'summary' && (
                      sortDirection === 'asc' ? (
                        <ArrowUp className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <ArrowDown className="w-3.5 h-3.5 text-emerald-400" />
                      )
                    )}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#27272A]/40 font-mono text-[11px]">
              {sortedRequests.slice(0, pageSize).map((req) => (
                <tr key={req.id} className="hover:bg-[#18181B]/50 transition-colors">
                  <td className="py-2.5 text-[#71717A] whitespace-nowrap">
                    {new Date(req.timestamp).toLocaleTimeString()}
                  </td>
                  <td className="py-2.5 whitespace-nowrap">
                    <span className="text-[#FAFAFA] font-medium">{req.sourceHost || req.sourceIp}</span>
                    <span className="text-[#71717A] text-[10px] block">{req.sourceIp}</span>
                  </td>
                  <td className="py-2.5 whitespace-nowrap">
                    <span className={`px-2 py-0.5 rounded text-[10px] border font-medium ${getProtocolColor(req.requestType)}`}>
                      {req.requestType} ({req.protocol})
                    </span>
                  </td>
                  <td className="py-2.5 text-[#A1A1AA] whitespace-nowrap">
                    Port {req.port}
                  </td>
                  <td className="py-2.5 text-[#71717A] whitespace-nowrap">
                    {req.sizeBytes} B
                  </td>
                  <td className="py-2.5 text-zinc-300">
                    {req.summary}
                  </td>
                </tr>
              ))}
              {sortedRequests.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-[#71717A] italic font-sans text-xs">
                    No router requests logged for this filter ({protocolFilter}). Active traffic will appear here in real time.
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

