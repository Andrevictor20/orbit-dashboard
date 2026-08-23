use serde_yaml::Value;
use super::types::AppStoreItem;

pub fn parse_casaos_compose(compose_yaml: &str, store_name: &str) -> Result<AppStoreItem, Box<dyn std::error::Error>> {
    let parsed: Value = serde_yaml::from_str(compose_yaml)?;
    
    // Helper to get string from CasaOS translation maps (en_US, custom, or first available)
    let get_translated_string = |v: &Value| -> Option<String> {
        if let Some(s) = v.as_str() {
            Some(s.to_string())
        } else if let Some(map) = v.as_mapping() {
            if let Some(s) = map.get(&Value::String("custom".to_string())).and_then(|t| t.as_str()) {
                Some(s.to_string())
            } else if let Some(s) = map.get(&Value::String("en_US".to_string())).and_then(|t| t.as_str()) {
                Some(s.to_string())
            } else if let Some(s) = map.get(&Value::String("en".to_string())).and_then(|t| t.as_str()) {
                Some(s.to_string())
            } else {
                map.values().next().and_then(|t| t.as_str()).map(|s| s.to_string())
            }
        } else {
            None
        }
    };

    let x_casaos = parsed.get("x-casaos");

    let name = x_casaos
        .and_then(|x| x.get("title"))
        .and_then(get_translated_string)
        .or_else(|| {
            parsed.get("name").and_then(|n| n.as_str()).map(|s| s.to_string())
        })
        .or_else(|| {
            parsed.get("services")
                .and_then(|s| s.as_mapping())
                .and_then(|m| m.keys().next())
                .and_then(|k| k.as_str())
                .map(|s| s.to_string())
        })
        .unwrap_or_else(|| "App".to_string());

    let description = x_casaos
        .and_then(|x| x.get("tagline").or_else(|| x.get("description")))
        .and_then(get_translated_string)
        .unwrap_or_default();

    let icon = x_casaos
        .and_then(|x| x.get("icon"))
        .and_then(get_translated_string)
        .unwrap_or_default();

    let category = x_casaos
        .and_then(|x| x.get("category"))
        .and_then(|v| v.as_str())
        .unwrap_or("Utilities")
        .to_string();

    let original_id = x_casaos
        .and_then(|x| x.get("store_app_id"))
        .and_then(|v| v.as_str())
        .unwrap_or_else(|| name.as_str())
        .to_string()
        .to_lowercase()
        .replace(' ', "-");

    let id = format!("{}-{}", store_name, original_id);

    Ok(AppStoreItem {
        id,
        name,
        description,
        icon,
        category,
        store: store_name.to_string(),
        compose_file: compose_yaml.to_string(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_casaos_compose_valid() {
        let yaml = r#"
name: testapp
services:
  app:
    image: alpine:latest
x-casaos:
  title:
    en_US: Test App
  tagline:
    en_US: A simple test app
  icon:
    en_US: https://example.com/icon.png
  category: Utilities
  store_app_id: test-app
"#;
        let item = parse_casaos_compose(yaml, "official").unwrap();
        
        assert_eq!(item.id, "official-test-app");
        assert_eq!(item.name, "Test App");
        assert_eq!(item.description, "A simple test app");
        assert_eq!(item.icon, "https://example.com/icon.png");
        assert_eq!(item.category, "Utilities");
        assert_eq!(item.store, "official");
        assert_eq!(item.compose_file, yaml);
    }

    #[test]
    fn test_parse_casaos_compose_missing_x_casaos() {
        let yaml = r#"
name: testapp
services:
  app:
    image: alpine:latest
"#;
        let result = parse_casaos_compose(yaml, "official");
        assert!(result.is_ok());
        let item = result.unwrap();
        assert_eq!(item.name, "testapp");
        assert_eq!(item.id, "official-testapp");
    }

    #[test]
    fn test_parse_casaos_compose_fallback_translations() {
        let yaml = r#"
name: testapp
x-casaos:
  title:
    custom: Custom Title
    en_US: English Title
"#;
        let item = parse_casaos_compose(yaml, "official").unwrap();
        // custom has higher priority than en_US
        assert_eq!(item.name, "Custom Title");
    }
}
