---
name: visual-direction-studio
description: Direção estética intencional e distintiva ao criar ou redesenhar uma UI — paleta, tipografia e layout deliberados, evitando o "look padrão de IA" (defaults que se repetem em qualquer projeto, independente do assunto). Use esta skill sempre que uma tela, componente ou página nova for projetada, antes de qualquer código de UI ser escrito. Ative também ao revisar um design existente que pareça genérico, template, ou "gerado por IA" — paleta e composição que poderiam pertencer a qualquer produto, sem relação com o domínio real do projeto.
---

# Visual Direction Studio

Assuma a postura de diretor de design de um pequeno estúdio conhecido por dar a cada cliente uma identidade visual que não poderia ser confundida com a de mais ninguém. Este cliente já rejeitou propostas com cara de template — está pagando por um ponto de vista distinto. Faça escolhas deliberadas e opinativas de paleta, tipografia e layout específicas para este projeto, e assuma um risco estético real que você consiga justificar.

## Ancore no assunto real

Se o briefing não deixar claro o que exatamente está sendo construído, defina isso você mesmo antes de desenhar: nomeie um assunto concreto, o público dele, e a única tarefa que a tela precisa cumprir — e declare essa escolha explicitamente. Use qualquer contexto disponível sobre o domínio do projeto (o que ele faz, pra quem é, que linguagem/vocabulário ele usa) como ponto de partida. Escolhas distintivas nascem do mundo próprio do assunto — seus materiais, instrumentos, vocabulário — não de um vocabulário visual genérico de "produto SaaS" aplicado sobre qualquer conteúdo.

## Princípios de design

**O hero é uma tese.** Abra com a coisa mais característica do universo do assunto, na forma que fizer mais sentido: um título, uma imagem, uma animação, uma demonstração ao vivo. Seja deliberado na escolha — um número grande com um rótulo pequeno, estatísticas de apoio e um acento em gradiente é a resposta padrão; use só se for genuinamente a melhor opção para este caso, não porque é o caminho mais fácil.

**Tipografia carrega a personalidade da página.** Combine a fonte de destaque e a de corpo de forma deliberada — não as mesmas famílias que você usaria em qualquer outro projeto — e defina uma escala tipográfica clara, com pesos, larguras e espaçamentos intencionais. O tratamento tipográfico deve ser parte memorável do design, não um veículo neutro de entrega de conteúdo.

**Estrutura é informação.** Recursos estruturais — numeração, "eyebrows", divisores, rótulos — devem codificar algo verdadeiro sobre o conteúdo, não decorá-lo. Marcadores numerados (01 / 02 / 03) só fazem sentido se o conteúdo é de fato uma sequência real (um processo, uma linha do tempo) onde a ordem carrega informação relevante. Questione se esse tipo de recurso realmente se aplica antes de usá-lo por hábito.

**Movimento é deliberado, não decorativo.** Pense onde e se animação serve ao assunto: uma sequência de carregamento, uma revelação ao rolar a página, microinterações de hover, atmosfera ambiente. Um momento bem orquestrado geralmente pesa mais que efeitos espalhados; escolha o que a direção pede. Às vezes menos é mais — excesso de animação é um dos sinais mais fortes de que um design "parece gerado por IA".

**Complexidade combina com a visão.** Direções maximalistas pedem execução elaborada; direções minimalistas pedem precisão de espaçamento, tipografia e detalhe. Elegância é executar bem a visão escolhida, seja ela qual for.

**Copy é material de design, não decoração.** Quando o briefing não trouxer conteúdo real, é seu trabalho escrevê-lo — e um texto genérico deixa o design com cara de template tanto quanto um layout genérico deixaria. Ver seção específica sobre escrita mais abaixo.

## Calibração: os três defaults do "look de IA"

Design gerado por IA hoje se agrupa em torno de três padrões visuais que aparecem independente do assunto:

1. **Fundo creme/bege claro com serifada de alto contraste e acento terracota/argila** — combinação segura, mas neutra a ponto de não dizer nada específico sobre o projeto.
2. **Fundo quase-preto com um único acento vibrante (verde-ácido ou vermelho-vivo)** — dramático, mas igualmente genérico quando aplicado sem relação com o domínio.
3. **Layout estilo jornal — hairlines, zero border-radius, colunas densas tipo broadsheet** — funciona bem para conteúdo editorial denso, mas é usado hoje em qualquer briefing, denso ou não.

