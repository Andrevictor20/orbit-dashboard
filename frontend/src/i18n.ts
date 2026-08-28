import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  pt: {
    translation: {
      "dashboard": {
        "title": "Orbit Dashboard",
        "subtitle": "Monitore o desempenho do sistema e containers em tempo real",
        "connected": "Conectado",
        "disconnected": "Desconectado",
        "system_performance": "Desempenho do Sistema",
        "container_status": "Status dos Containers",
        "live": "Ao vivo",
        "syncing": "Sincronizando do socket",
        "system_average": "Média do sistema",
        "total": "Total",
        "containers": "Containers",
        "cpu_usage": "Uso de CPU",
        "memory_usage": "Uso de Memória",
        "storage": "Armazenamento",
        "capacity_increase": "Aumento constante de capacidade"
      },
      "sidebar": {
        "dashboards": "Dashboards",
        "overview": "Visão Geral",
        "metrics": "Métricas do Sistema",
        "files": "Arquivos",
        "file_manager": "Gerenciador de Arquivos",
        "logs": "Logs do Sistema",
        "docker": "Docker",
        "store": "App Store",
        "containers": "Containers",
        "images": "Imagens",
        "networks": "Redes",
        "volumes": "Volumes",
        "settings": "Configurações Globais",
        "sign_out": "Sair",
        "terminal": "Terminal Web"
      },
      "container_list": {
        "title": "Inventário de Containers",
        "subtitle": "Em tempo real do Socket Docker",
        "refresh": "Atualizar",
        "name": "Nome",
        "image": "Imagem",
        "state": "Estado",
        "actions": "Ações",
        "no_containers": "Nenhum container encontrado"
      },
      "update_modal": {
        "title": "Atualização do Orbit",
        "subtitle": "Gerenciamento e implantação sob demanda",
        "available": "Disponível",
        "architecture": "Arquitetura",
        "installed_version": "Versão Instalada",
        "active_installation": "Instalação Ativa",
        "latest_github": "Mais Recente no GitHub",
        "what_changed": "O que há de novo / O que foi corrigido",
        "refresh": "Verificar",
        "no_notes": "Nenhuma nota de versão disponível no momento.",
        "close": "Fechar",
        "updating": "Atualizando...",
        "update_now": "Atualizar Orbit Agora",
        "reinstall_force": "Reinstalar / Forçar Atualização",
        "downloading_image": "Baixando imagem multi-arch do GitHub Container Registry (GHCR)...",
        "restarting_orbit": "Imagem baixada! Reiniciando container do Orbit... Aguarde reconexão.",
        "update_success": "Orbit atualizado com sucesso! Recarregando...",
        "restarting_manual": "O Orbit está reiniciando. Atualize a página manualmente caso não recarregue.",
        "badge_fix": "Correção",
        "badge_feat": "Nova Funcionalidade",
        "badge_perf": "Performance",
        "badge_sec": "Segurança",
        "badge_refactor": "Melhoria",
        "badge_docs": "Documentação",
        "badge_update": "Atualização"
      }
    }
  },
  en: {
    translation: {
      "dashboard": {
        "title": "Orbit Dashboard",
        "subtitle": "Monitor your system performance and containers in real-time",
        "connected": "Connected",
        "disconnected": "Disconnected",
        "system_performance": "System Performance",
        "container_status": "Container Status",
        "live": "Live",
        "syncing": "Syncing from socket",
        "system_average": "System average",
        "total": "Total",
        "containers": "Containers",
        "cpu_usage": "CPU Usage",
        "memory_usage": "Memory Usage",
        "storage": "Storage",
        "capacity_increase": "Steady capacity increase"
      },
      "sidebar": {
        "dashboards": "Dashboards",
        "overview": "Overview",
        "metrics": "System Metrics",
        "files": "Files",
        "file_manager": "File Manager",
        "logs": "System Logs",
        "docker": "Docker",
        "store": "App Store",
        "containers": "Containers",
        "images": "Images",
        "networks": "Networks",
        "volumes": "Volumes",
        "settings": "Global Settings",
        "sign_out": "Sign Out",
        "terminal": "Web Terminal"
      },
      "container_list": {
        "title": "Container Inventory",
        "subtitle": "Live from Docker Socket",
        "refresh": "Refresh",
        "name": "Name",
        "image": "Image",
        "state": "State",
        "actions": "Actions",
        "no_containers": "No containers found"
      },
      "update_modal": {
        "title": "Orbit Update",
        "subtitle": "On-demand system management & deployment",
        "available": "Available",
        "architecture": "Architecture",
        "installed_version": "Installed Version",
        "active_installation": "Active Installation",
        "latest_github": "Latest on GitHub",
        "what_changed": "What's New / What's Fixed",
        "refresh": "Check",
        "no_notes": "No release notes available at this time.",
        "close": "Close",
        "updating": "Updating...",
        "update_now": "Update Orbit Now",
        "reinstall_force": "Reinstall / Force Update",
        "downloading_image": "Downloading multi-arch image from GitHub Container Registry (GHCR)...",
        "restarting_orbit": "Image downloaded! Restarting Orbit container... Please wait for reconnection.",
        "update_success": "Orbit updated successfully! Reloading...",
        "restarting_manual": "Orbit is restarting. Please refresh the page manually if it does not reload.",
        "badge_fix": "Fix",
        "badge_feat": "New Feature",
        "badge_perf": "Performance",
        "badge_sec": "Security",
        "badge_refactor": "Improvement",
        "badge_docs": "Documentation",
        "badge_update": "Update"
      }
    }
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: "pt", // Idioma padrão em PT-BR
    fallbackLng: "en",
    interpolation: {
      escapeValue: false 
    }
  });

export default i18n;
