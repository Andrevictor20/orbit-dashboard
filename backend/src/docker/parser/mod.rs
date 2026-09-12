pub mod compose;
pub mod docker_run;
mod models;

pub use compose::*;
pub use docker_run::*;
pub use models::*;

/// Automatically identifies if the input is a docker run command or docker compose YAML and parses it
pub fn parse_docker_command_or_compose(input: &str) -> Result<ParsedDockerInput, String> {
    let trimmed = input.trim();
    if trimmed.is_empty() {
        return Err("Entrada vazia".to_string());
    }

    // Check if it looks like YAML compose
    if trimmed.starts_with("services:")
        || trimmed.starts_with("version:")
        || trimmed.contains("\nservices:")
        || trimmed.contains("services:\n")
    {
        return parse_docker_compose_yaml(trimmed);
    }

    // If it starts with docker run or has flags, parse as docker run
    if trimmed.starts_with("docker run")
        || trimmed.starts_with("docker compose")
        || trimmed.contains("-p ")
        || trimmed.contains("-v ")
        || trimmed.contains("-d ")
    {
        return parse_docker_run_command(trimmed);
    }

    // Attempt compose YAML first, then docker run as fallback
    if let Ok(compose_res) = parse_docker_compose_yaml(trimmed) {
        return Ok(compose_res);
    }

    parse_docker_run_command(trimmed)
}
