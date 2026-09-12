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
            origin_request: None,
        },
        RawIngressRule {
            hostname: Some("grafana.homelab.org".to_string()),
            service: "http://127.0.0.1:3000".to_string(),
            path: None,
            origin_request: None,
        },
        RawIngressRule {
            hostname: Some("plex.homelab.org".to_string()),
            service: "http://unknown-host:32400".to_string(),
            path: None,
            origin_request: None,
        },
        RawIngressRule {
            hostname: None,
            service: "http_status:404".to_string(),
            path: None,
            origin_request: None,
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

#[test]
fn test_decode_tunnel_token_with_cmd_args_and_quotes() {
    let payload = r#"{"a":"cf_acc_12345","t":"cf_tun_67890","s":"secret_xyz"}"#;
    let b64 = STANDARD.encode(payload.as_bytes());

    // Test with quotes
    let quoted = format!("\"{}\"", b64);
    let decoded = decode_tunnel_token(&quoted);
    assert!(decoded.is_some());
    assert_eq!(decoded.unwrap(), ("cf_acc_12345".to_string(), "cf_tun_67890".to_string()));

    // Test with --token prefix
    let with_flag = format!("--token {}", b64);
    let decoded_flag = decode_tunnel_token(&with_flag);
    assert!(decoded_flag.is_some());
    assert_eq!(decoded_flag.unwrap(), ("cf_acc_12345".to_string(), "cf_tun_67890".to_string()));

    // Test with full docker command string
    let full_cmd = format!("docker run cloudflare/cloudflared:latest tunnel run --token {}", b64);
    let decoded_cmd = decode_tunnel_token(&full_cmd);
    assert!(decoded_cmd.is_some());
    assert_eq!(decoded_cmd.unwrap(), ("cf_acc_12345".to_string(), "cf_tun_67890".to_string()));
}

#[tokio::test]
async fn test_cloudflare_test_connection_handler() {
    let app = backend::app();
    let auth_token = get_valid_token();

    let test_payload = serde_json::json!({
        "account_id": "test_account",
        "tunnel_id": "test_tunnel",
        "api_token": "test_token"
    });

    let res = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/cloudflare/test")
                .header("Authorization", format!("Bearer {}", auth_token))
                .header("Content-Type", "application/json")
                .body(Body::from(test_payload.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(res.status(), StatusCode::OK);
    let body_bytes = res.into_body().collect().await.unwrap().to_bytes();
    let json: serde_json::Value = serde_json::from_slice(&body_bytes).unwrap();
    // Since test_token is dummy, it should return success: false with an error message, not crash or 500
    assert_eq!(json["success"], false);
    assert!(json["error"].as_str().is_some());
}

#[test]
fn test_ingress_rules_pure_manipulation() {
    use backend::cloudflare::client::{insert_or_update_ingress_rule, remove_ingress_rule};

    let initial = vec![
        RawIngressRule {
            hostname: Some("grafana.example.com".to_string()),
            service: "http://127.0.0.1:3000".to_string(),
            path: None,
            origin_request: None,
        },
        RawIngressRule {
            hostname: None,
            service: "http_status:404".to_string(),
            path: None,
            origin_request: None,
        },
    ];

    // 1. Insert new rule: should be placed before catch-all 404
    let new_rule = RawIngressRule {
        hostname: Some("jellyfin.example.com".to_string()),
        service: "http://jellyfin:8096".to_string(),
        path: None,
        origin_request: None,
    };
    let updated = insert_or_update_ingress_rule(initial.clone(), new_rule);
    assert_eq!(updated.len(), 3);
    assert_eq!(updated[0].hostname.as_deref(), Some("grafana.example.com"));
    assert_eq!(updated[1].hostname.as_deref(), Some("jellyfin.example.com"));
    assert_eq!(updated[2].hostname, None);
    assert_eq!(updated[2].service, "http_status:404");

    // 2. Update existing rule: should overwrite without duplicating
    let updated_jellyfin = RawIngressRule {
        hostname: Some("jellyfin.example.com".to_string()),
        service: "http://jellyfin:8920".to_string(), // new port
        path: None,
        origin_request: None,
    };
    let re_updated = insert_or_update_ingress_rule(updated, updated_jellyfin);
    assert_eq!(re_updated.len(), 3);
    assert_eq!(re_updated[1].hostname.as_deref(), Some("jellyfin.example.com"));
    assert_eq!(re_updated[1].service, "http://jellyfin:8920");

    // 3. Remove rule by hostname
    let removed = remove_ingress_rule(re_updated, "grafana.example.com", None);
    assert_eq!(removed.len(), 2);
    assert_eq!(removed[0].hostname.as_deref(), Some("jellyfin.example.com"));
    assert_eq!(removed[1].hostname, None); // 404 catch-all preserved
}

#[tokio::test]
async fn test_cloudflare_routes_endpoints_unauthenticated() {
    let app = backend::app();

    let endpoints = vec![
        ("POST", "/api/cloudflare/routes"),
        ("DELETE", "/api/cloudflare/routes"),
    ];

    for (method, uri) in endpoints {
        let response = app
            .clone()
            .oneshot(
                Request::builder()
                    .method(method)
                    .uri(uri)
                    .header("Content-Type", "application/json")
                    .body(Body::from(r#"{"hostname":"test.example.com","service":"http://localhost:80"}"#))
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

#[test]
fn test_sync_ingress_rules_populates_short_id_and_container_name() {
    use backend::cloudflare::client::sync_ingress_rules_to_links;
    use backend::cloudflare::models::IngressRule;

    let full_id = "a1b2c3d4e5f67890123456789012345678901234567890123456789012345678".to_string();
    let short_id = "a1b2c3d4e5f6".to_string();
    let container_name = "/stirling-pdf".to_string();
    let public_url = "https://stirling-pdf.rasppi.cloud".to_string();

    let rule = IngressRule {
        hostname: "stirling-pdf.rasppi.cloud".to_string(),
        service: "http://stirling-pdf:8080".to_string(),
        path: None,
        public_url: public_url.clone(),
        matched_container_id: Some(full_id.clone()),
        matched_container_name: Some(container_name),
    };

    let sync_res = sync_ingress_rules_to_links(&[rule]);

    assert!(sync_res.synced_links.contains_key(&full_id));
    assert!(sync_res.synced_links.contains_key(&short_id), "Short ID (12 chars) must be synced");
    assert!(sync_res.synced_links.contains_key("stirling-pdf"), "Container name must be synced");
    assert_eq!(sync_res.synced_links.get(&short_id).unwrap(), &public_url);
    assert_eq!(sync_res.synced_links.get("stirling-pdf").unwrap(), &public_url);
}


