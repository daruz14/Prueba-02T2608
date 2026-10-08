#!/usr/bin/env bash
set -euo pipefail

# Idempotent Cloud Run deploy. Requires gcloud installed and authenticated.
#   ./deploy.sh
# The secret is created ONCE (the API key is never committed):
#   printf '%s' "$GEMINI_API_KEY" | gcloud secrets create mirador-gemini --data-file=-
# If the secret exists, deploy.sh injects it as GEMINI_API_KEY and switches
# MODEL_BACKEND to gemini.

SERVICE="${SERVICE:-mirador-nunoa}"
# us-central1: the Cloud Run free tier (2M requests + 180k vCPU-s + 360k GiB-s
# per month) is priced and applied in US regions only. Chilean time does not
# depend on the region: ENV TZ=America/Santiago (Dockerfile) sets it.
REGION="${REGION:-us-central1}"
PROJECT="${GCP_PROJECT:-}"
SECRET_NAME="${GEMINI_SECRET:-mirador-gemini}"

EXTRA=()
if [[ -n "$PROJECT" ]]; then
  EXTRA+=(--project "$PROJECT")
fi

SECRET_ARGS=()
if gcloud secrets describe "$SECRET_NAME" ${EXTRA[@]+"${EXTRA[@]}"} >/dev/null 2>&1; then
  SECRET_ARGS+=(--set-secrets "GEMINI_API_KEY=${SECRET_NAME}:latest")
  SECRET_ARGS+=(--set-env-vars "MODEL_BACKEND=${MODEL_BACKEND:-gemini}")
fi

# Optional ingress key: protects /messages and /lead/* behind an API key.
# Create the secret once (the key is never committed):
#   printf '%s' "$INGRESS_API_KEY" | gcloud secrets create mirador-ingress-key --data-file=-
INGRESS_SECRET="${INGRESS_SECRET:-mirador-ingress-key}"
if gcloud secrets describe "$INGRESS_SECRET" ${EXTRA[@]+"${EXTRA[@]}"} >/dev/null 2>&1; then
  SECRET_ARGS+=(--set-secrets "INGRESS_API_KEY=${INGRESS_SECRET}:latest")
elif [[ -n "${INGRESS_API_KEY:-}" ]]; then
  SECRET_ARGS+=(--set-env-vars "INGRESS_API_KEY=${INGRESS_API_KEY}")
fi

gcloud run deploy "$SERVICE" \
  --source . \
  --region "$REGION" \
  --port 8080 \
  --allow-unauthenticated \
  ${EXTRA[@]+"${EXTRA[@]}"} \
  ${SECRET_ARGS[@]+"${SECRET_ARGS[@]}"}

DESCRIBE=(run services describe "$SERVICE" --region "$REGION" --format='value(status.url)')
URL="$(gcloud ${EXTRA[@]+"${EXTRA[@]}"} "${DESCRIBE[@]}")"
echo "URL: $URL"
echo "Smoke test: curl -s $URL/healthz"
