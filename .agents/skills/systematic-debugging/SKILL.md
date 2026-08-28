---
name: systematic-debugging
description: "Protocolo de debugging sistemático e investigação metódica de causa raiz. Deve ser ativado antes de qualquer tentativa de correção de bugs, falhas de testes ou comportamentos inesperados. Impõe a regra dos 3 fixes e proíbe palpites às cegas."
---

# Systematic Debugging: Investigação Metódica de Causa Raiz

> **A Lei de Ferro do Debugging:**
> ```text
> NENHUMA CORREÇÃO É PERMITIDA ANTES DA INVESTIGAÇÃO DA CAUSA RAIZ
> ```
> Correções que atuam apenas no sintoma são falhas de engenharia. Tentar palpites aleatórios desperdiça tempo, esgota tokens e cria novos bugs.

---

## 1. As Quatro Fases Obrigatórias

Você DEVE concluir cada fase sequencialmente antes de propor qualquer código:

```text
Fase 1: Investigação da Causa Raiz
            ↓
Fase 2: Análise de Padrões & Comparações
            ↓
Fase 3: Hipótese Científica & Teste Mínimo
            ↓
Fase 4: Implementação com Teste Falhando (TDD)
```

---

### Fase 1: Investigação da Causa Raiz (Antes de Tocar no Código)

1. **Leitura Rigorosa das Mensagens de Erro:**
   - Não ignore warnings ou detalhes da stack trace. Leia linhas exatas, códigos de erro e caminhos de arquivo.
2. **Reprodução Determinística:**
   - Isole os passos exatos para disparar o erro de forma 100% reproduzível. Se for intermitente, colete dados e instrumente; não tente adivinhar.
3. **Mapeamento de Alterações Recentes:**
   - O que mudou no código, nas dependências ou no ambiente que possa ter disparado o problema? (`git diff`, commits recentes).
4. **Rastreamento Reverso de Dados (*Backward Tracing*):**
   - Onde o valor inválido ou estado corrompido foi gerado pela primeira vez?
   - Rastreie a cadeia de chamadas de trás para frente até encontrar o ponto de origem exato (a fonte), não onde o erro explodiu (o sintoma).

---

### Fase 2: Análise de Padrões & Comparações

1. **Busca por Exemplos Funcionais:**
   - Existe código similar na mesma base de código que funciona corretamente?
2. **Comparação Cirúrgica:**
   - Liste todas as diferenças, por menores que sejam, entre o fluxo que funciona e o fluxo que falha.
3. **Checagem de Premissas e Contratos:**
   - O que a função que quebrou assume como verdade sobre seus parâmetros, ambiente ou tempo de execução?

---

### Fase 3: Hipótese Científica & Teste Mínimo

1. **Formule Uma Única Hipótese Explícita:**
   - Declare claramente: *"Acredito que a causa raiz é X porque Y."*
2. **Teste com Alteração Mínima:**
   - Modifique a menor quantidade possível de código ou dados para testar a hipótese. Isole uma única variável por vez.
3. **Validação:**
   - Se o teste confirmar a hipótese $\rightarrow$ avance para a Fase 4.
   - Se o teste refutar a hipótese $\rightarrow$ formule uma NOVA hipótese. Não empilhe remendos sobre hipóteses não comprovadas.

---

### Fase 4: Implementação TDD & A Regra dos 3 Fixes

1. **Crie um Teste Automatizado Falhando (**RED**):**
   - Escreva o teste de regressão que reproduz a falha exata antes de alterar o código de produção.
2. **Implemente a Correção Focada na Causa Raiz (**GREEN**):**
   - Resolva o problema na fonte. Sem refatorações oportunistas ou mudanças extras em paralelo.
3. **Valide a Correção:**
   - O teste novo passou? Nenhum teste existente quebrou?
4. **A REGRA DOS 3 FIXES (STOP & QUESTION THE ARCHITECTURE):**
   - Se você tentar **3 correções consecutivas** e o problema persistir ou gerar novos sintomas em outros lugares, **PARE IMEDIATAMENTE**.
   - Três falhas consecutivas indicam um **problema arquitetural ou acoplamento indevido**, não um bug simples.
   - Discuta o problema com o usuário ou repense a arquitetura em vez de tentar um 4º remendo às cegas.

---

## 2. Sinais de Alerta (Quando você está fazendo errado)

Pare imediatamente se você se pegar pensando:
- *"Vou mudar isso aqui rapidinho para ver se passa nos testes."*
- *"Não entendi muito bem por que quebrou, mas essa linha resolveu."*
- *"Vou pular o teste de regressão e verificar manualmente."*
- *"Mais uma tentativa de fix e vai funcionar..."* (quando já falhou 2+ vezes).
