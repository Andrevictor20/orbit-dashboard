import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { 
  ShieldAlert, CheckCircle2, XCircle, X, Shield, 
  FolderLock, Terminal, Cpu, HardDrive, Eye, RefreshCw,
  FileCheck, Sparkles
} from 'lucide-react';

interface MemberPermissionsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MemberPermissionsModal({ isOpen, onClose }: MemberPermissionsModalProps) {
  const { t } = useTranslation();

  if (!isOpen) return null;

  const content = (
    <div 
      className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-card border border-border/90 rounded-3xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border/70 bg-accent/20 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-saturn-500/15 border border-saturn-500/30 flex items-center justify-center text-saturn-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-base font-bold text-primary flex items-center gap-2">
                <span>{t('users.permissions_modal_title', 'Permissões & Acesso de Membro')}</span>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-saturn-500/10 text-saturn-400 border border-saturn-500/20">
                  {t('users.role_member', 'Membro')}
                </span>
              </h4>
              <p className="text-xs text-secondary mt-0.5">
                {t('users.permissions_modal_subtitle', 'Controle de privilégios e isolamento de segurança para usuários comuns')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-secondary hover:text-primary rounded-xl hover:bg-accent/60 transition-colors"
            aria-label={t('common.close', 'Fechar')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 sm:p-7 overflow-y-auto flex-1 space-y-6">
          {/* Summary Banner */}
          <div className="p-4 rounded-2xl bg-accent/30 border border-border/80 flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-saturn-400 shrink-0 mt-0.5" />
            <p className="text-xs text-secondary leading-relaxed">
              <strong className="text-primary font-semibold">Princípio do Menor Privilégio: </strong>
              O papel de <strong className="text-primary font-semibold">Membro</strong> foi projetado para familiares e convidados. Eles aproveitam mídias e serviços sem o risco de modificar configurações de rede, acessar consoles ou apagar dados acidentalmente.
            </p>
          </div>

          {/* Grid of Allowed vs Blocked */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Allowed Column */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b border-emerald-500/20">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <h5 className="text-xs font-bold text-emerald-500 uppercase tracking-wider">
                  {t('users.permissions_allowed_title', 'O que um Membro PODE acessar')}
                </h5>
              </div>

              <div className="space-y-2.5">
                <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/15 flex items-start gap-2.5">
                  <HardDrive className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-xs font-semibold text-primary block">
                      {t('users.perm_files_allowed_title', 'Arquivos em Armazenamento Externo')}
                    </span>
                    <span className="text-[11px] text-secondary leading-relaxed block mt-0.5">
                      {t('users.perm_files_allowed_desc', 'Navegação, download e upload em unidades externas (/media, /mnt, /DATA).')}
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/15 flex items-start gap-2.5">
                  <FileCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-xs font-semibold text-primary block">
                      {t('users.perm_streaming_title', 'Streaming Direto de Mídias')}
                    </span>
                    <span className="text-[11px] text-secondary leading-relaxed block mt-0.5">
                      {t('users.perm_streaming_desc', 'Reprodução integrada de vídeos, músicas e visualização de fotos sem limites.')}
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/15 flex items-start gap-2.5">
                  <Eye className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-xs font-semibold text-primary block">
                      {t('users.perm_containers_allowed_title', 'Aplicativos Autorizados')}
                    </span>
                    <span className="text-[11px] text-secondary leading-relaxed block mt-0.5">
                      {t('users.perm_containers_allowed_desc', 'Visualização e acesso via link aos contêineres definidos como visíveis pelo admin.')}
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/15 flex items-start gap-2.5">
                  <Shield className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-xs font-semibold text-primary block">
                      {t('users.perm_account_title', 'Gestão da Própria Conta')}
                    </span>
                    <span className="text-[11px] text-secondary leading-relaxed block mt-0.5">
                      {t('users.perm_account_desc', 'Troca da própria senha, ativação de 2FA/TOTP e seleção de tema visual.')}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Blocked Column */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b border-rose-500/20">
                <XCircle className="w-4 h-4 text-rose-500 shrink-0" />
                <h5 className="text-xs font-bold text-rose-500 uppercase tracking-wider">
                  {t('users.permissions_blocked_title', 'O que um Membro NÃO PODE acessar')}
                </h5>
              </div>

              <div className="space-y-2.5">
                <div className="p-3 rounded-xl bg-rose-500/5 border border-rose-500/15 flex items-start gap-2.5">
                  <Cpu className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-xs font-semibold text-primary block">
                      {t('users.perm_integrations_blocked_title', 'Integrações (Home Assistant, Cloudflare, Pi-hole)')}
                    </span>
                    <span className="text-[11px] text-secondary leading-relaxed block mt-0.5">
                      {t('users.perm_integrations_blocked_desc', 'Bloqueio total: membros não configuram, não editam e não usam nenhuma integração.')}
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-rose-500/5 border border-rose-500/15 flex items-start gap-2.5">
                  <Terminal className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-xs font-semibold text-primary block">
                      {t('users.perm_terminal_blocked_title', 'Terminal Web & SSH')}
                    </span>
                    <span className="text-[11px] text-secondary leading-relaxed block mt-0.5">
                      {t('users.perm_terminal_blocked_desc', 'Acesso à linha de comando do host e contêineres estritamente restrito a administradores.')}
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-rose-500/5 border border-rose-500/15 flex items-start gap-2.5">
                  <FolderLock className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-xs font-semibold text-primary block">
                      {t('users.perm_files_blocked_title', 'Deleção e Pastas Críticas')}
                    </span>
                    <span className="text-[11px] text-secondary leading-relaxed block mt-0.5">
                      {t('users.perm_files_blocked_desc', 'Proibido apagar, renomear, mover ou esvaziar lixeira. Pastas raiz (/etc, /root) bloqueadas.')}
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-rose-500/5 border border-rose-500/15 flex items-start gap-2.5">
                  <RefreshCw className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-xs font-semibold text-primary block">
                      {t('users.perm_admin_blocked_title', 'Atualizações, Backups & Usuários')}
                    </span>
                    <span className="text-[11px] text-secondary leading-relaxed block mt-0.5">
                      {t('users.perm_admin_blocked_desc', 'Sem acesso a atualizar o sistema, criar/restaurar backups ou gerenciar usuários.')}
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-rose-500/5 border border-rose-500/15 flex items-start gap-2.5">
                  <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-xs font-semibold text-primary block">
                      {t('users.perm_docker_blocked_title', 'Gestão Docker Avançada')}
                    </span>
                    <span className="text-[11px] text-secondary leading-relaxed block mt-0.5">
                      {t('users.perm_docker_blocked_desc', 'Proibido excluir contêineres, gerenciar volumes, redes Docker ou imagens.')}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-4 border-t border-border/70 bg-accent/10 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-saturn-500 hover:bg-saturn-600 text-white text-xs sm:text-sm font-semibold rounded-xl transition-all shadow-md shadow-saturn-500/20 active:scale-95"
          >
            {t('common.understood', 'Entendi')}
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(content, document.body) : null;
}
