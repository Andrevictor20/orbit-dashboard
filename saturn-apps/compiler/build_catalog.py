#!/usr/bin/env python3
"""
saturn-apps/compiler/build_catalog.py

Varre todos os apps em saturn-apps/apps/, valida a integridade dos manifestos
e do compose, e compila o catálogo consolidado em:
- saturn-apps/catalog.json (formatado com indentação)
- saturn-apps/catalog.min.json (minificado para produção / CDN)
"""

import sys
import json
import yaml
from pathlib import Path

APPS_DIR = Path(__file__).resolve().parent.parent / "apps"
OUTPUT_JSON = Path(__file__).resolve().parent.parent / "catalog.json"
OUTPUT_MIN_JSON = Path(__file__).resolve().parent.parent / "catalog.min.json"

REQUIRED_FIELDS = ["id", "name", "category"]

def build():
    if not APPS_DIR.exists():
        print(f"Erro: Diretório {APPS_DIR} não encontrado!", file=sys.stderr)
        sys.exit(1)

    catalog = []
    errors = []

    print(f"Varrendo aplicativos em {APPS_DIR}...")
    app_dirs = sorted([d for d in APPS_DIR.iterdir() if d.is_dir()])

    for d in app_dirs:
        manifest_file = d / "saturn-app.yml"
        compose_file = d / "docker-compose.yml"

        if not manifest_file.exists():
            continue

        if not compose_file.exists():
            errors.append(f"[{d.name}] Faltando docker-compose.yml")
            continue

        try:
            with open(manifest_file, "r", encoding="utf-8") as f:
                manifest = yaml.safe_load(f)
        except Exception as e:
            errors.append(f"[{d.name}] Erro ao ler saturn-app.yml: {e}")
            continue

        if not isinstance(manifest, dict):
            errors.append(f"[{d.name}] saturn-app.yml não é um objeto YAML válido")
            continue

        for field in REQUIRED_FIELDS:
            if not manifest.get(field):
                errors.append(f"[{d.name}] Campo obrigatório ausente: {field}")

        try:
            with open(compose_file, "r", encoding="utf-8") as f:
                compose_content = f.read()
        except Exception as e:
            errors.append(f"[{d.name}] Erro ao ler docker-compose.yml: {e}")
            continue

        # Verifica se tem ícone local
        icon_path = manifest.get("icon", "")
        if (d / "icon.png").exists():
            # Pode ser servido relativamente ou via CDN
            icon_url = f"https://raw.githubusercontent.com/Andrevictor20/saturn-apps/main/apps/{d.name}/icon.png"
            if not icon_path or icon_path == "icon.png":
                icon_path = icon_url

        item = {
            "id": str(manifest.get("id", d.name)),
            "name": str(manifest.get("name", d.name)),
            "description": str(manifest.get("description") or manifest.get("tagline") or ""),
            "tagline": str(manifest.get("tagline") or ""),
            "icon": str(icon_path or ""),
            "category": str(manifest.get("category", "Utilities")),
            "store": str(manifest.get("store", "official")),
            "version": str(manifest.get("version", "1.0.0")),
            "developer": str(manifest.get("developer", "Community")),
            "port": manifest.get("port"),
            "architectures": manifest.get("architectures", []),
            "compose_file": compose_content,
        }

        catalog.append(item)

    if errors:
        print(f"\nAvisos/Erros encontrados ({len(errors)}):", file=sys.stderr)
        for err in errors[:10]:
            print(f"  - {err}", file=sys.stderr)
        if len(errors) > 10:
            print(f"  ... e mais {len(errors) - 10} avisos.", file=sys.stderr)

    # Escreve catalog.json
    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(catalog, f, indent=2, ensure_ascii=False)

    # Escreve catalog.min.json
    with open(OUTPUT_MIN_JSON, "w", encoding="utf-8") as f:
        json.dump(catalog, f, separators=(',', ':'), ensure_ascii=False)

    print(f"\nCatálogo compilado com sucesso!")
    print(f"Total de apps válidos: {len(catalog)}")
    print(f"Salvo em: {OUTPUT_JSON} ({OUTPUT_JSON.stat().st_size // 1024} KB)")
    print(f"Salvo em: {OUTPUT_MIN_JSON} ({OUTPUT_MIN_JSON.stat().st_size // 1024} KB)")

if __name__ == "__main__":
    build()
