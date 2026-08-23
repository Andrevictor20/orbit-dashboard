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
