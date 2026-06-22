# Deploy Drop4Life to PythonAnywhere

Simple step-by-step guide for beginners. No credit card required.

---

## Part A — Prepare on your computer

### Step 1: Install dependencies

```bash
cd drop4life
pip install -r requirements.txt
```

### Step 2: Build the React frontend

```bash
cd frontend
npm install
npm run build
cd ..
```

This copies the React build into `static/frontend/`.

### Step 3: Prepare Django

```bash
python manage.py migrate
python manage.py collectstatic --noinput
python manage.py setup_system
```

Default login after setup:
- **Username:** `superadmin`
- **Password:** `a1234!`

### Step 4: Test locally (optional)

```bash
set DJANGO_DEBUG=true
set DJANGO_ALLOWED_HOSTS=127.0.0.1,localhost
python manage.py runserver
```

Open `http://127.0.0.1:8000/` — you should see the login page.

---

## Part B — Upload to PythonAnywhere

### Step 5: Create a PythonAnywhere account

1. Go to [pythonanywhere.com](https://www.pythonanywhere.com)
2. Sign up for a **Beginner (free)** account
3. Choose username: `amrreda06` (your site will be `amrreda06.pythonanywhere.com`)

### Step 6: Upload your project

**Option 1 — Git (recommended):**

Open a **Bash console** on PythonAnywhere:

```bash
cd ~
git clone https://github.com/YOUR-USERNAME/drop4life.git
cd drop4life
```

**Option 2 — Manual upload:**

Upload the project folder to `/home/amrreda06/drop4life` using the **Files** tab.

> Do **not** upload `node_modules/` or `frontend/node_modules/`.

---

## Part C — Configure on PythonAnywhere

### Step 7: Create a virtual environment

In Bash console:

```bash
cd ~/drop4life
mkvirtualenv --python=/usr/bin/python3.10 drop4life-env
pip install -r requirements.txt
```

### Step 8: Build frontend on the server (if Node is available)

```bash
cd ~/drop4life/frontend
npm install
npm run build
cd ~/drop4life
```

If Node is not available, build on your PC and upload the `static/frontend/` folder.

### Step 9: Run Django setup commands

```bash
cd ~/drop4life
python manage.py migrate
python manage.py collectstatic --noinput
python manage.py setup_system
```

---

## Part D — Web app configuration

### Step 10: Configure WSGI file

Go to **Web** tab → click your WSGI configuration file link.

Replace the entire file with:

```python
import os
import sys

path = '/home/amrreda06/drop4life'
if path not in sys.path:
    sys.path.insert(0, path)

os.environ['DJANGO_DEBUG'] = 'false'
os.environ['DJANGO_ALLOWED_HOSTS'] = 'amrreda06.pythonanywhere.com'
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'drop4life_backend.settings')

from django.core.wsgi import get_wsgi_application
application = get_wsgi_application()
```

> Replace `amrreda06` with your PythonAnywhere username if different.

### Step 11: Set virtualenv on Web tab

- **Virtualenv:** `/home/amrreda06/.virtualenvs/drop4life-env`

### Step 12: Configure static files

On the **Web** tab, under **Static files**, add:

| URL | Directory |
|-----|-----------|
| `/static/` | `/home/amrreda06/drop4life/staticfiles/` |

### Step 13: Reload the web app

Click the green **Reload** button on the Web tab.

---

## Part E — Verify it works

### Test the site

Open: **https://amrreda06.pythonanywhere.com**

You should see the Drop4Life login page.

### Test the API

Open: **https://amrreda06.pythonanywhere.com/api/test/**

Expected response:

```json
{"message": "Hello from Django"}
```

### Login

- Username: `superadmin`
- Password: `a1234!`

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| **502 / Error loading app** | Check WSGI file path and virtualenv |
| **DisallowedHost** | Ensure `DJANGO_ALLOWED_HOSTS=amrreda06.pythonanywhere.com` in WSGI |
| **Static files missing (no CSS/JS)** | Run `collectstatic` and check Static files mapping |
| **Login fails** | Run `python manage.py setup_system` in Bash |
| **Charts not showing** | Run `cd frontend && npm install && npm run build` to copy Chart.js locally |

---

## Commands summary (copy-paste)

```bash
# On PythonAnywhere Bash console
cd ~/drop4life
workon drop4life-env
pip install -r requirements.txt
cd frontend && npm install && npm run build && cd ..
python manage.py migrate
python manage.py collectstatic --noinput
python manage.py setup_system
```

Then **Reload** the web app from the Web tab.

---

## Production settings (already configured)

| Setting | Value |
|---------|-------|
| `DEBUG` | `False` |
| `ALLOWED_HOSTS` | `amrreda06.pythonanywhere.com` |
| `DATABASE` | SQLite (`db.sqlite3`) |
| `STATIC_ROOT` | `staticfiles/` |
| External CDNs | Removed |

The project handles ~500 records comfortably with SQLite for a graduation demo.
