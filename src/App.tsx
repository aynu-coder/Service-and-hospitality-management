import React, { useState } from 'react';
import { HospitalityProvider, useHospitality } from './context/HospitalityContext';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { LoginModal } from './components/LoginModal';
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
import { Employee, NavSection } from './types/hospitality';

const AppShell: React.FC = () => {
  const { state, hasPermission, logout } = useHospitality();
  const [activeSection, setActiveSection] = useState<NavSection>('pos');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [preselectedTableId, setPreselectedTableId] = useState<string | undefined>(undefined);

  const handleOpenPosForTable = (tableId: string) => {
    setPreselectedTableId(tableId);
    setActiveSection('pos');
  };

  const handleLoginSuccess = (employee: Employee) => {
    setLoginModalOpen(false);
    const perms = state.config.rolePermissions[employee.role] || [];
    if (perms.includes('view_dashboard')) {
      setActiveSection('dashboard');
    } else if (perms.includes('kds_manage')) {
      setActiveSection('kitchen');
    } else if (perms.includes('bar_redeem_bono')) {
      setActiveSection('bar-bonos');
    } else if (perms.includes('inventory_manage')) {
      setActiveSection('inventory');
    } else if (perms.includes('finance_view')) {
      setActiveSection('finance');
    } else {
      setActiveSection('pos');
    }
  };

  const handleLogout = () => {
    logout();
    setActiveSection('pos');
  };

  // Unauthenticated users always land on the public Order Page (pos)
  const resolvedSection: NavSection = (() => {
    if (!state.isAuthenticated) return 'pos';
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
      {state.isAuthenticated && (
        <Sidebar
          activeSection={resolvedSection}
          onSelectSection={setActiveSection}
          mobileOpen={mobileMenuOpen}
          onCloseMobile={() => setMobileMenuOpen(false)}
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          activeSection={resolvedSection}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          onSelectSection={setActiveSection}
          onOpenLogin={() => setLoginModalOpen(true)}
          onLogout={handleLogout}
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

      <LoginModal
        open={loginModalOpen}
        onClose={() => setLoginModalOpen(false)}
        onSuccess={handleLoginSuccess}
      />
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
