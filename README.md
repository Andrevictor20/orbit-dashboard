<div align="center">

# Orbit Dashboard

**Painel de gerenciamento de contêineres Docker, orquestração de stacks Compose e telemetria de hardware para servidores locais e ambientes homelab.**

[![CI Pipeline](https://github.com/Andrevictor20/orbit-dashboard/actions/workflows/ci.yml/badge.svg)](https://github.com/Andrevictor20/orbit-dashboard/actions/workflows/ci.yml)
[![Docker Image](https://img.shields.io/badge/Docker-Multi--Arch%20(amd64%20%7C%20arm64)-blue?logo=docker)](https://github.com/Andrevictor20/orbit-dashboard/pkgs/container/orbit-dashboard)
[![Backend](https://img.shields.io/badge/Backend-Rust%20%2B%20Axum-orange?logo=rust)](https://www.rust-lang.org/)
[![Frontend](https://img.shields.io/badge/Frontend-React%2019%20%2B%20Vite%208-61DAFB?logo=react)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Style-Tailwind%20CSS%20v4-38B2AC?logo=tailwindcss)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

<br/>

[Início Rápido](#instalação-e-início-rápido) •
[Funcionalidades](#funcionalidades-principais) •
[Arquitetura](#arquitetura-do-sistema) •
[Documentação](#documentação-técnica) •
[Licença](#licença)

</div>

---

## Demonstração Visual

A interface do Orbit foi desenvolvida para operação ágil em navegadores desktop e móveis, com atualização contínua de estado via WebSockets.

### Visão Geral do Sistema
Painel central consolidando estado dos contêineres, utilização de processador, memória, armazenamento e atalhos operacionais.
![Orbit Overview](./docs/videos/overview.webp)

### Gerenciamento de Contêineres e Stacks
Controle de ciclo de vida, inspeção de portas, logs em tempo real e agrupamento por stacks Docker Compose.
![Orbit Containers](./docs/videos/containers.webp)

### Catálogo de Aplicativos Integrado
Instalação orientada a manifestos declarativos, com validação de portas e volumes locais.
![Orbit App Store](./docs/videos/appstore.webp)

<details>
<summary><b>Visualizar capturas de tela adicionais (Métricas, Processos, Armazenamento, Terminal e Temas)</b></summary>
<br/>

| Seção | Captura de Tela |
| :--- | :--- |
| **Histórico de Métricas de Sistema** | ![Metrics](./docs/images/metrics.png) |
| **Análise e Alocação de Disco** | ![Disk Analyzer](./docs/images/disk_analyzer.png) |
| **Visualizador de Logs Centralizado** | ![Logs](./docs/images/logs.png) |
| **Terminal Web Integrado (XTerm.js)** | ![Terminal](./docs/images/terminal.png) |
| **Autenticação Local Segura (Argon2id)** | ![Login](./docs/images/login.png) |
| **Gerenciador de Arquivos do Host** | ![File Manager](./docs/images/file_manager.png) |
| **Paletas Visuais e Alto Contraste** | ![Themes](./docs/images/themes.png) |

</details>

---

## Funcionalidades Principais

### Gerenciamento de Contêineres e Stacks Compose
- **Ciclo de Vida Completo:** Inicialização, parada, reinício, pausa e remoção segura com timeout gracioso pré-exclusão.
- **Visualização por Stacks:** Identificação e agrupamento automático de serviços gerenciados via Docker Compose, com suporte a visualização detalhada de sub-contêineres.
- **Streaming de Atualizações em Segundo Plano:** Atualização de imagens com leitura assíncrona linha a linha de camadas do Docker, suporte a cancelamento sob demanda via `CancellationToken` e execução desacoplada resistente a timeouts de proxies reversos.
- **Detecção e Mapeamento de Portas:** Descoberta automática de endpoints web, priorização determinística de portas HTTP/HTTPS (80, 443, 8080, 8123, 3000) e suporte a contêineres em `network_mode: host`.

### Telemetria de Hardware, Kernel e Rede
- **Amostragem em Tempo Real:** Transmissão contínua via WebSocket com taxa de amostragem de 1 segundo e buffer circular em memória para histórico de curvas.
- **Telemetria de Rede Primária do Host:** Identificação dinâmica da interface física ativa (Ethernet cabo ou Wi-Fi) através de `/host/proc/1/net/route` e cálculo preciso de vazão em `/host/proc/1/net/dev`, com gráficos separados para tráfego do host e tráfego de contêineres.
- **Resolução Resiliente de Memória RAM:** Suporte a cálculo nativo de cgroups (v1 e v2) com fallback automático via amostragem de RSS de processos (`docker top` e `/proc/<pid>/statm`) para ambientes homelab onde `cgroup_enable=memory` não estiver ativado no kernel.
- **Monitor de Processos do Host:** Varredura granular de processos com distinção de threads de kernel (`kthreadd`), consumo delta de CPU e proteções rígidas contra encerramento de processos essenciais do sistema operacional.
- **Analisador de Armazenamento:** Mapeamento multi-disco (NVMe, SSD, SATA, microSD, USB) com visualização em árvore de diretórios e classificação de segurança preventiva contra exclusões em diretórios de sistema.

### Integração Nativa com Home Assistant
- **Agrupamento Físico de Hardware:** Consolidação de sensores e controles subordinados no registro do dispositivo pai, eliminando poluição visual de entidades brutas desmembradas.
- **Classificação Dinâmica de Áreas:** Mapeamento em tempo real de cômodos e ambientes extraídos diretamente via templates da API do Home Assistant.
- **Isolamento e Segurança:** Todas as requisições de controle e proxies de mídia/câmeras passam pelo backend Axum com Bearer Token seguro, prevenindo vazamento de credenciais e bloqueios de CORS no navegador.

### Terminal Web e Console de Diagnóstico
- **Terminal Web Interativo:** Emulação baseada em `@xterm/xterm` com suporte a WebSockets bidirecionais e alocação de pseudo-terminais (PTY) para acesso direto a contêineres (`docker exec`) ou shell local.
- **Central de Logs do Sistema:** Consulta em tempo real de buffers circulares de logs de execução do Orbit e de serviços gerenciados, com filtragem por níveis de severidade (ERROR, WARN, INFO, DEBUG).

### Ergonomia e Design System
- **Layout Adaptativo Mobile:** Top bar otimizada para viewports móveis (< 640px) com menu consolidado de preferências e alvos de toque em conformidade com WCAG AA (mínimo de 36x36px).
- **Alto Contraste Calibrado:** Tokens semânticos de cores para temas claro e escuro, eliminando estilos hardcoded ilegíveis e aplicando isolamento estrito de variantes via `@custom-variant dark`.

---

## Instalação e Início Rápido

### Requisitos Mínimos
- **Sistema Operacional:** Linux (Kernel 5.4 ou superior).
- **Arquitetura:** x86_64 (`amd64`) ou ARM64 (`aarch64`, ex.: Raspberry Pi 4/5).
- **Docker:** Docker Engine 20.10+ e Docker Compose v2+.
- **Memória:** Mínimo de 512 MB de RAM (consumo do binário Orbit inferior a 25 MB em repouso).

---

### Opção 1: Instalação Automática via Shell Script (Recomendado)

O script realiza a detecção de arquitetura, valida os pré-requisitos, instala o Docker caso ausente, cria o diretório de persistência e inicia o serviço:

```bash
curl -fsSL https://raw.githubusercontent.com/Andrevictor20/orbit-dashboard/main/install.sh | bash
```

Ao término da execução, acesse `http://<ip-do-servidor>:5172` no navegador.

---

### Opção 2: Implantação Declarativa via Docker Compose

Para gerenciar o Orbit como um serviço Compose padrão, utilize a configuração abaixo:

```yaml
services:
  orbit:
    image: ghcr.io/andrevictor20/orbit-dashboard:latest
    container_name: orbit-dashboard
    restart: unless-stopped
    network_mode: bridge
    privileged: true
    pid: host
    extra_hosts:
      - "host.docker.internal:host-gateway"
    ports:
      - "5172:5172"
    volumes:
      # Comunicação com a API do Docker Engine
      - /var/run/docker.sock:/var/run/docker.sock
      # Persistência de dados locais (credenciais, banco de dados, catálogo)
      - orbit_data:/app/data
      # Leitura de métricas do sistema e pontos de montagem do host
      - /:/host:rslave
      - /mnt:/mnt:rslave
      - /media:/media:rslave
    environment:
      - RUST_LOG=info
      - SSH_HOST=host.docker.internal
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

volumes:
  orbit_data:
```

Execute a inicialização com:

```bash
docker compose up -d
```

> **Nota de Arquitetura:** As diretivas `privileged: true`, `pid: host` e o mapeamento `/:/host:rslave` são necessários para que o Orbit colete as tabelas de processos do host, meça temperaturas de hardware, inspecione a tabela de rotas de rede e gerencie volumes montados sem isolamento cego de container.

---

## Arquitetura do Sistema

```
+-------------------------------------------------------------+
|                     Navegador Web (SPA)                     |
|      React 19 + TypeScript + Vite + Tailwind CSS v4         |
+------------------------------+------------------------------+
                               | HTTP/1.1 REST & WebSockets
+------------------------------v------------------------------+
|                     Orbit Backend Daemon                    |
|             Rust (Edição 2021) + Axum + Tokio Runtime       |
+------------------------------+------------------------------+
| Modulos:                                                    |
|  - docker::containers / stats / updates / update_runner     |
|  - system::network / processes / disks                      |
|  - auth::jwt (Argon2id + CSPRNG 64-byte secret)             |
|  - ws (Broadcaster assíncrono com ring buffer)              |
|  - store::catalog (Parser de manifestos Compose)            |
|  - homeassistant::proxy (Isolamento de tokens e CORS)       |
+------------------------------+------------------------------+
                               | IPC Unix Domain Socket & /proc
+------------------------------v------------------------------+
|             Docker Engine Daemon & Linux Kernel             |
|       /var/run/docker.sock, /host/proc, /host/sys           |
+-------------------------------------------------------------+
```

### Componentes de Tecnologia
- **Backend:** Linguagem Rust, framework Axum 0.8, runtime assíncrono Tokio, cliente Docker Bollard, alocador de memória mimalloc, biblioteca de telemetria sysinfo.
- **Frontend:** React 19, TypeScript (verbatimModuleSyntax), Vite, Tailwind CSS v4, biblioteca de gráficos Recharts, emulador de terminal @xterm/xterm, ícones Lucide.
- **Garantia de Qualidade e CI:** Vitest (136 testes unitários no frontend), Cargo test (93 testes no backend), Playwright (E2E e regressão visual), OWASP ZAP (análise dinâmica DAST), Grafana k6 (testes de estresse de API).

---

## Segurança e Governança

O desenvolvimento do Orbit segue práticas estritas de segurança em software (SSDLC):
- **Criptografia de Credenciais:** Hashes de senha gerados via algoritmo Argon2id com parâmetros de memória e tempo calibrados contra ataques de GPU/ASIC.
- **Sessões e Chaves JWT:** Geração de segredos com gerador de números pseudo-aleatórios criptograficamente seguro (CSPRNG) de 64 bytes (`rand::random::<[u8; 64]>()`) na primeira inicialização.
- **Proteção contra IDOR e Auto-Encerramento:** Bloqueio formal contra comandos de encerramento direcionados ao próprio processo do Orbit, PID 1 e daemons de infraestrutura do host (`systemd`, `sshd`, `dockerd`, `containerd`).
- **Política de Origem Dinâmica (CORS):** Restrição de conexões a origens locais válidas (endereços RFC 1918, domínios `.local`/`.lan`, rede Tailscale e túneis Cloudflare), rejeitando requisições de origens públicas arbitrárias.
- **Headers HTTP Defensivos:** Aplicação sistemática de `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` e `Referrer-Policy: strict-origin-when-cross-origin`.

---

## Documentação Técnica

Para documentação detalhada sobre cada subsistema, consulte os arquivos específicos:

- [Arquitetura Interna e Fluxo de Dados](docs/ARCHITECTURE.md): Modelagem de módulos, concorrência, estruturas de telemetria e padrões de design.
- [Guia de Instalação e Implantação](docs/INSTALLATION.md): Procedimentos completos para Docker, compilação a partir do código-fonte e proxies reversos.
- [Segurança da Informação e Políticas](docs/SECURITY.md): Modelo de ameaças, controles criptográficos, mitigação de abusos e pipeline DevSecOps.
- [Estratégia de Testes e Qualidade](docs/TESTING.md): Pirâmide de testes, suítes unitárias, integração, E2E, análise de mutação e gates de CI.

---

## Licença

Este projeto é distribuído sob a licença **MIT**. Para termos e condições de uso, consulte o arquivo [LICENSE](LICENSE).
