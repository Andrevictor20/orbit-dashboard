---
name: image-to-code
description: "Pipeline image-first para desenvolvimento de interfaces. Gera referências visuais dedicadas por seção, realiza extração estruturada de tipografia, espaçamentos, hierarquia e cores, e implementa o código frontend com fidelidade absoluta à direção artística estabelecida."
---

# Image-to-Code: Pipeline de Design Orientado a Imagem

> **Propósito:** Em tarefas visuais onde a qualidade estética é prioritária, o fluxo orientado a imagens elimina adivinhações e estabelece uma referência visual de alta fidelidade antes de escrever o código de produção.

---

## 1. O Fluxo de Execução Obrigatório

```text
1. Geração de Imagem de Referência por Seção
        ↓
2. Inspeção Profunda e Extração do Design System
        ↓
3. Implementação Fiel em Código Frontend
```

---

## 2. Regras de Geração e Granularidade

1. **Uma Imagem por Seção:** Quando gerar referências visuais com a ferramenta `generate_image`, gere uma imagem horizontal (16:9 ou 16:10) por seção para manter a tipografia, botões e espaçamentos perfeitamente legíveis e inspecionáveis.
2. **Hero com Foco Único:** Mantenha o hero despoluído, com abertura forte, contraste evidente e sem poluição de dezenas de cartões amontoados.
3. **Sem Recortes de Baixa Resolução:** Se uma seção precisar de detalhes mais finos, gere uma imagem dedicada de detalhe em vez de tentar cortar pedaços desfocados de uma imagem grande.

---

## 3. Protocolo de Extração Sistemática

Antes de codificar, inspecione a imagem e extraia formalmente:
- **Hierarquia Tipográfica:** Proporção entre títulos de display, subtítulos e textos de apoio.
- **Relações Espaciais:** Distâncias entre headline e CTA, padding interno de cartões, margens de seção.
- **Forma dos Controles:** Raio de curvatura dos botões, estilos de borda, preenchimento vs contorno.
- **Cores & Acentos:** Cor primária de fundo, acento de destaque, matizes dos textos secundários.
- **Tratamento de Mídia:** Aspect ratio dos frames de imagem, sobreposições tonais e contrastes.

---

## 4. Tradução para Código

- O código é a camada de materialização fiel do design inspecionado.
- Garanta que a estrutura de componentes espelha o ritmo visual da imagem gerada, aplicando Tailwind e Motion para dar vida às interações.
