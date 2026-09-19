pub struct HelperScriptParams<'a> {
    pub host_dir: &'a str,
    pub compose_file: &'a str,
    pub project_flag: &'a str,
    pub data_mount: &'a str,
    pub image_name: &'a str,
    pub current_id: &'a str,
    pub current_name: &'a str,
    pub new_container_name: &'a str,
}

pub fn generate_helper_script(params: HelperScriptParams) -> String {
    format!(
        r#"sleep 2 && (
echo "🚀 [SATURN-UPDATER] Iniciando orquestração de atualização do contêiner Saturn..."

recreated=0

# 1. Garante que a imagem mais recente está presente no host
echo "📥 [SATURN-UPDATER] Baixando imagem mais recente no host ({image_name})..."
docker pull "{image_name}" 2>/dev/null || true

# 2. Tenta recriar via Docker Compose se projeto/diretório detectado
if [ -n "{host_dir}" ] && [ -f "/host{host_dir}/{compose_file}" ]; then
  echo "📁 [SATURN-UPDATER] Atualizando via Compose em /host{host_dir}/{compose_file}..."
  cd "/host{host_dir}"
  sed -i -E 's|image:[ \t]*.*saturn:[^ \t\r\n]+|image: {image_name}|g' "{compose_file}" 2>/dev/null || true
  docker compose {project_flag} -f "{compose_file}" pull 2>/dev/null || docker-compose {project_flag} -f "{compose_file}" pull 2>/dev/null || true
  if docker compose {project_flag} -f "{compose_file}" up -d --force-recreate || docker-compose {project_flag} -f "{compose_file}" up -d --force-recreate; then
    echo "✅ [SATURN-UPDATER] Compose up concluído com sucesso!"
    recreated=1
  fi
elif [ -f "/host/DATA/saturn/docker-compose.yml" ]; then
  cd "/host/DATA/saturn"
  sed -i -E 's|image:[ \t]*.*saturn:[^ \t\r\n]+|image: {image_name}|g' "docker-compose.yml" 2>/dev/null || true
  docker compose -f "docker-compose.yml" pull 2>/dev/null || docker-compose -f "docker-compose.yml" pull 2>/dev/null || true
  if docker compose -f "docker-compose.yml" up -d --force-recreate || docker-compose -f "docker-compose.yml" up -d --force-recreate; then
    echo "✅ [SATURN-UPDATER] Compose up em /DATA/saturn concluído!"
    recreated=1
  fi
elif [ -f "/host/root/saturn/docker-compose.yml" ]; then
  cd "/host/root/saturn"
  sed -i -E 's|image:[ \t]*.*saturn:[^ \t\r\n]+|image: {image_name}|g' "docker-compose.yml" 2>/dev/null || true
  docker compose -f "docker-compose.yml" pull 2>/dev/null || docker-compose -f "docker-compose.yml" pull 2>/dev/null || true
  if docker compose -f "docker-compose.yml" up -d --force-recreate || docker-compose -f "docker-compose.yml" up -d --force-recreate; then
    echo "✅ [SATURN-UPDATER] Compose up em /root/saturn concluído!"
    recreated=1
  fi
fi

# 3. Fallback direto e ultra-resiliente via Docker Engine
if [ "$recreated" -eq 0 ]; then
  echo "⚠️ [SATURN-UPDATER] Executando fallback direto via Docker Engine..."
  docker ps -q --filter "publish=5172" | xargs -r docker stop -t 4 2>/dev/null || true
  docker ps -q --filter "publish=5172" | xargs -r docker rm -f 2>/dev/null || true
  docker ps -q --filter "publish=5173" | xargs -r docker stop -t 4 2>/dev/null || true
  docker ps -q --filter "publish=5173" | xargs -r docker rm -f 2>/dev/null || true

  for target in "{current_id}" "{current_name}" saturn saturn-dashboard ; do
    if [ -n "$target" ]; then
      docker stop -t 4 "$target" 2>/dev/null || true
      docker rm -f "$target" 2>/dev/null || true
    fi
  done

  docker ps -a -q --filter "name=saturn" --filter "status=exited" | xargs -r docker rm 2>/dev/null || true
  docker ps -a -q --filter "name=saturn" --filter "status=created" | xargs -r docker rm 2>/dev/null || true
  docker ps -a -q --filter "name=saturn" --filter "status=dead" | xargs -r docker rm 2>/dev/null || true

  docker run -d --name "{new_container_name}" --restart unless-stopped \
    --privileged \
    --pid host \
    --add-host host.docker.internal:host-gateway \
    -p 5172:5172 \
    -p 5173:5172 \
    -v /var/run/docker.sock:/var/run/docker.sock \
    -v "{data_mount}:/app/data" \
    -v /:/host:rslave \
    -v /mnt:/mnt:rslave \
    -v /media:/media:rslave \
    -e RUST_LOG=info \
    -e SSH_HOST=host.docker.internal \
    "{image_name}"
fi

# 4. Aguarda e confirma se o novo container está ativo e saudável
echo "🔍 [SATURN-UPDATER] Verificando se o novo contêiner está ativo..."
for i in $(seq 1 30); do
  if docker ps --filter "name={new_container_name}" --filter "status=running" | grep -q "{new_container_name}"; then
    echo "🎉 [SATURN-UPDATER] Contêiner {new_container_name} confirmado em execução!"
    break
  fi
  sleep 1
done

sleep 3
docker image prune -f 2>/dev/null || true
docker images "ghcr.io/andrevictor20/saturn" "victorandre280/saturn" --filter "dangling=true" -q 2>/dev/null | xargs -r docker rmi 2>/dev/null || true

# Auto-remoção do contêiner updater após conclusão
(sleep 2 && docker rm -f saturn-updater 2>/dev/null) &
)"#,
        host_dir = params.host_dir,
        compose_file = params.compose_file,
        project_flag = params.project_flag,
        data_mount = params.data_mount,
        image_name = params.image_name,
        current_id = params.current_id,
        current_name = params.current_name,
        new_container_name = params.new_container_name
    )
}
