import React from 'react';
import { ShieldAlert, Sparkles } from 'lucide-react';

export const DiskSafetyGuideTab: React.FC = () => {
  return (
    <div className="space-y-4">
      <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-5 flex items-start gap-3.5">
        <ShieldAlert className="w-6 h-6 text-rose-500 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-rose-700 dark:text-rose-300">Diretrizes de Proteção do Sistema de Arquivos Linux</h3>
          <p className="text-xs text-rose-900/80 dark:text-rose-200/80 leading-relaxed">
            O Orbit bloqueia a exclusão de diretórios críticos essenciais. Abaixo está a lista detalhada do que <strong>NUNCA</strong> deve ser apagado manualmente via terminal ou scripts para evitar corrupção irreversível do host.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-card/70 border border-border/80 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-rose-500 font-bold text-sm">
            <ShieldAlert className="w-4 h-4" />
            <span>Pastas Críticas (Perigo Máximo 🔴)</span>
          </div>
          <ul className="space-y-2.5 text-xs text-secondary">
            <li className="p-2.5 rounded-xl bg-card border border-border/70 shadow-sm">
              <strong className="text-primary font-mono block">/boot</strong>
              Contém os kernels do Linux, Initramfs e Grub. Se apagado, o servidor não inicializará.
            </li>
            <li className="p-2.5 rounded-xl bg-card border border-border/70 shadow-sm">
              <strong className="text-primary font-mono block">/var/lib/docker/overlay2</strong>
              Camadas internas do Docker. Nunca use <code className="text-rose-500 font-semibold">rm -rf</code> diretamente aqui. Use sempre <code className="text-sky-500 font-semibold">docker system prune</code>.
            </li>
            <li className="p-2.5 rounded-xl bg-card border border-border/70 shadow-sm">
              <strong className="text-primary font-mono block">/etc</strong>
              Configurações globais do sistema operacional (<code className="text-secondary font-mono">fstab</code>, <code className="text-secondary font-mono">passwd</code>, rede, etc.).
            </li>
            <li className="p-2.5 rounded-xl bg-card border border-border/70 shadow-sm">
              <strong className="text-primary font-mono block">/lib e /usr/lib</strong>
              Bibliotecas compartilhadas (.so) necessárias para a execução de praticamente todos os binários do sistema.
            </li>
            <li className="p-2.5 rounded-xl bg-card border border-border/70 shadow-sm">
              <strong className="text-primary font-mono block">/proc e /sys</strong>
              Sistemas de arquivos virtuais gerados em memória RAM pelo kernel. Não ocupam espaço real em disco.
            </li>
          </ul>
        </div>

        <div className="bg-card/70 border border-border/80 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-amber-500 font-bold text-sm">
            <Sparkles className="w-4 h-4" />
            <span>Pastas de Atenção & Limpeza Segura (🟡 / 🟢)</span>
          </div>
          <ul className="space-y-2.5 text-xs text-secondary">
            <li className="p-2.5 rounded-xl bg-card border border-border/70 shadow-sm">
              <strong className="text-emerald-500 font-mono block">/tmp e /var/tmp (🟢 Seguro)</strong>
              Arquivos temporários de sessões e processos. Podem ser limpos com segurança.
            </li>
            <li className="p-2.5 rounded-xl bg-card border border-border/70 shadow-sm">
              <strong className="text-emerald-500 font-mono block">~/.cache (🟢 Seguro)</strong>
              Caches de navegadores e ferramentas CLI. Podem ser excluídos sem perda de dados permanentes.
            </li>
            <li className="p-2.5 rounded-xl bg-card border border-border/70 shadow-sm">
              <strong className="text-amber-500 font-mono block">/var/lib (🟡 Atenção)</strong>
              Contém dados de bancos de dados ativos (Postgres, MySQL, Redis) e volumes de aplicações.
            </li>
            <li className="p-2.5 rounded-xl bg-card border border-border/70 shadow-sm">
              <strong className="text-amber-500 font-mono block">~/.config (🟡 Atenção)</strong>
              Preferências de usuário e chaves de configurações de aplicativos.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};
