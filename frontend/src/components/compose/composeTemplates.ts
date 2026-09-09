export interface ComposeTemplate {
  id: string;
  name: string;
  category: string;
  description: string;
  yaml: string;
  env?: string;
}

export const COMPOSE_TEMPLATES: ComposeTemplate[] = [
  {
    id: 'blank',
    name: 'Template Em Branco',
    category: 'Básico',
    description: 'Estrutura mínima válida de Docker Compose',
    yaml: `services:
  app:
    image: alpine:latest
    container_name: my-app
    restart: unless-stopped
    command: ["tail", "-f", "/dev/null"]
    ports:
      - "8080:80"
    environment:
      - TZ=America/Sao_Paulo
    volumes:
      - ./data:/app/data
`,
    env: `TZ=America/Sao_Paulo
PORT=8080
`,
  },
  {
    id: 'nginx-web',
    name: 'Nginx Web Server',
    category: 'Web',
    description: 'Servidor web estático Nginx com volume de assets',
    yaml: `services:
  web:
    image: nginx:alpine
    container_name: nginx-web
    restart: unless-stopped
    ports:
      - "8088:80"
    volumes:
      - ./html:/usr/share/nginx/html:ro
      - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro
    environment:
      - NGINX_PORT=80
`,
    env: `NGINX_PORT=80
`,
  },
  {
    id: 'postgres-pgadmin',
    name: 'PostgreSQL + pgAdmin',
    category: 'Banco de Dados',
    description: 'PostgreSQL 16 com painel de administração web pgAdmin 4',
    yaml: `services:
  postgres:
    image: postgres:16-alpine
    container_name: postgres-db
    restart: unless-stopped
    environment:
      POSTGRES_USER: \${DB_USER:-orbit}
      POSTGRES_PASSWORD: \${DB_PASSWORD:-orbit_secret}
      POSTGRES_DB: \${DB_NAME:-orbit_db}
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  pgadmin:
    image: dpage/pgadmin4:latest
    container_name: pgadmin-ui
    restart: unless-stopped
    environment:
      PGADMIN_DEFAULT_EMAIL: \${PGADMIN_EMAIL:-admin@orbit.local}
      PGADMIN_DEFAULT_PASSWORD: \${PGADMIN_PASSWORD:-admin1234}
    ports:
      - "5050:80"
    depends_on:
      - postgres

volumes:
  pgdata:
`,
    env: `DB_USER=orbit
DB_PASSWORD=orbit_secret
DB_NAME=orbit_db
PGADMIN_EMAIL=admin@orbit.local
PGADMIN_PASSWORD=admin1234
`,
  },
  {
    id: 'redis-commander',
    name: 'Redis + Redis Commander',
    category: 'Cache & Filas',
    description: 'Instância Redis Alpine com interface web de exploração de chaves',
    yaml: `services:
  redis:
    image: redis:7-alpine
    container_name: redis-cache
    restart: unless-stopped
    command: redis-server --appendonly yes --requirepass \${REDIS_PASSWORD:-orbitredis}
    ports:
      - "6379:6379"
    volumes:
      - redisdata:/data

  redis-commander:
    image: rediscommander/redis-commander:latest
    container_name: redis-commander-ui
    restart: unless-stopped
    environment:
      - REDIS_HOSTS=local:redis:6379:0:\${REDIS_PASSWORD:-orbitredis}
    ports:
      - "8081:8081"
    depends_on:
      - redis

volumes:
  redisdata:
`,
    env: `REDIS_PASSWORD=orbitredis
`,
  },
  {
    id: 'uptime-kuma',
    name: 'Uptime Kuma',
    category: 'Monitoramento',
    description: 'Monitor de status e disponibilidade self-hosted elegante e moderno',
    yaml: `services:
  uptime-kuma:
    image: louislam/uptime-kuma:1
    container_name: uptime-kuma
    restart: unless-stopped
    ports:
      - "3001:3001"
    volumes:
      - kumadata:/app/data

volumes:
  kumadata:
`,
    env: `PORT=3001
`,
  },
];
