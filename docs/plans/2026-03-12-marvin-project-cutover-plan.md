# Marvin Project Cutover Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Move the live Marvin deployment from the old Hetzner Cloud project into the project that owns `marvintext.com`, then remove all remaining resources from the old project.

**Architecture:** Reuse the repo's existing Hetzner bootstrap path to create a fresh server in the target project, validate the Docker Compose production stack on the new host, point `marvintext.com` at the new host, and only after verification delete the old server-side resources. This keeps the destructive step last and limits downtime to DNS propagation plus container bootstrap.

**Tech Stack:** Hetzner Cloud API, `hcloud` CLI, Python provisioning script, cloud-init, Docker Compose, Django, React/Vite, Nginx, SSH, DNS.

---

### Task 1: Inventory both Hetzner projects

**Files:**
- Modify: none
- Test: none

**Step 1: List target-project resources**

Run:

```bash
zsh -ic 'hcloud server list && hcloud primary-ip list && hcloud zone list && hcloud firewall list && hcloud ssh-key list'
```

**Step 2: List old-project resources**

Run:

```bash
HCLOUD_TOKEN='<old-project-token>' hcloud server list
HCLOUD_TOKEN='<old-project-token>' hcloud primary-ip list
HCLOUD_TOKEN='<old-project-token>' hcloud firewall list
HCLOUD_TOKEN='<old-project-token>' hcloud ssh-key list
```

**Step 3: Confirm cutover order**

Proceed only if the target project is empty enough to provision safely and the old project has no extra dependencies such as volumes or private networks.

### Task 2: Provision a fresh server in the `marvintext.com` project

**Files:**
- Modify: none
- Test: none

**Step 1: Run the repo provisioning script with the target-project token**

Run:

```bash
zsh -ic 'python3 infra/provision.py'
```

**Step 2: Record the new server IP**

Use the IP emitted by the script or `hcloud server list`.

**Step 3: Watch cloud-init until Docker services start**

Run:

```bash
ssh -i ~/.ssh/mive_deploy_key root@<new-ip> 'tail -n 200 /var/log/cloud-init-output.log'
ssh -i ~/.ssh/mive_deploy_key root@<new-ip> 'cd /opt/mive && docker compose -f docker-compose.prod.yml ps'
```

### Task 3: Reconfigure the fresh deployment for `marvintext.com`

**Files:**
- Modify: runtime files on the new server (`/opt/mive/.env`, `/opt/mive/nginx/nginx.conf`)
- Test: runtime HTTP checks

**Step 1: Replace IP-based runtime settings with domain-based settings**

Set:

```dotenv
DJANGO_ALLOWED_HOSTS=<new-ip>,marvintext.com,www.marvintext.com
CSRF_TRUSTED_ORIGINS=http://<new-ip>,http://marvintext.com,http://www.marvintext.com
VITE_API_BASE=http://marvintext.com
VITE_COLLAB_URL=ws://marvintext.com/ws
```

**Step 2: Add `www` to apex redirect in Nginx**

Serve the app on `marvintext.com` and redirect `www.marvintext.com` to the apex domain.

**Step 3: Rebuild affected services**

Run:

```bash
ssh -i ~/.ssh/mive_deploy_key root@<new-ip> 'cd /opt/mive && docker compose -f docker-compose.prod.yml up -d --build backend collab nginx'
```

### Task 4: Cut DNS over to the new server

**Files:**
- Modify: none
- Test: authoritative DNS + HTTP checks

**Step 1: Update the zone records in the target project**

Set `@` and `www` `A`/`AAAA` to the new server IPs with `hcloud zone set-records`.

**Step 2: Verify authoritative nameservers**

Run:

```bash
dig @ns1.your-server.de marvintext.com A +short
dig @ns1.your-server.de marvintext.com AAAA +short
```

**Step 3: Verify app responses against the new IP**

Run:

```bash
curl -i --resolve marvintext.com:80:<new-ipv4> http://marvintext.com/
curl -i --resolve marvintext.com:80:<new-ipv4> http://marvintext.com/api/auth/me/
curl -i --resolve www.marvintext.com:80:<new-ipv4> http://www.marvintext.com/
```

### Task 5: Remove the old-project resources

**Files:**
- Modify: none
- Test: old project inventory returns empty

**Step 1: Delete the old server**

Run:

```bash
HCLOUD_TOKEN='<old-project-token>' hcloud server delete mive-prod
```

**Step 2: Delete remaining detached resources if any remain**

Delete firewall and SSH key only after the server and attached primary IPs are gone.

**Step 3: Verify the old project is empty**

Run:

```bash
HCLOUD_TOKEN='<old-project-token>' hcloud server list
HCLOUD_TOKEN='<old-project-token>' hcloud primary-ip list
HCLOUD_TOKEN='<old-project-token>' hcloud firewall list
HCLOUD_TOKEN='<old-project-token>' hcloud ssh-key list
```
