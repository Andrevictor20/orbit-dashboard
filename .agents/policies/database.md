# Database Policy

- Proteger as queries contra injeções.
- Garantir a integridade (FKs, Null constraints).
- Migrations devem considerar a segurança da transição (schema compatibility) e devem ser reversíveis.
- Revisões de DB (N+1, queries caras) devem ocorrer antes do merge de grandes funcionalidades.
