# Drop4Life — Smart Blood Bank (Graduation Project)

Django backend + React frontend. Designed for **PythonAnywhere** (free, no credit card).

- **Database:** SQLite
- **No external services** (no Render, no PostgreSQL, no paid APIs)
- **Offline-friendly:** no CDN fonts or images; Chart.js bundled locally

---

## Local development

### 1. Backend

```bash
pip install -r requirements.txt
set DJANGO_DEBUG=true
set DJANGO_ALLOWED_HOSTS=127.0.0.1,localhost
python manage.py migrate
python manage.py setup_system
python manage.py runserver
```

### 2. Frontend (optional — main UI is served by Django at `/`)

```bash
cd frontend
npm install
npm run build
cd ..
python manage.py collectstatic --noinput
```

Open: `http://127.0.0.1:8000/`

Login: `superadmin` / `a1234!`

---

## Deploy to PythonAnywhere

See **[DEPLOY_PYTHONANYWHERE.md](DEPLOY_PYTHONANYWHERE.md)** for full step-by-step instructions.

Quick summary:

1. Upload project to `/home/amrreda06/drop4life`
2. Create virtualenv + `pip install -r requirements.txt`
3. `cd frontend && npm install && npm run build`
4. `python manage.py migrate && python manage.py collectstatic && python manage.py setup_system`
5. Configure WSGI + static files mapping in PythonAnywhere Web tab

Live URL: **https://amrreda06.pythonanywhere.com**

---

## Project structure

```
drop4life/
├── api/                    # Django REST API
├── drop4life_backend/      # Settings & URLs
├── frontend/               # React (build → static/frontend/)
├── static/                 # JS, CSS, React build output
├── drop4life.html          # Main UI (served at /)
├── db.sqlite3              # SQLite database
└── requirements.txt
```
