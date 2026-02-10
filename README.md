# Experiments – AI Markdown Writer

Web-based Markdown writing studio with project trees, versioning, file-level comments, and configurable AI agents per project/folder/file. Backend: Django + DRF. Frontend: React + Vite + Milkdown.

## Local dev (Docker)

1. Generate an encryption key for BYOK storage:

```bash
python - <<'PY'
from cryptography.fernet import Fernet
print(Fernet.generate_key().decode())
PY
```

2. Export the key and start the stack:

```bash
export ENCRYPTION_KEY="<paste-key>"
docker compose up --build
```

- API: http://localhost:8000
- Web: http://localhost:5173

## Notes

- `ENCRYPTION_KEY` is required for storing provider API keys.
- Projects, files, and comments are stored in Postgres.
- Version snapshots are created each time a file is saved.

## Folder structure

- `backend/` Django API
- `frontend/` React + Vite UI
