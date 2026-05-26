# DataRegimen — Cloud Run site

Static marketing site for DataRegimen, packaged in an unprivileged nginx
container and deployed to Google Cloud Run via Cloud Build.

```
.
├── Dockerfile                # nginx-unprivileged, multi-stage friendly
├── cloudbuild.yaml           # build → push → deploy → smoke-test
├── nginx.conf                # main nginx config (logs, gzip, limits)
├── default.conf.template     # server block; ${PORT} injected at boot
├── .dockerignore
└── site/                     # static assets served by nginx
    ├── index.html
    ├── 404.html
    ├── styles.css
    ├── script.js
    ├── favicon.svg
    ├── manifest.webmanifest
    ├── robots.txt
    └── sitemap.xml
```

## What you get

- Fully accessible HTML (semantic landmarks, skip-link, ARIA, keyboard nav, `prefers-reduced-motion`, focus rings, 44-px touch targets).
- Mobile-first responsive design at all common breakpoints.
- SEO: descriptive `<title>`/`<meta>`, Open Graph, Twitter Cards, canonical, three JSON-LD blocks (Organization, ProfessionalService, FAQPage), `robots.txt`, `sitemap.xml`.
- Formspree-powered contact form with async submit, live validation, status messaging, and honeypot field.
- nginx security headers (HSTS, CSP, X-Frame-Options, Referrer-Policy, Permissions-Policy), gzip, immutable asset caching, `/healthz` probe.
- Runs as the non-root `nginx` user — Cloud Run best practice.

---

## 1. One-time setup

```bash
# Set these once
export PROJECT_ID="your-gcp-project"
export REGION="us-central1"
export SERVICE="dataregimen"
export REPO="dataregimen"

gcloud config set project $PROJECT_ID

# Enable APIs
gcloud services enable \
  cloudbuild.googleapis.com \
  run.googleapis.com \
  artifactregistry.googleapis.com

# Create Artifact Registry repo (one-time)
gcloud artifacts repositories create $REPO \
  --repository-format=docker \
  --location=$REGION \
  --description="DataRegimen container images"

# Grant Cloud Build SA the rights to deploy Cloud Run
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')
CB_SA="${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${CB_SA}" --role="roles/run.admin"
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${CB_SA}" --role="roles/iam.serviceAccountUser"
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${CB_SA}" --role="roles/artifactregistry.writer"
```

## 2. Configure the contact form

In `site/index.html`, replace `YOUR_FORM_ID` in the form `action`:

```html
<form action="https://formspree.io/f/YOUR_FORM_ID" method="POST" ...>
```

Get the ID by creating a form at https://formspree.io.

## 3. Local test

```bash
docker build -t dataregimen:local .
docker run --rm -p 8080:8080 -e PORT=8080 dataregimen:local
# open http://localhost:8080
# healthcheck: curl http://localhost:8080/healthz
```

## 4. Deploy

### Manual (one-shot)

```bash
gcloud builds submit --config=cloudbuild.yaml \
  --substitutions=_REGION=$REGION,_SERVICE=$SERVICE,_REPO=$REPO
```

### Continuous (recommended)

Connect your Git repo to Cloud Build and create a trigger pointing at
`cloudbuild.yaml`. Each push will build, push, deploy, and smoke-test.

```bash
gcloud builds triggers create github \
  --name="dataregimen-main" \
  --repo-name="your-repo" \
  --repo-owner="your-org" \
  --branch-pattern="^main$" \
  --build-config="cloudbuild.yaml"
```

## 5. Custom domain

```bash
gcloud beta run domain-mappings create \
  --service=$SERVICE \
  --domain=dataregimen.com \
  --region=$REGION
```

Then add the DNS records Cloud Run shows you.

## Substitution variables (override per-environment)

| Var              | Default       | Purpose                                |
| ---------------- | ------------- | -------------------------------------- |
| `_REGION`        | `us-central1` | Cloud Run + Artifact Registry region   |
| `_SERVICE`       | `dataregimen` | Cloud Run service name                 |
| `_REPO`          | `dataregimen` | Artifact Registry repository           |
| `_MEMORY`        | `256Mi`       | Container memory                       |
| `_CPU`           | `1`           | Container vCPU                         |
| `_CONCURRENCY`   | `80`          | Requests per instance                  |
| `_MIN_INSTANCES` | `0`           | Scale-to-zero by default               |
| `_MAX_INSTANCES` | `10`          | Cap on autoscaling                     |
| `_ALLOW_UNAUTH`  | `true`        | Set `false` for private services       |

## Notes

- **Why `nginxinc/nginx-unprivileged`?** Cloud Run forbids running as root. This image runs as UID 101 by default, uses `/tmp` for PID + temp dirs, and works without any tweaks to the file-system layout.
- **Why `envsubst` on the server block?** Cloud Run injects `$PORT` at runtime. The base image's entrypoint expands `${PORT}` from `/etc/nginx/templates/*.template` into `/etc/nginx/conf.d/` before launching nginx.
- **CSP**: tuned to allow Google Fonts and Formspree only. Tighten further (replace `'unsafe-inline'` with nonces) if you add a build step.
