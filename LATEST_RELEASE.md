# Saturn Dashboard v3.7.8

### Novidades, Correções e Melhorias na Versão 3.7.8

### 🐳 Segundo Contêiner Dedicado (`saturn-updater`) & Reinicialização Monitorada
- **Orquestrador Dedicado em Segundo Contêiner:** A atualização in-place agora cria e inicia automaticamente um contêiner independente (`saturn-updater`) diretamente via Docker Engine API (Bollard), eliminando falhas de permissão ao executar a CLI dentro do contêiner.
- **Pulls Explícitos no Host:** O script do `saturn-updater` realiza `docker pull` e `docker compose pull` explicitamente no host antes de recriar os serviços, garantindo que a nova imagem seja aplicada mesmo em tags `:latest`.
- **Verificação Ativa do Contêiner:** O `saturn-updater` monitora ativamente a transição e verifica via Docker API se o novo contêiner Saturn atingiu o estado `running` antes de encerrar.

### 🔄 Monitoramento Preciso de Versão no Frontend (`/updating`)
- **Fim dos Falsos Positivos de Sucesso:** A página de atualização `/updating` não considera mais requisições bem-sucedidas com a versão antiga como término da atualização; ela valida estritamente que a versão online retornada pelo healthcheck é idêntica à versão de destino (`v3.7.8`).
- **Feedback Visual da Transição:** Exibição em tempo real do encerramento do contêiner antigo, sondagem ativa da reconexão e confirmação inequívoca do novo contêiner operacional.
- **Hardening de Permissões:** Adicionado `privileged: true` ao template do `docker-compose.yml` no `install.sh`, assegurando permissões completas de gerenciamento do Docker socket.
