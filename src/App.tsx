import React from 'react';
import { NetworkProvider, useNetwork } from './context/NetworkContext';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { LearningBanner } from './components/LearningBanner';
import { OverviewView } from './components/OverviewView';
import { DevicesView } from './components/DevicesView';
import { TopologyView } from './components/TopologyView';
import { ActivityView } from './components/ActivityView';
import { AlertsView } from './components/AlertsView';
import { SecurityLabView } from './components/SecurityLabView';
import { SettingsView } from './components/SettingsView';
import { DeviceDetailModal } from './components/DeviceDetailModal';
import { QuarantineConfirmModal } from './components/QuarantineConfirmModal';

const AppContent: React.FC = () => {
  const { activeView, selectedDevice, setSelectedDevice, quarantineTarget, setQuarantineTarget } = useNetwork();

  return (
    <div id="app-root-container" className="flex min-h-screen bg-[#09090B] text-[#FAFAFA]">
      {/* Sidebar Navigation */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <LearningBanner />

        <main className="flex-1 pb-12 overflow-y-auto">
          {activeView === 'overview' && <OverviewView />}
          {activeView === 'devices' && <DevicesView />}
          {activeView === 'topology' && <TopologyView />}
          {activeView === 'activity' && <ActivityView />}
          {activeView === 'alerts' && <AlertsView />}
          {activeView === 'security-lab' && <SecurityLabView />}
          {activeView === 'settings' && <SettingsView />}
        </main>
      </div>

      {/* Modals & Overlays */}
      {selectedDevice && (
        <DeviceDetailModal
          device={selectedDevice}
          onClose={() => setSelectedDevice(null)}
        />
      )}

      {quarantineTarget && (
        <QuarantineConfirmModal
          device={quarantineTarget}
          onClose={() => setQuarantineTarget(null)}
        />
      )}
    </div>
  );
};

export default function App() {
  return (
    <NetworkProvider>
      <AppContent />
    </NetworkProvider>
  );
}
