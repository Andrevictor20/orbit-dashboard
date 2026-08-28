# Frontend Policy

- **Disciplina Anti-Slop & Dials de Calibração**: Toda interface deve ser calibrada através dos dials (`DESIGN_VARIANCE`, `MOTION_INTENSITY`, `VISUAL_DENSITY`) e de um Design Read explícito, evitando defaults preguiçosos de IA (Inter genérico, roxo com glow, 3 cards simétricos, falsos screenshots com divs).
- **Copywriting de Alta Conversão & Clareza (Clarity > Cleverness)**:
  - Textos de UI devem focar em benefícios e resultados tangíveis (aplicando a ponte "E daí?"), não apenas em listas de features técnicas.
  - CTAs devem comunicar valor claro (`[Verbo de Ação] + [O que recebe] + [Alívio]`), banindo botões burocráticos como "Enviar" ou "Clique Aqui".
  - Fórmulas magnéticas no Hero (headline ≤ 2 linhas, subtexto ≤ 20 palavras).
- **Proibição Absoluta de Em-Dash (`—`)**: É expressamente proibido o uso do travessão longo (`—`) e da meia-risca (`–`) em textos de UI, headlines, botões, pills, FAQs e descrições.
- **SEO Semântico On-Page & AI Search (GEO)**:
  - Apenas um único `<h1>` por página, com hierarquia lógica estrita (`h1` $\rightarrow$ `h2` $\rightarrow$ `h3`).
  - Title tags (50-60 caracteres) e Meta descriptions (150-160 caracteres) atrativas e clicáveis.
  - Injeção de dados estruturados Schema.org em JSON-LD (`Product`, `FAQPage`, `Organization`).
  - Atributos `alt` contextuais em todas as imagens informativas.
- **Hero & Viewport Stability**:
  - O hero deve caber na viewport inicial do desktop e usar `min-h-[100dvh]` em seções cheias (proibido `h-screen`).
  - Top padding do hero limitado a `pt-24` no desktop.
- **Anti-Repetição de Seções**: Páginas multi-seções devem usar pelo menos 4 famílias de layout distintas, com no máximo 2 seções de zigzag consecutivas e no máximo 1 eyebrow a cada 3 seções.
- **Acessibilidade Inegociável (WCAG AA)**: Contraste mínimo de 4.5:1 para texto e botões, foco visível de teclado, navegação em 1 linha (altura ≤ 80px) e respeito estrito a `prefers-reduced-motion`.
- **Estados Completos**: Componentes devem implementar ciclo completo de estados (Default, Hover/Focus, Active, Loading com skeleton real, Empty e Error).
