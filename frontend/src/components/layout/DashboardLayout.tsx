import {
  LayoutDashboard,
  Box,
  Settings,
  Terminal,
  Activity,
  HardDrive,
  Cpu,
  Network,
  LogOut,
  Search,
  Command,
  Sun
} from 'lucide-react';

interface SidebarSectionProps {
  title: string;
  children: React.ReactNode;
}

function SidebarSection({ title, children }: SidebarSectionProps) {
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
  active?: boolean;
}

function SidebarItem({ icon: Icon, label, active }: SidebarItemProps) {
  return (
    <button
      className={`w-full flex items-center gap-3 px-4 py-2 rounded-md transition-colors text-sm font-medium ${
        active
          ? 'bg-accent text-primary'
          : 'text-secondary hover:text-primary hover:bg-accent'
      }`}
    >
      <Icon className="w-4 h-4" />
      <span>{label}</span>
    </button>
  );
}

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <aside className="w-64 border-r shad-border flex flex-col fixed h-full z-10 bg-background">
        <div className="h-14 border-b shad-border flex items-center px-6">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-primary flex items-center justify-center">
              <Terminal className="w-4 h-4 text-background" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold leading-tight">Orbit</span>
              <span className="text-[10px] text-secondary leading-tight">Admin Dashboard</span>
            </div>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto py-6">
          <SidebarSection title="Dashboards">
            <SidebarItem icon={LayoutDashboard} label="Overview" active />
            <SidebarItem icon={Activity} label="System Metrics" />
          </SidebarSection>

          <SidebarSection title="Docker">
            <SidebarItem icon={Box} label="Containers" />
            <SidebarItem icon={HardDrive} label="Images" />
            <SidebarItem icon={Network} label="Networks" />
            <SidebarItem icon={HardDrive} label="Volumes" />
          </SidebarSection>
          
          <SidebarSection title="Settings">
            <SidebarItem icon={Settings} label="Global Settings" />
          </SidebarSection>
        </div>

        <div className="p-4 border-t shad-border mt-auto">
          <button className="w-full flex items-center gap-3 px-4 py-2 rounded-md text-sm font-medium text-secondary hover:text-primary hover:bg-accent transition-colors">
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-64 flex flex-col min-h-screen">
        {/* Topbar */}
        <header className="h-14 border-b shad-border flex items-center justify-between px-6 sticky top-0 z-10 bg-background/95 backdrop-blur-sm">
          {/* Search bar simulation */}
          <div className="flex items-center gap-2 w-96 px-3 py-1.5 rounded-md border shad-border bg-background text-secondary text-sm">
            <Search className="w-4 h-4" />
            <span className="flex-1">Search...</span>
            <div className="flex items-center gap-1 bg-accent px-1.5 py-0.5 rounded text-xs font-mono">
              <Command className="w-3 h-3" />
              <span>K</span>
            </div>
          </div>
          
          <div className="flex items-center gap-4 text-sm font-medium">
            <span className="text-secondary hover:text-primary cursor-pointer transition-colors">Blocks</span>
            <span className="text-secondary hover:text-primary cursor-pointer transition-colors">Landing Page</span>
            <span className="text-secondary hover:text-primary cursor-pointer transition-colors">GitHub</span>
            <button className="p-2 rounded-md border shad-border hover:bg-accent transition-colors text-secondary">
              <Sun className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Page Content */}
        <div className="p-8 flex-1">
          {children}
        </div>
      </main>
    </div>
  );
}
