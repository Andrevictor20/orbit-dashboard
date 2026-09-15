# Orbit Dashboard v3.6.1

### Novidades e Recursos da Versão 3.6.0

- **Sistema Completo de Backups e Restauração Inteligente:**
  - **Backup de Sistema Completo:** Crie snapshots compactados de todo o ambiente Orbit com 1 clique, preservando configurações centrais (`orbit_auth.json`, `settings.json`, `custom_links.json`, `jwt.secret`), todas as integrações (`pihole.json`, `cloudflare.json`, `samba.json`, Home Assistant), rotinas de agendamento, todos os aplicativos em `/data/apps/*` com volumes e o manifesto Docker de contêineres.
  - **Backup de Configurações & Integrações:** Snapshot ultraleve contendo apenas credenciais, tokens, rotas e parâmetros do Orbit sem a carga de volumes de dados.
  - **Backup de Todos os Contêineres & Apps:** Snapshot em massa para proteger todos os aplicativos e contêineres gerenciados.
  - **Restauração Atômica e Segura:** Descompactação e verificação automática do manifesto `orbit_manifest.json` com modal de confirmação reforçada exigindo a digitação da palavra `RESTAURAR` para prevenir ações acidentais.
  - **Rotinas Automáticas com Escopo:** Configure agendamentos automáticos periódicos (diários/semanais) para todo o sistema, todas as aplicações ou apps selecionados.

- **Telemetria de GPU e Top 5 Processos em Tempo Real:**
  - **Card de GPU na Visão Geral:** Acompanhe percentual de uso, consumo de memória VRAM (usada/total), temperatura em tempo real, gráfico histórico sparkline e detecção do modelo da placa de vídeo.
  - **Top 5 Processos (CPU e RAM):** Acesse rapidamente através do botão no canto superior dos cards os processos com maior consumo, identificando PID, nome, tag do contêiner e link direto para detalhes.
  - **Hero Header de Boas-Vindas:** Barra superior com saudação de boas-vindas, relógio dinâmico, fuso horário, alternador de formato 12h/24h e widget climático com Qualidade do Ar (AQI + status).
  - **Armazenamento Redesenhado:** Visual mais limpo com foco no espaço livre restante de cada partição.

- **Expansão Global Multilíngue (9 Idiomas):**
  - Suporte completo e oficial para **Japonês (ja)**, **Chinês Simplificado (zh)**, **Coreano (ko)**, **Árabe (ar - com suporte a RTL)**, **Francês (fr)**, **Espanhol (es)** e **Italiano (it)**, além de **Português (pt)** e **Inglês (en)**.
  - Arquitetura de internacionalização modular por domínios (`common`, `backups`, `containers`, `docker`, etc.) garantindo 100% de paridade de tradução e carregamento ultrarrápido.

- **Estabilidade, Qualidade de Código e Performance:**
  - Decomposição modular completa de componentes extensos no frontend e backend, mantendo arquivos enxutos e altamente sustentáveis.
  - Suíte completa de testes automatizados unitários e de integração 100% aprovada.
