# 📦 Guia de Instalação e Implantação do Orbit Dashboard

O Orbit foi projetado para oferecer uma experiência **Zero-Config**: não requer banco de dados externo, nem arquivos `.env` complexos.

---

## ⚡ Método 1: Instalação Automática em 1 Comando (Estilo CasaOS - Recomendado)

Instalação completa automatizada com detecção automática de arquitetura (**ARM64, ARMv7 ou x86_64**), instalação automática do Docker/Compose se não houver, criação da pasta `data/`, proteção de logs e inicialização imediata:

```bash
curl -fsSL https://raw.githubusercontent.com/Andrevictor20/orbit-dashboard/main/install.sh | bash
```

Após a conclusão, acesse `http://<IP-DO-SEU-SERVIDOR>:5172`.

---

## 🐳 Método 2: Instalação Manual via Docker Compose

Caso prefira criar manualmente o seu arquivo `docker-compose.yml`:

### 1. Crie o arquivo `docker-compose.yml`

```yaml
services:
  orbit:
    image: ghcr.io/andrevictor20/orbit-dashboard:latest
    container_name: orbit-dashboard
    restart: unless-stopped
    ports:
      - "5172:5172"
    volumes:
      # Permite ao Orbit gerenciar seus contêineres Docker
      - /var/run/docker.sock:/var/run/docker.sock
      # Persistência de dados locais, links e credenciais
      - orbit_data:/app/data
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

volumes:
  orbit_data:
```

> 💡 **Atualizações Sob Demanda:** O Orbit possui atualização nativa com detecção automática de arquitetura (ARM/x86). Você pode checar novidades, ver o changelog e atualizar o Orbit diretamente pelo botão de atualização no painel superior!

### 2. Inicie o Serviço

Execute no terminal:

```bash
docker compose up -d
```

### 3. Acesse o Dashboard
Abra seu navegador em:
```
http://<IP-DO-SEU-SERVIDOR>:5172
```
Na primeira inicialização, você será direcionado para o assistente de configuração para definir seu usuário e senha de administrador.

---

## 🛠️ Método 2: Compilação Manual a partir do Código-Fonte

Caso prefira rodar o Orbit diretamente no host sem Docker:

### Pré-requisitos
- **Rust Toolchain:** `rustc` e `cargo` instalados ([rustup.rs](https://rustup.rs/))
- **Node.js:** Versão 20 ou superior e `npm`
- **Docker Engine:** Instalado e em execução com acesso ao socket `/var/run/docker.sock`

### Passos de Compilação

1. **Clone o Repositório:**
   ```bash
   git clone https://github.com/Andrevictor20/orbit-dashboard.git
   cd orbit-dashboard
   ```

2. **Compile o Frontend (SPA):**
   ```bash
   cd frontend
   npm install
   npm run build
   cd ..
   ```

3. **Copie os arquivos estáticos para o Backend:**
   ```bash
   mkdir -p backend/public
   cp -r frontend/dist/* backend/public/
   ```

4. **Inicie o Backend em Rust:**
   ```bash
   cd backend
   cargo run --release
   ```

5. **Acesso:**
   Acesse `http://localhost:5172` no seu navegador.

---

## 💻 Ambiente de Desenvolvimento (Hot Reloading)

Para contribuir com o código e ter Hot Module Replacement (HMR):

1. **Terminal 1 - Iniciar a API Rust:**
   ```bash
   cd backend
   cargo run
   # A API iniciará em http://localhost:5172
   ```

2. **Terminal 2 - Iniciar o Servidor Vite com Proxy:**
   ```bash
   cd frontend
   npm install
   npm run dev
   # O Frontend iniciará em http://localhost:5173 com proxy automático para a porta 5172
   ```
