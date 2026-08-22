import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
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
  FileText,
  Loader2
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useInstall } from '../../contexts/InstallContext';
import { useTheme } from '../ThemeProvider';
import { InstallProgressModal } from '../InstallProgressModal';

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
}

function SidebarItem({ icon: Icon, label, to, isCollapsed }: SidebarItemProps) {
  return (
    <NavLink
      to={to}
      title={isCollapsed ? label : undefined}
      className={({ isActive }) =>
        `w-full flex items-center ${isCollapsed ? 'justify-center px-0' : 'gap-3 px-4'} py-2 rounded-md transition-all duration-200 text-sm font-medium active:scale-[0.98] ${
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
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const { taskId, appName, task, maximize } = useInstall();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const toggleLanguage = () => {
    i18n.changeLanguage(i18n.language === 'pt' ? 'en' : 'pt');
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <aside className={`border-r shad-border flex flex-col fixed h-full z-20 bg-background transition-all duration-300 ${isSidebarOpen ? 'w-64' : 'w-16'}`}>
        <div className={`h-14 border-b shad-border flex items-center ${isSidebarOpen ? 'justify-between px-4' : 'justify-center px-0'}`}>
          {isSidebarOpen && (
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="w-6 h-6 rounded flex items-center justify-center overflow-hidden shrink-0">
                <img src="/favicon.jpg" alt="Orbit Logo" className="w-full h-full object-cover" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold leading-tight">Orbit</span>
                <span className="text-[10px] text-secondary leading-tight">Admin Dashboard</span>
              </div>
            </div>
          )}
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 text-secondary hover:text-primary transition-all duration-200 rounded-md hover:bg-accent active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-orbit-500 focus-visible:outline-none">
            <Menu className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto py-6 px-2">
          <SidebarSection title={t('sidebar.dashboards')} isCollapsed={!isSidebarOpen}>
            <SidebarItem icon={LayoutDashboard} label={t('sidebar.overview')} to="/" isCollapsed={!isSidebarOpen} />
            <SidebarItem icon={Activity} label={t('sidebar.metrics')} to="/metrics" isCollapsed={!isSidebarOpen} />
            <SidebarItem icon={FileText} label="System Logs" to="/logs" isCollapsed={!isSidebarOpen} />
          </SidebarSection>

          <SidebarSection title={t('sidebar.docker')} isCollapsed={!isSidebarOpen}>
            <SidebarItem icon={Package} label="App Store" to="/store" isCollapsed={!isSidebarOpen} />
            <SidebarItem icon={Box} label={t('sidebar.containers')} to="/containers" isCollapsed={!isSidebarOpen} />
            <SidebarItem icon={Terminal} label={t('sidebar.terminal')} to="/terminal" isCollapsed={!isSidebarOpen} />
            <SidebarItem icon={HardDrive} label={t('sidebar.images')} to="/images" isCollapsed={!isSidebarOpen} />
            <SidebarItem icon={Network} label={t('sidebar.networks')} to="/networks" isCollapsed={!isSidebarOpen} />
            <SidebarItem icon={HardDrive} label={t('sidebar.volumes')} to="/volumes" isCollapsed={!isSidebarOpen} />
          </SidebarSection>
          

        </div>

        <div className="p-4 border-t shad-border mt-auto flex flex-col gap-2">
          {taskId && (
            <button
              onClick={maximize}
              className={`w-full flex items-center ${!isSidebarOpen ? 'justify-center px-0' : 'justify-between px-4'} py-2 rounded-md text-sm font-medium bg-orbit-500/10 text-orbit-400 hover:bg-orbit-500/20 transition-all duration-200 active:scale-[0.98] border border-orbit-500/20 focus-visible:ring-2 focus-visible:ring-orbit-500 focus-visible:outline-none`}
              title={!isSidebarOpen ? `Instalando ${appName}...` : undefined}
            >
              <div className="flex items-center gap-3">
                <Loader2 className="w-4 h-4 shrink-0 animate-spin" />
                {isSidebarOpen && <span className="truncate max-w-[120px] text-left">{appName}</span>}
              </div>
              {isSidebarOpen && task && (
                <span className="text-xs font-bold">{task.progress}%</span>
              )}
            </button>
          )}

          <button 
            onClick={handleLogout}
            title={!isSidebarOpen ? t('sidebar.sign_out') : undefined}
            className={`w-full flex items-center ${!isSidebarOpen ? 'justify-center px-0' : 'gap-3 px-4'} py-2 rounded-md text-sm font-medium text-secondary hover:text-primary hover:bg-accent hover:text-rose-400 transition-all duration-200 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:outline-none`}
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {isSidebarOpen && <span>{t('sidebar.sign_out')}</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className={`flex-1 flex flex-col min-h-screen transition-all duration-300 ${isSidebarOpen ? 'ml-64' : 'ml-16'}`}>
        {/* Topbar */}
        <header className="h-14 border-b shad-border flex items-center justify-end px-6 sticky top-0 z-10 bg-background/95 backdrop-blur-sm">
          
          <div className="flex items-center gap-4 text-sm font-medium">
            <div className="flex items-center gap-2 mr-2">
              <Palette className="w-4 h-4 text-secondary" />
              <select 
                value={color} 
                onChange={(e) => setColor(e.target.value as any)}
                className="bg-background border shad-border text-secondary text-xs rounded-md py-1 px-2 outline-none transition-colors duration-200 focus:border-orbit-500 focus-visible:ring-2 focus-visible:ring-orbit-500/50"
              >
                <option value="zinc">Zinc</option>
                <option value="rose">Rose</option>
                <option value="blue">Blue</option>
                <option value="green">Green</option>
                <option value="catppuccin">Catppuccin</option>
                <option value="tokyonight">Tokyo Night</option>
              </select>
            </div>
            <button onClick={toggleLanguage} className="text-xs font-bold text-secondary hover:text-primary transition-all duration-200 active:scale-[0.95]">
              {i18n.language === 'pt' ? 'PT-BR' : 'EN'}
            </button>
            <button 
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-2 rounded-md border shad-border hover:bg-accent transition-all duration-200 text-secondary active:scale-[0.95] focus-visible:ring-2 focus-visible:ring-orbit-500 focus-visible:outline-none"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </header>

        {/* Page Content */}
        <div className="p-8 flex-1 animate-fade-in">
          {children}
        </div>
      </main>

      <InstallProgressModal />
    </div>
  );
}
