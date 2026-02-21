#!/bin/sh
set -e

# Wait for database
python - <<'PY'
import os, time, psycopg

host = os.environ.get("DB_HOST", "db")
port = int(os.environ.get("DB_PORT", "5432"))
name = os.environ.get("DB_NAME", "app")
user = os.environ.get("DB_USER", "app")
password = os.environ.get("DB_PASSWORD", "app")

for i in range(30):
    try:
        conn = psycopg.connect(host=host, port=port, dbname=name, user=user, password=password)
        conn.close()
        break
    except Exception:
        time.sleep(1)
else:
    raise SystemExit("Database not ready")
PY

python manage.py migrate --noinput
python manage.py collectstatic --noinput

exec gunicorn server.wsgi:application \
    --bind 0.0.0.0:8000 \
    --workers 2 \
    --threads 2 \
    --timeout 300 \
    --access-logfile - \
    --error-logfile -
