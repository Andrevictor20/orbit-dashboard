# Guia de Instalação e Implantação - Orbit Dashboard

Este documento apresenta as instruções detalhadas para implantação do Orbit Dashboard em ambientes de produção e desenvolvimento, incluindo requisitos de sistema, métodos de execução e configuração de proxies reversos.

---

## 1. Requisitos de Sistema

### Requisitos Mínimos de Hardware
- **Processador:** 1 núcleo x86_64 (`amd64`) ou ARM64 (`aarch64`, ex.: Raspberry Pi 4 ou superior).
- **Memória RAM:** Mínimo de 512 MB livre (o processo do Orbit consome habitualmente entre 15 MB e 35 MB de RAM em repouso).
- **Armazenamento:** 200 MB de espaço disponível para a imagem do container e dados de estado.

### Requisitos de Software
- **Kernel Linux:** Versão 5.4 ou superior com suporte a cgroups (v1 ou v2).
- **Docker Engine:** Versão 20.10.0 ou superior.
- **Docker Compose:** Plugin Compose v2 (`docker compose`) instalado.
- **Acesso ao Socket:** Permissão de leitura e escrita em `/var/run/docker.sock`.

---

## 2. Métodos de Instalação

### Método 1: Instalação Automatizada via Shell Script (Recomendado)

O instalador automatizado verifica a arquitetura do processador, instala dependências ausentes (como o Docker Engine em distribuições Debian/Ubuntu), configura o diretório de dados em `/DATA/AppData/orbit-dashboard` e inicia o container:

```bash
curl -fsSL https://raw.githubusercontent.com/Andrevictor20/orbit-dashboard/main/install.sh | bash
```

Após a conclusão da execução, o serviço estará acessível na porta 5172:
```
http://<ip-do-servidor>:5172
```

---

### Método 2: Implantação Declarativa via Docker Compose

Para integrar o Orbit ao seu ambiente de containers existente, utilize a especificação de compose abaixo:

```yaml
services:
  orbit:
    image: ghcr.io/andrevictor20/orbit-dashboard:latest
    container_name: orbit-dashboard
    restart: unless-stopped
    network_mode: bridge
    # Privilégios necessários para telemetria de hardware e gerenciamento de processos do host
    privileged: true
    pid: host
    extra_hosts:
      - "host.docker.internal:host-gateway"
    ports:
      - "5172:5172"
    volumes:
      # Comunicação com a Docker Engine API
      - /var/run/docker.sock:/var/run/docker.sock
      # Persistência de banco de dados, chaves de sessão e configurações locais
      - orbit_data:/app/data
      # Pontos de montagem do host para leitura de métricas, rotas e análise de disco
      - /:/host:rslave
      - /mnt:/mnt:rslave
      - /media:/media:rslave
    environment:
      - RUST_LOG=info
      - SSH_HOST=host.docker.internal
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

volumes:
  orbit_data:
```

#### Execução do Serviço
No mesmo diretório onde o arquivo `docker-compose.yml` foi salvo, execute:

```bash
docker compose up -d
```

---

### Método 3: Execução Direta via Docker CLI (`docker run`)

Caso prefira iniciar o container através de um único comando de terminal:

```bash
docker run -d \
  --name orbit-dashboard \
  --restart unless-stopped \
  --privileged \
  --pid host \
  --add-host host.docker.internal:host-gateway \
  -p 5172:5172 \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v orbit_data:/app/data \
  -v /:/host:rslave \
  -v /mnt:/mnt:rslave \
  -v /media:/media:rslave \
  -e RUST_LOG=info \
  -e SSH_HOST=host.docker.internal \
  ghcr.io/andrevictor20/orbit-dashboard:latest
```

---

### Método 4: Compilação Manual a partir do Código-Fonte

Para executar o Orbit nativamente no sistema operacional sem o container Docker:

#### Pré-requisitos de Compilação
- Rust Toolchain 1.80+ (`rustc` e `cargo`).
- Node.js versão 20 LTS ou superior com `npm`.
- Docker Engine ativo no host.

