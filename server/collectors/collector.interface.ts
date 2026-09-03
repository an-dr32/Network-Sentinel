import { Device, NetworkEvent } from '../types';

export interface NetworkCollector {
  readonly type: 'linux' | 'macos' | 'windows' | 'mock';
  discoverDevices(): Promise<Device[]>;
  startMonitoring(onEvent: (event: NetworkEvent) => void): Promise<void>;
  stopMonitoring(): Promise<void>;
  isAvailable(): Promise<boolean>;
}
