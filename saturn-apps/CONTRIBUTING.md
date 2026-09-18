# Guia de Contribuição — Saturn Apps

Obrigado por querer contribuir com o catálogo de aplicativos do Saturn!

## Regras de Qualidade para Novos Apps

1. **Nome do diretório:** O nome da pasta dentro de `apps/` deve ser idêntico ao `id` informado em `saturn-app.yml` (letras minúsculas, números e hífens, ex: `uptime-kuma`).
2. **Ícone:** Deve ter formato PNG quadrado (preferencialmente 256x256 ou 512x512) nomeado como `icon.png`.
3. **Docker Compose:**
   - Use imagens oficiais ou mantidas por organizações reconhecidas (ex: `linuxserver/*`).
   - Evite fixar volumes em caminhos absolutos do host como `/root` ou `/home/usuario`. Prefira caminhos relativos ou variáveis como `${SATURN_APP_DATA_DIR:-./data}`.
   - Utilize a diretiva `restart: unless-stopped`.
4. **Portas:** Informe a porta principal da interface web no campo `port:` de `saturn-app.yml`.

---

## Passo a Passo

### 1. Criar o branch do app
```bash
git checkout -b app/meu-novo-app
cp -r _template apps/meu-novo-app
```

### 2. Editar os arquivos
- Atualize `apps/meu-novo-app/saturn-app.yml` com as informações do projeto.
- Defina os containers em `apps/meu-novo-app/docker-compose.yml`.
- Coloque o logotipo do app em `apps/meu-novo-app/icon.png`.

### 3. Testar a compilação localmente
```bash
python3 compiler/build_catalog.py
```
Certifique-se de que nenhum erro de validação foi emitido.

### 4. Abrir o Pull Request
Envie suas alterações para o GitHub e abra um Pull Request detalhando o novo aplicativo.
