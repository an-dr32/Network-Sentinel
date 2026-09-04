import React from 'react';
import { NetworkProvider, useNetwork } from './context/NetworkContext';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { LearningBanner } from './components/LearningBanner';
import { OverviewView } from './components/OverviewView';
import { DevicesView } from './components/DevicesView';
import { TopologyView } from './components/TopologyView';
import { EventsView } from './components/EventsView';
import { AlertsView } from './components/AlertsView';
import { SecurityLabView } from './components/SecurityLabView';
import { SettingsView } from './components/SettingsView';
import { DeviceDetailModal } from './components/DeviceDetailModal';
import { QuarantineConfirmModal } from './components/QuarantineConfirmModal';

const AppContent: React.FC = () => {
  const { activeView, selectedDevice, setSelectedDevice, quarantineTarget, setQuarantineTarget } = useNetwork();

  return (
    <div id="app-root-container" className="flex h-screen w-screen overflow-hidden bg-[#09090B] text-[#FAFAFA]">
      {/* Sidebar Navigation - Static, does not scroll with main content */}
      <Sidebar />

      {/* Main Content Area - Independent Scroll Container */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <Header />
        <LearningBanner />

        <main className="flex-1 pb-12 overflow-y-auto">
          {activeView === 'overview' && <OverviewView />}
          {activeView === 'devices' && <DevicesView />}
          {activeView === 'topology' && <TopologyView />}
          {(activeView === 'events' || activeView === 'activity') && <EventsView />}
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
