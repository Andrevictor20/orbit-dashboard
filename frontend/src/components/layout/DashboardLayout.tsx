import { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { 
  LayoutDashboard, 
  Box, 
  Terminal,
  Activity,
  HardDrive,
  Network,
  Sun,
  Moon,
  LogOut,
  Palette,
  Package,
  Menu,
  X,
  FileText,
  Loader2,
  FolderOpen,
  AlertCircle,
  CheckCircle2,
  Maximize,
  Minimize,
  Sparkles,
  Globe
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useInstall } from '../../contexts/InstallContext';
import { useTheme } from '../ThemeProvider';
import { supportedLanguages } from '../../i18n';
import { InstallProgressModal } from '../InstallProgressModal';
import { ProfileModal } from '../ProfileModal';
import { UpdateModal, type SystemUpdateInfo } from '../UpdateModal';

interface SidebarSectionProps {
  title: string;
  children: React.ReactNode;
  isCollapsed?: boolean;
}

function SidebarSection({ title, children, isCollapsed }: SidebarSectionProps) {
  if (isCollapsed) {
    return <div className="mb-6 space-y-1">{children}</div>;
  }
  return (
    <div className="mb-6">
      <h3 className="px-4 text-xs font-semibold text-secondary tracking-wider uppercase mb-2">
        {title}
      </h3>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

interface SidebarItemProps {
  icon: React.ElementType;
  label: string;
  to: string;
  isCollapsed?: boolean;
  onClick?: () => void;
}

function SidebarItem({ icon: Icon, label, to, isCollapsed, onClick }: SidebarItemProps) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      title={isCollapsed ? label : undefined}
      className={({ isActive }) =>
        `w-full flex items-center ${isCollapsed ? 'justify-center px-0' : 'gap-3 px-4'} py-2.5 rounded-md transition-all duration-200 text-sm font-medium active:scale-[0.98] ${
          isActive
            ? 'bg-accent text-primary'
            : 'text-secondary hover:text-primary hover:bg-accent/80'
        }`
      }
    >
      <Icon className="w-4 h-4 shrink-0" />
      {!isCollapsed && <span>{label}</span>}
    </NavLink>
  );
}

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { t, i18n } = useTranslation();
  const { logout } = useAuth();
  const { theme, setTheme, color, setColor } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<SystemUpdateInfo | null>(null);
  const { appName, task, maximize } = useInstall();

  // Close mobile drawer on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  const checkUpdates = (force = false) => {
    const token = localStorage.getItem('orbit_token');
    const url = force ? '/api/system/update/check?force=true' : '/api/system/update/check';
    fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (data) setUpdateInfo(data);
      })
      .catch(() => {});
  };

  useEffect(() => {
    checkUpdates();
    const interval = setInterval(checkUpdates, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex bg-background relative overflow-x-hidden">
      {/* Mobile Backdrop Overlay */}
      {isMobileMenuOpen && (
        <div 
          onClick={() => setIsMobileMenuOpen(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden transition-opacity animate-in fade-in"
          aria-hidden="true"
        />
      )}

      {/* Sidebar (Responsive Drawer on Mobile, Collapsible on Desktop) */}
      <aside 
        className={`border-r shad-border flex flex-col fixed inset-y-0 left-0 z-50 bg-background transition-all duration-300 ${
          isMobileMenuOpen ? 'translate-x-0 w-72 shadow-2xl' : '-translate-x-full'
        } md:translate-x-0 ${
          isSidebarOpen ? 'md:w-64' : 'md:w-16'
        }`}
      >
        <div className={`h-14 border-b shad-border flex items-center justify-between px-4`}>
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="w-6 h-6 rounded flex items-center justify-center overflow-hidden shrink-0">
              <img src="/favicon.jpg?v=2" alt="Orbit Logo" className="w-full h-full object-cover" />
            </div>
            <div className={`flex flex-col ${(isSidebarOpen || isMobileMenuOpen) ? 'block' : 'hidden md:hidden'}`}>
              <span className="text-sm font-semibold leading-tight">Orbit</span>
              <span className="text-[10px] text-secondary leading-tight">Admin Dashboard</span>
            </div>
          </div>
          
          {/* Close button on mobile, Collapse button on desktop */}
          <button 
            onClick={() => {
              if (window.innerWidth < 768) {
                setIsMobileMenuOpen(false);
              } else {
                setIsSidebarOpen(!isSidebarOpen);
              }
            }} 
            className="p-2 text-secondary hover:text-primary transition-all duration-200 rounded-md hover:bg-accent active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-orbit-500 focus-visible:outline-none"
            aria-label="Alternar menu lateral"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5 md:hidden" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto py-6 px-2">
          <SidebarSection title={t('sidebar.dashboards')} isCollapsed={!isSidebarOpen && !isMobileMenuOpen}>
            <SidebarItem icon={LayoutDashboard} label={t('sidebar.overview')} to="/" isCollapsed={!isSidebarOpen && !isMobileMenuOpen} onClick={() => setIsMobileMenuOpen(false)} />
            <SidebarItem icon={Activity} label={t('sidebar.metrics')} to="/metrics" isCollapsed={!isSidebarOpen && !isMobileMenuOpen} onClick={() => setIsMobileMenuOpen(false)} />
            <SidebarItem icon={FolderOpen} label={t('sidebar.files')} to="/files" isCollapsed={!isSidebarOpen && !isMobileMenuOpen} onClick={() => setIsMobileMenuOpen(false)} />
            <SidebarItem icon={FileText} label={t('sidebar.logs')} to="/logs" isCollapsed={!isSidebarOpen && !isMobileMenuOpen} onClick={() => setIsMobileMenuOpen(false)} />
          </SidebarSection>

          <SidebarSection title={t('sidebar.docker')} isCollapsed={!isSidebarOpen && !isMobileMenuOpen}>
            <SidebarItem icon={Package} label={t('sidebar.store')} to="/store" isCollapsed={!isSidebarOpen && !isMobileMenuOpen} onClick={() => setIsMobileMenuOpen(false)} />
            <SidebarItem icon={Box} label={t('sidebar.containers')} to="/containers" isCollapsed={!isSidebarOpen && !isMobileMenuOpen} onClick={() => setIsMobileMenuOpen(false)} />
            <SidebarItem icon={Terminal} label={t('sidebar.terminal')} to="/terminal" isCollapsed={!isSidebarOpen && !isMobileMenuOpen} onClick={() => setIsMobileMenuOpen(false)} />
            <SidebarItem icon={HardDrive} label={t('sidebar.images')} to="/images" isCollapsed={!isSidebarOpen && !isMobileMenuOpen} onClick={() => setIsMobileMenuOpen(false)} />
            <SidebarItem icon={Network} label={t('sidebar.networks')} to="/networks" isCollapsed={!isSidebarOpen && !isMobileMenuOpen} onClick={() => setIsMobileMenuOpen(false)} />
            <SidebarItem icon={HardDrive} label={t('sidebar.volumes')} to="/volumes" isCollapsed={!isSidebarOpen && !isMobileMenuOpen} onClick={() => setIsMobileMenuOpen(false)} />
          </SidebarSection>
        </div>

        <div className="p-4 border-t shad-border mt-auto flex flex-col gap-2">
          {task && (
            <button
              onClick={() => maximize(task.id)}
              className={`w-full flex items-center ${(!isSidebarOpen && !isMobileMenuOpen) ? 'justify-center px-0' : 'justify-between px-3'} py-2 rounded-xl text-xs font-medium transition-all duration-200 active:scale-[0.98] border focus-visible:ring-2 focus-visible:ring-orbit-500 focus-visible:outline-none ${
                task.status === 'error'
                  ? 'bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20'
                  : task.status === 'done'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                  : 'bg-orbit-500/10 text-orbit-400 border-orbit-500/20 hover:bg-orbit-500/20'
              }`}
              title={(!isSidebarOpen && !isMobileMenuOpen) ? `${task.title || appName} (${task.progress}%)` : undefined}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {task.status === 'error' ? (
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                ) : task.status === 'done' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                ) : (
                  <Loader2 className="w-4 h-4 shrink-0 animate-spin text-orbit-400" />
                )}
                {(isSidebarOpen || isMobileMenuOpen) && (
                  <span className="truncate max-w-[120px] text-left">
                    {task.title || appName}
                  </span>
                )}
              </div>
              {(isSidebarOpen || isMobileMenuOpen) && (
                <span className="text-xs font-bold tabular-nums shrink-0 ml-1">{task.progress}%</span>
              )}
            </button>
          )}

          <button 
            onClick={handleLogout}
            title={(!isSidebarOpen && !isMobileMenuOpen) ? t('sidebar.sign_out') : undefined}
            className={`w-full flex items-center ${(!isSidebarOpen && !isMobileMenuOpen) ? 'justify-center px-0' : 'gap-3 px-4'} py-2 rounded-md text-sm font-medium text-secondary hover:text-primary hover:bg-accent hover:text-rose-400 transition-all duration-200 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:outline-none`}
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {(isSidebarOpen || isMobileMenuOpen) && <span>{t('sidebar.sign_out')}</span>}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className={`flex-1 flex flex-col min-h-screen transition-all duration-300 w-full min-w-0 ${
        isSidebarOpen ? 'md:ml-64' : 'md:ml-16'
      }`}>
        {/* Topbar */}
        <header className="h-14 border-b shad-border flex items-center justify-between px-4 sm:px-6 sticky top-0 z-30 bg-background/95 backdrop-blur-sm">
          {/* Mobile Hamburger Menu Toggle */}
          <div className="flex items-center gap-3 md:hidden">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-2 -ml-2 text-secondary hover:text-primary rounded-lg hover:bg-accent transition-colors active:scale-95"
              aria-label="Abrir menu de navegação"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <img src="/favicon.jpg?v=2" alt="Orbit Logo" className="w-5 h-5 rounded object-cover" />
              <span className="text-sm font-bold tracking-tight">Orbit</span>
            </div>
          </div>

          <div className="hidden md:block" />

          {/* Right Controls */}
          <div className="flex items-center gap-2 sm:gap-4 text-sm font-medium">
            {/* Update Notification / Sparkles Button */}
            <button
              onClick={() => setIsUpdateModalOpen(true)}
              className={`relative p-1.5 sm:p-2 rounded-md border shad-border transition-all duration-200 active:scale-[0.95] focus-visible:ring-2 focus-visible:ring-orbit-500 focus-visible:outline-none ${
                updateInfo?.has_update 
                  ? 'text-amber-400 bg-amber-500/10 border-amber-500/30 hover:bg-amber-500/20' 
                  : 'text-secondary hover:text-primary hover:bg-accent'
              }`}
              title={updateInfo?.has_update ? "Nova versão do Orbit disponível! Clique para ver." : "Verificar atualizações do Orbit"}
              aria-label="Atualizações do Orbit"
            >
              <Sparkles className="w-4 h-4" />
              {updateInfo?.has_update && (
                <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                </span>
              )}
            </button>

            <div className="flex items-center gap-1.5 sm:gap-2">
              <Palette className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-secondary shrink-0" />
              <select 
                value={color} 
                onChange={(e) => setColor(e.target.value as any)}
                className="bg-background border shad-border text-secondary text-xs rounded-md py-1 px-1.5 sm:px-2 outline-none transition-colors duration-200 focus:border-orbit-500 focus-visible:ring-2 focus-visible:ring-orbit-500/50 cursor-pointer"
                aria-label="Selecionar tema de cores"
              >
                <option value="zinc">Zinc</option>
                <option value="rose">Rose</option>
                <option value="blue">Blue</option>
                <option value="green">Green</option>
                <option value="catppuccin">Catppuccin</option>
                <option value="tokyonight">Tokyo Night</option>
              </select>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <Globe className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-secondary shrink-0" />
              <select 
                value={supportedLanguages.some(l => l.code === i18n.language) ? i18n.language : (i18n.language?.split('-')[0] || 'pt')} 
                onChange={(e) => i18n.changeLanguage(e.target.value)}
                className="bg-background border shad-border text-secondary text-xs rounded-md py-1 px-1.5 sm:px-2 outline-none transition-colors duration-200 focus:border-orbit-500 focus-visible:ring-2 focus-visible:ring-orbit-500/50 cursor-pointer max-w-[120px] sm:max-w-[150px] truncate"
                aria-label={t('header.switch_language')}
              >
                {supportedLanguages.map(lang => (
                  <option key={lang.code} value={lang.code}>
                    {lang.flag} {lang.nativeName}
                  </option>
                ))}
              </select>
            </div>
            <button 
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-1.5 sm:p-2 rounded-md border shad-border hover:bg-accent transition-all duration-200 text-secondary active:scale-[0.95] focus-visible:ring-2 focus-visible:ring-orbit-500 focus-visible:outline-none"
              aria-label={t('header.toggle_theme')}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button
              onClick={() => {
                if (!document.fullscreenElement) {
                  document.documentElement.requestFullscreen().catch(() => {});
                } else {
                  document.exitFullscreen().catch(() => {});
                }
              }}
              className="p-1.5 sm:p-2 rounded-md border shad-border hover:bg-accent transition-all duration-200 text-secondary active:scale-[0.95] focus-visible:ring-2 focus-visible:ring-orbit-500 focus-visible:outline-none"
              title="Alternar Tela Cheia"
              aria-label="Alternar tela cheia"
            >
              {typeof document !== 'undefined' && document.fullscreenElement ? (
                <Minimize className="w-4 h-4" />
              ) : (
                <Maximize className="w-4 h-4" />
              )}
            </button>
            <div className="h-5 sm:h-6 w-px bg-border mx-1 sm:mx-2"></div>
            <button
              onClick={() => setIsProfileModalOpen(true)}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full overflow-hidden border-2 border-transparent hover:border-orbit-500 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orbit-500"
              aria-label="Abrir perfil"
            >
              <img src="/favicon.jpg?v=2" alt="Profile" className="w-full h-full object-cover" />
            </button>
          </div>
        </header>

        {/* Page Content with fluid responsive padding */}
        <div className={`flex-1 overflow-x-hidden animate-fade-in w-full min-w-0 ${
          location.pathname === '/files' ? 'p-2 sm:p-3.5 lg:p-4 flex flex-col' : 'p-3.5 sm:p-6 lg:p-8'
        }`}>
          {children}
        </div>
      </main>

      <InstallProgressModal />
      <ProfileModal isOpen={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} />
      <UpdateModal
        isOpen={isUpdateModalOpen}
        onClose={() => setIsUpdateModalOpen(false)}
        updateInfo={updateInfo}
        onRefreshInfo={() => checkUpdates(true)}
      />
    </div>
  );
}


