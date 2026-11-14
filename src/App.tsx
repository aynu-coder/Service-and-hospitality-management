import React, { useState } from 'react';
import { HospitalityProvider, useHospitality } from './context/HospitalityContext';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { DashboardView } from './components/DashboardView';
import { PosView } from './components/PosView';
import { TablesView } from './components/TablesView';
import { KdsView } from './components/KdsView';
import { BarBonoView } from './components/BarBonoView';
import { InventoryView } from './components/InventoryView';
import { FinanceView } from './components/FinanceView';
import { StaffAuditView } from './components/StaffAuditView';
import { ReportsView } from './components/ReportsView';
import { SettingsView } from './components/SettingsView';
import { NavSection } from './types/hospitality';

const AppShell: React.FC = () => {
  const { hasPermission } = useHospitality();
  const [activeSection, setActiveSection] = useState<NavSection>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [preselectedTableId, setPreselectedTableId] = useState<string | undefined>(undefined);

  const handleOpenPosForTable = (tableId: string) => {
    setPreselectedTableId(tableId);
    setActiveSection('pos');
  };

  // Fallback if switched role lacks current section permission
  const resolvedSection: NavSection = (() => {
    if (activeSection === 'dashboard' && !hasPermission('view_dashboard')) {
      if (hasPermission('kds_manage')) return 'kitchen';
      if (hasPermission('bar_redeem_bono')) return 'bar-bonos';
      if (hasPermission('pos_create')) return 'pos';
      if (hasPermission('inventory_manage')) return 'inventory';
      if (hasPermission('finance_view')) return 'finance';
    }
    return activeSection;
  })();

  return (
    <div className="flex min-h-screen w-full bg-[#F7F8FA] text-[#111827]">
      <Sidebar
        activeSection={resolvedSection}
        onSelectSection={setActiveSection}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          activeSection={resolvedSection}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          onSelectSection={setActiveSection}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-7">
          {resolvedSection === 'dashboard' && <DashboardView onNavigate={setActiveSection} />}
          {resolvedSection === 'pos' && (
            <PosView
              preselectedTableId={preselectedTableId}
              onClearPreselectedTable={() => setPreselectedTableId(undefined)}
            />
          )}
          {resolvedSection === 'tables' && (
            <TablesView onOpenPosForTable={handleOpenPosForTable} />
          )}
          {resolvedSection === 'kitchen' && <KdsView />}
          {resolvedSection === 'bar-bonos' && <BarBonoView />}
          {resolvedSection === 'inventory' && <InventoryView />}
          {resolvedSection === 'finance' && <FinanceView />}
          {resolvedSection === 'staff-audit' && <StaffAuditView />}
          {resolvedSection === 'reports' && <ReportsView />}
          {resolvedSection === 'settings' && <SettingsView />}
        </main>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <HospitalityProvider>
      <AppShell />
    </HospitalityProvider>
  );
}
