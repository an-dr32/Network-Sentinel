import React, { useState, useRef, useEffect } from 'react';
import {
  MoreVertical,
  Eye,
  Pencil,
  Fingerprint,
  Wifi,
  WifiOff,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Loader2,
} from 'lucide-react';
import { Device } from '../types';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { DisconnectConfirmModal } from './DisconnectConfirmModal';

interface DeviceActionsDropdownProps {
  device: Device;
  onInspect: () => void;
  onStartRename?: () => void;
  onFingerprint: () => Promise<void>;
  isFingerprinting?: boolean;
  onToggleStatus: () => Promise<void>;
  onQuarantine: () => void;
  onRestore: () => Promise<void>;
  onDelete?: () => Promise<void>;
  align?: 'left' | 'right';
  variant?: 'icon' | 'labeled';
}

export const DeviceActionsDropdown: React.FC<DeviceActionsDropdownProps> = ({
  device,
  onInspect,
  onStartRename,
  onFingerprint,
  isFingerprinting = false,
  onToggleStatus,
  onQuarantine,
  onRestore,
  onDelete,
  align = 'right',
  variant = 'icon',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [openUpwards, setOpenUpwards] = useState(false);
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isOnline = device.status === 'online';
  const isQuarantined = device.quarantined;

  const toggleMenu = () => {
    if (!isOpen && dropdownRef.current) {
      const rect = dropdownRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      setOpenUpwards(spaceBelow < 260);
    }
    setIsOpen((prev) => !prev);
  };

  // Handle outside click & escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleAction = (action: () => void) => {
    action();
    setIsOpen(false);
  };

  const handleStatusToggle = async () => {
    setIsTogglingStatus(true);
    try {
      await onToggleStatus();
    } finally {
      setIsTogglingStatus(false);
      setIsOpen(false);
    }
  };

  const handleDeleteExecute = async () => {
    if (!onDelete) return;
    await onDelete();
  };

  return (
    <div className="relative inline-block text-left" ref={dropdownRef} onClick={(e) => e.stopPropagation()}>
      {/* Trigger Button */}
      {variant === 'labeled' ? (
        <button
          id={`device-actions-btn-${device.id}`}
          onClick={toggleMenu}
          className={`px-2.5 py-1 text-xs rounded border transition-colors flex items-center gap-1.5 ${
            isOpen
              ? 'bg-zinc-700 text-white border-zinc-500'
              : 'bg-[#18181B] hover:bg-zinc-800 text-[#FAFAFA] border-[#27272A] hover:border-zinc-600'
          }`}
          aria-haspopup="true"
          aria-expanded={isOpen}
          title="Device actions menu"
        >
          <span>Actions</span>
          <MoreVertical className="w-3.5 h-3.5 text-zinc-400" />
        </button>
      ) : (
        <button
          id={`device-actions-btn-${device.id}`}
          onClick={toggleMenu}
          className={`p-1.5 rounded-md border transition-colors flex items-center justify-center ${
            isOpen
              ? 'bg-zinc-700 text-white border-zinc-500 shadow-sm'
              : 'bg-[#18181B] hover:bg-zinc-800 text-zinc-400 hover:text-[#FAFAFA] border-[#27272A] hover:border-zinc-600'
          }`}
          aria-haspopup="true"
          aria-expanded={isOpen}
          title="Device Actions"
        >
          <MoreVertical className="w-4 h-4" />
        </button>
      )}

      {/* Dropdown Menu Popup */}
      {isOpen && (
        <div
          id={`device-actions-menu-${device.id}`}
          className={`absolute ${
            align === 'right' ? 'right-0' : 'left-0'
          } ${
            openUpwards ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
          } w-52 bg-[#18181B] border border-[#27272A] rounded-lg shadow-2xl py-1 z-50 text-left`}
          role="menu"
          aria-orientation="vertical"
        >
          {/* Header Info */}
          <div className="px-3 py-1.5 border-b border-[#27272A] mb-1">
            <p className="text-[11px] font-semibold text-[#FAFAFA] truncate">
              {device.customName || device.hostname || 'Device'}
            </p>
            <p className="text-[10px] font-mono text-[#71717A] truncate">
              {device.currentIp} • {device.macAddress}
            </p>
          </div>

          {/* Action 1: Inspect Details */}
          <button
            id={`device-action-inspect-${device.id}`}
            onClick={() => handleAction(onInspect)}
            className="w-full px-3 py-1.5 text-xs text-zinc-300 hover:text-white hover:bg-zinc-800/80 flex items-center gap-2.5 transition-colors"
            role="menuitem"
          >
            <Eye className="w-3.5 h-3.5 text-zinc-400" />
            <span>Inspect Details</span>
          </button>

          {/* Action 2: Rename Device */}
          {onStartRename && (
            <button
              id={`device-action-rename-${device.id}`}
              onClick={() => handleAction(onStartRename)}
              className="w-full px-3 py-1.5 text-xs text-zinc-300 hover:text-white hover:bg-zinc-800/80 flex items-center gap-2.5 transition-colors"
              role="menuitem"
            >
              <Pencil className="w-3.5 h-3.5 text-zinc-400" />
              <span>Rename Device</span>
            </button>
          )}

          {/* Action 3: OS Fingerprint Probe */}
          <button
            id={`device-action-fingerprint-${device.id}`}
            onClick={async () => {
              await onFingerprint();
              setIsOpen(false);
            }}
            disabled={isFingerprinting}
            className="w-full px-3 py-1.5 text-xs text-zinc-300 hover:text-white hover:bg-zinc-800/80 flex items-center gap-2.5 transition-colors disabled:opacity-50"
            role="menuitem"
          >
            {isFingerprinting ? (
              <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin" />
            ) : (
              <Fingerprint className="w-3.5 h-3.5 text-blue-400" />
            )}
            <span>{isFingerprinting ? 'Probing OS Stack...' : 'Probe OS Fingerprint'}</span>
          </button>

          <div className="my-1 border-t border-[#27272A]" />

          {/* Action 4: Disconnect / Reconnect Node */}
          <button
            id={`device-action-toggle-status-${device.id}`}
            type="button"
            onClick={() => {
              if (isOnline) {
                setIsOpen(false);
                setShowDisconnectModal(true);
              } else {
                handleStatusToggle();
              }
            }}
            disabled={isTogglingStatus}
            className="w-full px-3 py-1.5 text-xs text-zinc-300 hover:text-white hover:bg-zinc-800/80 flex items-center gap-2.5 transition-colors disabled:opacity-50 cursor-pointer"
            role="menuitem"
          >
            {isTogglingStatus ? (
              <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin" />
            ) : isOnline ? (
              <WifiOff className="w-3.5 h-3.5 text-amber-400" />
            ) : (
              <Wifi className="w-3.5 h-3.5 text-emerald-400" />
            )}
            <span>{isOnline ? 'Disconnect Node' : 'Reconnect Node'}</span>
          </button>

          {/* Action 5: Quarantine / Restore */}
          {isQuarantined ? (
            <button
              id={`device-action-restore-${device.id}`}
              type="button"
              onClick={async () => {
                await onRestore();
                setIsOpen(false);
              }}
              className="w-full px-3 py-1.5 text-xs text-emerald-300 hover:text-emerald-200 hover:bg-emerald-950/40 flex items-center gap-2.5 transition-colors cursor-pointer"
              role="menuitem"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Restore Network Access</span>
            </button>
          ) : (
            <button
              id={`device-action-quarantine-${device.id}`}
              type="button"
              onClick={() => handleAction(onQuarantine)}
              className="w-full px-3 py-1.5 text-xs text-red-300 hover:text-red-200 hover:bg-red-950/40 flex items-center gap-2.5 transition-colors cursor-pointer"
              role="menuitem"
            >
              <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
              <span>Quarantine Device</span>
            </button>
          )}

          {/* Action 6: Delete Device Record (Prominent Red Background with Light Text) */}
          {onDelete && (
            <div className="pt-1.5 pb-1 px-1 border-t border-[#27272A] mt-1">
              <button
                id={`device-action-delete-${device.id}`}
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  setShowDeleteModal(true);
                }}
                className="w-full px-3 py-2 text-xs font-semibold bg-red-600 hover:bg-red-500 text-white rounded-md flex items-center gap-2.5 transition-colors shadow-sm cursor-pointer"
                role="menuitem"
                title="Delete Device Record"
              >
                <Trash2 className="w-3.5 h-3.5 text-white shrink-0" />
                <span>Delete Record</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Confirmation Modals */}
      {showDeleteModal && (
        <DeleteConfirmModal
          device={device}
          onClose={() => setShowDeleteModal(false)}
          onConfirm={handleDeleteExecute}
        />
      )}

      {showDisconnectModal && (
        <DisconnectConfirmModal
          device={device}
          onClose={() => setShowDisconnectModal(false)}
          onConfirm={handleStatusToggle}
        />
      )}
    </div>
  );
};