#### Etapas de Construção

1. **Obtenção do Código-Fonte:**
   ```bash
   git clone https://github.com/Andrevictor20/orbit-dashboard.git
   cd orbit-dashboard
   ```

2. **Compilação dos Assets do Frontend:**
   ```bash
   cd frontend
   npm install
   npm run build
   cd ..
   ```

3. **Cópia dos Arquivos Estáticos para o Backend:**
   ```bash
   mkdir -p backend/public
   cp -r frontend/dist/* backend/public/
   ```

4. **Compilação e Execução do Binário Rust:**
   ```bash
   cd backend
   cargo run --release
   ```

O servidor iniciará escutando conexões na porta 5172.

---

## 3. Ambiente de Desenvolvimento com Hot-Reloading

Para desenvolvimento com recarregamento em tempo real (HMR) no frontend e compilação incremental no backend:

1. **Terminal 1 - Executar a API Axum em Rust:**
   ```bash
   cd backend
   cargo run
   # A API estará em execução em http://localhost:5172
   ```

2. **Terminal 2 - Executar o Servidor de Desenvolvimento Vite:**
   ```bash
   cd frontend
   npm install
   npm run dev
   # A interface estará acessível em http://localhost:5173, com proxy reverso configurado para a porta 5172
   ```

---

## 4. Configuração de Proxies Reversos

O Orbit utiliza conexões HTTP padrão para rotas REST e conexões persistentes WebSocket para telemetria em tempo real e emulação de terminal. Ao posicionar o Orbit atrás de um proxy reverso, a propagação de cabeçalhos de upgrade é obrigatória.

### Exemplo de Configuração para Nginx

```nginx
server {
    listen 80;
    server_name orbit.seu-dominio.lan;

    # Opcional: Redirecionamento HTTPS
    # return 301 https://$host$request_uri;

    location / {
        proxy_pass http://127.0.0.1:5172;
        proxy_http_version 1.1;

        # Propagação obrigatória para WebSockets
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # Identificação correta de host e protocolo
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Desativação de buffer para manter streaming de logs e métricas em tempo real
        proxy_buffering off;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
}
```

### Exemplo de Configuração para Caddy

```caddy
orbit.seu-dominio.lan {
    reverse_proxy 127.0.0.1:5172
}
```

*Nota:* O Caddy gerencia cabeçalhos de WebSocket e streaming de conexões automaticamente.

---

## 5. Procedimento de Atualização

### Atualização pela Interface Gráfica (OTA)
O Orbit possui rotina integrada de verificação de atualizações. Quando uma nova versão for publicada no registro de imagens (GHCR), o botão de atualização na barra superior exibirá um indicador visual. Clicar em "Atualizar" acionará o download da nova imagem e a recriação do container mantendo o volume de dados intacto.

### Atualização Manual via Docker Compose
Para atualizar manualmente a imagem e reiniciar a stack:

```bash
docker compose pull orbit
docker compose up -d orbit
```

---

## 6. Diagnóstico de Problemas (Troubleshooting)

### Permissão Negada em `/var/run/docker.sock`
Se os logs do container indicarem erro de permissão ao acessar a API do Docker, certifique-se de que o usuário ou grupo do host possui acesso ao arquivo de socket:
```bash
ls -la /var/run/docker.sock
# O socket deve possuir permissão rw para o grupo docker
```

### Memória RAM dos Containers Zerada (0.0 MB)
Em sistemas operacionais onde a contabilidade de memória por cgroup estiver desativada no kernel (situação frequente em imagens padrão do Raspberry Pi OS), adicione o parâmetro de inicialização no arquivo `/boot/firmware/cmdline.txt` (ou `/boot/cmdline.txt`):
```
cgroup_enable=memory cgroup_memory=1
```
Reinicie o servidor para aplicar a configuração. Caso não seja possível alterar os parâmetros de kernel, o Orbit ativará automaticamente o fallback de medição de processos via RSS.
