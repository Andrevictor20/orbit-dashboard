---
name: pair-navigator
description: Protocolo de navegação em pair programming com IA — como interromper propostas over-engineered, injetar contexto de domínio que o agente não tem, e fechar decisões de arquitetura em conjunto antes de codificar. Use esta skill sempre que um agente (principal ou subagente) estiver prestes a propor ou implementar uma solução técnica, sempre que o humano interromper um plano com "simplifica" ou "para", ou sempre que surgir uma decisão de arquitetura com trade-offs (monolito vs. serviços separados, sync vs. async, escolha de biblioteca/API externa). Ative também quando perceber sinais de over-engineering: múltiplos estados/camadas para um problema simples, abstrações prematuras, ou generalização não pedida.
---

# Pair Navigator

Esta skill governa a parte "conversa" do pair programming — o que diferencia um par de pair programming de um gerador de código que só recebe spec e devolve output.

## Quando você (agente) está prestes a propor uma solução

Antes de implementar, declare em 2-4 linhas:
1. **O problema** que está resolvendo (reafirme com suas palavras, para expor mal-entendidos cedo).
2. **A proposta mínima** — a versão mais simples que resolve o problema real.
3. Se existir uma alternativa mais robusta/genérica, **mencione-a mas não a implemente por padrão** — deixe o humano escolher escalar.

**Teste de over-engineering antes de codificar:** se sua proposta para um problema simples envolve mais de ~3 estados, filas/camadas separadas, ou uma abstração genérica "para o futuro", pare e ofereça primeiro a versão mínima. Exemplo de referência: pedido de "sistema de envio de email" → proposta correta inicial é algo como 4 estados (pending/sending/sent/unknown, na dúvida não reenvia), não uma state machine de 8 estados com dead-letter queue.

## Quando o humano interrompe

Se o humano disser algo como "simplifica", "para, tá complicado demais", ou "não precisa disso agora":
- **Não defenda a versão original.** Corte estados, camadas ou generalizações imediatamente.
- Reescreva a proposta em uma frase e peça confirmação antes de tocar em código.
- Não reintroduza a complexidade cortada em commits seguintes sem que o humano peça de novo.

## Quando o humano dá contexto de domínio

Contexto de domínio (ex.: "esse serviço bloqueia clients que não são browser real", "esse LLM inventa números quando não tem dado real", "esse formato de e-mail é obrigatório desde tal data por política do provedor") geralmente vem de tentativa e erro real ou de conhecimento que não está em nenhuma documentação disponível para você.

- Trate como **fato definitivo**, não como sugestão a ser ponderada.
- Registre esse fato para reuso (aponte para a skill/agente responsável por documentação viva — normalmente o agente "archivist" — para que vire uma entrada permanente, não se perca na conversa).
- Não tente "confirmar" o fato revertendo para a abordagem que ele acabou de invalidar.

## Decisões de arquitetura com trade-off

Para decisões que comprometem a estrutura do projeto (linguagem por componente, monolito vs. múltiplos serviços, síncrono vs. assíncrono, escolha de API externa paga vs. gratuita com limite):
1. Apresente 2-3 opções reais (não uma opção "certa" com espantalhos ao lado).
2. Para cada uma, uma frase de trade-off (custo, complexidade operacional, acoplamento).
3. **Pare e peça confirmação explícita** antes de implementar. Essas decisões não devem ser tomadas unilateralmente pelo agente, mesmo que pareçam óbvias.

## Ajuste de tom/personalidade/copy

IA tende a suavizar tudo — opiniões fortes e vozes distintas viram texto genérico ("mush") sem instrução explícita.
- Ao lidar com prompts de personalidade, textos de produto ou copy que precisam soar humano/opinativo, prefira regras **concretas e negativas/positivas** ("nunca usa a palavra X", "sempre começa com Y") a instruções vagas ("seja mais direto", "tenha mais personalidade").
- Trate cada ajuste de prompt como uma iteração testável com dado real, não como "achismo" — compare outputs antes/depois.

## Checklist rápido antes de qualquer implementação

- [ ] Reafirmei o problema em 1 frase?
- [ ] A proposta é a versão mínima, não a mais genérica possível?
- [ ] Se há trade-off de arquitetura, parei para confirmar antes de codificar?
- [ ] Se recebi contexto de domínio novo, ele está registrado em algum lugar permanente (não só nesta conversa)?
