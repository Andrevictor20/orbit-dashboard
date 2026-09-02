# Orbit Dashboard v2.1.0

### ✨ Novidades & Recursos Principais (v2.1.0)
- **Detecção e Catalogação Inteligente de Portas Web:**
  - **Eliminação de Portas Duplicadas:** Deduplicação nativa de bindings IPv4 (`0.0.0.0`) e IPv6 (`::`), unificando mapeamentos em uma única badge limpa (adeus portas repetidas como `8096:8096` lado a lado).
  - **Descoberta em Host Networking:** Containers operando em `network_mode: host` (como Home Assistant) ou com portas declaradas em labels de ecossistema (`io.casaos.port.web`) agora são catalogados automaticamente e exibem sua porta pública correspondente (ex: Home Assistant na porta `8123`).
  - **Priorização da Porta Principal:** Algoritmo de classificação que posiciona portas Web/HTTP (80, 443, 8080, 8123, 8096, 3000, 5000, 1880, 5678, etc.) em primeiro lugar, impedindo que portas secundárias de rede (DHCP 67, DNS 53) ocultem a porta da interface Web.
  - **Porta Principal Clicável & Botão "Abrir" Automático:** Badges de portas agora possuem destaque visual com link direto. O botão "Abrir" passa a ser renderizado automaticamente para qualquer container com porta Web ativa, sem exigir configuração manual prévia.
- **Atualização em Lote de Containers em Segundo Plano:**
  - Novo `BatchUpdateContext` e `BatchUpdateFloatingBar`: permite disparar a atualização de múltiplos containers e continuar navegando no dashboard livremente sem perda de progresso ou cancelamento de processos.
- **App Store & Detecção de Apps Instalados:**
  - Menu lateral de seleção de categorias retrátil em telas menores (`< lg`) com toggle responsivo.
  - Badges verdes "Instalado" com ícone de verificação para apps já presentes no host, com botão alternando automaticamente para "Gerenciar".

### 🎨 Design, Responsividade & Tema Claro
- **Responsividade Aperfeiçoada:** Ajustes de layout para meia tela (704px a 960px) e mobile no cabeçalho superior (`DashboardLayout`), grid de telemetria e bento launcher (`Overview`) e barra de navegação do `DiskAnalyzer`.
- **Contraste Perfeito no Tema Claro (Light Mode):**
  - Terminal Web (XTerm & SSH) com paleta dinâmica clara de alto contraste com sync em tempo real sem fechar sessões ativas.
  - Eliminação de fundos escuros estáticos no Gerenciador de Arquivos, Console de Logs e Analisador de Disco, garantindo conformidade com padrões WCAG AAA.

### ⚙️ Engenharia & Versionamento
- **Sistema Automatizado de SemVer:** Incremento padronizado por nível de impacto a cada commit (Patch para pequenas correções, Minor para médias adições e Major para quebras estruturais), com script dedicado e git hook nativo.

