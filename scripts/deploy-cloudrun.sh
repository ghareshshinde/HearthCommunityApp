#!/usr/bin/env bash
# One-command deploy of Hearth to Google Cloud Run, run from Cloud Shell inside the cloned repo.
#   bash scripts/deploy-cloudrun.sh
# Safe to run again: it reuses the bucket and secrets and only redeploys the code.
# Optional settings before running: REGION (default asia-south1), ADMIN_PASSWORD (otherwise one is generated and shown once).
set -euo pipefail

PROJECT="$(gcloud config get-value project 2>/dev/null || true)"
if [ -z "$PROJECT" ] || [ "$PROJECT" = "(unset)" ]; then
  echo "No Google Cloud project is selected. Run:  gcloud config set project YOUR-PROJECT-ID" >&2
  exit 1
fi
REGION="${REGION:-asia-south1}"
BUCKET="${BUCKET:-$PROJECT-hearth-data}"
SERVICE="${SERVICE:-hearth}"
echo "Project: $PROJECT   Region: $REGION   Bucket: $BUCKET   Service: $SERVICE"

echo "1/6 Switching on Google services (about 1 minute the first time)"
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com storage.googleapis.com

echo "2/6 Storage bucket for the data"
if ! gcloud storage buckets describe "gs://$BUCKET" >/dev/null 2>&1; then
  gcloud storage buckets create "gs://$BUCKET" --location="$REGION" --uniform-bucket-level-access
fi
gcloud storage buckets update "gs://$BUCKET" --versioning >/dev/null

echo "3/6 Secrets"
NEW_PASSWORD=""
if ! gcloud secrets describe hearth-session-secret >/dev/null 2>&1; then
  printf '%s' "$(openssl rand -hex 32)" | gcloud secrets create hearth-session-secret --data-file=- >/dev/null
fi
if ! gcloud secrets describe hearth-admin-password >/dev/null 2>&1; then
  NEW_PASSWORD="${ADMIN_PASSWORD:-$(openssl rand -base64 12 | tr -d '/+=' | cut -c1-14)}"
  printf '%s' "$NEW_PASSWORD" | gcloud secrets create hearth-admin-password --data-file=- >/dev/null
fi

echo "4/6 Permissions for the service"
PN="$(gcloud projects describe "$PROJECT" --format='value(projectNumber)')"
SA="$PN-compute@developer.gserviceaccount.com"
gcloud storage buckets add-iam-policy-binding "gs://$BUCKET" --member="serviceAccount:$SA" --role=roles/storage.objectUser >/dev/null
for s in hearth-session-secret hearth-admin-password; do
  gcloud secrets add-iam-policy-binding "$s" --member="serviceAccount:$SA" --role=roles/secretmanager.secretAccessor >/dev/null
done
# New projects need these so the build can run under the default account.
for role in roles/cloudbuild.builds.builder roles/artifactregistry.writer roles/logging.logWriter; do
  gcloud projects add-iam-policy-binding "$PROJECT" --member="serviceAccount:$SA" --role="$role" --condition=None >/dev/null 2>&1 || true
done

echo "5/6 Building and deploying (about 5 minutes the first time)"
gcloud run deploy "$SERVICE" --source . --region "$REGION" --allow-unauthenticated \
  --max-instances 1 --min-instances 0 --memory 512Mi \
  --set-env-vars "GCS_BUCKET=$BUCKET" \
  --set-secrets "SESSION_SECRET=hearth-session-secret:latest,ADMIN_PASSWORD=hearth-admin-password:latest" --quiet

echo "6/6 Telling the app its own address"
URL="$(gcloud run services describe "$SERVICE" --region "$REGION" --format='value(status.url)')"
gcloud run services update "$SERVICE" --region "$REGION" --update-env-vars "APP_URL=$URL" --quiet >/dev/null

echo
echo "==================== DONE ===================="
echo "Public site : $URL/c/jsg"
echo "Admin sign-in: $URL/c/jsg/admin"
if [ -n "$NEW_PASSWORD" ]; then
  echo "Admin password (shown once, save it now): $NEW_PASSWORD"
else
  echo "Admin password: unchanged from your first deploy (Secret Manager: hearth-admin-password)"
fi
echo "Next: sign in, click New event, set Status to Published, then open the public site and register."
