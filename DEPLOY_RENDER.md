# Deploy Drop4Life Backend to Render

Step-by-step guide to deploy the Django API on [Render](https://render.com).

---

## Prerequisites

- GitHub repo pushed (e.g. `amrreda06/drop4life`)
- Render account (free tier works)

---

## Step 1 — Push code to GitHub

```bash
git add .
git commit -m "Prepare backend for Render deployment"
git push origin main
```

---

## Step 2 — Create PostgreSQL database on Render

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click **New +** → **PostgreSQL**
3. Name: `drop4life-db`
4. Plan: **Free**
5. Click **Create Database**
6. Copy the **Internal Database URL** (you will link it to the web service)

> **Important:** SQLite on Render free tier is wiped on every deploy. Always use PostgreSQL in production.

---

## Step 3 — Create Web Service

1. Click **New +** → **Web Service**
2. Connect your GitHub repo `drop4life`
3. Configure:

| Field | Value |
|-------|-------|
| **Name** | `drop4life-api` |
| **Region** | closest to your users |
| **Branch** | `main` |
| **Root Directory** | *(leave empty)* |
| **Runtime** | `Python 3` |
| **Build Command** | see below |
| **Start Command** | see below |

### Build Command

```bash
pip install -r requirements.txt && python manage.py collectstatic --noinput && python manage.py migrate --noinput
```

Or use the included script:

```bash
chmod +x build.sh && ./build.sh
```

**What it does:**
- Installs Python dependencies (`gunicorn`, `Django`, `psycopg2`, etc.)
- Collects static files into `staticfiles/` (served by WhiteNoise)
- Runs database migrations

### Start Command

```bash
gunicorn drop4life_backend.wsgi:application --bind 0.0.0.0:$PORT --workers 2 --threads 2 --timeout 120
```

**What it does:**
- Starts the production WSGI server
- `$PORT` is injected automatically by Render
- `--timeout 120` prevents slow requests from being killed on free tier cold starts

---

## Step 4 — Environment Variables

In **Environment** tab, add:

| Key | Value |
|-----|-------|
| `DJANGO_SECRET_KEY` | Generate a long random string (Render can auto-generate) |
| `DJANGO_DEBUG` | `false` |
| `CORS_ALLOW_ALL_ORIGINS` | `false` |
| `CORS_ALLOWED_ORIGINS` | `https://amrreda06.github.io` |
| `CSRF_TRUSTED_ORIGINS` | `https://YOUR-SERVICE.onrender.com,https://amrreda06.github.io` |
| `DATABASE_URL` | Paste from PostgreSQL dashboard (Internal URL) |
| `PYTHON_VERSION` | `3.12.3` |

`RENDER_EXTERNAL_HOSTNAME` and `ALLOWED_HOSTS` are handled automatically by `settings.py`.

Optional:

| Key | Value |
|-----|-------|
| `DROP4LIFE_SUPERADMIN_PASSWORD` | Custom superadmin password on first setup |

---

## Step 5 — Deploy

Click **Create Web Service** (or **Manual Deploy → Deploy latest commit**).

Wait until the build log shows **Build successful** and status is **Live**.

Your API URL will be:

```
https://drop4life-api.onrender.com
```

*(Replace with your actual service name.)*

---

## Step 6 — Initialize the system (first deploy only)

1. Open your service → **Shell**
2. Run:

```bash
python manage.py setup_system
```

Default login after setup:
- Username: `superadmin`
- Password: `a1234!` (or your `DROP4LIFE_SUPERADMIN_PASSWORD`)

---

## Step 7 — Verify the API works

Open in browser or use curl:

```bash
curl https://YOUR-SERVICE.onrender.com/api/test/
```

Expected response:

```json
{"message":"Hello from Django"}
```

Other endpoints (require login token):
- `POST /api/accounts/login/`
- `GET /api/bootstrap/`

---

## Step 8 — Connect the frontend

Update `frontend/.env.production`:

```
VITE_API_URL=https://YOUR-SERVICE.onrender.com/api
```

Then redeploy GitHub Pages:

```bash
cd frontend
npm run deploy
```

---

## One-click deploy (Blueprint)

This repo includes `render.yaml`. On Render:

1. **New +** → **Blueprint**
2. Select the repo
3. Render creates the web service + PostgreSQL automatically

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| **502 Bad Gateway** | Check Start Command uses `$PORT`; review Render logs |
| **DisallowedHost** | Ensure `.onrender.com` is in hosts or set `DJANGO_ALLOWED_HOSTS` |
| **CORS error from frontend** | Set `CORS_ALLOWED_ORIGINS=https://amrreda06.github.io` |
| **Database errors** | Link `DATABASE_URL` to PostgreSQL, not SQLite |
| **Static files 404** | Ensure `collectstatic` runs in Build Command |
| **Cold start slow** | Free tier sleeps after inactivity; first request may take ~30s |

---

## Files used for production

| File | Purpose |
|------|---------|
| `requirements.txt` | Python dependencies including `gunicorn` |
| `Procfile` | Start command for Render/Heroku |
| `build.sh` | Build script (install, collectstatic, migrate) |
| `render.yaml` | Render Blueprint (optional) |
| `runtime.txt` | Python version |
| `drop4life_backend/settings.py` | Production settings |
