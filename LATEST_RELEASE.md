# Saturn Dashboard v3.9.1

### Novidades, Correções e Melhorias na Versão 3.9.1

### 🚀 Auto-Cleanup e Ocultação Estrita do Contêiner Auxiliar `saturn-updater`
- **Auto-Remoção do Contêiner Auxiliar (`--rm`):** O contêiner temporário `saturn-updater` agora é criado com `auto_remove: true` na API do Docker Engine. Ao concluir a orquestração do update, ele é automaticamente purgado pelo daemon do Docker, eliminando o acúmulo de contêineres órfãos em estado `exited`.
- **Limpeza Automática de Contêineres Residuais no Boot:** O ciclo de limpeza e inicialização do Saturn (`backend/src/system/update/cleaner.rs`) agora remove ativamente qualquer instância remanescente do `saturn-updater` na inicialização do sistema.
- **Filtro de Contêineres Internos no Backend:** A rota `/api/docker/containers` e o endpoint `/api/docker/containers/{id}` agora filtram estritamente o `saturn-updater`, impedindo que contêineres de manutenção interna do sistema sejam expostos como aplicações para o usuário.
- **Isolamento de Stacks no Frontend:** O utilitário de agrupamento de stacks (`groupContainers`) e o hook de filtragem (`useFilteredContainers`) ignoram o `saturn-updater`, garantindo que o Saturn Dashboard exiba apenas o contêiner principal (`1 / 1 ativo`), sem criar grupos falsos de "2 containers" no painel.
