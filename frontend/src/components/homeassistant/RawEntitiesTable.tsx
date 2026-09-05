import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, ToggleLeft, ToggleRight, Loader2, ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import type { HAEntity } from './types';

interface RawEntitiesTableProps {
  entities: HAEntity[];
  isPending: (entityId: string) => boolean;
  onToggle: (entity: HAEntity) => void;
}

const PAGE_SIZE = 25;

export const RawEntitiesTable: React.FC<RawEntitiesTableProps> = ({
  entities,
  isPending,
  onToggle,
}) => {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [domainFilter, setDomainFilter] = useState('all');
  const [page, setPage] = useState(1);

  // Domínios únicos
  const domains = useMemo(() => {
    const set = new Set<string>();
    entities.forEach((e) => {
      const [dom] = e.entity_id.split('.');
      if (dom) set.add(dom);
    });
    return Array.from(set).sort();
  }, [entities]);

  // Filtro
  const filtered = useMemo(() => {
    return entities.filter((e) => {
      const [dom] = e.entity_id.split('.');
      if (domainFilter !== 'all' && dom !== domainFilter) return false;

      if (!search.trim()) return true;
      const q = search.toLowerCase();
      const fn = (e.attributes.friendly_name || '').toLowerCase();
      return e.entity_id.toLowerCase().includes(q) || fn.includes(q);
    });
  }, [entities, search, domainFilter]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE) || 1;
  const paginated = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  return (
    <div className="rounded-2xl border border-border/70 bg-card/60 backdrop-blur-3xl saturate-[190%] p-4 sm:p-5 shadow-xl space-y-4">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-orbit-400" />
          <h3 className="text-sm font-bold text-primary">
            {t('homeassistant.tab_raw_entities')}
          </h3>
          <span className="text-xs text-secondary font-mono bg-accent px-2 py-0.5 rounded-md">
            {filtered.length} / {entities.length}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Seletor de Domínio */}
          <select
            value={domainFilter}
            onChange={(e) => {
              setDomainFilter(e.target.value);
              setPage(1);
            }}
            className="px-2.5 py-1.5 rounded-xl border border-border/70 bg-card text-xs text-primary focus:outline-none focus:ring-2 focus:ring-orbit-500"
          >
            <option value="all">{t('homeassistant.tab_all')}</option>
            {domains.map((dom) => (
              <option key={dom} value={dom}>
                {dom}
              </option>
            ))}
          </select>

          {/* Busca */}
          <div className="relative w-full sm:w-56">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-secondary" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder={t('homeassistant.search_placeholder')}
              className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-border/70 bg-card text-xs text-primary focus:outline-none focus:ring-2 focus:ring-orbit-500"
            />
          </div>
        </div>
      </div>

      {/* Tabela de Entidades */}
      <div className="overflow-x-auto rounded-xl border border-border/60">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-border/60 bg-accent/40 text-secondary font-semibold uppercase tracking-wider text-[10px]">
              <th className="p-3">Entidade</th>
              <th className="p-3">Nome Amigável</th>
              <th className="p-3">Estado</th>
              <th className="p-3 text-right">Ação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {paginated.map((e) => {
              const [dom] = e.entity_id.split('.');
              const isToggleable = ['light', 'switch', 'input_boolean'].includes(dom);
              const isOn = e.state === 'on';
              const pending = isPending(e.entity_id);

              return (
                <tr key={e.entity_id} className="hover:bg-accent/20 transition-colors">
                  <td className="p-3 font-mono text-[11px] text-primary truncate max-w-[200px]">
                    {e.entity_id}
                  </td>
                  <td className="p-3 text-secondary truncate max-w-[180px]">
                    {e.attributes.friendly_name || '—'}
                  </td>
                  <td className="p-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium font-mono ${
                        isOn
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          : 'bg-accent text-secondary'
                      }`}
                    >
                      {e.state}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    {isToggleable && (
                      <button
                        onClick={() => onToggle(e)}
                        disabled={pending}
                        className="p-1 rounded text-secondary hover:text-primary active:scale-95"
                        title={isOn ? t('homeassistant.state_on') : t('homeassistant.state_off')}
                      >
                        {pending ? (
                          <Loader2 className="w-4 h-4 animate-spin text-orbit-400" />
                        ) : isOn ? (
                          <ToggleRight className="w-5 h-5 text-orbit-400" />
                        ) : (
                          <ToggleLeft className="w-5 h-5" />
                        )}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-secondary pt-2">
          <span>
            Página {page} de {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-1.5 rounded-lg border border-border/70 bg-card hover:bg-accent disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-1.5 rounded-lg border border-border/70 bg-card hover:bg-accent disabled:opacity-40"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
