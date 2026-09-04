# Orbit Dashboard v2.2.1

### 🛠️ Correções & Melhorias no Sistema de Atualização (v2.2.1)
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
