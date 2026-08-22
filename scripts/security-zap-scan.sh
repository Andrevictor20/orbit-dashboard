#!/bin/bash
# security-zap-scan.sh
# Requires Docker. This script runs an OWASP ZAP API Scan against the OpenAPI specification.
# It validates security headers, injections, and overall API attack surface.

set -e

# Target API URL (Must be accessible from within docker, so we use host network or correct IP)
TARGET_API="http://localhost:5172"
# Path to the OpenAPI spec
OPENAPI_FILE="backend/openapi.yaml"

echo "========================================="
echo "Starting OWASP ZAP API Security Scan..."
echo "Target: $TARGET_API"
echo "Spec: $OPENAPI_FILE"
echo "========================================="

# Run ZAP API scan in Docker
docker run --rm --network host \
  -v $(pwd):/zap/wrk/:z \
  -t ghcr.io/zaproxy/zaproxy:stable zap-api-scan.py \
  -t "/zap/wrk/$OPENAPI_FILE" \
  -f openapi \
  -O "$TARGET_API" \
  -r zap-report.html

echo "========================================="
echo "Scan complete! Report saved to zap-report.html"
echo "========================================="
