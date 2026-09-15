import React from 'react';
import { Sparkles, FileText, Archive, Trash2, ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface DiskInsightsTabProps {
  handleDockerPrune: () => void;
  isPruningDocker: boolean;
  handleNavigate: (path: string) => void;
  handleEmptyTrash: () => void;
  isCleaningTrash: boolean;
}

export const DiskInsightsTab: React.FC<DiskInsightsTabProps> = ({
  handleDockerPrune,
  isPruningDocker,
  handleNavigate,
  handleEmptyTrash,
  isCleaningTrash,
}) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Docker Prune Card */}
        <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-primary">
                  {t('disk.docker_prune_title', 'Docker: Limpeza de Imagens & Cache Órfãos')}
                </h3>
                <span className="text-[11px] text-emerald-400 font-mono">
                  {t('disk.docker_prune_reclaim', 'Liberação média: 2 a 15 GB')}
                </span>
              </div>
            </div>
            <p className="text-xs text-secondary leading-relaxed mb-4">
              {t('disk.docker_prune_desc', 'O Docker acumula camadas antigas de build, imagens não utilizadas (dangling) e containers parados. Esta ação limpa tudo que não está em uso ativo sem afetar seus containers em execução.')}
            </p>
          </div>

          <div className="pt-3 border-t border-border/60 flex items-center justify-between">
            <span className="text-[11px] text-zinc-500 font-mono">POST /api/docker/images/prune</span>
            <button
              onClick={handleDockerPrune}
              disabled={isPruningDocker}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-600 active:scale-95 text-white text-xs font-semibold shadow-md shadow-sky-500/20 transition-all disabled:opacity-50"
            >
              <Sparkles className={`w-3.5 h-3.5 ${isPruningDocker ? 'animate-spin' : ''}`} />
              <span>{isPruningDocker ? t('disk.pruning', 'Limpando...') : t('disk.run_prune', 'Executar Prune')}</span>
            </button>
          </div>
        </div>

        {/* System Logs & Journals Card */}
        <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-primary">
                  {t('disk.logs_title', 'Logs Rotacionados & Systemd Journals')}
                </h3>
                <span className="text-[11px] text-amber-700 dark:text-amber-400 font-mono font-semibold">
                  {t('disk.logs_reclaim', 'Liberação média: 500 MB a 5 GB')}
                </span>
              </div>
            </div>
            <p className="text-xs text-secondary leading-relaxed mb-4">
              {t('disk.logs_desc', 'Arquivos em /var/log e journals do Linux podem crescer indefinidamente. Arquivos compactados (.gz, .log.1) são seguros para exclusão.')}
            </p>
          </div>

          <div className="pt-3 border-t border-border/60 flex items-center justify-between">
            <span className="text-[11px] text-secondary font-mono">journalctl --vacuum-time=3d</span>
            <button
              onClick={() => handleNavigate('/var/log')}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-card border border-border hover:bg-accent text-primary text-xs font-semibold transition-all shadow-sm"
            >
              <span>{t('disk.inspect_var_log', 'Inspecionar /var/log')}</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Package Manager Cache Card */}
        <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 rounded-xl bg-violet-500/10 text-violet-400 border border-violet-500/20">
                <Archive className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-primary">
                  {t('disk.cache_title', 'Cache de Pacotes (APT / npm / pip)')}
                </h3>
                <span className="text-[11px] text-violet-500 dark:text-violet-400 font-mono">
                  {t('disk.cache_reclaim', 'Liberação média: 1 a 4 GB')}
                </span>
              </div>
            </div>
            <p className="text-xs text-secondary leading-relaxed mb-4">
              {t('disk.cache_desc', 'O gerenciador de pacotes retém arquivos .deb baixados em /var/cache/apt/archives.')}
            </p>
          </div>

          <div className="pt-3 border-t border-border/60 flex items-center justify-between">
            <span className="text-[11px] text-secondary font-mono">apt clean / apt autoclean</span>
            <button
              onClick={() => handleNavigate('/var/cache')}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-card border border-border hover:bg-accent text-primary text-xs font-semibold transition-all shadow-sm"
            >
              <span>{t('disk.inspect_var_cache', 'Inspecionar /var/cache')}</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Trash & Temporary Files Card */}
        <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-primary">
                  {t('disk.trash_title', 'Lixeira do Sistema & Temporários')}
                </h3>
                <span className="text-[11px] text-rose-500 dark:text-rose-400 font-mono font-semibold">
                  {t('disk.trash_reclaim', 'Esvaziamento Permanente')}
                </span>
              </div>
            </div>
            <p className="text-xs text-secondary leading-relaxed mb-4">
              {t('disk.trash_desc', 'Itens apagados pelo Gerenciador de Arquivos ficam na lixeira segura. Esvazie para recuperar o espaço físico permanentemente.')}
            </p>
          </div>

          <div className="pt-3 border-t border-border/60 flex items-center justify-between">
            <span className="text-[11px] text-secondary font-mono">DELETE /api/files/trash</span>
            <button
              onClick={handleEmptyTrash}
              disabled={isCleaningTrash}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 active:scale-95 text-white text-xs font-semibold shadow-md shadow-rose-500/20 transition-all disabled:opacity-50"
            >
              <Trash2 className={`w-3.5 h-3.5 ${isCleaningTrash ? 'animate-spin' : ''}`} />
              <span>{isCleaningTrash ? t('disk.emptying', 'Esvaziando...') : t('disk.empty_trash_action', 'Esvaziar Lixeira')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
