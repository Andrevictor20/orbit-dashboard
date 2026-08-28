use tracing_subscriber::layer::SubscriberExt;
use tracing_subscriber::util::SubscriberInitExt;

async fn shutdown_signal() {
    let ctrl_c = async {
        tokio::signal::ctrl_c()
            .await
            .expect("failed to install Ctrl+C handler");
    };

    #[cfg(unix)]
    let terminate = async {
        if let Ok(mut sig) = tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate()) {
            sig.recv().await;
        } else {
            std::future::pending::<()>().await;
        }
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {
            tracing::info!("Received Ctrl+C signal. Starting graceful shutdown...");
        },
        _ = terminate => {
            tracing::info!("Received SIGTERM signal. Starting graceful shutdown...");
        },
    }
}

#[tokio::main]
async fn main() {
    // Load .env if present
    let _ = dotenvy::dotenv();

    // Ensure data directory exists for logging
    let _ = std::fs::create_dir_all("data");

    // Setup daily rolling log file and prune old logs (keep max 5 days / max 50MB)
    let file_appender = tracing_appender::rolling::daily("data", "orbit.log");
    let (non_blocking, _guard) = tracing_appender::non_blocking(file_appender);
    backend::logs::prune_old_log_files("data", 5, 50 * 1024 * 1024);

    let file_layer = tracing_subscriber::fmt::layer()
        .with_writer(non_blocking)
        .with_ansi(false);

    let stdout_layer = tracing_subscriber::fmt::layer()
        .with_writer(std::io::stdout);

    let env_filter = tracing_subscriber::EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info,bollard=warn,hyper=warn,tower_http=warn,h2=warn"));

    tracing_subscriber::registry()
        .with(env_filter)
        .with(file_layer)
        .with(stdout_layer)
        .init();

    tracing::info!("Orbit Dashboard Backend Starting...");

    // Load App Store cache from disk or sync in background
    tokio::spawn(async {
        if !backend::store::catalog::load_cached_apps_from_disk() {
            backend::store::sync_repositories().await;
        }
    });

    let app = backend::app();
    let listener = match tokio::net::TcpListener::bind("0.0.0.0:5172").await {
        Ok(l) => l,
        Err(e) => {
            eprintln!("FATAL: Failed to bind TCP listener on 0.0.0.0:5172: {}", e);
            tracing::error!("FATAL: Failed to bind TCP listener on 0.0.0.0:5172: {}", e);
            std::process::exit(1);
        }
    };
    tracing::info!("Listening on 0.0.0.0:5172");
    
    let server = axum::serve(listener, app.into_make_service_with_connect_info::<std::net::SocketAddr>())
        .with_graceful_shutdown(shutdown_signal());

    if let Err(e) = server.await {
        eprintln!("FATAL: Server error: {}", e);
        tracing::error!("FATAL: Server error: {}", e);
        std::process::exit(1);
    } else {
        tracing::info!("Orbit Dashboard Backend stopped gracefully.");
    }
}
