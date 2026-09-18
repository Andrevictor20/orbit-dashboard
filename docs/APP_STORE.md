# Saturn App Store — Catálogo & Guia de Aplicativos

A **Saturn App Store** é um ecossistema autônomo, desacoplado e multi-arquitetura projetado para fornecer mais de 920 aplicativos oficiais prontos para implantação com 1 clique, com total independência de ecossistemas legados de terceiros.

---

## 1. Visão Geral e Recursos Inteligentes

Diferente de gerenciadores de homelab tradicionais que realizam downloads lentos de arquivos ZIP pesados ou quebram silenciosamente em processadores ARM, a App Store do Saturn foi construída com foco em resiliência e inteligência de hardware:

- **Catálogo Otimizado via CDN:** Consumo de catálogo pré-compilado e minificado (`catalog.min.json`) via CDN global, reduzindo o tempo de carregamento para milissegundos e economizando banda e memória.
- **Detecção de Arquitetura em Tempo Real:** O backend consulta dinamicamente a CPU do seu host (`x86_64` vs `aarch64` / `ARM64`) e cruza com a compatibilidade declarada de cada contêiner.
- **Badges de Compatibilidade:** Cada cartão exibe chips inteligentes (`x86 / ARM` ou alerta âmbar de exclusividade de plataforma), evitando que você perca tempo tentando rodar imagens incompatíveis.
- **Filtro de Arquitetura da CPU:** Na barra de busca da loja, ative o filtro *"Compatíveis com meu Servidor"* para ocultar automaticamente qualquer aplicação não suportada pelo seu processador.
- **Cache Local e Operação Offline:** As definições são salvas em cache local (`/app/data/cached_apps.json`), garantindo que o catálogo continue disponível mesmo durante instabilidades temporárias de internet.
- **Gerenciador de Repositórios Comunitários:** Adicione e alterne lojas comunitárias de terceiros diretamente pelo modal de repositórios com persistência em `/app/data/stores.json`.

---

## 2. Estrutura de um Aplicativo no Catálogo

Todos os aplicativos da loja oficial residem no repositório [`Andrevictor20/saturn-apps`](https://github.com/Andrevictor20/saturn-apps) dentro da pasta `apps/<nome-do-app>/`. Cada aplicativo é composto por 4 arquivos obrigatórios:

```
saturn-apps/
└── apps/
    └── meu-app/
        ├── saturn-app.yml       # Metadados do app, categoria e arquiteturas suportadas
        ├── docker-compose.yml   # Configuração Docker Compose padronizada
        ├── icon.png             # Ícone do app (quadrado, mínimo 256x256 px)
        └── README.md            # Instruções de primeiro acesso e credenciais padrão
```

---

## 3. Especificação dos Arquivos

### 3.1. `saturn-app.yml` (Manifesto)

O manifesto declara os metadados consumidos pela interface e pelo compilador de catálogo:

```yaml
id: meu-app
name: Meu App
title:
  pt_BR: Meu Aplicativo Incrível
  en_US: My Awesome Application
tagline:
  pt_BR: Gerencie seus arquivos e notas com privacidade absoluta
  en_US: Manage your files and notes with absolute privacy
description:
  pt_BR: Descrição detalhada do que o aplicativo faz, seus benefícios e principais recursos.
  en_US: Detailed description of what the application does, its benefits, and key features.
category: Utilitários          # Categorias: Mídia, Produtividade, Utilitários, Redes, etc.
architectures:
  - amd64                      # Suporte a x86_64 / PCs / Servidores Intel & AMD
  - arm64                      # Suporte a ARM64 / Raspberry Pi 4 e 5 / Apple Silicon
port_map: "8080"               # Porta web principal utilizada pelo serviço
developer: Equipe Meu App
website: https://meuapp.exemplo.com
screenshot: []
```

### 3.2. `docker-compose.yml` (Serviço Docker)

Utilize especificações Compose limpas e padronizadas, sem chaves proprietárias ou caminhos absolutos rígidos:

```yaml
services:
  meu-app:
    image: vendor/meu-app:latest
    container_name: meu-app
    restart: unless-stopped
    ports:
      - "8080:8080"
    volumes:
      - /DATA/AppData/meu-app/config:/config
      - /DATA/AppData/meu-app/data:/data
    environment:
      - PUID=1000
      - PGID=1000
      - TZ=America/Sao_Paulo
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

---

## 4. Como Adicionar um Novo Aplicativo ao Catálogo Oficial

Para submeter um novo aplicativo ou atualizar um existente na loja oficial do Saturn:

1. **Faça um Fork do Repositório Oficial:**
   Acesse [github.com/Andrevictor20/saturn-apps](https://github.com/Andrevictor20/saturn-apps) e clique em **Fork**.

2. **Clone seu Fork Localmente:**
   ```bash
   git clone https://github.com/SEU_USUARIO/saturn-apps.git
   cd saturn-apps
   ```

3. **Crie a Pasta da Nova Aplicação:**
   ```bash
   mkdir -p apps/meu-novo-app
   ```
   Adicione os 4 arquivos obrigatórios (`saturn-app.yml`, `docker-compose.yml`, `icon.png` e `README.md`).

4. **Compile e Valide o Catálogo:**
   O repositório inclui um compilador Python que valida schemas e constrói o índice consolidado:
   ```bash
   python3 compiler/build_catalog.py
   ```
   O script validará a integridade de todos os YAMLs e gerará `catalog.json` e `catalog.min.json`. Certifique-se de que a compilação finalizou com status de sucesso.

5. **Envie seu Pull Request:**
   Faça commit das alterações e abra um Pull Request detalhando o aplicativo incluído. Após a revisão e aprovação pela equipe do Saturn, a ação de CI publicará o novo catálogo automaticamente e ele aparecerá na App Store de todos os usuários em questão de minutos!

---

## 5. Como Adicionar Repositórios Customizados no seu Saturn

Você não precisa esperar a inclusão no catálogo oficial para testar ou usar lojas comunitárias:

1. No painel do Saturn, abra a **App Store**.
2. Clique no ícone de repositórios no topo da tela (**Gerenciar Fontes da Loja**).
3. Insira o nome e a URL direta do arquivo `catalog.json` da sua fonte comunitária (exemplo: `https://raw.githubusercontent.com/comunidade/minha-loja/main/catalog.json`).
4. Clique em **Adicionar**. O Saturn sincronizará os novos aplicativos instantaneamente mantendo suas fontes salvas em `/app/data/stores.json`.
