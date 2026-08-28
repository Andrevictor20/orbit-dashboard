use tracing_subscriber::layer::SubscriberExt;
use tracing_subscriber::util::SubscriberInitExt;

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

    // Refresh App Store repositories in background
    tokio::spawn(async {
        backend::store::sync_repositories().await;
    });

    let app = backend::app();
    let listener = tokio::net::TcpListener::bind("0.0.0.0:5172").await.unwrap();
    tracing::info!("Listening on 0.0.0.0:5172");
    axum::serve(listener, app.into_make_service_with_connect_info::<std::net::SocketAddr>()).await.unwrap();
}

