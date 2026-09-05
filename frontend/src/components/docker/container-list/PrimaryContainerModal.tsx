import React from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Layers, X, ExternalLink, Settings2 } from 'lucide-react';
import { resolveWebUrl } from '../../../utils/url';
import type { GroupContainerItem } from '../../../utils/containerGroups';

export interface PrimaryContainerModalProps {
  isOpen: boolean;
  group: GroupContainerItem | null;
  customLinks: Record<string, string>;
  onClose: () => void;
  onSelectPrimary: (groupKey: string, containerId: string, containerName: string) => void;
  onEditLink: (e: React.MouseEvent, containerId: string) => void;
}

export function PrimaryContainerModal({
  isOpen,
  group,
  customLinks,
  onClose,
  onSelectPrimary,
  onEditLink,
}: PrimaryContainerModalProps) {
  const { t } = useTranslation();

  if (!isOpen || !group || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-2xl shadow-2xl p-5 sm:p-6 w-full max-w-lg mx-auto my-auto max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-orbit-500/10 text-orbit-600 dark:text-orbit-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-primary">
                {t('containers.select_primary')}
              </h3>
              <p className="text-xs text-secondary">{group.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-secondary hover:text-primary hover:bg-accent/80 transition-colors"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-2.5 mb-4">
          {group.containers.map(sub => {
            const isSelected = group?.primaryContainer.id === sub.id;
            const ports = sub.ports?.filter(p => p.public_port) || [];
            const link = customLinks[sub.id] || (ports.length > 0 ? resolveWebUrl(ports[0].public_port) : '');

            return (
              <div
                key={sub.id}
                className={`w-full p-3 rounded-xl border flex items-center justify-between gap-3 transition-all ${
                  isSelected
                    ? 'bg-orbit-500/15 border-orbit-500/60 text-orbit-700 dark:text-orbit-300 font-medium shadow-sm'
                    : 'bg-background hover:bg-accent/40 border-border text-primary'
                }`}
              >
                <button
                  type="button"
                  onClick={() => onSelectPrimary(group.groupKey, sub.id, sub.name)}
                  className="flex-1 text-left min-w-0 flex items-center gap-3"
                >
                  <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                    isSelected ? 'border-orbit-500 bg-orbit-500 text-white' : 'border-border bg-card'
                  }`}>
                    {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm truncate text-primary">{sub.name}</span>
                      {isSelected && (
                        <span className="px-2 py-0.5 rounded-full bg-orbit-500 text-white text-[10px] font-bold">
                          {t('containers.primary')}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-secondary font-mono block truncate mt-0.5">
                      {link ? link : t('containers.no_public_ports')}
                    </span>
                  </div>
                </button>

                <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                  {link && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(link, '_blank');
                      }}
                      className="p-1.5 rounded-lg text-orbit-600 dark:text-orbit-300 hover:text-orbit-700 dark:hover:text-white bg-orbit-500/10 hover:bg-orbit-500/25 border border-orbit-500/30 transition-all"
                      title={t('containers.open_app')}
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={(e) => onEditLink(e, sub.id)}
                    className="p-1.5 rounded-lg text-secondary hover:text-primary bg-accent/50 hover:bg-accent border border-border transition-all"
                    title={t('containers.edit_link')}
                  >
                    <Settings2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-secondary hover:text-primary hover:bg-accent/50 transition-colors text-sm font-medium"
          >
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
