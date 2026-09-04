import React, { useState, useMemo } from 'react';
import {
  Activity,
  Search,
  Trash2,
  Pause,
  Play,
  ChevronDown,
  ChevronRight,
  Terminal,
  ShieldCheck,
  AlertCircle,
  Copy,
  Check,
  Radio,
  ExternalLink,
} from 'lucide-react';
import { useNetwork } from '../context/NetworkContext';
import { formatTimeAgo } from '../utils/formatters';

export const EventsView: React.FC = () => {
  const { events, clearEvents, status, setSelectedDevice, devices } = useNetwork();
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [isPaused, setIsPaused] = useState(false);
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Filter events
  const filteredEvents = useMemo(() => {
    return events.filter((evt) => {
      const matchesSearch =
        searchQuery === '' ||
        evt.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        evt.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (evt.deviceIp && evt.deviceIp.includes(searchQuery)) ||
        (evt.deviceName && evt.deviceName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        JSON.stringify(evt.evidence || {}).toLowerCase().includes(searchQuery.toLowerCase());

      const matchesSeverity = severityFilter === 'all' || evt.severity === severityFilter;
      const matchesType =
        typeFilter === 'all' ||
        evt.type === typeFilter ||
        (typeFilter === 'monitoring' && evt.type === 'monitoring_event') ||
        (typeFilter === 'anomalies' && ['dns_anomaly', 'port_scan', 'traffic_anomaly', 'risk_changed'].includes(evt.type));

      return matchesSearch && matchesSeverity && matchesType;
    });
  }, [events, searchQuery, severityFilter, typeFilter]);

  const toggleExpand = (id: string) => {
    setExpandedEventId((prev) => (prev === id ? null : id));
  };

  const handleClearHistory = async () => {
    try {
      setIsClearing(true);
      await clearEvents();
      setShowClearConfirm(false);
    } catch (err) {
      console.error('Failed to clear event history:', err);
    } finally {
      setIsClearing(false);
    }
  };

  const handleCopyEvidence = (id: string, evidence: any) => {
    try {
      navigator.clipboard.writeText(JSON.stringify(evidence, null, 2));
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {}
  };

  const handleDeviceClick = (ipOrId?: string) => {
    if (!ipOrId) return;
    const dev = devices.find((d) => d.id === ipOrId || d.currentIp === ipOrId);
    if (dev) {
      setSelectedDevice(dev);
    }
  };

  return (
    <div id="events-view" className="p-6 space-y-5 max-w-7xl mx-auto">
      {/* Top Status & Action Bar */}
      <div className="bg-[#111113] border border-[#27272A] rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <h2 className="text-sm font-semibold text-[#FAFAFA] flex items-center gap-2">
              <span>Monitor Mode Event Log</span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 font-normal">
                {events.length} {events.length === 1 ? 'event' : 'events'} recorded
              </span>
            </h2>
          </div>
          <p className="text-xs text-[#71717A] mt-1">
            Real-time telemetry stream, DNS resolutions, ARP heartbeats, and heuristic anomalies captured on {status?.subnet || '192.168.1.0/24'}.
          </p>
        </div>

        {/* Global Event Action Controls */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            id="pause-events-stream-btn"
            onClick={() => setIsPaused(!isPaused)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
              isPaused
                ? 'bg-amber-950/50 border-amber-800 text-amber-300 hover:bg-amber-900/50'
                : 'bg-[#18181B] border-[#27272A] text-[#FAFAFA] hover:bg-zinc-800'
            }`}
          >
            {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
            <span>{isPaused ? 'Resume Stream' : 'Pause'}</span>
          </button>

          {/* Clear History Button */}
          <button
            id="clear-events-history-btn"
            onClick={() => setShowClearConfirm(true)}
            disabled={events.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-red-950/30 hover:bg-red-950/60 border border-red-800/60 text-red-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title="Clear all recorded event history"
          >
            <Trash2 className="w-3.5 h-3.5 text-red-400" />
            <span>Clear History</span>
          </button>
        </div>
      </div>

      {/* Clear Confirmation Modal / Banner */}
      {showClearConfirm && (
        <div
          id="clear-events-confirm-dialog"
          className="p-4 rounded-xl bg-red-950/30 border border-red-800/70 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in duration-200"
        >
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
            <div>
              <h4 className="text-xs font-semibold text-red-200">Clear all event history?</h4>
              <p className="text-[11px] text-red-300/80">
                This will purge all {events.length} recorded telemetry and anomaly events. Active monitor mode will continue capturing new incoming events.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
            <button
              onClick={() => setShowClearConfirm(false)}
              disabled={isClearing}
              className="px-3 py-1 text-xs rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
            >
              Cancel
            </button>
            <button
              id="confirm-clear-events-btn"
              onClick={handleClearHistory}
              disabled={isClearing}
              className="px-3 py-1 text-xs rounded bg-red-600 hover:bg-red-500 text-white font-medium transition-colors flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{isClearing ? 'Clearing...' : 'Yes, Clear All'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-[#111113] p-3.5 rounded-xl border border-[#27272A]">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#71717A] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            id="events-search-input"
            type="text"
            placeholder="Search by IP, hostname, title, protocol, or raw evidence..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#18181B] border border-[#27272A] rounded-md pl-9 pr-4 py-2 text-xs text-[#FAFAFA] placeholder:text-[#71717A] focus:outline-none focus:border-zinc-500 font-mono"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2.5">
          <select
            id="events-severity-filter"
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="bg-[#18181B] border border-[#27272A] text-xs text-[#FAFAFA] rounded-md px-2.5 py-2 focus:outline-none focus:border-zinc-500"
          >
            <option value="all">All Severities</option>
            <option value="critical">Critical</option>
            <option value="suspicious">Suspicious</option>
            <option value="watch">Watch</option>
            <option value="info">Info</option>
          </select>

          <select
            id="events-type-filter"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-[#18181B] border border-[#27272A] text-xs text-[#FAFAFA] rounded-md px-2.5 py-2 focus:outline-none focus:border-zinc-500"
          >
            <option value="all">All Event Types</option>
            <option value="monitoring">Monitor Telemetry (DNS/ARP/mDNS)</option>
            <option value="anomalies">Anomalies & Threats</option>
            <option value="device_discovered">Device Discovered</option>
            <option value="os_fingerprinted">OS Fingerprinted</option>
            <option value="port_scan">Port Scan</option>
            <option value="dns_anomaly">DNS Anomaly</option>
            <option value="traffic_anomaly">Traffic Anomaly</option>
            <option value="response">Defensive Response</option>
          </select>
        </div>
      </div>

      {/* Events List Container */}
      <div className="bg-[#111113] border border-[#27272A] rounded-xl overflow-hidden shadow-sm">
        <div className="p-3.5 border-b border-[#27272A] bg-[#18181B] flex items-center justify-between text-xs text-[#71717A]">
          <span>
            Displaying <strong className="text-[#FAFAFA]">{filteredEvents.length}</strong> of{' '}
            <strong className="text-[#FAFAFA]">{events.length}</strong> events
          </span>
          <span className="font-mono text-[11px] flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span>Passive Collector Ingestion</span>
          </span>
        </div>

        <div className="divide-y divide-[#27272A]">
          {filteredEvents.length === 0 ? (
            <div className="p-12 text-center text-[#71717A] text-xs space-y-3">
              <ShieldCheck className="w-10 h-10 text-zinc-600 mx-auto" />
              <div className="text-sm font-medium text-zinc-300">
                {events.length === 0 ? 'Event history is empty' : 'No matching events found'}
              </div>
              <p className="max-w-md mx-auto text-[11px] text-zinc-500">
                {events.length === 0
                  ? 'All prior events have been cleared. During Monitor Mode, real-time packet activity, DNS lookups, and ARP heartbeats will automatically stream here.'
                  : 'Try clearing your search query or setting filters back to "All Severities" and "All Event Types".'}
              </p>
            </div>
          ) : (
            filteredEvents.map((evt) => {
              const isExpanded = expandedEventId === evt.id;
              const isCrit = evt.severity === 'critical';
              const isSusp = evt.severity === 'suspicious';
              const isWatch = evt.severity === 'watch';

              return (
                <div
                  key={evt.id}
                  id={`event-row-${evt.id}`}
                  className={`p-4 transition-colors hover:bg-[#18181B]/60 ${
                    isExpanded ? 'bg-[#18181B]/40' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="mt-1 shrink-0">
                        <span
                          className={`w-2.5 h-2.5 rounded-full block ${
                            isCrit
                              ? 'bg-red-500 ring-4 ring-red-950'
                              : isSusp
                              ? 'bg-amber-500 ring-4 ring-amber-950'
                              : isWatch
                              ? 'bg-yellow-500 ring-4 ring-yellow-950'
                              : 'bg-emerald-500 ring-4 ring-emerald-950'
                          }`}
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-xs font-semibold text-[#FAFAFA]">{evt.title}</h4>
                          <span
                            className={`text-[9px] font-mono uppercase px-1.5 py-0.2 rounded border ${
                              isCrit
                                ? 'bg-red-950 text-red-300 border-red-800'
                                : isSusp
                                ? 'bg-amber-950 text-amber-300 border-amber-800'
                                : isWatch
                                ? 'bg-yellow-950 text-yellow-300 border-yellow-800'
                                : 'bg-emerald-950 text-emerald-300 border-emerald-800'
                            }`}
                          >
                            {evt.severity}
                          </span>
                          <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400 border border-zinc-700/50">
                            {evt.type}
                          </span>
                          {evt.simulated && (
                            <span className="text-[9px] font-mono uppercase px-1.5 py-0.2 rounded bg-purple-950/60 text-purple-300 border border-purple-800/60">
                              SIMULATED
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-[#A1A1AA] mt-1.5">{evt.description}</p>

                        {/* Associated Device & Link Meta */}
                        <div className="flex flex-wrap items-center gap-3 mt-2 text-[11px] text-[#71717A] font-mono">
                          {evt.deviceIp && (
                            <button
                              onClick={() => handleDeviceClick(evt.deviceIp)}
                              className="hover:text-emerald-400 underline decoration-zinc-700 underline-offset-2 flex items-center gap-1 transition-colors"
                              title="Click to view device details"
                            >
                              <span>IP: {evt.deviceIp}</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </button>
                          )}
                          {evt.deviceName && (
                            <button
                              onClick={() => handleDeviceClick(evt.deviceId || evt.deviceIp)}
                              className="hover:text-emerald-400 underline decoration-zinc-700 underline-offset-2 transition-colors"
                              title="Click to view device details"
                            >
                              Host: {evt.deviceName}
                            </button>
                          )}
                          {(evt.evidence as any)?.protocol && (
                            <span className="px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-300 text-[10px]">
                              {(evt.evidence as any).protocol}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-[11px] text-[#71717A] font-mono" title={new Date(evt.timestamp).toLocaleString()}>
                        {formatTimeAgo(evt.timestamp)}
                      </span>
                      <button
                        onClick={() => toggleExpand(evt.id)}
                        className="p-1 rounded hover:bg-zinc-800 text-[#71717A] hover:text-[#FAFAFA] transition-colors"
                        title={isExpanded ? 'Collapse Payload' : 'Inspect Evidence Payload'}
                      >
                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Expandable Technical Evidence Inspector */}
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-[#27272A] bg-[#09090B] p-3 rounded-lg font-mono text-[11px] text-[#A1A1AA]">
                      <div className="flex items-center justify-between text-[#71717A] mb-2 font-semibold">
                        <div className="flex items-center gap-1.5">
                          <Terminal className="w-3.5 h-3.5 text-zinc-400" />
                          <span>Event Evidence & Raw Attributes</span>
                        </div>
                        <button
                          onClick={() => handleCopyEvidence(evt.id, evt.evidence)}
                          className="flex items-center gap-1 text-[10px] text-zinc-400 hover:text-zinc-200 px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 transition-colors"
                        >
                          {copiedId === evt.id ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span className="text-emerald-400">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copy JSON</span>
                            </>
                          )}
                        </button>
                      </div>
                      <pre className="overflow-x-auto text-emerald-400/95 bg-[#0d0d10] p-2.5 rounded border border-[#222226]">
                        {JSON.stringify(evt.evidence, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
