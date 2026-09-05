# Orbit Dashboard v2.3.0

### 🚀 Novidades & Recursos Principais (v2.3.0)
- **Agrupamento Universal de Entidades do Home Assistant & Inspeção Interativa por Modal:**
  - **Fim da Poluição Visual de Entidades Brutas:** As centenas de entidades e sensores soltos (`sensor.*`, `binary_sensor.*`, `event.*`, `update.*`) agora são consolidados automaticamente em **Dispositivos Físicos e Lógicos Coesos** (`HADeviceGroup`).
  - **Identificação e Agrupamento Inteligente de Hardware e Rotinas:**
    - *Roteador Huawei IGD:* Unificação de status WAN, endereço IP externo e telemetria de tráfego (KiB/s download/upload) em um único dispositivo de rede.
    - *Backups do Sistema:* Agrupamento de status do gerenciador, último backup concluído e próximo agendamento.
    - *Ciclo Solar & Astronomia:* Agrupamento de `sun.sun`, horários solares (alvorada, crepúsculo, meio-dia).
    - *Home Assistant Cloud & Assistente de Voz:* Consolidação de STT, TTS, conversation e Remote UI.
    - *Atualizações de Sistema & HACS:* Agrupamento de atualizações de cards e do core.
    - *Lâmpadas & Tomadas Inteligentes:* Consolidadas individualmente com suas respectivas leituras de consumo elétrico (W, kWh, V, A).
    - *Câmeras de Segurança & Dispositivos Móveis:* Tapo C200 com detecção de movimento e smartphones com nível de bateria e presença.
  - **Card de Dispositivo em Liquid Glass (`DeviceGroupCard`):** Card vítreo translúcido com ícone temático, quick toggle inline para luzes e tomadas, badge de status, contagem de entidades filhas e botão de expansão.
  - **Modal de Detalhe e Inspeção (`DeviceDetailModal`):** Ao clicar no card, abre uma gaveta detalhada exibindo todas as entidades e sensores do dispositivo com controles interativos em tempo real, leituras de telemetria e cópia de `entity_id` com 1 clique.
  - **Subfiltros por Categoria & Busca Rápida:** Filtros dinâmicos (Iluminação, Tomadas, Mídia, Climatização, Câmeras, Dispositivos Móveis, Rede, Sistema & Backups, Automações, Sensores) com campo de busca em tempo real.

- **Desacoplamento Assíncrono do Atualizador de Containers (Fim dos Timeouts Cloudflare 524):**
  - **Resposta Imediata na API:** O endpoint `POST /api/docker/containers/{id}/update` agora responde em `< 20ms` com status `started` e delega a recriação do container a uma tarefa assíncrona em segundo plano, eliminando timeouts de 60-100s impostos por proxies reversos e túneis.
  - **Polling Leve de Status:** Novo endpoint `GET /api/docker/containers/{id}/update-status` com acompanhamento de progresso em tempo real pela interface.
  - **Reordenação Estratégica da Fila:** Containers de rede e túnel (`cloudflared`, `traefik`, `nginx-proxy`) são atualizados estritamente no final da fila, mantendo o tráfego estável durante todo o processo.
  - **Isolamento de Stacks Compose:** Execução cirúrgica escopada por serviço (`pull <service>` e `up -d --no-deps <service>`).

- **Mini Gráficos SVG Nativos em Tempo Real na Visão Geral:**
  - **Mini Sparklines Ultraleves:** Curvas Bézier cúbicas suaves com interpolação contínua e gradientes fluidos para CPU, Memória e Rede, com taxa de atualização de 60fps e zero overhead de bibliotecas pesadas.
  - **Otimização Vertical dos Cards:** Redução da altura ociosa e harmonização visual completa dos cards de telemetria com a listagem desagregada de discos.

---

### 🛠️ Correções & Melhorias Anteriores (v2.2.1)
- **Verificação Precisa de Prontidão da Imagem no GitHub Container Registry (GHCR):**
  - **Fim dos Falsos Positivos de Atualização:** O sistema agora consulta diretamente a API de manifestos do registry OCI (`ghcr.io`) para checar se a imagem multi-arch (amd64 / arm64) da nova versão já foi concluída e publicada antes de disponibilizar o botão de atualizar.
  - **Proteção Pré-Atualização:** Tentativas de atualização enquanto a imagem ainda estiver sendo gerada no GitHub Actions são bloqueadas na API com status explicativo, evitando downloads prematuros de versões anteriores.
  - **Auto-Polling no Modal de Atualização:** Quando a imagem estiver em compilação, o painel verifica automaticamente a cada 7 segundos o status no GitHub e libera o botão assim que o pacote estiver 100% pronto.
