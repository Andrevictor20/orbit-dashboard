use backend::ssh::{get_docker_gateway_ip, resolve_ssh_target_host};

#[test]
fn test_resolve_ssh_target_host_custom_ip() {
    let custom = Some("192.168.1.100".to_string());
    let resolved = resolve_ssh_target_host(custom, 22);
    assert_eq!(resolved, "192.168.1.100");
}

#[test]
fn test_resolve_ssh_target_host_custom_domain() {
    let custom = Some("remote-server.lan".to_string());
    let resolved = resolve_ssh_target_host(custom, 2222);
    assert_eq!(resolved, "remote-server.lan");
}

#[test]
fn test_resolve_ssh_target_host_localhost_fallback() {
    // When passed None, localhost, or 127.0.0.1, it should resolve to a valid candidate
    let resolved_none = resolve_ssh_target_host(None, 22);
    assert!(!resolved_none.is_empty());

    let resolved_localhost = resolve_ssh_target_host(Some("localhost".to_string()), 22);
    assert!(!resolved_localhost.is_empty());

    let resolved_127 = resolve_ssh_target_host(Some("127.0.0.1".to_string()), 22);
    assert!(!resolved_127.is_empty());
}

#[test]
fn test_get_docker_gateway_ip_or_none() {
    let gw = get_docker_gateway_ip();
    // On linux with routes, it returns an IPv4 string
    if let Some(ip) = gw {
        assert!(ip.contains('.'));
        let parts: Vec<&str> = ip.split('.').collect();
        assert_eq!(parts.len(), 4);
    }
}
