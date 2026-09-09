import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ShieldCheck,
  ShieldAlert,
  Search,
  Plus,
  Trash2,
  Copy,
  Check,
  Globe,
  Loader2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { PiHoleDomainItem } from '../../types/pihole';

interface PiHoleDomainListProps {
  domains: PiHoleDomainItem[];
  loading: boolean;
  onAddDomain: (domain: string, listType: 'white' | 'black') => Promise<void>;
  onRemoveDomain: (domain: string, listType: 'white' | 'black') => Promise<void>;
}

export function PiHoleDomainList({
  domains,
  loading,
  onAddDomain,
  onRemoveDomain,
}: PiHoleDomainListProps) {
  const { t } = useTranslation();
  const [activeSubTab, setActiveSubTab] = useState<'white' | 'black'>('white');
  const [searchQuery, setSearchQuery] = useState('');
  const [newDomainInput, setNewDomainInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedDomain, setCopiedDomain] = useState<string | null>(null);
  const [deletingDomain, setDeletingDomain] = useState<string | null>(null);

  const filteredDomains = useMemo(() => {
    return domains
      .filter((item) => item.list_type === activeSubTab)
      .filter((item) =>
        item.domain.toLowerCase().includes(searchQuery.toLowerCase().trim())
      );
  }, [domains, activeSubTab, searchQuery]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newDomainInput.trim().toLowerCase();
    if (!clean) return;

    // Simple domain regex validation
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-_.]*\.[a-zA-Z]{2,}$/;
    if (!domainRegex.test(clean)) {
      toast.error(t('pihole.invalid_domain_format'));
      return;
    }

    try {
      setIsSubmitting(true);
      await onAddDomain(clean, activeSubTab);
      setNewDomainInput('');
      toast.success(
        t('pihole.domain_added_success', {
          domain: clean,
          list: activeSubTab === 'white' ? t('pihole.whitelist') : t('pihole.blacklist'),
        })
      );
    } catch (err: any) {
      toast.error(err.message || t('pihole.domain_add_failed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemove = async (domain: string, listType: 'white' | 'black') => {
    try {
      setDeletingDomain(`${domain}:${listType}`);
      await onRemoveDomain(domain, listType);
      toast.success(t('pihole.domain_removed_success', { domain }));
    } catch (err: any) {
      toast.error(err.message || t('pihole.domain_remove_failed'));
    } finally {
      setDeletingDomain(null);
    }
  };

  const handleCopy = (domain: string) => {
    navigator.clipboard.writeText(domain);
    setCopiedDomain(domain);
    setTimeout(() => setCopiedDomain(null), 1500);
  };

  return (
    <div className="rounded-2xl border shad-border bg-surface/80 dark:bg-zinc-900/80 backdrop-blur-md p-5 flex flex-col space-y-4">
      {/* Sub-tabs header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border/50">
        <div className="flex items-center gap-2 bg-zinc-100 dark:bg-zinc-800/80 p-1 rounded-xl w-fit">
          <button
            type="button"
            onClick={() => setActiveSubTab('white')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeSubTab === 'white'
                ? 'bg-surface dark:bg-zinc-700 text-emerald-500 shadow-sm'
                : 'text-secondary hover:text-primary'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>{t('pihole.whitelist')}</span>
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-emerald-500/10 text-emerald-500 font-mono">
              {domains.filter((d) => d.list_type === 'white').length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('black')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeSubTab === 'black'
                ? 'bg-surface dark:bg-zinc-700 text-rose-500 shadow-sm'
                : 'text-secondary hover:text-primary'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>{t('pihole.blacklist')}</span>
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-rose-500/10 text-rose-500 font-mono">
              {domains.filter((d) => d.list_type === 'black').length}
            </span>
          </button>
        </div>

        {/* Search input */}
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-secondary" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('pihole.search_domains_placeholder')}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-surface dark:bg-zinc-800 border border-border focus:border-orbit-500 focus:outline-none transition-colors"
          />
        </div>
      </div>

      {/* Add Domain Form */}
      <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Globe className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-secondary" />
          <input
            type="text"
            value={newDomainInput}
            onChange={(e) => setNewDomainInput(e.target.value)}
            placeholder={
              activeSubTab === 'white'
                ? t('pihole.add_whitelist_placeholder')
                : t('pihole.add_blacklist_placeholder')
            }
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-surface dark:bg-zinc-800 border border-border focus:border-orbit-500 focus:outline-none transition-colors font-mono"
          />
        </div>
        <button
          type="submit"
          disabled={isSubmitting || !newDomainInput.trim()}
          className={`flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white shadow-sm transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
            activeSubTab === 'white'
              ? 'bg-emerald-600 hover:bg-emerald-500'
              : 'bg-rose-600 hover:bg-rose-500'
          }`}
        >
          {isSubmitting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Plus className="w-4 h-4" />
          )}
          <span>
            {activeSubTab === 'white'
              ? t('pihole.add_to_whitelist')
              : t('pihole.add_to_blacklist')}
          </span>
        </button>
      </form>

      {/* Domains Table / List */}
      <div className="overflow-x-auto rounded-xl border border-border/50">
        <table className="w-full text-left text-xs">
          <thead className="bg-zinc-100/70 dark:bg-zinc-800/50 text-secondary border-b border-border/50">
            <tr>
              <th className="py-2.5 px-4 font-medium">{t('pihole.col_domain')}</th>
              <th className="py-2.5 px-4 font-medium">{t('pihole.col_type')}</th>
              <th className="py-2.5 px-4 font-medium text-right">{t('pihole.col_actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {loading ? (
              <tr>
                <td colSpan={3} className="py-8 text-center text-secondary">
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-orbit-500" />
                    <span>{t('common.loading')}</span>
                  </div>
                </td>
              </tr>
            ) : filteredDomains.length === 0 ? (
              <tr>
                <td colSpan={3} className="py-8 text-center text-secondary">
                  {searchQuery ? t('pihole.no_matching_domains') : t('pihole.list_empty')}
                </td>
              </tr>
            ) : (
              filteredDomains.map((item) => {
                const actionKey = `${item.domain}:${item.list_type}`;
                const isDeleting = deletingDomain === actionKey;
                const isCopied = copiedDomain === item.domain;

                return (
                  <tr
                    key={item.domain}
                    className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors group"
                  >
                    <td className="py-3 px-4 font-mono font-medium text-primary">
                      {item.domain}
                    </td>
                    <td className="py-3 px-4">
                      {item.list_type === 'white' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <ShieldCheck className="w-3 h-3" />
                          {t('pihole.whitelist')}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                          <ShieldAlert className="w-3 h-3" />
                          {t('pihole.blacklist')}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => handleCopy(item.domain)}
                          className="p-1.5 rounded-lg text-secondary hover:text-primary hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                          title={t('common.copy')}
                        >
                          {isCopied ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemove(item.domain, item.list_type)}
                          disabled={isDeleting}
                          className="p-1.5 rounded-lg text-secondary hover:text-rose-400 hover:bg-rose-500/10 transition-colors disabled:opacity-50"
                          title={t('common.delete')}
                        >
                          {isDeleting ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-400" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