- **Eliminação de Cache Agressivo de HTML/SPA no Navegador:**
  - **Headers Estritos Anti-Cache:** O servidor Axum agora injeta `Cache-Control: no-cache, no-store, must-revalidate, max-age=0` e `Pragma: no-cache` em todas as rotas SPA e arquivos HTML, garantindo que o navegador nunca sirva versões antigas do painel após uma reinicialização.
  - **Redirecionamento com Limpeza Forçada:** O redirecionamento pós-atualização agora aplica bypass de cache no navegador, carregando imediatamente as novas telas e recursos sem requerer hard refresh (Ctrl+F5).
  - **Assets com Cache Imutável:** Arquivos de scripts e estilos versionados em `/assets/` mantêm cache seguro de longo prazo para velocidade instantânea de navegação.

### ✨ Novidades & Recursos Principais (v2.2.0)
- **Integração Nativa com Home Assistant:**
  - **Configuração Direta pela Interface Gráfica:** Adicione a URL da sua instância e o Token de Acesso de Longa Duração diretamente pela interface do Orbit, sem necessidade de editar arquivos de configuração ou acessar o terminal.
  - **Proxy Seguro & Proteção contra Restrições de CORS:** Toda a comunicação é intermediada pelo backend Axum com persistência segura em volume (`data/homeassistant.json`), eliminando bloqueios de rede local cruzada (CORS) e mascarando o token do cliente.
  - **Controle e Telemetria de Dispositivos em Tempo Real:**
    - Lâmpadas inteligentes com controle de ligado/desligado e slider de intensidade de brilho.
    - Tomadas e interruptores elétricos com alternância instantânea.
    - Sensores de presença e sensores de abertura de portas/janelas.
    - Sensores numéricos de telemetria e termostatos de climatização com exibição de temperatura atual e alvo.
  - **Filtros Rápidos & Busca Instantânea:** Filtragem por categorias (Luzes, Tomadas, Sensores, Climatização) e busca instantânea em tempo real.
  - **Acesso Dedicado na Barra Lateral:** Nova seção "Integrações" na sidebar com suporte bilíngue completo (Português e Inglês).

- **Efeito Translúcido / Liquid Glass & Animações Suaves:**
  - **Física Autêntica de Vidro Líquido:** Superfícies translúcidas de cards, sidebar, topbar e modais com profundidade óptica aprimorada em todos os 6 temas (`--card` em 0.48 no escuro e 0.58 no claro) com desfoque aumentado para `blur(28px) saturate(190%) contrast(105%)`.
  - **Chanfro Especular Superior:** Borda chanfrada vítrea reproduzindo o reflexo de aresta lapidada através da sombra `--glass-shadow`.
  - **Orbs Luminosas Atmosféricas Dinâmicas:** 4 fontes de luz multicoloridas e orgânicas se movimentando suavemente em segundo plano (`animate-float-slow`, `animate-float-reverse`, `animate-pulse-glow`), gerando refração óptica viva sob os cartões e a barra lateral.
  - **Física de Mola Amortecida (Spring Physics):** Transições de mola suaves (`cubic-bezier(0.16, 1, 0.3, 1)`) com micro-interações táteis elásticas em botões, pills, modais e cards.

- **Telemetria de Armazenamento por Unidade Física (HDs, SSDs e microSD Separados):**
  - **Desagregação de Mídia:** Fim da barra única que somava todos os discos; visualização em camadas dedicadas para cada HD, SSD NVMe, pendrive USB e cartão microSD.
  - **Classificação Inteligente:** Ícones temáticos contextuais, badges de tecnologia (`NVMe`, `microSD`, `HD Externo`, `USB`), ponto de montagem e medidores individuais de capacidade.

- **Redução Massiva do Consumo de Memória RAM (De ~100 MB para ~30 MB):**
  - **Alocador Global Mimalloc:** Substituição do glibc malloc padrão pelo `mimalloc`, garantindo liberação imediata de páginas de memória para o sistema operacional (`madvise`).
  - **Tokio Runtime Otimizado:** Limitação para 4 worker threads, reduzindo overhead de stacks ociosas e context switching.
  - **Zero-Copy JSON Cache:** Catálogo de aplicativos da App Store servido em tempo $O(1)$ diretamente da memória sem re-serializações ou clones massivos de structs.

- **Resiliência do Atualizador em Lote & Detecção de Portas:**
  - **Socket Timeout de 15 Minutos:** Aumento do timeout do socket Bollard para 900s, viabilizando o download de imagens de múltiplos gigabytes sem cancelamento de conexão.
  - **Compatibilidade com Rede Host:** Resolução de conflitos de `EndpointsConfig` em containers com `network_mode: "host"`.
  - **Detecção da Porta 14333:** Catalogação automática da porta Web da interface do `cloudflared` com priorização e geração automática do botão "Abrir".
