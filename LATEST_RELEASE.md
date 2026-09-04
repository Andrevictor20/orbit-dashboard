# Orbit Dashboard v2.2.0

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
