import React, { useState, useMemo } from 'react';
import {
  Activity,
  Search,
  Filter,
  Pause,
  Play,
  ChevronDown,
  ChevronRight,
  ShieldAlert,
  Radio,
  Clock,
  Terminal,
} from 'lucide-react';
import { useNetwork } from '../context/NetworkContext';
import { NetworkEvent } from '../types';
import { formatTimeAgo } from '../utils/formatters';

export const ActivityView: React.FC = () => {
  const { events } = useNetwork();
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [isPaused, setIsPaused] = useState(false);
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);

  // Filter events
  const filteredEvents = useMemo(() => {
    return events.filter((evt) => {
      const matchesSearch =
        searchQuery === '' ||
        evt.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        evt.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (evt.deviceIp && evt.deviceIp.includes(searchQuery)) ||
        (evt.deviceName && evt.deviceName.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesSeverity = severityFilter === 'all' || evt.severity === severityFilter;
      const matchesType = typeFilter === 'all' || evt.type === typeFilter;

      return matchesSearch && matchesSeverity && matchesType;
    });
  }, [events, searchQuery, severityFilter, typeFilter]);

  const toggleExpand = (id: string) => {
    setExpandedEventId((prev) => (prev === id ? null : id));
  };

  return (
    <div id="activity-view" className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-[#111113] p-4 rounded-lg border border-[#27272A]">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#71717A] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            id="activity-search-input"
            type="text"
            placeholder="Search activity audit logs by IP, host, title, or evidence..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#18181B] border border-[#27272A] rounded-md pl-9 pr-4 py-2 text-xs text-[#FAFAFA] placeholder:text-[#71717A] focus:outline-none focus:border-zinc-500 font-mono"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2.5">
          <select
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
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-[#18181B] border border-[#27272A] text-xs text-[#FAFAFA] rounded-md px-2.5 py-2 focus:outline-none focus:border-zinc-500"
          >
            <option value="all">All Event Types</option>
            <option value="device_discovered">Device Discovered</option>
            <option value="port_scan">Port Scan</option>
            <option value="dns_anomaly">DNS Anomaly</option>
            <option value="traffic_anomaly">Traffic Anomaly</option>
            <option value="ip_changed">IP Changed</option>
            <option value="response">Defensive Response</option>
          </select>

          <button
            onClick={() => setIsPaused(!isPaused)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium border transition-colors ${
              isPaused
                ? 'bg-amber-950/50 border-amber-800 text-amber-300'
                : 'bg-[#18181B] border-[#27272A] text-[#FAFAFA] hover:bg-zinc-800'
            }`}
          >
            {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
            <span>{isPaused ? 'Resume Stream' : 'Pause Stream'}</span>
          </button>
        </div>
      </div>

      {/* Events List */}
      <div className="bg-[#111113] border border-[#27272A] rounded-lg overflow-hidden">
        <div className="p-3.5 border-b border-[#27272A] bg-[#18181B] flex items-center justify-between text-xs text-[#71717A]">
          <span>
            Observing <strong className="text-[#FAFAFA]">{filteredEvents.length}</strong> recorded audit events
          </span>
          <span className="font-mono text-[11px]">Real-Time Syslog & Packet Telemetry</span>
        </div>

        <div className="divide-y divide-[#27272A]">
          {filteredEvents.length === 0 ? (
            <div className="p-12 text-center text-[#71717A] text-xs">
              No network events match the current filter criteria.
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
                  className={`p-4 transition-colors hover:bg-[#18181B]/60 ${
                    isExpanded ? 'bg-[#18181B]/40' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-1">
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

                      <div>
                        <div className="flex items-center gap-2">
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
                          {evt.simulated && (
                            <span className="text-[9px] font-mono uppercase px-1 py-0.2 rounded bg-amber-950 text-amber-300 border border-amber-800">
                              SIMULATED
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-[#A1A1AA] mt-1">{evt.description}</p>

                        <div className="flex items-center gap-3 mt-2 text-[11px] text-[#71717A] font-mono">
                          {evt.deviceIp && <span>IP: {evt.deviceIp}</span>}
                          {evt.deviceName && <span>Host: {evt.deviceName}</span>}
                          <span>Type: {evt.type}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-[11px] text-[#71717A] font-mono">
                        {formatTimeAgo(evt.timestamp)}
                      </span>
                      <button
                        onClick={() => toggleExpand(evt.id)}
                        className="p-1 rounded hover:bg-zinc-800 text-[#71717A] hover:text-[#FAFAFA] transition-colors"
                        title="Inspect Evidence Payload"
                      >
                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Expandable Technical Evidence Inspector */}
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-[#27272A] bg-[#09090B] p-3 rounded-md font-mono text-[11px] text-[#A1A1AA]">
                      <div className="flex items-center gap-1.5 text-[#71717A] mb-2 font-semibold">
                        <Terminal className="w-3.5 h-3.5" />
                        <span>Evidence Metadata & Raw Attributes</span>
                      </div>
                      <pre className="overflow-x-auto text-emerald-400">
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
