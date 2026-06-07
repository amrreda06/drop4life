# Drop4Life — Smart Blood Bank System

Full-stack blood bank management system.

- **Backend:** Django REST Framework (deploy to Render)
- **Frontend:** React + Vite shell with legacy Drop4Life UI (deploy to GitHub Pages)

## Local development

### Backend

```bash
pip install -r requirements.txt
python manage.py migrate
python manage.py setup_system
python manage.py runserver
```

Open `http://127.0.0.1:8000/` for the Django-served UI, or run the React dev server below.

Default login: `superadmin` / `a1234!`

### Frontend (React dev server)

```bash
cd frontend
npm install
npm run dev
```

Set `frontend/.env.development`:

```
VITE_API_URL=http://127.0.0.1:8000/api
```

## Production deployment

See deployment commands at the end of this file after first-time setup.

## Environment variables (Render)

| Variable | Example |
|----------|---------|
| `DJANGO_SECRET_KEY` | long random string |
| `DJANGO_DEBUG` | `false` |
| `DJANGO_ALLOWED_HOSTS` | `drop4life-api.onrender.com` |
| `CORS_ALLOWED_ORIGINS` | `https://amrreda06.github.io` |
| `CSRF_TRUSTED_ORIGINS` | `https://drop4life-api.onrender.com,https://amrreda06.github.io` |
| `DATABASE_URL` | auto from Render PostgreSQL |

## Project structure

```
drop4life/
├── api/                 # Django app
├── drop4life_backend/   # Django project settings
├── frontend/            # React + GitHub Pages build
├── static/              # Static assets (Django)
├── drop4life.html       # Main UI template
├── Procfile             # Render start command
├── render.yaml          # Render blueprint
└── requirements.txt
```

## Deploy frontend → GitHub Pages

```bash
cd frontend
# Edit .env.production — set VITE_API_URL to your Render API URL
npm install
npm run deploy
```

Then in GitHub repo **Settings → Pages → Source**: branch `gh-pages`, folder `/ (root)`.

Site URL: https://amrreda06.github.io/drop4life

## Deploy backend → Render

1. Push this repo to GitHub (`amrreda06/drop4life`).
2. On [Render](https://render.com): **New → Web Service** → connect repo.
3. Settings:
   - **Build command:** `./build.sh` or `pip install -r requirements.txt && python manage.py collectstatic --noinput && python manage.py migrate`
   - **Start command:** `gunicorn drop4life_backend.wsgi:application --bind 0.0.0.0:$PORT`
4. Add environment variables from `.env.example`.
5. Add a PostgreSQL database on Render and link `DATABASE_URL`.
6. After deploy, copy the Render URL into `frontend/.env.production` as `VITE_API_URL=https://YOUR-APP.onrender.com/api` and redeploy frontend.

## Post-deploy checklist

- [ ] Update `VITE_API_URL` in `frontend/.env.production`
- [ ] Set `CORS_ALLOWED_ORIGINS` on Render to `https://amrreda06.github.io`
- [ ] Run `python manage.py setup_system` on Render shell (first time)
- [ ] Clear browser cache / use incognito when testing GitHub Pages
