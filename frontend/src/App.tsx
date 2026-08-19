import { Server, Activity, HardDrive, Box } from 'lucide-react';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { StatCard } from './components/ui/StatCard';

function App() {
  return (
    <DashboardLayout>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard 
          title="Total Containers" 
          value="12" 
          icon={Box} 
          trend="+2 this week"
          trendUp={true}
        />
        <StatCard 
          title="CPU Usage" 
          value="24%" 
          icon={Activity} 
          trend="Normal"
          trendUp={true}
        />
        <StatCard 
          title="Memory Usage" 
          value="3.2 GB" 
          icon={Server} 
          trend="4.0 GB Total"
        />
        <StatCard 
          title="Storage" 
          value="120 GB" 
          icon={HardDrive} 
          trend="80% Used"
          trendUp={false}
        />
      </div>

      <div className="glass-card p-6 min-h-[400px]">
        <h3 className="text-lg font-medium text-slate-200 mb-4">Active Containers</h3>
        <div className="flex items-center justify-center h-[300px] text-slate-500">
          <p>Container list will be populated here</p>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default App;
