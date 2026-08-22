import { useEffect, useState, useRef } from 'react';
import { Terminal as TerminalIcon, RefreshCw, AlertTriangle } from 'lucide-react';

interface LogsResponse {
  logs: string[];
}

export function Logs() {
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/logs');
      if (!res.ok) throw new Error('Failed to fetch logs');
      const data: LogsResponse = await res.json();
      setLogs(data.logs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error fetching logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 5000); // Polling every 5 seconds
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-2">
            <TerminalIcon className="w-8 h-8 text-orbit-500" />
            Orbit Logs
          </h1>
          <p className="text-gray-400 mt-2">
            System logs from the backend service
          </p>
        </div>
        <button
          onClick={fetchLogs}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-orbit-600 hover:bg-orbit-500 text-white rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="bg-gray-900 rounded-lg p-4 border border-gray-800 shadow-xl overflow-hidden flex flex-col h-[65vh]">
        {error ? (
          <div className="flex items-center gap-2 text-red-500 bg-red-500/10 p-4 rounded-lg">
            <AlertTriangle className="w-5 h-5" />
            <p>{error}</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto font-mono text-sm text-gray-300 space-y-1">
            {logs.length === 0 ? (
              <p className="text-gray-500 italic">No logs found. The system might just be starting up.</p>
            ) : (
              logs.map((line, i) => (
                <div key={i} className="break-all whitespace-pre-wrap">
                  {line}
                </div>
              ))
            )}
            <div ref={logsEndRef} />
          </div>
        )}
      </div>
    </div>
  );
}
