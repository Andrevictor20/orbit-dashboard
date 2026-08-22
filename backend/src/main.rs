#[tokio::main]
async fn main() {
    // Load .env if present
    let _ = dotenvy::dotenv();

    // Setup logging to file
    let file_appender = tracing_appender::rolling::never("data", "orbit.log");
    let (non_blocking, _guard) = tracing_appender::non_blocking(file_appender);
    tracing_subscriber::fmt()
        .with_writer(non_blocking)
        .with_ansi(false)
        .init();

    tracing::info!("Orbit Dashboard Backend Starting...");

    let app = backend::app();
    let listener = tokio::net::TcpListener::bind("0.0.0.0:5172").await.unwrap();
    tracing::info!("Listening on 0.0.0.0:5172");
    axum::serve(listener, app.into_make_service_with_connect_info::<std::net::SocketAddr>()).await.unwrap();
}
