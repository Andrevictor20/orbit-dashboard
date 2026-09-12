import { Sparkles, Zap, Wrench, type LucideIcon } from 'lucide-react';

export interface ReleaseItem {
  title: string;
  desc: string;
}

export interface ReleaseSection {
  title: string;
  badgeLabel: string;
  badgeClass: string;
  icon: LucideIcon;
  items: ReleaseItem[];
}

export function parseReleaseNotes(raw: string): ReleaseSection[] {
  if (!raw || !raw.trim()) return [];

  const sections: ReleaseSection[] = [];
  const lines = raw.split('\n');

  let currentSection: ReleaseSection = {
    title: 'Melhorias da Versão',
    badgeLabel: 'NOVIDADE',
    badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    icon: Sparkles,
    items: [],
  };

  for (let line of lines) {
    line = line.trim();
    if (!line || line.startsWith('# ')) continue;

    if (line.startsWith('### ') || line.startsWith('## ')) {
      if (currentSection.items.length > 0) {
        sections.push(currentSection);
      }

      const heading = line.replace(/^#+\s*/, '').trim();
      const lower = heading.toLowerCase();

      if (
        lower.includes('desempenho') ||
        lower.includes('performance') ||
        lower.includes('fluidez')
      ) {
        currentSection = {
          title: heading.replace(/^[^\w\s]+/, '').trim() || 'Desempenho & Fluidez',
          badgeLabel: 'DESEMPENHO',
          badgeClass:
            'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 font-semibold',
          icon: Zap,
          items: [],
        };
      } else if (
        lower.includes('correç') ||
        lower.includes('fix') ||
        lower.includes('bug')
      ) {
        currentSection = {
          title: heading.replace(/^[^\w\s]+/, '').trim() || 'Correções & Estabilidade',
          badgeLabel: 'CORREÇÃO',
          badgeClass:
            'bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/30 font-semibold',
          icon: Wrench,
          items: [],
        };
      } else {
        currentSection = {
          title: heading.replace(/^[^\w\s]+/, '').trim() || 'Novidades',
          badgeLabel: 'NOVIDADE',
          badgeClass:
            'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 font-semibold',
          icon: Sparkles,
          items: [],
        };
      }
      continue;
    }

    if (line.startsWith('- ') || line.startsWith('* ')) {
      const text = line.replace(/^[-*]\s+/, '').trim();
      const boldMatch = text.match(/^\*\*(.*?)\*\*[:\s-]*(.*)$/);
      if (boldMatch) {
        const cleanTitle = boldMatch[1].replace(/[:\s-]+$/, '').trim();
        const cleanDesc = boldMatch[2].replace(/^[:\s-]+/, '').trim();
        currentSection.items.push({
          title: cleanTitle,
          desc: cleanDesc,
        });
      } else {
        currentSection.items.push({
          title: '',
          desc: text,
        });
      }
    }
  }

  if (currentSection.items.length > 0) {
    sections.push(currentSection);
  }

  return sections;
}
