import { useEffect, useState } from 'react';
import { Play, Square, RefreshCw } from 'lucide-react';

interface Container {
  id: string;
  name: string;
  image: string;
  state: string;
  status: string;
}

export function ContainerList() {
  const [containers, setContainers] = useState<Container[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchContainers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/docker/containers');
      if (res.ok) {
        const data = await res.json();
        setContainers(data);
      }
    } catch (err) {
      console.error('Failed to fetch containers', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContainers();
  }, []);

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-sm font-semibold text-primary">Container Inventory</h3>
          <p className="text-xs text-secondary mt-1">Live from Docker Socket</p>
        </div>
        <button 
          onClick={fetchContainers}
          className="shad-button-outline text-xs py-1.5 px-3 flex items-center gap-2"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>
      
      <div className="flex-1 overflow-auto border shad-border rounded-md">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-secondary uppercase bg-accent/50 border-b shad-border">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Image</th>
              <th className="px-4 py-3 font-medium">State</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {containers.length === 0 && !loading && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-secondary">
                  No containers found
                </td>
              </tr>
            )}
            {containers.map((c) => (
              <tr key={c.id} className="border-b shad-border hover:bg-accent/50 transition-colors">
                <td className="px-4 py-3 font-medium text-primary">
                  {c.name}
                </td>
                <td className="px-4 py-3 text-secondary truncate max-w-[150px]">
                  {c.image}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${
                      c.state === 'running' ? 'bg-emerald-500' : 'bg-rose-500'
                    }`} />
                    <span className="capitalize">{c.state}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    {c.state === 'running' ? (
                      <button className="p-1.5 rounded hover:bg-accent text-secondary hover:text-rose-400 transition-colors" title="Stop">
                        <Square className="w-4 h-4" />
                      </button>
                    ) : (
                      <button className="p-1.5 rounded hover:bg-accent text-secondary hover:text-emerald-400 transition-colors" title="Start">
                        <Play className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
