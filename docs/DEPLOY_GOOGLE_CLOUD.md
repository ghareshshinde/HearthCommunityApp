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
| `APP_URL` | the public address, e.g. `https://hearth-xxxx.a.run.app` | Used for the links in emails and for sharing previews. |
| `SMTP_URL` | e.g. `smtps://user:app-password@smtp.gmail.com:465` | Turns email sending on. Without it, emails are only recorded in Admin > Audit log and emails. |
| `EMAIL_FROM` | e.g. `JSG Hyderabad <jsghyd@gmail.com>` | Sender name and address. |
| `EMAIL_REPLY_TO` | the community's address | Replies go here. |
| `NOTIFY_COPY_TO` | `jsghyd@gmail.com` (comma-separate for more) | A copy of every new registration goes to this address. |
| max instances | 1 | Required. |

## Quick way (Cloud Shell, about 10 minutes)

```bash
git clone https://github.com/ghareshshinde/HearthCommunityApp && cd HearthCommunityApp
gcloud config set project YOUR-PROJECT-ID
bash scripts/deploy-cloudrun.sh
```
It does every step below, generates the secrets, and prints the site address and the admin password at the end. Email is optional and can be added later (see Email below).

## Steps by hand (Cloud Shell, once, about 10 minutes)

You need a Google Cloud project with billing switched on. Open Cloud Shell (the terminal icon at the top right of the Cloud console).

**1. Get the code and set your names**
```bash
git clone https://github.com/ghareshshinde/HearthCommunityApp
cd HearthCommunityApp
export PROJECT=your-project-id          # find it at the top of the console
export REGION=asia-south1               # Mumbai
export BUCKET=$PROJECT-hearth-data
gcloud config set project $PROJECT
```
A private repo asks for sign-in: use `gh auth login` first (Cloud Shell has `gh`), or a personal access token.

**2. Switch on the services and create the storage bucket**
```bash
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com storage.googleapis.com
gcloud storage buckets create gs://$BUCKET --location=$REGION --uniform-bucket-level-access
gcloud storage buckets update gs://$BUCKET --versioning
```

**3. Store the two secrets** (replace the admin password with your own; keep it somewhere safe)
```bash
printf '%s' "$(openssl rand -hex 32)" | gcloud secrets create hearth-session-secret --data-file=-
printf '%s' 'CHOOSE-A-STRONG-ADMIN-PASSWORD' | gcloud secrets create hearth-admin-password --data-file=-
```

**4. Let the service use them**
```bash
PN=$(gcloud projects describe $PROJECT --format='value(projectNumber)')
SA=$PN-compute@developer.gserviceaccount.com
gcloud storage buckets add-iam-policy-binding gs://$BUCKET --member=serviceAccount:$SA --role=roles/storage.objectUser
gcloud secrets add-iam-policy-binding hearth-session-secret --member=serviceAccount:$SA --role=roles/secretmanager.secretAccessor
gcloud secrets add-iam-policy-binding hearth-admin-password --member=serviceAccount:$SA --role=roles/secretmanager.secretAccessor
```

**5. Deploy** (the first build takes about 5 minutes; say yes if it offers to create an Artifact Registry repository)
```bash
gcloud run deploy hearth --source . --region $REGION --allow-unauthenticated \
  --max-instances 1 --min-instances 0 --memory 512Mi \
  --set-env-vars GCS_BUCKET=$BUCKET \
  --set-secrets SESSION_SECRET=hearth-session-secret:latest,ADMIN_PASSWORD=hearth-admin-password:latest
```

**6. Tell the app its own address** (used in emails and share previews)
```bash
URL=$(gcloud run services describe hearth --region $REGION --format='value(status.url)')
gcloud run services update hearth --region $REGION --update-env-vars APP_URL=$URL
echo $URL
```

**7. Open it**: `URL/c/jsg` is the public site and `URL/c/jsg/admin` is the admin sign-in (the password from step 3).
Then create the event in the admin console: New event, check the sports and dates, set Status to Published.

**8. Check it before the event** (5 minutes, from any computer with Node 22: `git clone` the repo, `npm ci`)
```bash
npx playwright install chromium     # once
node scripts/loadtest.mjs $URL 300 300
```
It saves 300 test families at once and prints a "probe" link. Expect `"failed": 0`. Then prove the data survives a restart:
```bash
gcloud run services update hearth --region $REGION --update-env-vars RESTARTED_AT=$(date +%s)
curl -s -o /dev/null -w '%{http_code}\n' PROBE-LINK-FROM-ABOVE      # must print 200
```
Afterwards remove the test families: Admin > Registrations, select all rows (filter by name "Family"), Cancel, or start the real event on a fresh bucket object (set `GCS_OBJECT=hearth/event.db`).
Also on two phones: open `URL/c/jsg/staff/login`, sign in as a gate login, tap Scan and scan a ticket from `URL/c/jsg/t/...`.

**Email (later, when ready)**: add `SMTP_URL`, `EMAIL_FROM` and `NOTIFY_COPY_TO` with
`gcloud run services update hearth --region $REGION --update-env-vars EMAIL_FROM='JSG Hyderabad <jsghyd@gmail.com>',NOTIFY_COPY_TO=jsghyd@gmail.com`
and put the SMTP URL (it contains a password) in Secret Manager:
`printf '%s' 'smtps://jsghyd%40gmail.com:APP-PASSWORD@smtp.gmail.com:465' | gcloud secrets create hearth-smtp-url --data-file=-`, grant the same accessor role as in step 4, then
`gcloud run services update hearth --region $REGION --update-secrets SMTP_URL=hearth-smtp-url:latest`.

**Updating later**: after new code is pushed to GitHub, run `git pull` and the step 5 command again. Registrations are kept in the bucket.

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
