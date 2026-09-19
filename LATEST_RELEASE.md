# Saturn Dashboard v3.7.9

### Novidades, Correções e Melhorias na Versão 3.7.9

### 👥 Ergonomia & Design dos Modais Multiusuário (React Portal & Viewport Escape)
- **Eliminação do Confinamento CSS em Submodais:** As modais de criação de usuário (`UserFormModal`), redefinição de senha (`ResetPasswordModal`) e confirmação de exclusão (`DeleteUserModal`) agora utilizam `createPortal` nativo para `document.body`. Isso elimina o confinamento forçado dentro do card pai de configurações causado por filtros `backdrop-filter`, centralizando as janelas perfeitamente na tela do navegador com z-index `100`.
- **Layout Espaçoso & Fim da Sensação de Aperto:** A modal de novo usuário foi ampliada para `max-w-xl` (576px) com padding generoso (`p-6 sm:p-7`), cabeçalho refinado com botão de fechar (`X`), inputs amplos e confortáveis (`px-4 py-2.5 text-sm`) e cantos arredondados modernos (`rounded-3xl`).
- **Cards de Seleção de Papel Amplos:** Os botões de seleção de papel (**Membro** e **Admin**) foram transformados em cards espaçosos com ícones dedicados, indicador visual de seleção ativa e descrições detalhadas e legíveis sobre os privilégios de cada nível de acesso.
- **Expansão do Modal de Configurações & Perfil:** O `ProfileModal` principal agora se adapta confortavelmente em telas maiores (`max-w-3xl lg:max-w-4xl`), proporcionando muito mais respiro para a listagem de contas de usuários, integrações e configurações de sistema.
