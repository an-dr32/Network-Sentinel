import { RiskSeverity, DeviceTrustStatus, DeviceOnlineStatus } from '../types';

export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function formatRate(kbps: number): string {
  if (kbps >= 1000) {
    return `${(kbps / 1000).toFixed(1)} Mbps`;
  }
  return `${kbps.toFixed(0)} Kbps`;
}

export function formatTimeAgo(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 5) return 'just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function getRiskBadgeClasses(severity: RiskSeverity): {
  bg: string;
  text: string;
  border: string;
  dot: string;
} {
  switch (severity) {
    case 'critical':
      return {
        bg: 'bg-red-950/40',
        text: 'text-red-400',
        border: 'border-red-800/60',
        dot: 'bg-red-500',
      };
    case 'suspicious':
      return {
        bg: 'bg-amber-950/40',
        text: 'text-amber-400',
        border: 'border-amber-800/60',
        dot: 'bg-amber-500',
      };
    case 'watch':
      return {
        bg: 'bg-yellow-950/30',
        text: 'text-yellow-400',
        border: 'border-yellow-800/50',
        dot: 'bg-yellow-500',
      };
    case 'normal':
    default:
      return {
        bg: 'bg-emerald-950/30',
        text: 'text-emerald-400',
        border: 'border-emerald-800/50',
        dot: 'bg-emerald-500',
      };
  }
}

export function getTrustStatusClasses(status: DeviceTrustStatus): {
  bg: string;
  text: string;
  border: string;
} {
  switch (status) {
    case 'known':
      return {
        bg: 'bg-emerald-950/40',
        text: 'text-emerald-300',
        border: 'border-emerald-800/50',
      };
    case 'new':
      return {
        bg: 'bg-blue-950/40',
        text: 'text-blue-300',
        border: 'border-blue-800/50',
      };
    case 'guest':
      return {
        bg: 'bg-zinc-800',
        text: 'text-zinc-300',
        border: 'border-zinc-700',
      };
    case 'suspicious':
      return {
        bg: 'bg-amber-950/40',
        text: 'text-amber-300',
        border: 'border-amber-800/50',
      };
    case 'blocked':
      return {
        bg: 'bg-red-950/40',
        text: 'text-red-300',
        border: 'border-red-800/50',
      };
  }
}
