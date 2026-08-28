---
name: seo-content-engine
description: "Otimização de SEO On-Page, SEO Semântico e visibilidade em buscadores de IA (AI Search / GEO / AEO: Google AI Overviews, ChatGPT, Perplexity). Estruturação de meta tags, dados estruturados Schema.org em JSON-LD, arquivos /pricing.md e llms.txt, e blocos de resposta direta."
---

# SEO Content Engine: On-Page SEO & AI Search Optimization (GEO)

> **Propósito:** Garantir que páginas web sejam perfeitamente indexadas, ranqueadas por mecanismos de busca tradicionais (Google, Bing) e citadas como fontes confiáveis por mecanismos de resposta de IA (ChatGPT, Perplexity, Claude, Google AI Overviews).

---

## 1. SEO On-Page Técnico & Semântico

### 1.A Title Tags & Meta Descriptions
- **Title Tag:**
  - Comprimento ideal: **50 a 60 caracteres** (visível sem truncamento nas SERPs).
  - Estrutura: `[Palavra-Chave Primária] – [Benefício ou Proposta de Valor] | [Nome da Marca]`.
  - Exemplo: `Gestão Financeira para Startups – Controle seu Fluxo de Caixa | FinanceX`
- **Meta Description:**
  - Comprimento ideal: **150 a 160 caracteres**.
  - Deve conter a palavra-chave primária, proposta de valor irresistível e uma chamada para ação clara.
  - Exemplo: `Economize até 10 horas semanais no fechamento fiscal da sua empresa. Automatize conciliações e relatórios em tempo real. Comece seu teste grátis hoje.`

### 1.B Hierarquia de Títulos & Estrutura HTML
- **Apenas UM `<h1>` por página:** Contendo a proposta de valor e a palavra-chave principal.
- **Hierarquia Lógica e Sem Saltos:** `<h1>` $\rightarrow$ `<h2>` (seções principais) $\rightarrow$ `<h3>` (subtópicos). Nunca pule de `<h1>` para `<h3>`.
- **Semântica HTML5:** Utilize `<main>`, `<section>`, `<article>`, `<header>`, `<footer>` e `<nav>`.

### 1.C Otimização de Mídia & Imagens
- Atributo `alt` descritivo e contextual em 100% das imagens informativas (evitando keyword stuffing).
- Formatos modernos de alta compressão: `.webp` ou `.avif`.
- Atributo `loading="lazy"` em todas as imagens fora do Hero inicial (a imagem do Hero deve ter prioridade máxima de carregamento).

---

## 2. Otimização para Buscadores de IA (AI Search / GEO / AEO)

Buscadores com IA (ChatGPT Search, Perplexity, Google AI Overviews) não leem apenas rankings de links; eles extraem **passagens de texto autossuficientes** e citam fontes com alta autoridade.

### 2.A Blocos de Resposta Direta (Snippet Extraction)
- Inicie seções de FAQ e definições conceituais com uma resposta direta e concisa de **40 a 60 palavras**.
- Evite enrolação ou introduções vazias antes da resposta direta.

### 2.B Tabelas Comparativas Estruturadas
- Para buscas do tipo *"Produto A vs Produto B"* ou *"Melhores alternativas para X"*, utilize tabelas HTML (`<table>`) em vez de listas corridas. IAs extraem tabelas com 3x mais facilidade.

### 2.C Dados de Autoridade & Citações
- Inclua números e estatísticas com fontes datadas (estudos mostram que páginas com dados quantitativos têm +37% de citações em LLMs).
- Atribuição de autoria clara com biografia e credenciais do especialista.

---

## 3. Dados Estruturados Schema.org (JSON-LD)

Injete dados estruturados via script `<script type="application/ld+json">` para permitir rich snippets no Google e parsing imediato por IAs:

### Exemplo: Schema de Organização e Software / Produto
```json
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "FinanceX",
  "applicationCategory": "BusinessApplication",
  "operatingSystem": "Web",
  "offers": {
    "@type": "Offer",
    "price": "49.00",
    "priceCurrency": "BRL"
  },
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "4.9",
    "reviewCount": "340"
  }
}
```

### Exemplo: Schema de FAQPage (Perguntas Frequentes)
```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "Preciso cadastrar cartão de crédito para testar?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Não. Você tem acesso completo e gratuito por 14 dias sem precisar cadastrar cartão."
      }
    }
  ]
}
```

---

## 4. Arquivos para Agentes Autônomos de Compra

Para que agentes de IA possam avaliar seu produto e preços sem barreiras de JavaScript:
1. **`/pricing.md` ou `/pricing.txt`:** Arquivo Markdown simples na raiz do site detalhando planos, limites e valores de forma limpa e parseável.
2. **`/llms.txt`:** Resumo de contexto com a missão da empresa, arquitetura de produtos e links oficiais para consulta de modelos de linguagem.
