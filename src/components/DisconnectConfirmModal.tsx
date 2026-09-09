import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { WifiOff, AlertTriangle, X, Loader2 } from 'lucide-react';
import { Device } from '../types';

interface DisconnectConfirmModalProps {
  device: Device;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export const DisconnectConfirmModal: React.FC<DisconnectConfirmModalProps> = ({
  device,
  onClose,
  onConfirm,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      await onConfirm();
      onClose();
    } catch (err: any) {
      console.error('Disconnect node failed:', err);
      setError(err?.message || 'Failed to disconnect node');
    } finally {
      setIsSubmitting(false);
    }
  };

  const modalContent = (
    <div
      id="disconnect-confirm-overlay"
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        id="disconnect-confirm-modal"
        className="bg-[#111113] border border-amber-800/80 rounded-xl w-full max-w-lg p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150 text-left"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-950/80 border border-amber-800 flex items-center justify-center text-amber-400">
              <WifiOff className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[#FAFAFA]">
                Disconnect Node
              </h3>
              <p className="text-xs text-amber-400 font-mono">
                [SUSPEND ACTIVE TELEMETRY]
              </p>
            </div>
          </div>
          <button
            type="button"
            id="close-disconnect-modal-btn"
            onClick={onClose}
            className="text-[#71717A] hover:text-[#FAFAFA] p-1 rounded-md hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Target Identity Information */}
        <div className="bg-[#18181B] p-3.5 rounded-lg border border-[#27272A] space-y-2 text-xs font-mono">
          <div className="flex justify-between">
            <span className="text-[#71717A]">Target Node:</span>
            <span className="font-semibold text-[#FAFAFA]">
              {device.customName || device.hostname || 'Unknown Host'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#71717A]">Current IP:</span>
            <span className="text-emerald-400">{device.currentIp}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#71717A]">Hardware MAC:</span>
            <span className="text-[#A1A1AA]">{device.macAddress}</span>
          </div>
          {device.vendor && (
            <div className="flex justify-between">
              <span className="text-[#71717A]">Hardware Vendor:</span>
              <span className="text-zinc-300">{device.vendor}</span>
            </div>
          )}
        </div>

        {/* Notice of Disconnection Effects */}
        <div className="bg-amber-950/20 border border-amber-900/60 p-3.5 rounded-lg text-xs space-y-2 text-amber-200">
          <div className="flex items-center gap-2 font-medium text-amber-300">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Connection State Change</span>
          </div>
          <p className="text-[11px] text-amber-200/90 leading-relaxed">
            Marking this device as disconnected will update its network state to <strong>Offline</strong> and move it to historical device records.
          </p>
          <ul className="list-disc list-inside text-[11px] text-[#A1A1AA] space-y-1">
            <li>Active socket traffic rate calculations and real-time polling will pause.</li>
            <li>Historical logs, fingerprint profiles, and security evidence remain saved.</li>
            <li>You can reconnect this device at any time from the actions menu.</li>
          </ul>
        </div>

        {error && (
          <div className="p-2.5 rounded bg-red-950/40 border border-red-800 text-red-300 text-xs">
            {error}
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            id="cancel-disconnect-node-btn"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 bg-[#18181B] hover:bg-zinc-800 text-[#FAFAFA] rounded-md border border-[#27272A] text-xs font-medium transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            id="confirm-disconnect-node-btn"
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 rounded-md text-xs font-bold transition-colors shadow-sm flex items-center gap-1.5 disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Disconnecting...</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5" />
                <span>Confirm Disconnect</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};
