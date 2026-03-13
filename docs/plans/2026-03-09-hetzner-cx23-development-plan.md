# Hetzner CX23 Development Deploy Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Provision a cheap disposable Hetzner Cloud environment for the remote `development` branch on a single `cx23` server and verify that the stack boots correctly over public IP + HTTP.

**Architecture:** Keep the existing single-node Docker Compose production stack, but simplify provisioning for this experiment: default to `cx23`, use the `development` deploy ref, generate all internal secrets automatically, and avoid SSH-based Git bootstrap if HTTPS clone is sufficient. Treat the server as ephemeral and validate by smoke testing the frontend, API, and collaboration websocket after cloud-init completes.

**Tech Stack:** Python 3.11, Hetzner Cloud API (`hcloud`), cloud-init, Docker Compose, Django, PostgreSQL 16, Node.js websocket server, Nginx, `unittest`, `curl`, `ssh`.

---

### Task 1: Switch the provisioning defaults to the cheap experimental target

**Files:**
- Modify: `infra/provision.py`
- Test: `infra/tests/test_provision.py`

**Step 1: Write the failing test**

Add a test asserting the experimental defaults:

```python
def test_defaults_target_cx23_and_development_ref(self):
    module = load_provision_module()

    self.assertEqual(module.SERVER_TYPE, "cx23")
    self.assertEqual(module.DEPLOY_REF, "development")
```

**Step 2: Run test to verify it fails**

Run: `python -m unittest infra.tests.test_provision -v`
Expected: FAIL because the script still defaults to a larger server shape and/or empty deploy ref.

**Step 3: Write minimal implementation**

In `infra/provision.py`, set:

```python
SERVER_TYPE = "cx23"
DEPLOY_REF = os.environ.get("DEPLOY_REF", "development")
```

Keep `LOCATION_NAME = "nbg1"` unchanged.

**Step 4: Run test to verify it passes**

Run: `python -m unittest infra.tests.test_provision -v`
Expected: PASS

**Step 5: Commit**

```bash
git add infra/provision.py infra/tests/test_provision.py
git commit -m "feat: default hetzner deploy to cx23 development"
```

---

### Task 2: Remove the SSH deploy-key requirement for the first test deploy

**Files:**
- Modify: `infra/provision.py`
- Test: `infra/tests/test_provision.py`

**Step 1: Write the failing test**

Add a test that checks the generated cloud-init clones via HTTPS and does not require `/root/.ssh/deploy_key`:

```python
def test_cloud_init_uses_https_clone_for_repo_bootstrap(self):
    module = load_provision_module()
    module.GITHUB_REPO = "https://github.com/EugedeTomaso/experiments.git"

    cloud_init = module.build_cloud_init(
        "private-key",
        {
            "django_secret": "django-secret",
            "encryption_key": "encryption-key",
            "db_password": "db-password",
            "internal_api_key": "internal-api-key",
        },
    )

    self.assertIn("git clone https://github.com/EugedeTomaso/experiments.git /opt/mive", cloud_init)
    self.assertNotIn("/root/.ssh/deploy_key", cloud_init)
```

**Step 2: Run test to verify it fails**

Run: `python -m unittest infra.tests.test_provision -v`
Expected: FAIL because the bootstrap still writes an SSH key and uses `git@github.com:...`.

**Step 3: Write minimal implementation**

In `infra/provision.py`:

- switch `GITHUB_REPO` to the HTTPS URL
- remove SSH key generation/upload from the bootstrap path used for this disposable deploy
- remove `ssh-keyscan github.com` and `GIT_SSH_COMMAND=...` from the clone/check-out commands

Target shell commands in cloud-init:

```sh
git clone https://github.com/EugedeTomaso/experiments.git /opt/mive
git -C /opt/mive fetch --all --tags
git -C /opt/mive checkout development
```

**Step 4: Run test to verify it passes**

Run: `python -m unittest infra.tests.test_provision -v`
Expected: PASS

**Step 5: Commit**

```bash
git add infra/provision.py infra/tests/test_provision.py
git commit -m "feat: simplify hetzner bootstrap to use https clone"
```

---

### Task 3: Make the provisioning output explicit for disposable test environments

**Files:**
- Modify: `infra/provision.py`
- Test: `infra/tests/test_provision.py`

**Step 1: Write the failing test**

Add a test for the output env values generated from server IP:

