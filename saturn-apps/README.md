# Saturn Apps — O Catálogo Oficial de Aplicativos para Saturn

Repositório central de aplicativos e serviços auto-hospedados (self-hosted) compatíveis com o **Saturn**.

---

## 🎯 Objetivo
Este repositório fornece uma coleção curada e mantida pela comunidade de arquivos Docker Compose e metadados para instalação em um clique diretamente pelo Saturn.

## 📂 Estrutura do Repositório

```text
saturn-apps/
├── apps/
│   ├── <app-id>/
│   │   ├── saturn-app.yml      # Manifesto de metadados
│   │   ├── docker-compose.yml  # Definição dos containers
│   │   ├── icon.png            # Ícone oficial do app
│   │   └── README.md           # Instruções e documentação
├── compiler/
│   └── build_catalog.py        # Compilador do catálogo consolidado
├── _template/                  # Modelo para novos aplicativos
├── catalog.json                # Catálogo compilado
└── catalog.min.json            # Versão minificada para produção / CDN
```

---

## 🚀 Como Contribuir
Qualquer membro da comunidade pode adicionar novos aplicativos ou atualizar os existentes.

1. Faça um Fork deste repositório.
2. Copie a pasta `_template/` para `apps/<seu-app-id>/`.
3. Preencha o `saturn-app.yml`, configure o `docker-compose.yml` e adicione o `icon.png`.
4. Abra um Pull Request (PR). Nosso CI automatizado validará a integridade do seu app!

Consulte o guia completo em [CONTRIBUTING.md](./CONTRIBUTING.md).
