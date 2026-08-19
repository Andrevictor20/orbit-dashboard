import { TrendingUp, Activity, HardDrive, Box } from 'lucide-react';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { StatCard } from './components/ui/StatCard';

function App() {
  return (
    <DashboardLayout>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-primary tracking-tight">Orbit Dashboard</h2>
        <p className="text-sm text-secondary mt-1">Monitor your system performance and containers in real-time</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard 
          title="Total Containers" 
          value="12" 
          trend="+2"
          trendUp={true}
          subText="Trending up this month"
          icon={TrendingUp}
        />
        <StatCard 
          title="CPU Usage" 
          value="24%" 
          trend="Normal"
          trendUp={true}
          subText="Strong performance"
          icon={Activity}
        />
        <StatCard 
          title="Memory Usage" 
          value="3.2 GB" 
          trend="-2.1%"
          trendUp={false}
          subText="Capacity needs attention"
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="shad-card p-6 min-h-[400px] lg:col-span-2 flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-sm font-semibold text-primary">System Performance</h3>
              <p className="text-xs text-secondary mt-1">Resource usage vs capacity</p>
            </div>
            <button className="shad-button-outline text-xs py-1.5 px-3">
              Last 12 hrs
            </button>
          </div>
          <div className="flex-1 border border-dashed shad-border rounded-md flex items-center justify-center text-secondary text-sm">
            [Chart Area]
          </div>
        </div>

        <div className="shad-card p-6 min-h-[400px] flex flex-col">
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-primary">Container Status</h3>
            <p className="text-xs text-secondary mt-1">Active vs Stopped</p>
          </div>
          <div className="flex-1 border border-dashed shad-border rounded-md flex items-center justify-center text-secondary text-sm">
            [Donut Chart]
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default App;
