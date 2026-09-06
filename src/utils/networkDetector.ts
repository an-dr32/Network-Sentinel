/**
 * Client-Side Network & Hardware Connection Detector
 * Uses standard browser APIs (navigator.onLine, Network Information API, and WebRTC ICE probing)
 * to automatically determine if the user is on Wi-Fi, Ethernet, Both, or Offline.
 */

export interface ClientConnectionDetails {
  isOnline: boolean;
  connectionState: 'wifi' | 'ethernet' | 'both' | 'offline';
  hasEthernet: boolean;
  hasWifi: boolean;
  isOffline: boolean;
  networkType: string;
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  localIps: string[];
}

/**
 * Attempts to gather local IP addresses via WebRTC ICE candidate generation.
 * This runs locally in the browser with zero external requests.
 */
export async function detectLocalIps(): Promise<string[]> {
  const ips = new Set<string>();

  if (typeof window === 'undefined' || !window.RTCPeerConnection) {
    return [];
  }

  return new Promise((resolve) => {
    try {
      const pc = new RTCPeerConnection({ iceServers: [] });
      pc.createDataChannel('');

      const timeout = setTimeout(() => {
        try {
          pc.close();
        } catch {}
        resolve(Array.from(ips));
      }, 1200);

      pc.onicecandidate = (event) => {
        if (!event || !event.candidate) {
          try {
            pc.close();
          } catch {}
          clearTimeout(timeout);
          resolve(Array.from(ips));
          return;
        }

        const cand = event.candidate.candidate;
        // Match IPv4 addresses in candidate string
        const ipMatch = cand.match(/([0-9]{1,3}(\.[0-9]{1,3}){3})/);
        if (ipMatch && ipMatch[1]) {
          const ip = ipMatch[1];
          // Exclude loopback and link-local
          if (ip !== '127.0.0.1' && !ip.startsWith('169.254.') && !ip.startsWith('0.0.0.0')) {
            ips.add(ip);
          }
        }
      };

      pc.createOffer()
        .then((offer) => pc.setLocalDescription(offer))
        .catch(() => {
          clearTimeout(timeout);
          resolve(Array.from(ips));
        });
    } catch {
      resolve(Array.from(ips));
    }
  });
}

/**
 * Inspects browser network indicators to detect if the user is on Wi-Fi, Ethernet, Both, or Offline.
 */
export function getBrowserConnectionState(): {
  isOnline: boolean;
  hasEthernet: boolean;
  hasWifi: boolean;
  isOffline: boolean;
  connectionState: 'wifi' | 'ethernet' | 'both' | 'offline';
  networkType: string;
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
} {
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

  if (!isOnline) {
    return {
      isOnline: false,
      hasEthernet: false,
      hasWifi: false,
      isOffline: true,
      connectionState: 'offline',
      networkType: 'none',
    };
  }

  const nav = typeof navigator !== 'undefined' ? (navigator as any) : null;
  const connection = nav?.connection || nav?.mozConnection || nav?.webkitConnection;

  const rawType = (connection?.type || '').toLowerCase();
  const effectiveType = connection?.effectiveType;
  const downlink = connection?.downlink;
  const rtt = connection?.rtt;

  let hasEthernet = false;
  let hasWifi = false;

  if (rawType === 'ethernet') {
    hasEthernet = true;
  } else if (rawType === 'wifi' || rawType === 'wimax') {
    hasWifi = true;
  } else if (rawType === 'none') {
    return {
      isOnline: false,
      hasEthernet: false,
      hasWifi: false,
      isOffline: true,
      connectionState: 'offline',
      networkType: 'none',
    };
  }

  let connectionState: 'wifi' | 'ethernet' | 'both' | 'offline' = 'wifi';

  if (hasEthernet && hasWifi) {
    connectionState = 'both';
  } else if (hasEthernet) {
    connectionState = 'ethernet';
  } else if (hasWifi) {
    connectionState = 'wifi';
  } else {
    // If browser doesn't expose precise rawType ('unknown' or unsupported):
    // Default to wifi if online, unless detected otherwise by host server
    connectionState = 'wifi';
  }

  return {
    isOnline,
    hasEthernet,
    hasWifi,
    isOffline: false,
    connectionState,
    networkType: rawType || (hasEthernet ? 'ethernet' : 'wifi'),
    effectiveType,
    downlink,
    rtt,
  };
}