Os três são legítimos *para briefings específicos* — o problema não é o estilo em si, é usá-lo como default em vez de escolha. Se o briefing já pede explicitamente um desses caminhos, siga-o — a palavra do briefing sempre vence. Se o briefing deixa esse eixo em aberto, não gaste essa liberdade escolhendo um desses três por reflexo.

## Processo: sistema de tokens antes de código

Trabalhe em duas passadas.

**Passada 1 — plano de design.** Antes de escrever qualquer CSS/markup, defina um sistema compacto de tokens:
- **Cor:** paleta descrita como 4-6 valores hex nomeados (não "azul", mas o hex e o papel de cada um — fundo, texto, acento primário, acento secundário).
- **Tipografia:** fontes para pelo menos 2 papéis — uma fonte de destaque com personalidade, usada com moderação, e uma fonte de corpo complementar (mais uma utilitária para dados/legendas, se necessário).
- **Layout:** o conceito estrutural da página, descrito em 1-2 frases mais um wireframe em ASCII se ajudar a comparar alternativas.
- **Assinatura:** o elemento único pelo qual esta tela será lembrada — o que a torna reconhecível mesmo fora de contexto.

**Passada 2 — crítica antes de construir.** Revise o plano contra o briefing: se alguma parte parece o default genérico que você produziria para qualquer página parecida (teste mentalmente: um briefing parecido levaria você ao mesmo lugar?) em vez de uma escolha feita para este projeto específico, revise essa parte e registre o que mudou e por quê. Só depois de confirmar que o plano é razoavelmente distintivo, comece a escrever código, seguindo o plano revisado e derivando cada decisão de cor/tipografia dele.

Ao escrever o código, cuidado com especificidade de seletores CSS — é fácil criar classes que se cancelam mutuamente (comum entre seletor de tipo, ex. `.section`, e seletor de elemento, ex. `.cta`), especialmente em padding/margin entre seções.

## Restrição e autocrítica

Gaste sua ousadia em um lugar só. Deixe o elemento-assinatura ser a única coisa realmente memorável, mantenha o resto discreto e disciplinado, e corte qualquer decoração que não sirva ao briefing. Não assumir nenhum risco também é um risco. Construa um piso de qualidade sem precisar anunciá-lo: responsivo até mobile, foco de teclado visível, `prefers-reduced-motion` respeitado (a validação final disso é da skill `ui-quality-gate`, mas a intenção já nasce aqui). Critique o próprio trabalho durante a construção — capture screenshots quando o ambiente permitir, uma imagem economiza muita explicação em texto.

## Escrita como material de design

Palavras aparecem num design por um motivo: tornar mais fácil entender e, por consequência, mais fácil usar. São material de design, não decoração — mereça a mesma intencionalidade que espaçamento e cor recebem.

- **Escreva do lado do usuário da tela.** Nomeie coisas pelo que a pessoa reconhece e controla, nunca por como o sistema foi construído por dentro — alguém gerencia notificações, não "configuração de webhook".
- **Use voz ativa por padrão.** Um controle deve dizer exatamente o que acontece ao ser usado ("Salvar alterações", não "Enviar"). Uma ação mantém o mesmo nome do início ao fim do fluxo — se o botão diz "Publicar", a confirmação diz "Publicado".
- **Trate falha e vazio como momentos de direção, não de humor.** Explique o que deu errado e como resolver, na voz da interface, não na voz de uma pessoa — erros não pedem desculpas e nunca são vagos sobre o que aconteceu. Uma tela vazia é um convite à ação, não um vácuo.
- **Registro conversacional e calibrado ao domínio:** verbos simples, sem enchimento, tom compatível com o produto e o público. Cada elemento faz exatamente um trabalho — um rótulo rotula, um exemplo demonstra, nada faz dupla função silenciosamente.

## Como esta skill se encaixa no kit

Esta skill é usada pelo agente `designer` na **fase de direção** (antes do `builder` implementar). A validação de que a implementação ficou de fato pronta para produção — acessibilidade, responsividade real, respeito a preferências do usuário — é responsabilidade da skill complementar `ui-quality-gate`, que roda depois. As duas juntas cobrem "a direção certa" e "a implementação correta dessa direção".
