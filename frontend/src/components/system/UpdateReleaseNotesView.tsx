import React from 'react';
import {
  RefreshCw,
  ExternalLink,
  Cpu,
  Clock,
  CheckCircle2,
  GitBranch,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';
import type { SystemUpdateInfo } from './UpdateModal';
import type { ReleaseSection } from './releaseNotesParser';

interface UpdateReleaseNotesViewProps {
  updateInfo: SystemUpdateInfo | null;
  hasNewVersion: boolean;
  onRefreshInfo: () => void;
  formatPlatformName: (platform: string, arch: string) => string;
  parsedSections: ReleaseSection[];
}

export const UpdateReleaseNotesView: React.FC<UpdateReleaseNotesViewProps> = ({
  updateInfo,
  hasNewVersion,
  onRefreshInfo,
  formatPlatformName,
  parsedSections,
}) => {
  return (
    <>
      {/* Top Banner & Highlights */}
      <div className="p-5 pb-3 border-b border-border/60 bg-muted/20 space-y-3 shrink-0">
        {/* CI/CD Building Alert Banner */}
        {updateInfo?.ci_status === 'building' && (
          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start justify-between gap-3 text-xs text-amber-900 dark:text-amber-200 shadow-sm">
            <div className="flex items-start gap-2.5">
              <RefreshCw className="w-4 h-4 text-amber-600 dark:text-amber-400 animate-spin shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-primary flex items-center gap-1.5">
                  <span>Compilação Multi-Arch em Andamento</span>
                  <span className="text-[10px] bg-amber-500/20 text-amber-800 dark:text-amber-300 px-1.5 py-0.5 rounded font-mono font-semibold">
                    GitHub Actions
                  </span>
                </p>
                <p className="text-[11.5px] text-slate-600 dark:text-secondary mt-0.5 leading-relaxed">
                  A imagem da versão{' '}
                  <strong className="text-primary font-mono">
                    v{updateInfo.latest_version}
                  </strong>{' '}
                  está sendo compilada e empacotada no GitHub (~8 min). Esta tela
                  atualizará automaticamente assim que estiver pronta.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={onRefreshInfo}
                className="px-2.5 py-1 rounded-xl bg-card hover:bg-accent text-slate-700 dark:text-secondary hover:text-primary text-[11px] font-semibold border border-border/70 flex items-center gap-1 transition-colors"
                title="Verificar status no GitHub agora"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Verificar</span>
              </button>
              {updateInfo.ci_workflow_url && (
                <a
                  href={updateInfo.ci_workflow_url}
                  target="_blank"
                  rel="noreferrer"
                  className="px-2.5 py-1 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-800 dark:text-amber-200 text-[11px] font-semibold flex items-center gap-1 transition-colors"
                >
                  <span>Ver CI/CD</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>
        )}

        {/* Architecture & Date */}
        <div className="flex items-center justify-between p-2.5 px-3 rounded-xl bg-card border border-border/70 text-xs">
          <div className="flex items-center gap-1.5 text-slate-600 dark:text-secondary">
            <Cpu className="w-3.5 h-3.5 text-orbit-600 dark:text-orbit-400" />
            <span>Arquitetura:</span>
            <strong className="text-primary font-mono">
              {updateInfo
                ? formatPlatformName(updateInfo.platform, updateInfo.arch)
                : 'Detectando...'}
            </strong>
          </div>

          {updateInfo?.published_at && (
            <div className="flex items-center gap-1 text-slate-600 dark:text-secondary font-mono text-[11px]">
              <Clock className="w-3 h-3" />
              <span>
                {new Date(updateInfo.published_at).toLocaleDateString('pt-BR')}
              </span>
            </div>
          )}
        </div>

        {/* 2-Column Version Deck */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3.5 rounded-2xl bg-card border border-border/80 flex flex-col justify-between shadow-sm">
            <span className="text-xs text-slate-600 dark:text-secondary font-medium">
              Versão Instalada
            </span>
            <span className="text-xl font-bold text-primary font-mono mt-1">
              v{updateInfo?.current_version || '1.9.9'}
            </span>
            <div className="flex items-center gap-1 text-[11px] text-emerald-700 dark:text-emerald-400 mt-1 font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Instalação Ativa</span>
            </div>
          </div>

          <div
            className={`p-3.5 rounded-2xl border flex flex-col justify-between shadow-sm ${
              hasNewVersion
                ? 'bg-orbit-500/10 border-orbit-500/40'
                : 'bg-card border-border/80'
            }`}
          >
            <span className="text-xs text-slate-600 dark:text-secondary font-medium">
              Mais Recente
            </span>
            <span
              className={`text-xl font-bold font-mono mt-1 ${
                hasNewVersion
                  ? 'text-orbit-600 dark:text-orbit-400'
                  : 'text-primary'
              }`}
            >
              v
              {updateInfo?.latest_version ||
                updateInfo?.current_version ||
                '1.9.9'}
            </span>
            <div className="flex items-center gap-1 text-[11px] text-slate-600 dark:text-secondary mt-1 font-mono">
              <GitBranch className="w-3.5 h-3.5 text-orbit-600 dark:text-orbit-400" />
              <span>ghcr.io:latest</span>
            </div>
          </div>
        </div>
      </div>

      {/* Title & Refresh */}
      <div className="px-5 pt-2 pb-1 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-bold text-primary">
          <Sparkles className="w-3.5 h-3.5 text-orbit-600 dark:text-orbit-400" />
          <span>O que mudou nesta versão</span>
        </div>

        <button
          onClick={onRefreshInfo}
          className="text-[11px] text-slate-700 dark:text-secondary hover:text-primary transition-colors flex items-center gap-1 bg-card hover:bg-accent px-2.5 py-1 rounded-lg border border-border/70 active:scale-95 shadow-sm font-medium"
          title="Verificar atualizações"
        >
          <RefreshCw className="w-3 h-3" />
          <span>Verificar</span>
        </button>
      </div>

      {/* Release Notes List */}
      <div className="p-5 pt-2 overflow-y-auto flex-1 space-y-3 scrollbar-thin">
        {parsedSections.length > 0 ? (
          parsedSections.map((section, sIdx) => {
            const SectionIcon = section.icon;
            return (
              <div
                key={sIdx}
                className="p-4 rounded-2xl bg-white dark:bg-card border border-border/80 space-y-2.5 shadow-sm"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1 text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-lg border ${section.badgeClass}`}
                  >
                    <SectionIcon className="w-3 h-3" />
                    <span>{section.badgeLabel}</span>
                  </span>
                  <h3 className="text-xs font-bold text-slate-950 dark:text-white">
                    {section.title}
                  </h3>
                </div>

                <ul className="space-y-1.5 pl-2">
                  {section.items.map((item, iIdx) => (
                    <li
                      key={iIdx}
                      className="text-xs leading-relaxed flex items-start gap-2"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-orbit-500 dark:bg-orbit-400 shrink-0 mt-1.5" />
                      <div className="text-slate-900 dark:text-zinc-100 font-normal">
                        {item.title && (
                          <strong className="text-slate-950 dark:text-white font-bold mr-1">
                            {item.title}:
                          </strong>
                        )}
                        <span className="text-slate-800 dark:text-zinc-200">
                          {item.desc}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center p-8 rounded-2xl bg-card border border-border/60 text-slate-600 dark:text-secondary text-center space-y-2">
            <ShieldCheck className="w-8 h-8 text-emerald-600 dark:text-emerald-400 mb-1" />
            <p className="text-sm font-semibold text-primary">
              Orbit 100% Atualizado
            </p>
            <p className="text-xs text-slate-600 dark:text-secondary">
              Você está rodando a versão mais recente com todas as melhorias e
              correções aplicadas.
            </p>
          </div>
        )}
      </div>
    </>
  );
};
