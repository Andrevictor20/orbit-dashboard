import { useEffect } from 'react';
import { TrendingUp, Activity, HardDrive, Box } from 'lucide-react';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { StatCard } from './components/ui/StatCard';
import { ContainerList } from './components/ui/ContainerList';
import { useWebSocket } from './hooks/useWebSocket';

function App() {
  const { stats, isConnected } = useWebSocket('/api/docker/stats');

  // Derived metrics
  const cpuPercent = stats ? stats.cpu_usage.toFixed(1) : '0.0';
  const memoryUsedGB = stats ? (stats.memory_used / 1024 / 1024 / 1024).toFixed(2) : '0.00';
  const memoryTotalGB = stats ? (stats.memory_total / 1024 / 1024 / 1024).toFixed(2) : '0.00';
  const memoryPercent = stats && stats.memory_total > 0 
    ? ((stats.memory_used / stats.memory_total) * 100).toFixed(1)
    : '0.0';

  // Auto-login for development Phase 4
  useEffect(() => {
    fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'admin' })
    }).then(() => {
      // Force reconnect websocket or just let it happen naturally
    });
  }, []);

  return (
    <DashboardLayout>
      <div className="mb-8 flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-primary tracking-tight">Orbit Dashboard</h2>
          <p className="text-sm text-secondary mt-1">Monitor your system performance and containers in real-time</p>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
          <span className="text-xs font-medium text-secondary">
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard 
          title="Containers" 
          value="Live" 
          trend="WS"
          trendUp={isConnected}
          subText="Syncing from socket"
          icon={TrendingUp}
        />
        <StatCard 
          title="CPU Usage" 
          value={`${cpuPercent}%`} 
          trend="Live"
          trendUp={true}
          subText="System average"
          icon={Activity}
        />
        <StatCard 
          title="Memory Usage" 
          value={`${memoryUsedGB} GB`} 
          trend={`${memoryPercent}%`}
          trendUp={parseFloat(memoryPercent) < 80}
          subText={`${memoryTotalGB} GB Total`}
          icon={HardDrive}
        />
        <StatCard 
          title="Storage" 
          value="120 GB" 
          trend="+8.3%"
          trendUp={true}
          subText="Steady capacity increase"
          icon={Box}
        />
      </div>

      <div className="grid grid-cols-1 gap-4">
        <div className="shad-card p-6 min-h-[400px]">
          <ContainerList />
        </div>
      </div>
    </DashboardLayout>
  );
}

export default App;
