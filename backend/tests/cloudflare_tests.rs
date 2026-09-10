use axum::{
    body::Body,
    http::{Request, StatusCode},
};
use base64::engine::general_purpose::STANDARD;
use base64::Engine;
use http_body_util::BodyExt;
use tower::ServiceExt;

use backend::cloudflare::client::{
    match_ingress_with_containers, CloudflareClient, RawIngressRule,
};
use backend::cloudflare::detector::decode_tunnel_token;

fn get_valid_token() -> String {
    use jsonwebtoken::{encode, EncodingKey, Header};
    let claims = backend::auth::Claims {
        sub: "admin".to_owned(),
        exp: 10000000000,
    };
    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(backend::auth::get_jwt_secret()),
    )
    .unwrap()
}

#[test]
fn test_decode_tunnel_token_valid() {
    let payload = r#"{"a":"cf_acc_12345","t":"cf_tun_67890","s":"secret_xyz"}"#;
    let b64 = STANDARD.encode(payload.as_bytes());

    let decoded = decode_tunnel_token(&b64);
    assert!(decoded.is_some());
    let (account_id, tunnel_id) = decoded.unwrap();
    assert_eq!(account_id, "cf_acc_12345");
    assert_eq!(tunnel_id, "cf_tun_67890");
}

#[test]
fn test_decode_tunnel_token_invalid_or_empty() {
    assert!(decode_tunnel_token("").is_none());
    assert!(decode_tunnel_token("not-a-valid-token").is_none());
    assert!(decode_tunnel_token("eyJhIjoiYWNjb3VudCJ9").is_none()); // missing "t"
}

#[test]
fn test_match_ingress_with_containers() {
    let raw_rules = vec![
        RawIngressRule {
            hostname: Some("jellyfin.homelab.org".to_string()),
            service: "http://jellyfin:8096".to_string(),
            path: None,
        },
        RawIngressRule {
            hostname: Some("grafana.homelab.org".to_string()),
            service: "http://127.0.0.1:3000".to_string(),
            path: None,
        },
        RawIngressRule {
            hostname: Some("plex.homelab.org".to_string()),
            service: "http://unknown-host:32400".to_string(),
            path: None,
        },
        RawIngressRule {
            hostname: None,
            service: "http_status:404".to_string(),
            path: None,
        },
    ];

    // Mock summary containers
    let containers = vec![
        backend::cloudflare::client::ContainerSummaryInfo::new(
            "cont_id_1",
            "jellyfin",
            vec![8096],
        ),
        backend::cloudflare::client::ContainerSummaryInfo::new(
            "cont_id_2",
            "monitoring-grafana",
            vec![3000],
        ),
        backend::cloudflare::client::ContainerSummaryInfo::new(
            "cont_id_3",
            "plex",
            vec![32400],
        ),
    ];

    let matched = match_ingress_with_containers(raw_rules, &containers);
    assert_eq!(matched.len(), 3); // 404 catch-all ignored

    // jellyfin matched by direct container name
    assert_eq!(matched[0].hostname, "jellyfin.homelab.org");
    assert_eq!(matched[0].matched_container_id.as_deref(), Some("cont_id_1"));
    assert_eq!(matched[0].public_url, "https://jellyfin.homelab.org");

    // grafana matched by port 3000 / name contains grafana
    assert_eq!(matched[1].hostname, "grafana.homelab.org");
    assert_eq!(matched[1].matched_container_id.as_deref(), Some("cont_id_2"));

    // plex matched by subdomain of hostname
    assert_eq!(matched[2].hostname, "plex.homelab.org");
    assert_eq!(matched[2].matched_container_id.as_deref(), Some("cont_id_3"));
}

#[tokio::test]
async fn test_cloudflare_unauthenticated_rejected() {
    let app = backend::app();

    let endpoints = vec![
        ("GET", "/api/cloudflare/config"),
        ("GET", "/api/cloudflare/detect"),
        ("GET", "/api/cloudflare/tunnels"),
        ("POST", "/api/cloudflare/sync-links"),
    ];

    for (method, uri) in endpoints {
        let response = app
            .clone()
            .oneshot(
                Request::builder()
                    .method(method)
                    .uri(uri)
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(
            response.status(),
            StatusCode::UNAUTHORIZED,
            "Expected 401 for unauthenticated request to {} {}",
            method,
            uri
        );
    }
}

#[tokio::test]
async fn test_cloudflare_config_lifecycle() {
    let app = backend::app();
    let auth_token = get_valid_token();

    // 1. GET initial config
    let res = app
        .clone()
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/api/cloudflare/config")
                .header("Authorization", format!("Bearer {}", auth_token))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::OK);

    // 2. POST save config
    let save_payload = serde_json::json!({
        "account_id": "test_account_999",
        "tunnel_id": "test_tunnel_888",
        "api_token": "secret_cloudflare_token_12345",
        "auto_sync_links": true,
        "enabled": true
    });

    let res = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/cloudflare/config")
                .header("Authorization", format!("Bearer {}", auth_token))
                .header("Content-Type", "application/json")
                .body(Body::from(save_payload.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::OK);

    // 3. GET config should now have masked token and configured = true
    let res = app
        .clone()
        .oneshot(
            Request::builder()
                .method("GET")
                .uri("/api/cloudflare/config")
                .header("Authorization", format!("Bearer {}", auth_token))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::OK);

    let body_bytes = res.into_body().collect().await.unwrap().to_bytes();
    let json: serde_json::Value = serde_json::from_slice(&body_bytes).unwrap();
    assert_eq!(json["configured"], true);
    assert_eq!(json["account_id"], "test_account_999");
    assert_eq!(json["tunnel_id"], "test_tunnel_888");
    assert_eq!(json["has_api_token"], true);
    // Token must be masked for security
    let token_str = json["api_token"].as_str().unwrap();
    assert!(token_str.contains("••••"));

    // 4. Clean up / DELETE config
    let res = app
        .clone()
        .oneshot(
            Request::builder()
                .method("DELETE")
                .uri("/api/cloudflare/config")
                .header("Authorization", format!("Bearer {}", auth_token))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::OK);
}

#[test]
fn test_local_yaml_parser() {
    let temp_dir = std::env::temp_dir();
    let yaml_file = temp_dir.join("test_cloudflared_config.yml");

    let yaml_content = r#"
tunnel: 6ff42887-865e-4658-b612-309543effe13
credentials-file: /etc/cloudflared/cert.json

ingress:
  - hostname: app1.example.com
    service: http://app1:8080
  - hostname: app2.example.com
    service: http://192.168.1.100:9090
  - service: http_status:404
"#;

    std::fs::write(&yaml_file, yaml_content).unwrap();

    let client = CloudflareClient::new();
    let (tunnel_id, rules) = client.parse_local_yaml(yaml_file.to_str().unwrap()).unwrap();

    assert_eq!(tunnel_id.as_deref(), Some("6ff42887-865e-4658-b612-309543effe13"));
    assert_eq!(rules.len(), 3);
    assert_eq!(rules[0].hostname.as_deref(), Some("app1.example.com"));
    assert_eq!(rules[0].service, "http://app1:8080");

    let _ = std::fs::remove_file(yaml_file);
}
