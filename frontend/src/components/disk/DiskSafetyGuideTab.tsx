import React from 'react';
import { ShieldAlert, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export const DiskSafetyGuideTab: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-5 flex items-start gap-3.5">
        <ShieldAlert className="w-6 h-6 text-rose-500 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-rose-700 dark:text-rose-300">
            {t('disk.safety_title', 'Diretrizes de Proteção do Sistema de Arquivos Linux')}
          </h3>
          <p className="text-xs text-rose-900/80 dark:text-rose-200/80 leading-relaxed">
            {t(
              'disk.safety_intro',
              'O Saturn bloqueia a exclusão de diretórios críticos essenciais. Abaixo está a lista detalhada do que NUNCA deve ser apagado manualmente via terminal ou scripts para evitar corrupção irreversível do host.'
            )}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-card/70 border border-border/80 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-rose-500 font-bold text-sm">
            <ShieldAlert className="w-4 h-4" />
            <span>{t('disk.critical_folders_title', 'Pastas Críticas (Perigo Máximo 🔴)')}</span>
          </div>
          <ul className="space-y-2.5 text-xs text-secondary">
            <li className="p-2.5 rounded-xl bg-card border border-border/70 shadow-sm">
              <strong className="text-primary font-mono block">/boot</strong>
              {t('disk.boot_desc', 'Contém os kernels do Linux, Initramfs e Grub. Se apagado, o servidor não inicializará.')}
            </li>
            <li className="p-2.5 rounded-xl bg-card border border-border/70 shadow-sm">
              <strong className="text-primary font-mono block">/var/lib/docker/overlay2</strong>
              {t('disk.docker_overlay_desc', 'Camadas internas do Docker. Nunca use rm -rf diretamente aqui. Use sempre docker system prune.')}
            </li>
            <li className="p-2.5 rounded-xl bg-card border border-border/70 shadow-sm">
              <strong className="text-primary font-mono block">/etc</strong>
              {t('disk.etc_desc', 'Configurações globais do sistema operacional (fstab, passwd, rede, etc.).')}
            </li>
            <li className="p-2.5 rounded-xl bg-card border border-border/70 shadow-sm">
              <strong className="text-primary font-mono block">/lib e /usr/lib</strong>
              {t('disk.lib_desc', 'Bibliotecas compartilhadas (.so) necessárias para a execução de praticamente todos os binários do sistema.')}
            </li>
            <li className="p-2.5 rounded-xl bg-card border border-border/70 shadow-sm">
              <strong className="text-primary font-mono block">/proc e /sys</strong>
              {t('disk.proc_desc', 'Sistemas de arquivos virtuais gerados em memória RAM pelo kernel. Não ocupam espaço real em disco.')}
            </li>
          </ul>
        </div>

        <div className="bg-card/70 border border-border/80 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-amber-500 font-bold text-sm">
            <Sparkles className="w-4 h-4" />
            <span>{t('disk.attention_folders_title', 'Pastas de Atenção & Limpeza Segura (🟡 / 🟢)')}</span>
          </div>
          <ul className="space-y-2.5 text-xs text-secondary">
            <li className="p-2.5 rounded-xl bg-card border border-border/70 shadow-sm">
              <strong className="text-emerald-500 font-mono block">{t('disk.tmp_safe', '/tmp e /var/tmp (🟢 Seguro)')}</strong>
              {t('disk.tmp_desc', 'Arquivos temporários de sessões e processos. Podem ser limpos com segurança.')}
            </li>
            <li className="p-2.5 rounded-xl bg-card border border-border/70 shadow-sm">
              <strong className="text-emerald-500 font-mono block">{t('disk.cache_home_safe', '~/.cache (🟢 Seguro)')}</strong>
              {t('disk.cache_home_desc', 'Caches de navegadores e ferramentas CLI. Podem ser excluídos sem perda de dados permanentes.')}
            </li>
            <li className="p-2.5 rounded-xl bg-card border border-border/70 shadow-sm">
              <strong className="text-amber-500 font-mono block">{t('disk.var_lib_attention', '/var/lib (🟡 Atenção)')}</strong>
              {t('disk.var_lib_desc', 'Contém dados de bancos de dados ativos (Postgres, MySQL, Redis) e volumes de aplicações.')}
            </li>
            <li className="p-2.5 rounded-xl bg-card border border-border/70 shadow-sm">
              <strong className="text-amber-500 font-mono block">{t('disk.config_home_attention', '~/.config (🟡 Atenção)')}</strong>
              {t('disk.config_home_desc', 'Preferências de usuário e chaves de configurações de aplicativos.')}
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};
