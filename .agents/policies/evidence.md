# Evidence Policy

- Afirmações puramente verbais ("Testes passaram") NÃO SÃO ACEITAS para declarar aprovação em testes ou release.
- **Native Execution Evidence:** Uma execução somente pode ser considerada realizada quando o agente efetivamente executou o comando apropriado do projeto (ex: `npm test`, `pytest`, `cargo test`). O agente deve descobrir dinamicamente a toolchain. O comando real utilizado deve ser registrado na evidência.
- **Fake Evidence:** O agente NUNCA deve fabricar evidências, forjar `exit_code: 0`, ou declarar GREEN sem a execução real correspondente. Qualquer tentativa resulta imediatamente em BLOCK.
- É exigido um nível de evidência L0 a L4 proporcional ao risco da mudança:
  - **Level 0 (CLAIM)**: Apenas afirmação textual. NÃO é suficiente para declarar teste PASS.
  - **Level 1 (OBSERVED OUTPUT)**: Comando real executado + saída observada. Pode ser usado para feedback local.
  - **Level 2 (REPRODUCIBLE TEST)**: Comando real + resultado + contexto suficiente para reprodução.
  - **Level 3 (CI VERIFIED)**: Resultado confirmado por CI externo.
  - **Level 4 (RELEASE AUTHORIZED)**: Resultado confirmado por CI + controles de branch/review/release apropriados.
- **Local vs Release Authority:** Execução local != autoridade de release. A execução local nunca deve ser tratada como prova de autorização de release, a menos que o projeto se classifique como Trivial/Small sem CI.
- Se o projeto não possuir testes, o agente DEVE declarar explicitamente "No automated test command discovered" e NUNCA fingir que passaram testes inexistentes.
