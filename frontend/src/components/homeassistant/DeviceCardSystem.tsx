import React from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, ArrowDown, ArrowUp, Activity, Cpu, HardDrive, Play, Loader2, Network } from 'lucide-react';
import type { SystemMetrics } from './types';

interface DeviceCardSystemProps {
  metrics: SystemMetrics;
  isPending: (entityId: string) => boolean;
  onRunSpeedtest?: () => void;
}

export const DeviceCardSystem: React.FC<DeviceCardSystemProps> = ({
  metrics,
  isPending,
  onRunSpeedtest,
}) => {
  const { t } = useTranslation();

  const download = metrics.speedtestDownload?.state || '—';
  const upload = metrics.speedtestUpload?.state || '—';
  const ping = metrics.speedtestPing?.state || '—';
  const ip = metrics.ipAddress?.state || '—';

  const isTesting = metrics.runSpeedtestEntity
    ? isPending(metrics.runSpeedtestEntity.entity_id)
    : false;

  return (
    <div className="space-y-4">
      {/* Bloco Internet & Speedtest */}
      <div className="rounded-2xl border border-border/70 bg-card/60 backdrop-blur-3xl saturate-[190%] p-5 sm:p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/50 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-cyan-500/15 text-cyan-400 border border-cyan-500/20 shadow-sm">
              <Globe className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-primary flex items-center gap-2">
                {t('homeassistant.tab_system')} & Internet
              </h3>
              <p className="text-xs text-secondary font-mono">IP: {ip}</p>
            </div>
          </div>

          {onRunSpeedtest && (
            <button
              onClick={onRunSpeedtest}
              disabled={isTesting}
              className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-orbit-500 hover:bg-orbit-600 active:scale-95 text-white font-medium text-xs shadow-md shadow-orbit-500/20 transition-all disabled:opacity-50"
            >
              {isTesting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Testando...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>{t('homeassistant.run_speedtest')}</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* Métricas Speedtest */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-5">
          {/* Download */}
          <div className="p-4 rounded-xl bg-accent/40 border border-border/50 flex flex-col justify-between">
            <div className="flex items-center gap-2 text-xs text-secondary font-medium">
              <ArrowDown className="w-4 h-4 text-emerald-400" />
              <span>Download</span>
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-2xl font-extrabold text-primary tabular-nums">{download}</span>
              <span className="text-xs text-secondary">Mbps</span>
            </div>
          </div>

          {/* Upload */}
          <div className="p-4 rounded-xl bg-accent/40 border border-border/50 flex flex-col justify-between">
            <div className="flex items-center gap-2 text-xs text-secondary font-medium">
              <ArrowUp className="w-4 h-4 text-sky-400" />
              <span>Upload</span>
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-2xl font-extrabold text-primary tabular-nums">{upload}</span>
              <span className="text-xs text-secondary">Mbps</span>
            </div>
          </div>

          {/* Ping */}
          <div className="p-4 rounded-xl bg-accent/40 border border-border/50 flex flex-col justify-between">
            <div className="flex items-center gap-2 text-xs text-secondary font-medium">
              <Activity className="w-4 h-4 text-amber-400" />
              <span>Latência / Ping</span>
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-2xl font-extrabold text-primary tabular-nums">{ping}</span>
              <span className="text-xs text-secondary">ms</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bloco Raspberry Pi / Hardware se disponível no HA */}
      {(metrics.cpu || metrics.ram || metrics.disk) && (
        <div className="rounded-2xl border border-border/70 bg-card/60 backdrop-blur-3xl saturate-[190%] p-5 shadow-lg">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-secondary mb-4 flex items-center gap-2">
            <Network className="w-4 h-4 text-orbit-400" />
            Host Telemetry
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {metrics.cpu && (
              <div className="p-3.5 rounded-xl bg-accent/40 border border-border/50 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Cpu className="w-4 h-4 text-orbit-400" />
                  <span className="text-xs font-medium text-secondary">CPU</span>
                </div>
                <span className="text-sm font-bold text-primary">{metrics.cpu.state}%</span>
              </div>
            )}

            {metrics.ram && (
              <div className="p-3.5 rounded-xl bg-accent/40 border border-border/50 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Activity className="w-4 h-4 text-indigo-400" />
                  <span className="text-xs font-medium text-secondary">RAM</span>
                </div>
                <span className="text-sm font-bold text-primary">{metrics.ram.state}%</span>
              </div>
            )}

            {metrics.disk && (
              <div className="p-3.5 rounded-xl bg-accent/40 border border-border/50 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <HardDrive className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-medium text-secondary">Disco</span>
                </div>
                <span className="text-sm font-bold text-primary">{metrics.disk.state}%</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
