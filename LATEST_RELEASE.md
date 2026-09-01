# Orbit Dashboard v2.0.0 (XP Kit Update)

### ✨ Novidades (Premium Redesign & Insights)
- **Design System Premium:** Todo o Orbit foi refatorado com um design "Double-Bezel" premium de alto contraste, física de molas (spring-bounce) nas interações e remoção de modais e selects nativos feios. O visual agora está no padrão "High-End".
- **Terminal Web Avançado:** O Terminal ganhou suporte a múltiplas abas concorrentes, barra de ferramentas superior e espaçamento ideal.
- **Alertas Preditivos (Insights):** Novo sistema de detecção inteligente em tempo real. O backend agora dispara alertas precisos quando houver pico de uso de CPU (>90%), RAM (>90%) e Alta Temperatura.
- **Ícones de Fallback:** Aplicativos sem ícones customizados não ficam mais invisíveis ou como um quadrado preto; assumem automaticamente a logo do Docker de forma elegante.

### ⚡ Desempenho & Arquitetura
- **Zero Bugs de React Hooks:** Refatoração pesada no gerenciamento de estado do Terminal e painel de análise, corrigindo deadlocks, renderizações quebradas e consumo excessivo do frontend.
- **Correção de Precisão no Armazenamento:** A Análise de Disco agora conta blocos físicos de fato (como no `du -h`), e não cai mais nas armadilhas dos *sparse files* monstruosos do BTRFS/Docker (adeus aos 128 TB).

### 🛠️ Correções
- Scrollbars nativas agressivas nos eixos horizontais e menus de abas foram exterminadas graças à regra CSS de ocultação.
- Correção crítica da sobreposição no modal de Atualização de Múltiplos Containers.
