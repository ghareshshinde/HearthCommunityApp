# Deploying Hearth on Google Cloud (Cloud Run)

Hearth keeps its data in a SQLite file. Cloud Run has no permanent disk, so the app saves a snapshot to a
Cloud Storage bucket after every change and restores it when a new container starts. Nothing else is needed.

**One rule: run exactly one instance** (`--max-instances 1`). SQLite has a single writer. If a second instance
ever saves newer data, the app refuses to overwrite it and shows "We could not store this safely" instead of losing data.

## What you set

| Setting | Value | Notes |
|---|---|---|
| `ADMIN_PASSWORD` | your choice | Used only when the database is first created. Change it later in Admin > Change password. |
| `SESSION_SECRET` | long random text | Signs admin cookies. Keep it in Secret Manager. |
| `GCS_BUCKET` | bucket name | Where the snapshot lives. Leave empty to run without backup (local use only). |
| `GCS_OBJECT` | optional, default `hearth/hearth.db` | |
| `SEED_DEMO_EVENT` | `true` for a demo event on first run | Optional. |
| `RESET_ADMIN_PASSWORD` | `true` once, with `ADMIN_PASSWORD` set | Recovery if the password is lost. Remove it afterwards. |
| max instances | 1 | Required. |

## Steps (Cloud Shell, once)

```bash
PROJECT=your-project-id
REGION=asia-south1
BUCKET=$PROJECT-hearth-data

gcloud config set project $PROJECT
gcloud storage buckets create gs://$BUCKET --location=$REGION --uniform-bucket-level-access
gcloud storage buckets update gs://$BUCKET --versioning   # keeps older snapshots as a second safety net

# Secrets
printf '%s' "$(openssl rand -hex 32)" | gcloud secrets create hearth-session-secret --data-file=-
printf '%s' 'choose-a-strong-admin-password' | gcloud secrets create hearth-admin-password --data-file=-

# Deploy straight from the repository (uses the Dockerfile)
gcloud run deploy hearth --source . --region $REGION --allow-unauthenticated \
  --max-instances 1 --min-instances 0 \
  --set-env-vars GCS_BUCKET=$BUCKET,SEED_DEMO_EVENT=false \
  --set-secrets SESSION_SECRET=hearth-session-secret:latest,ADMIN_PASSWORD=hearth-admin-password:latest

# Let the service write to the bucket and read its secrets
SA=$(gcloud run services describe hearth --region $REGION --format='value(spec.template.spec.serviceAccountName)')
[ -z "$SA" ] && SA=$(gcloud projects describe $PROJECT --format='value(projectNumber)')-compute@developer.gserviceaccount.com
gcloud storage buckets add-iam-policy-binding gs://$BUCKET --member=serviceAccount:$SA --role=roles/storage.objectUser
gcloud secrets add-iam-policy-binding hearth-session-secret --member=serviceAccount:$SA --role=roles/secretmanager.secretAccessor
gcloud secrets add-iam-policy-binding hearth-admin-password --member=serviceAccount:$SA --role=roles/secretmanager.secretAccessor
```

Open the service URL, then `/c/jsg/admin` and sign in with the admin password. Add a custom domain later if you want one.

## Google AI Studio

AI Studio's Build mode can import a GitHub repository and deploy to Cloud Run. I could not confirm from its documentation
that it accepts a Next.js app with a Dockerfile, so treat that route as untested. The repository is a standard
container app: if the import works, set the environment variables above and make sure the deployed service has
**max instances = 1** and a service account with `Storage Object User` on the bucket. If it does not, the Cloud Shell steps
above deploy the same code.

## Checks after deploying

1. Register a test family, then in the Cloud Console open Cloud Run > hearth > Revisions > "Deploy new revision" (this restarts the container).
2. Open the admin registrations page: the test family should still be there. That proves restore works.
3. Admin > Download backup gives you a copy of the whole database at any time.

## Costs and limits

Cloud Run with 0 minimum instances sleeps when idle, so the first visit after a quiet period takes a few seconds while the
snapshot is restored. Set `--min-instances 1` on event day to avoid that. One instance is plenty for a community event
(the PRD target is 300 concurrent users); a load test is still to do.
