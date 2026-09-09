import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Trash2, AlertTriangle, X, Loader2 } from 'lucide-react';
import { Device } from '../types';

interface DeleteConfirmModalProps {
  device: Device;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
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
      console.error('Delete device record failed:', err);
      setError(err?.message || 'Failed to delete device record');
    } finally {
      setIsSubmitting(false);
    }
  };

  const modalContent = (
    <div
      id="delete-confirm-overlay"
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        id="delete-confirm-modal"
        className="bg-[#111113] border border-red-800/80 rounded-xl w-full max-w-lg p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150 text-left"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-950/80 border border-red-800 flex items-center justify-center text-red-400">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[#FAFAFA]">
                Delete Device Record
              </h3>
              <p className="text-xs text-red-400 font-mono">
                [PERMANENT RECORD REMOVAL]
              </p>
            </div>
          </div>
          <button
            type="button"
            id="close-delete-modal-btn"
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

        {/* Destruction Notice */}
        <div className="bg-red-950/25 border border-red-900/60 p-3.5 rounded-lg text-xs space-y-2 text-red-200">
          <div className="flex items-center gap-2 font-medium text-red-300">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <span>Warning: Destructive Action</span>
          </div>
          <p className="text-[11px] text-red-200/80 leading-relaxed">
            This will permanently remove this device record, its OS fingerprint history, open port analysis, and associated risk audit trail from the database.
          </p>
          <p className="text-[11px] text-zinc-400 leading-relaxed">
            If this device is currently powered on and attached to the physical subnet, it may be re-discovered as a new unverified device during future network discovery sweeps.
          </p>
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
            id="cancel-delete-record-btn"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 bg-[#18181B] hover:bg-zinc-800 text-[#FAFAFA] rounded-md border border-[#27272A] text-xs font-medium transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            id="confirm-delete-record-btn"
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-md text-xs font-medium transition-colors shadow-sm flex items-center gap-1.5 disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Deleting Record...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Record</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};