```python
def test_cloud_init_writes_ip_based_runtime_env(self):
    module = load_provision_module()

    cloud_init = module.build_cloud_init(
        "private-key",
        {
            "django_secret": "django-secret",
            "encryption_key": "encryption-key",
            "db_password": "db-password",
            "internal_api_key": "internal-api-key",
        },
    )

    self.assertIn("DJANGO_ALLOWED_HOSTS=$SERVER_IP", cloud_init)
    self.assertIn("CSRF_TRUSTED_ORIGINS=http://$SERVER_IP", cloud_init)
    self.assertIn("VITE_API_BASE=http://$SERVER_IP", cloud_init)
    self.assertIn("VITE_COLLAB_URL=ws://$SERVER_IP/ws", cloud_init)
```

**Step 2: Run test to verify it fails**

Run: `python -m unittest infra.tests.test_provision -v`
Expected: FAIL if any env output diverges during the refactor.

**Step 3: Write minimal implementation**

Keep the IP-based `.env` generation explicit inside `build_cloud_init()` and make sure the env block still writes:

```sh
DJANGO_ALLOWED_HOSTS=$SERVER_IP
CSRF_TRUSTED_ORIGINS=http://$SERVER_IP
VITE_API_BASE=http://$SERVER_IP
VITE_COLLAB_URL=ws://$SERVER_IP/ws
```

**Step 4: Run test to verify it passes**

Run: `python -m unittest infra.tests.test_provision -v`
Expected: PASS

**Step 5: Commit**

```bash
git add infra/provision.py infra/tests/test_provision.py
git commit -m "test: lock ip-based env output for disposable deploy"
```

---

### Task 4: Provision the Hetzner Cloud server in the Marvin project

**Files:**
- Modify: none
- Test: none

**Step 1: Install the missing provisioning dependency**

Run:

```bash
python -m pip install hcloud
```

Expected: `hcloud` installs successfully into the current Python environment.

**Step 2: Run the provisioning script with the project-scoped token**

Run:

```bash
HCLOUD_TOKEN='<token>' python infra/provision.py
```

Expected:
- a new `cx23` server is created in the Hetzner Cloud project tied to the token
- the script prints the public server IP
- the script reports the SSH command to access the server

**Step 3: Record the resulting server IP for verification**

Capture the IP emitted by the script. If the script reports that the server already exists, use that IP.

**Step 4: Commit**

No commit. This is an operational step.

---

### Task 5: Verify cloud-init and container startup on the new VM

**Files:**
- Modify: none
- Test: none

**Step 1: Stream the bootstrap log**

Run:

```bash
ssh root@<server-ip> 'tail -n 200 /var/log/cloud-init-output.log'
```

Expected:
- Docker packages install cleanly
- repo clone succeeds
- `.env` file is written
- `docker compose -f docker-compose.prod.yml up -d --build` completes

**Step 2: Check container status**

Run:

```bash
ssh root@<server-ip> 'cd /opt/mive && docker compose -f docker-compose.prod.yml ps'
```

Expected: `db`, `backend`, `collab`, and `nginx` all show `Up` or healthy-equivalent running state.

**Step 3: Inspect logs if anything is unhealthy**

Run:

```bash
ssh root@<server-ip> 'cd /opt/mive && docker compose -f docker-compose.prod.yml logs --tail=150'
```

Expected: enough output to diagnose any startup failure before deciding whether to patch or recreate the VM.

**Step 4: Commit**

No commit. This is an operational step.

---

### Task 6: Smoke-test the live deployment over the public IP

**Files:**
- Modify: none
- Test: none

**Step 1: Check the frontend entrypoint**

Run:

```bash
curl -I http://<server-ip>/
```

Expected: `HTTP/1.1 200 OK`

**Step 2: Check the API through Nginx**

Run:

```bash
curl -i http://<server-ip>/api/
```

Expected: an HTTP response from Django through Nginx. `401`, `403`, or `404` are acceptable for this smoke test as long as the request reaches the app.

**Step 3: Check the collaboration service health endpoint from inside the VM**

Run:

```bash
ssh root@<server-ip> 'curl -i http://127.0.0.1:4444/health'
```

Expected: `200 OK` with body `ok`

**Step 4: Document the test outcome**

Record:
- server IP
- whether login page loads
- whether API answers
- whether websocket backend is healthy
- whether `cx23` feels viable or clearly underpowered

**Step 5: Commit**

No commit. This is an operational step.

---

### Task 7: Decide whether to keep or resize the server

**Files:**
- Modify: none
- Test: none

**Step 1: Evaluate the smoke-test result**

Use the outputs from Task 6 to decide whether:

- `cx23` is good enough for continued manual testing, or
- the server should be destroyed and recreated with a larger type

**Step 2: If the server is not good enough, destroy and recreate cleanly**

Run the equivalent Hetzner deletion flow and rerun Task 4 after adjusting `SERVER_TYPE`.

Expected: no in-place mutation of a broken disposable VM; prefer clean recreation.

**Step 3: Commit**

No commit. This is an operational step.
