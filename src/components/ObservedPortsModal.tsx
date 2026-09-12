import React, { useState, useMemo } from 'react';
import {
  X,
  Search,
  Check,
  Plus,
  Trash2,
  Filter,
  ShieldAlert,
  Server,
  Radio,
  CheckSquare,
  Square,
  RefreshCw,
  Info,
  Sparkles,
  Layers,
  Activity,
} from 'lucide-react';
import { useNetwork } from '../context/NetworkContext';
import { ObservedPortConfig } from '../types';

interface ObservedPortsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type CategoryFilter =
  | 'all'
  | 'web'
  | 'remote'
  | 'file'
  | 'database'
  | 'iot'
  | 'network'
  | 'media'
  | 'custom';

export const ObservedPortsModal: React.FC<ObservedPortsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    observedPorts,
    activeObservedPortNumbers,
    updateObservedPorts,
    addCustomObservedPort,
    removeObservedPort,
    probeObservedPorts,
    devices,
  } = useNetwork();

  // Local draft selection of port numbers
  const [selectedPortNumbers, setSelectedPortNumbers] = useState<number[]>(
    () => activeObservedPortNumbers
  );

  // Sync draft whenever active port numbers change externally
  React.useEffect(() => {
    setSelectedPortNumbers(activeObservedPortNumbers);
  }, [activeObservedPortNumbers]);

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isProbing, setIsProbing] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Custom Port Form State
  const [customPortNum, setCustomPortNum] = useState('');
  const [customServiceName, setCustomServiceName] = useState('');
  const [customProtocol, setCustomProtocol] = useState<'tcp' | 'udp' | 'both'>('tcp');
  const [customDescription, setCustomDescription] = useState('');
  const [customCategory, setCustomCategory] = useState<'custom' | 'web' | 'remote' | 'database' | 'iot' | 'file' | 'network' | 'media'>('custom');
  const [customFormError, setCustomFormError] = useState('');

  // Identify which ports are currently detected on any online device
  const detectedPortsOnNetwork = useMemo(() => {
    const set = new Set<number>();
    for (const dev of devices) {
      if (dev.openPorts) {
        for (const p of dev.openPorts) {
          if (p.state === 'open') {
            set.add(p.port);
          }
        }
      }
    }
    return set;
  }, [devices]);

  // Filtered port list
  const filteredPorts = useMemo(() => {
    return observedPorts.filter((p) => {
      // Category filter
      if (categoryFilter === 'custom' && !p.isCustom) return false;
      if (categoryFilter !== 'all' && categoryFilter !== 'custom' && p.category !== categoryFilter) {
        return false;
      }

      // Search query
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const matchPort = p.port.toString().includes(q);
      const matchService = p.service.toLowerCase().includes(q);
      const matchDesc = (p.description || '').toLowerCase().includes(q);
      const matchCat = (p.category || '').toLowerCase().includes(q);
      return matchPort || matchService || matchDesc || matchCat;
    });
  }, [observedPorts, categoryFilter, searchQuery]);

  if (!isOpen) return null;

  const handleTogglePort = (portNum: number) => {
    setSelectedPortNumbers((prev) =>
      prev.includes(portNum) ? prev.filter((p) => p !== portNum) : [...prev, portNum]
    );
  };

  const handleSelectAllVisible = () => {
    const visibleNums = filteredPorts.map((p) => p.port);
    setSelectedPortNumbers((prev) => Array.from(new Set([...prev, ...visibleNums])));
  };

  const handleDeselectAllVisible = () => {
    const visibleNums = new Set(filteredPorts.map((p) => p.port));
    setSelectedPortNumbers((prev) => prev.filter((p) => !visibleNums.has(p)));
  };

  const handleRestoreDefaults = () => {
    const defaultPorts = [22, 53, 80, 135, 139, 443, 445, 515, 548, 554, 631, 1883, 3000, 3389, 5000, 5001, 5357, 7000, 8000, 8008, 8080, 8443, 9000, 9100, 32400];
    setSelectedPortNumbers(defaultPorts);
  };

  const handleCreateCustomPort = async (e: React.FormEvent) => {
    e.preventDefault();
    setCustomFormError('');

    const portNum = parseInt(customPortNum.trim(), 10);
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      setCustomFormError('Please enter a valid port number between 1 and 65535.');
      return;
    }

    if (!customServiceName.trim()) {
      setCustomFormError('Please specify the expected service name (e.g., Home Assistant, SCADA, Custom API).');
      return;
    }

    try {
      const created = await addCustomObservedPort({
        port: portNum,
        service: customServiceName.trim(),
        protocol: customProtocol,
        description: customDescription.trim() || undefined,
        category: customCategory,
      });

      // Automatically add to local selected ports
      if (!selectedPortNumbers.includes(created.port)) {
        setSelectedPortNumbers((prev) => [...prev, created.port]);
      }

      // Reset form
      setCustomPortNum('');
      setCustomServiceName('');
      setCustomDescription('');
      setShowCustomForm(false);
      setFeedbackMsg({
        type: 'success',
        text: `Custom Port ${created.port} (${created.service}) created and added to observation list!`,
      });
      setTimeout(() => setFeedbackMsg(null), 4000);
    } catch (err: any) {
      setCustomFormError(err.message || 'Failed to add custom port');
    }
  };

  const handleDeleteCustomPort = async (e: React.MouseEvent, portNum: number) => {
    e.stopPropagation();
    try {
      await removeObservedPort(portNum);
      setSelectedPortNumbers((prev) => prev.filter((p) => p !== portNum));
      setFeedbackMsg({
        type: 'success',
        text: `Custom port ${portNum} removed.`,
      });
      setTimeout(() => setFeedbackMsg(null), 3000);
    } catch (err: any) {
      setFeedbackMsg({
        type: 'error',
        text: err.message || `Failed to remove port ${portNum}`,
      });
    }
  };

  const handleApplyAndScan = async () => {
    setIsSaving(true);
    setFeedbackMsg(null);
    try {
      // 1. Save active observed ports
      await updateObservedPorts(selectedPortNumbers);

      // 2. Trigger probe scan across all online devices
      setIsProbing(true);
      await probeObservedPorts();

      setFeedbackMsg({
        type: 'success',
        text: `Saved ${selectedPortNumbers.length} observed ports and completed scan across online hosts.`,
      });
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      setFeedbackMsg({
        type: 'error',
        text: err.message || 'Failed to save or probe observed ports',
      });
    } finally {
      setIsSaving(false);
      setIsProbing(false);
    }
  };

  const handleSaveOnly = async () => {
    setIsSaving(true);
    setFeedbackMsg(null);
    try {
      await updateObservedPorts(selectedPortNumbers);
      setFeedbackMsg({
        type: 'success',
        text: `Updated ${selectedPortNumbers.length} observed ports configuration.`,
      });
      setTimeout(() => {
        onClose();
      }, 800);
    } catch (err: any) {
      setFeedbackMsg({
        type: 'error',
        text: err.message || 'Failed to save observed ports',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const customPortsCount = observedPorts.filter((p) => p.isCustom).length;
  const activeCount = selectedPortNumbers.length;

  return (
    <div
      id="observed-ports-modal-overlay"
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150"
    >
      <div
        id="observed-ports-modal-content"
        className="bg-[#121215] border border-[#27272A] rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#27272A] bg-[#18181B]/80">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-[#FAFAFA]">
                  Configure Observed Ports & Expected Services
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  {activeCount} Active
                </span>
                {customPortsCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-medium bg-purple-500/15 text-purple-400 border border-purple-500/30">
                    {customPortsCount} Custom
                  </span>
                )}
              </div>
              <p className="text-xs text-[#A1A1AA] mt-0.5">
                Select common ports and services to monitor, or add non-standard ports to inspect during discovery scans and traffic monitoring.
              </p>
            </div>
          </div>

          <button
            id="close-observed-ports-modal-btn"
            onClick={onClose}
            className="p-1.5 text-[#71717A] hover:text-[#FAFAFA] hover:bg-[#27272A] rounded-lg transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback Banner */}
        {feedbackMsg && (
          <div
            className={`px-6 py-2.5 text-xs font-medium flex items-center justify-between border-b ${
              feedbackMsg.type === 'success'
                ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800/40'
                : 'bg-rose-950/40 text-rose-300 border-rose-800/40'
            }`}
          >
            <span>{feedbackMsg.text}</span>
            <button
              onClick={() => setFeedbackMsg(null)}
              className="text-xs opacity-70 hover:opacity-100"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Search, Action Controls & Category Tabs */}
        <div className="p-4 border-b border-[#27272A] bg-[#141417] space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-[#71717A] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="search-observed-ports-input"
                type="text"
                placeholder="Search ports (e.g. 443, 8080), service names (SSH, RTSP), or protocols..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-1.5 bg-[#18181B] border border-[#27272A] rounded-lg text-xs text-[#FAFAFA] placeholder-[#71717A] focus:outline-none focus:border-emerald-500 transition-colors font-mono"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#71717A] hover:text-[#FAFAFA]"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Quick Bulk Selection Buttons & Add Custom Trigger */}
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              <button
                id="select-all-visible-ports-btn"
                type="button"
                onClick={handleSelectAllVisible}
                className="px-2.5 py-1.5 bg-[#1F1F23] hover:bg-[#27272A] border border-[#27272A] text-[#D4D4D8] hover:text-[#FAFAFA] rounded-md text-xs font-medium transition-colors flex items-center gap-1.5"
              >
                <CheckSquare className="w-3.5 h-3.5 text-emerald-400" />
                <span>Select All</span>
              </button>

              <button
                id="deselect-all-visible-ports-btn"
                type="button"
                onClick={handleDeselectAllVisible}
                className="px-2.5 py-1.5 bg-[#1F1F23] hover:bg-[#27272A] border border-[#27272A] text-[#A1A1AA] hover:text-[#FAFAFA] rounded-md text-xs font-medium transition-colors flex items-center gap-1.5"
              >
                <Square className="w-3.5 h-3.5 text-[#71717A]" />
                <span>Deselect All</span>
              </button>

              <button
                id="restore-defaults-ports-btn"
                type="button"
                onClick={handleRestoreDefaults}
                className="px-2.5 py-1.5 bg-[#1F1F23] hover:bg-[#27272A] border border-[#27272A] text-[#A1A1AA] hover:text-[#FAFAFA] rounded-md text-xs font-medium transition-colors flex items-center gap-1.5"
                title="Reset to recommended signature ports"
              >
                <RefreshCw className="w-3.5 h-3.5 text-[#71717A]" />
                <span>Defaults</span>
              </button>

              <button
                id="toggle-custom-port-form-btn"
                type="button"
                onClick={() => setShowCustomForm(!showCustomForm)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 border ${
                  showCustomForm
                    ? 'bg-purple-600/20 text-purple-300 border-purple-500/40'
                    : 'bg-purple-600/10 hover:bg-purple-600/20 text-purple-400 border-purple-500/30'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Custom Port</span>
              </button>
            </div>
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
            <span className="text-[11px] text-[#71717A] uppercase font-mono mr-1 flex items-center gap-1">
              <Filter className="w-3 h-3" /> Filter:
            </span>
            {(
              [
                { id: 'all', label: 'All Ports' },
                { id: 'web', label: 'Web & Proxies' },
                { id: 'remote', label: 'Remote Access' },
                { id: 'file', label: 'File Sharing' },
                { id: 'database', label: 'Databases' },
                { id: 'iot', label: 'IoT & Smart Home' },
                { id: 'network', label: 'Core Network' },
                { id: 'media', label: 'Streaming & Media' },
                { id: 'custom', label: `Custom (${customPortsCount})` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                id={`filter-category-${tab.id}-btn`}
                type="button"
                onClick={() => setCategoryFilter(tab.id)}
                className={`px-2.5 py-1 rounded-full text-xs whitespace-nowrap transition-colors border font-medium ${
                  categoryFilter === tab.id
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-[#18181B] text-[#A1A1AA] border-[#27272A] hover:border-[#3F3F46] hover:text-[#FAFAFA]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Expandable Custom Port Creator Form */}
        {showCustomForm && (
          <div className="p-4 bg-[#18181B] border-b border-purple-500/20 animate-in slide-in-from-top-2 duration-150">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-400" />
                <h3 className="text-xs font-semibold text-[#FAFAFA]">
                  Create Non-Standard / Custom Monitored Port
                </h3>
              </div>
              <span className="text-[11px] text-[#A1A1AA]">
                Define proprietary, IoT, or internal service ports to observe
              </span>
            </div>

            <form onSubmit={handleCreateCustomPort} className="space-y-3">
              {customFormError && (
                <div className="p-2 bg-rose-950/50 border border-rose-800 text-rose-300 text-xs rounded-md">
                  {customFormError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                {/* Port Number */}
                <div>
                  <label className="block text-[11px] font-mono text-[#A1A1AA] mb-1">
                    Port Number *
                  </label>
                  <input
                    id="custom-port-number-input"
                    type="number"
                    min="1"
                    max="65535"
                    placeholder="e.g. 8123"
                    value={customPortNum}
                    onChange={(e) => setCustomPortNum(e.target.value)}
                    className="w-full px-3 py-1.5 bg-[#121215] border border-[#27272A] rounded-lg text-xs text-[#FAFAFA] font-mono focus:outline-none focus:border-purple-500"
                    required
                  />
                </div>

                {/* Service Name */}
                <div>
                  <label className="block text-[11px] font-mono text-[#A1A1AA] mb-1">
                    Expected Service Name *
                  </label>
                  <input
                    id="custom-service-name-input"
                    type="text"
                    placeholder="e.g. Home Assistant / Scada"
                    value={customServiceName}
                    onChange={(e) => setCustomServiceName(e.target.value)}
                    className="w-full px-3 py-1.5 bg-[#121215] border border-[#27272A] rounded-lg text-xs text-[#FAFAFA] focus:outline-none focus:border-purple-500"
                    required
                  />
                </div>

                {/* Protocol */}
                <div>
                  <label className="block text-[11px] font-mono text-[#A1A1AA] mb-1">
                    Protocol
                  </label>
                  <select
                    id="custom-protocol-select"
                    value={customProtocol}
                    onChange={(e) => setCustomProtocol(e.target.value as any)}
                    className="w-full px-3 py-1.5 bg-[#121215] border border-[#27272A] rounded-lg text-xs text-[#FAFAFA] focus:outline-none focus:border-purple-500 font-mono"
                  >
                    <option value="tcp">TCP (Connection-oriented)</option>
                    <option value="udp">UDP (Datagram)</option>
                    <option value="both">Both (TCP & UDP)</option>
                  </select>
                </div>

                {/* Category */}
                <div>
                  <label className="block text-[11px] font-mono text-[#A1A1AA] mb-1">
                    Category
                  </label>
                  <select
                    id="custom-category-select"
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value as any)}
                    className="w-full px-3 py-1.5 bg-[#121215] border border-[#27272A] rounded-lg text-xs text-[#FAFAFA] focus:outline-none focus:border-purple-500"
                  >
                    <option value="custom">Custom / Internal</option>
                    <option value="web">Web Application</option>
                    <option value="remote">Remote Access</option>
                    <option value="iot">Smart Home / IoT</option>
                    <option value="database">Database</option>
                    <option value="file">File Sharing</option>
                    <option value="network">Core Network</option>
                    <option value="media">Streaming / Media</option>
                  </select>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-[11px] font-mono text-[#A1A1AA] mb-1">
                  Description / Service Details (Optional)
                </label>
                <input
                  id="custom-description-input"
                  type="text"
                  placeholder="e.g. Local home automation hub, internal microservice, or proprietary controller"
                  value={customDescription}
                  onChange={(e) => setCustomDescription(e.target.value)}
                  className="w-full px-3 py-1.5 bg-[#121215] border border-[#27272A] rounded-lg text-xs text-[#FAFAFA] focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowCustomForm(false)}
                  className="px-3 py-1.5 text-xs text-[#A1A1AA] hover:text-[#FAFAFA] rounded-md transition-colors"
                >
                  Cancel
                </button>
                <button
                  id="submit-custom-port-btn"
                  type="submit"
                  className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Port to Observation Set</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Scrollable Ports Multi-Select List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 max-h-[460px]">
          {filteredPorts.length === 0 ? (
            <div className="py-12 text-center text-[#71717A]">
              <Server className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm font-medium text-[#A1A1AA]">No ports found</p>
              <p className="text-xs mt-1">
                No observed ports match "{searchQuery}" in this category.
              </p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setCategoryFilter('all');
                }}
                className="mt-3 text-xs text-emerald-400 hover:underline"
              >
                Reset filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {filteredPorts.map((portItem) => {
                const isChecked = selectedPortNumbers.includes(portItem.port);
                const isDetected = detectedPortsOnNetwork.has(portItem.port);

                return (
                  <div
                    key={portItem.port}
                    id={`port-row-${portItem.port}`}
                    onClick={() => handleTogglePort(portItem.port)}
                    className={`flex items-start gap-3 p-3 rounded-lg border transition-all cursor-pointer select-none ${
                      isChecked
                        ? 'bg-[#18181B] border-emerald-500/40 hover:border-emerald-500/60'
                        : 'bg-[#121215] border-[#27272A] opacity-75 hover:opacity-100 hover:border-[#3F3F46]'
                    }`}
                  >
                    {/* Checkbox */}
                    <div className="pt-0.5">
                      <div
                        className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                          isChecked
                            ? 'bg-emerald-500 border-emerald-400 text-black'
                            : 'border-[#3F3F46] bg-[#1F1F23]'
                        }`}
                      >
                        {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                    </div>

                    {/* Port & Service Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Port Number Pill */}
                        <span className="font-mono text-xs font-bold text-[#FAFAFA] bg-[#27272A] px-2 py-0.5 rounded border border-[#3F3F46]">
                          Port {portItem.port}
                        </span>

                        {/* Service Name */}
                        <span className="text-xs font-semibold text-emerald-400">
                          {portItem.service}
                        </span>

                        {/* Protocol */}
                        <span className="font-mono text-[10px] text-[#A1A1AA] uppercase bg-[#18181B] px-1.5 py-0.5 rounded border border-[#27272A]">
                          {portItem.protocol || 'tcp'}
                        </span>

                        {/* Category Tag */}
                        {portItem.category && (
                          <span className="text-[10px] text-[#71717A] capitalize">
                            • {portItem.category}
                          </span>
                        )}

                        {/* Custom Badge */}
                        {portItem.isCustom && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                            CUSTOM
                          </span>
                        )}

                        {/* Currently Live Detected Badge */}
                        {isDetected && (
                          <span
                            className="px-1.5 py-0.2 rounded text-[10px] font-medium bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 flex items-center gap-1"
                            title="This port is currently responding on an active device on your local subnet!"
                          >
                            <Activity className="w-2.5 h-2.5" />
                            Live on Network
                          </span>
                        )}
                      </div>

                      {/* Description / What service should run here */}
                      <p className="text-[11px] text-[#A1A1AA] mt-1 leading-snug line-clamp-2">
                        {portItem.description || `Monitored service traffic on port ${portItem.port}`}
                      </p>
                    </div>

                    {/* Delete button if custom port */}
                    {portItem.isCustom && (
                      <button
                        type="button"
                        onClick={(e) => handleDeleteCustomPort(e, portItem.port)}
                        className="p-1 text-[#71717A] hover:text-rose-400 hover:bg-rose-950/30 rounded transition-colors"
                        title="Delete custom port definition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-4 border-t border-[#27272A] bg-[#18181B]">
          <div className="flex items-center gap-2 text-xs text-[#A1A1AA]">
            <Layers className="w-4 h-4 text-emerald-400" />
            <span>
              <strong className="text-[#FAFAFA] font-mono">{selectedPortNumbers.length}</strong> ports will be inspected during subnet sweeps and passive monitoring
            </span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              id="cancel-observed-ports-btn"
              type="button"
              onClick={onClose}
              disabled={isSaving || isProbing}
              className="px-3.5 py-2 text-xs font-medium text-[#A1A1AA] hover:text-[#FAFAFA] hover:bg-[#27272A] rounded-lg transition-colors"
            >
              Cancel
            </button>

            <button
              id="save-observed-ports-only-btn"
              type="button"
              onClick={handleSaveOnly}
              disabled={isSaving || isProbing}
              className="px-3.5 py-2 bg-[#1F1F23] hover:bg-[#27272A] border border-[#27272A] text-[#FAFAFA] rounded-lg text-xs font-medium transition-colors"
            >
              Save Configuration
            </button>

            <button
              id="apply-and-scan-observed-ports-btn"
              type="button"
              onClick={handleApplyAndScan}
              disabled={isSaving || isProbing}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800/40 text-black font-semibold rounded-lg text-xs transition-colors flex items-center gap-2 shadow-sm"
            >
              {isProbing ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Probing Subnet Devices...</span>
                </>
              ) : isSaving ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Radio className="w-3.5 h-3.5" />
                  <span>Save & Scan Subnet Now</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
