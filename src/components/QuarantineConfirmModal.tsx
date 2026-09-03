import React, { useState } from 'react';
import { AlertTriangle, ShieldAlert, X, Lock } from 'lucide-react';
import { Device } from '../types';
import { useNetwork } from '../context/NetworkContext';

interface QuarantineConfirmModalProps {
  device: Device;
  onClose: () => void;
}

export const QuarantineConfirmModal: React.FC<QuarantineConfirmModalProps> = ({ device, onClose }) => {
  const { triggerQuarantine } = useNetwork();
  const [reason, setReason] = useState('Suspicious anomaly detected deviating from baseline model');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      await triggerQuarantine(device.id, reason);
      onClose();
    } catch (err) {
      console.error('Quarantine failed:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      id="quarantine-confirm-overlay"
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        id="quarantine-confirm-modal"
        className="bg-[#111113] border border-red-800/80 rounded-xl w-full max-w-lg p-6 shadow-2xl space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-950/80 border border-red-800 flex items-center justify-center text-red-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[#FAFAFA]">
                Confirm Defensive Quarantine
              </h3>
              <p className="text-xs text-red-400 font-mono">
                [SIMULATED ISOLATION ADAPTER]
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-[#71717A] hover:text-[#FAFAFA]">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Target Identity Information */}
        <div className="bg-[#18181B] p-3.5 rounded-lg border border-[#27272A] space-y-2 text-xs font-mono">
          <div className="flex justify-between">
            <span className="text-[#71717A]">Target Node:</span>
            <span className="font-semibold text-[#FAFAFA]">{device.hostname}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#71717A]">Current IP:</span>
            <span className="text-emerald-400">{device.currentIp}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#71717A]">Hardware MAC:</span>
            <span className="text-[#A1A1AA]">{device.macAddress}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#71717A]">Risk Level:</span>
            <span className="text-red-400 font-bold">{device.riskScore}/100 ({device.riskSeverity})</span>
          </div>
        </div>

        {/* Isolation Consequences Notice */}
        <div className="bg-red-950/20 border border-red-900/50 p-3.5 rounded-lg text-xs space-y-1 text-red-200">
          <p className="font-medium text-red-300">Consequences of Quarantine:</p>
          <ul className="list-disc list-inside text-[11px] text-[#A1A1AA] space-y-0.5">
            <li>Simulated ARP isolation / Gateway ACL filter drop applied.</li>
            <li>Inbound and outbound subnet routing suspended for this MAC.</li>
            <li>Status logged permanently in the local security audit trail.</li>
          </ul>
        </div>

        {/* Reason Input */}
        <div>
          <label className="text-xs font-medium text-[#FAFAFA] block mb-1.5">
            Administrative Justification / Reason
          </label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full bg-[#18181B] border border-[#27272A] rounded-md px-3 py-2 text-xs text-[#FAFAFA] focus:outline-none focus:border-red-500"
          />
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#18181B] hover:bg-zinc-800 text-[#FAFAFA] rounded-md border border-[#27272A] text-xs font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-md text-xs font-medium transition-colors shadow-sm flex items-center gap-1.5"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>{isSubmitting ? 'Isolating...' : 'Confirm Quarantine'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
