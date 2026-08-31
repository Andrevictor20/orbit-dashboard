use axum_test::TestServer;
use backend::app;
use backend::auth::{Claims, get_jwt_secret};
use backend::docker::{parse_docker_command_or_compose, check_port_availability};
use jsonwebtoken::{encode, EncodingKey, Header};
use axum::http::StatusCode;

fn get_test_cookie() -> axum_extra::extract::cookie::Cookie<'static> {
    let claims = Claims {
        sub: "admin".to_string(),
        exp: 10_000_000_000,
    };

    let token = encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(get_jwt_secret()),
    ).unwrap();

    axum_extra::extract::cookie::Cookie::new("auth_token", token)
}

#[test]
fn test_parse_simple_docker_run() {
    let cmd = "docker run -d --name my-nginx -p 8080:80 -v /my/html:/usr/share/nginx/html -e TZ=UTC nginx:alpine";
    let parsed = parse_docker_command_or_compose(cmd).expect("Should parse simple docker run");

    assert_eq!(parsed.input_type, "docker_run");
    assert_eq!(parsed.app_name, "my-nginx");
    assert_eq!(parsed.services.len(), 1);

    let svc = &parsed.services[0];
    assert_eq!(svc.name, "my-nginx");
    assert_eq!(svc.image, "nginx:alpine");
    assert_eq!(svc.ports.len(), 1);
    assert_eq!(svc.ports[0].host_port, Some(8080));
    assert_eq!(svc.ports[0].container_port, 80);
    assert_eq!(svc.ports[0].protocol, "tcp");

    assert_eq!(svc.volumes.len(), 1);
    assert_eq!(svc.volumes[0].host_path, "/my/html");
    assert_eq!(svc.volumes[0].container_path, "/usr/share/nginx/html");

    assert_eq!(svc.environment.get("TZ"), Some(&"UTC".to_string()));
    assert!(parsed.compose_yaml.contains("image: nginx:alpine"));
    assert!(parsed.compose_yaml.contains("8080:80"));
}

#[test]
fn test_parse_multiline_docker_run_with_quotes_and_equals() {
    let cmd = r#"docker run -d \
      --name=qbittorrent \
      -e PUID=1000 \
      -e PGID=1000 \
      -e "TZ=America/Sao_Paulo" \
      -p 8080:8080 \
      -p 6881:6881/tcp \
      -p 6881:6881/udp \
      -v ./config:/config \
      -v /downloads:/downloads \
      --restart unless-stopped \
      lscr.io/linuxserver/qbittorrent:latest"#;

    let parsed = parse_docker_command_or_compose(cmd).expect("Should parse multiline docker run");

    assert_eq!(parsed.input_type, "docker_run");
    assert_eq!(parsed.app_name, "qbittorrent");
    assert_eq!(parsed.services.len(), 1);

    let svc = &parsed.services[0];
    assert_eq!(svc.name, "qbittorrent");
    assert_eq!(svc.image, "lscr.io/linuxserver/qbittorrent:latest");
    assert_eq!(svc.restart, Some("unless-stopped".to_string()));
    assert_eq!(svc.ports.len(), 3);
    assert_eq!(svc.volumes.len(), 2);
    assert_eq!(svc.environment.get("TZ"), Some(&"America/Sao_Paulo".to_string()));
    assert_eq!(svc.environment.get("PUID"), Some(&"1000".to_string()));
}

#[test]
fn test_parse_docker_compose_yaml() {
    let yaml = r#"
version: '3.8'
services:
  web:
    container_name: web-server
    image: nginx:latest
    ports:
      - "80:80"
    volumes:
      - ./html:/usr/share/nginx/html
    environment:
      - NODE_ENV=production
"#;

    let parsed = parse_docker_command_or_compose(yaml).expect("Should parse docker compose yaml");
    assert_eq!(parsed.input_type, "docker_compose");
    assert_eq!(parsed.services.len(), 1);
    assert_eq!(parsed.services[0].name, "web-server");
    assert_eq!(parsed.services[0].image, "nginx:latest");
    assert_eq!(parsed.services[0].ports.len(), 1);
    assert_eq!(parsed.services[0].ports[0].host_port, Some(80));
    assert_eq!(parsed.services[0].ports[0].container_port, 80);
}

#[test]
fn test_port_availability_check() {
    // Port 0 or a very high ephemeral port is usually available
    let port_check = check_port_availability(59182, "tcp");
    assert_eq!(port_check.host_port, 59182);
    assert_eq!(port_check.protocol, "tcp");
    // Suggested port should be generated if in use, or same if free
    assert!(port_check.suggested_port >= 59182);
}

#[tokio::test]
async fn test_parse_api_endpoint() {
    unsafe { std::env::set_var("JWT_SECRET", "super_secret"); }
    let server = TestServer::new(app());
    let cookie = get_test_cookie();

    let cmd = "docker run -d --name redis-cache -p 6379:6379 redis:7-alpine";
    let response = server
        .post("/api/docker/compose/parse")
        .add_cookie(cookie)
        .json(&serde_json::json!({ "raw_input": cmd }))
        .await;

    assert_eq!(response.status_code(), StatusCode::OK);
    let json: serde_json::Value = response.json();
    assert_eq!(json.get("input_type").and_then(|v| v.as_str()), Some("docker_run"));
    assert_eq!(json.get("app_name").and_then(|v| v.as_str()), Some("redis-cache"));
    assert!(json.get("compose_yaml").is_some());
    assert!(json.get("port_conflicts").is_some());
}

#[tokio::test]
async fn test_check_ports_api_endpoint() {
    unsafe { std::env::set_var("JWT_SECRET", "super_secret"); }
    let server = TestServer::new(app());
    let cookie = get_test_cookie();

    let response = server
        .post("/api/docker/ports/check")
        .add_cookie(cookie)
        .json(&serde_json::json!({ "ports": [8080, 59182] }))
        .await;

    assert_eq!(response.status_code(), StatusCode::OK);
    let json: serde_json::Value = response.json();
    let conflicts = json.get("conflicts").and_then(|v| v.as_array()).unwrap();
    assert_eq!(conflicts.len(), 2);
}
