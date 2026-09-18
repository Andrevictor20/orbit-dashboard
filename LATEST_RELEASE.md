# Saturn Dashboard v3.7.2

### Novidades, Correções e Melhorias na Versão 3.7.2

### ⚡ Atualizações do Sistema & Reinicialização Instantânea
- **Auto-Reconexão Instantânea:** Implementada sonda inteligente no modal de atualização que verifica o Content-Type JSON contra respostas HTML de fallback da SPA e aciona o recarregamento automático da página no instante em que o novo container responde.
- **Endpoint Público `/api/health`:** Espelhada a rota de verificação de integridade no Axum para consulta direta por clientes web e scripts de monitoramento sem necessidade de autenticação prévia.
- **Reinício Acelerado:** Otimizada a sequência de parada do container com `docker stop -t 4`, reduzido o delay de flush pré-restart e eliminado o `docker compose pull` redundante no script auxiliar.

### 🛍️ App Store & Resiliência Visual
- **Correção dos Ícones da Loja:** Corrigida a decodificação de 183 aplicações do repositório oficial `saturn-apps` cujos arquivos vetoriais SVG causavam rejeição de MIME (`text/plain` com `nosniff`) pelo GitHub Raw, convertendo-os para PNGs nativos 256x256.
- **Componente Resiliente `AppIcon`:** Implementado com lazy-loading, tentativa automática de fallback no CDN Walkxcode (`dashboard-icons`), renderização elegante de iniciais em gradiente em caso de falha de rede e supressão de caixas pretas de imagem quebrada (`alt=""`).
- **Ergonomia dos Cards:** Otimizada a ação primária para "Instalar" (`common.install`) e adotado layout flex assimétrico com largura livre, eliminando o aperto tipográfico em resoluções compactas e mantendo o botão "Explorar" acessível via teclado (WCAG AA).

### 🛡️ Governança de Releases
- **Prevenção de Bumps Fantasmas:** Adicionada salvaguarda em `scripts/bump-version.mjs` que bloqueia bumps automáticos de versão quando apenas documentação ou regras de IA forem alteradas.
