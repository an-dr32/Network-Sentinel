export type DeviceTrustStatus = 'known' | 'new' | 'guest' | 'suspicious' | 'blocked';
export type DeviceOnlineStatus = 'online' | 'offline';
export type RiskSeverity = 'normal' | 'watch' | 'suspicious' | 'critical';
export type EventSeverity = 'info' | 'watch' | 'suspicious' | 'critical';

export interface IpHistoryEntry {
  ip: string;
  firstSeen: string;
  lastSeen: string;
  leaseType?: 'dhcp' | 'static' | 'unknown';
}

export interface OpenPort {
  port: number;
  service: string;
  protocol: 'tcp' | 'udp';
  state: 'open' | 'filtered' | 'closed';
  riskRating?: 'low' | 'medium' | 'high';
}

export interface DeviceConnection {
  targetIp: string;
  targetPort: number;
  protocol: string;
  hostname?: string;
  bytesSent: number;
  bytesReceived: number;
  timestamp: string;
  isUnusual?: boolean;
}

export interface DnsQueryLog {
  domain: string;
  queryType: string;
  timestamp: string;
  resolvedIp?: string;
  isAnomaly?: boolean;
  anomalyReason?: string;
}

export interface RiskEvidenceItem {
  rule: string;
  points: number;
  reason: string;
  timestamp: string;
}

export interface Device {
  id: string;
  macAddress: string;
  hostname: string;
  vendor: string;
  ipAddresses: string[];
  currentIp: string;
  ipHistory: IpHistoryEntry[];
  firstSeen: string;
  lastSeen: string;
  status: DeviceOnlineStatus;
  trustStatus: DeviceTrustStatus;
  riskScore: number;
  riskSeverity: RiskSeverity;
  tags: string[];
  osGuess?: string;
  osConfidence?: number;
  osDetectionDetails?: OsDetectionDetails;
  deviceType: 'router' | 'workstation' | 'laptop' | 'smartphone' | 'iot' | 'server' | 'printer' | 'unknown';
  openPorts: OpenPort[];
  activeConnections?: DeviceConnection[];
  dnsLogs?: DnsQueryLog[];
  riskEvidence: RiskEvidenceItem[];
  quarantined: boolean;
  quarantineDetails?: {
    quarantinedAt: string;
    reason: string;
    method: string;
    simulated: boolean;
  };
  trafficStats: {
    bytesSent: number;
    bytesReceived: number;
    packetCount: number;
    rateKbps: number;
  };
}

export interface OsDetectionDetails {
  ttl?: number;
  methods: string[];
  confidence: number;
  fingerprintedAt: string;
  identifiedBanners?: string[];
  signatureMatch?: string;
}

export type NetworkEventType =
  | 'device_discovered'
  | 'device_offline'
  | 'ip_changed'
  | 'dns_anomaly'
  | 'port_scan'
  | 'traffic_anomaly'
  | 'risk_changed'
  | 'response'
  | 'system_info'
  | 'os_fingerprinted';

export interface NetworkEvent {
  id: string;
  timestamp: string;
  type: NetworkEventType;
  deviceId?: string;
  deviceName?: string;
  deviceIp?: string;
  severity: EventSeverity;
  title: string;
  description: string;
  evidence: Record<string, unknown>;
  simulated: boolean;
}

export interface Alert {
  id: string;
  eventId: string;
  deviceId?: string;
  deviceName?: string;
  deviceIp?: string;
  title: string;
  description: string;
  severity: 'watch' | 'suspicious' | 'critical';
  riskScore: number;
  reasons: string[];
  resolved: boolean;
  resolvedAt?: string;
  resolvedBy?: string;
  createdAt: string;
  simulated: boolean;
}

export interface BaselineFeatures {
  isLearning: boolean;
  learningProgress: number; // 0 to 100
  confidenceScore: number; // 0 to 100
  devicesLearned: number;
  eventsAnalyzed: number;
  totalObservedPackets: number;
  startTime: string;
  estimatedRemainingSeconds: number;
  knownSubnets: string[];
  typicalPorts: number[];
  commonDnsDomains: string[];
  averageTrafficKbps: number;
}

export interface TopologyNode {
  id: string;
  label: string;
  type: 'gateway' | 'switch' | 'device';
  ip?: string;
  mac?: string;
  status: DeviceOnlineStatus;
  trustStatus: DeviceTrustStatus;
  riskScore: number;
  riskSeverity: RiskSeverity;
  deviceType?: string;
  vendor?: string;
  quarantined?: boolean;
  routerTraffic?: DeviceRouterTrafficStats;
}

export type RouterRequestType =
  | 'DNS'
  | 'HTTPS'
  | 'HTTP'
  | 'DHCP'
  | 'NTP'
  | 'ICMP'
  | 'mDNS'
  | 'SSDP'
  | 'SMB'
  | 'SSH'
  | 'OTHER';

export interface RouterRequestEvent {
  id: string;
  timestamp: string;
  sourceDeviceId: string;
  sourceIp: string;
  sourceHost: string;
  requestType: RouterRequestType;
  protocol: 'UDP' | 'TCP' | 'ICMP';
  port: number;
  target: string;
  sizeBytes: number;
  summary: string;
}

export interface DeviceRouterTrafficStats {
  deviceId: string;
  totalRequests: number;
  requestsPerMinute: number;
  typeCounts: Record<string, number>;
  lastRequest?: RouterRequestEvent;
  recentRequests: RouterRequestEvent[];
}

export interface RouterTrafficSummary {
  gatewayIp: string;
  totalRequests: number;
  requestsPerMinute: number;
  deviceStats: Record<string, DeviceRouterTrafficStats>;
  globalTypeCounts: Record<string, number>;
  recentRequests: RouterRequestEvent[];
}

export interface TopologyEdge {
  id: string;
  source: string;
  target: string;
  trafficKbps: number;
  active: boolean;
  protocol?: string;
  totalRequests?: number;
  requestsPerMinute?: number;
  requestTypeCounts?: Record<string, number>;
  topRequestType?: RouterRequestType;
  lastRequest?: RouterRequestEvent;
}

export interface RiskWeights {
  newDevice: number;
  portScan: number;
  unusualHosts: number;
  unusualDns: number;
  abnormalTraffic: number;
  unidentifiedOs: number;
  trustedBonus: number;
  baselineBonus: number;
}

export interface TopologyData {
  nodes: TopologyNode[];
  edges: TopologyEdge[];
  lastUpdated: string;
  trafficSummary?: RouterTrafficSummary;
}

export interface SystemStatus {
  collectorType: 'linux' | 'macos' | 'windows' | 'mock';
  collectorActive: boolean;
  interfaceName: string;
  subnet: string;
  mode: 'learning' | 'monitoring';
  totalDevices: number;
  onlineDevices: number;
  suspiciousDevices: number;
  criticalDevices: number;
  activeAlerts: number;
  uptimeSeconds: number;
  lastScanTimestamp: string;
}

export interface ResponseResult {
  success: boolean;
  deviceId: string;
  action: 'quarantine' | 'restore';
  method: string;
  timestamp: string;
  simulated: boolean;
  details: string;
}

export interface SecurityLabScenario {
  id: string;
  name: string;
  category: 'discovery' | 'reconnaissance' | 'anomaly' | 'traffic' | 'full_demo';
  description: string;
  severity: EventSeverity;
  payload: Record<string, unknown>;
}
