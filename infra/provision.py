#!/usr/bin/env python3
"""Provision a Hetzner Cloud server for Mive production deployment."""

import os
import secrets
import subprocess
import sys
import textwrap
from pathlib import Path

try:
    from cryptography.fernet import Fernet
    from hcloud import Client
    from hcloud.firewalls.domain import FirewallRule
    from hcloud.images import Image
    from hcloud.locations import Location
    from hcloud.server_types import ServerType
except ImportError:
    sys.exit("Install dependencies first: pip install hcloud cryptography")

# --- Config ---
SERVER_NAME = "mive-prod"
SSH_KEY_NAME = "mive-deploy"
FIREWALL_NAME = "mive-firewall"
SERVER_TYPE = "cx22"  # 2 vCPU, 4GB RAM, 40GB SSD
IMAGE_NAME = "ubuntu-24.04"
LOCATION_NAME = "nbg1"  # Nuremberg
GITHUB_REPO = "git@github.com:EugedeTomaso/experiments.git"
DEPLOY_DIR = "/opt/mive"
SSH_KEY_PATH = Path.home() / ".ssh" / "mive_deploy_key"


def generate_ssh_key():
    """Generate an ED25519 SSH key pair if it doesn't exist."""
    if SSH_KEY_PATH.exists():
        print(f"SSH key already exists at {SSH_KEY_PATH}")
    else:
        print("Generating SSH key pair...")
        subprocess.run(
            ["ssh-keygen", "-t", "ed25519", "-f", str(SSH_KEY_PATH),
             "-N", "", "-C", "mive-deploy"],
            check=True,
        )
    public_key = SSH_KEY_PATH.with_suffix(".pub").read_text().strip()
    private_key = SSH_KEY_PATH.read_text()
    return public_key, private_key


def find_or_create_ssh_key(client, name, public_key):
    """Upload SSH key to Hetzner (idempotent)."""
    existing = client.ssh_keys.get_by_name(name)
    if existing:
        print(f"SSH key '{name}' already exists on Hetzner")
        return existing
    print(f"Creating SSH key '{name}' on Hetzner...")
    return client.ssh_keys.create(name=name, public_key=public_key)


def find_or_create_firewall(client, name):
    """Create firewall with ports 22, 80, 443 (idempotent)."""
    existing = client.firewalls.get_by_name(name)
    if existing:
        print(f"Firewall '{name}' already exists")
        return existing
    print(f"Creating firewall '{name}'...")
    rules = [
        FirewallRule(
            direction="in", protocol="tcp", port=str(port),
            source_ips=["0.0.0.0/0", "::/0"],
        )
        for port in [22, 80, 443]
    ]
    response = client.firewalls.create(name=name, rules=rules)
    return response.firewall


def generate_secrets():
    """Generate all production secrets."""
    return {
        "django_secret": secrets.token_urlsafe(50),
        "encryption_key": Fernet.generate_key().decode(),
        "db_password": secrets.token_urlsafe(32),
        "internal_api_key": secrets.token_urlsafe(32),
    }


def build_cloud_init(private_key, sec):
    """Build cloud-init user_data for server bootstrap."""
    # Indent private key for YAML block scalar
    pk_indented = textwrap.indent(private_key.strip(), "      ")

    return f"""#cloud-config
package_update: true
packages:
  - ca-certificates
  - curl
  - git

write_files:
  - path: /root/.ssh/deploy_key
    permissions: '0600'
    content: |
{pk_indented}

runcmd:
  # Install Docker CE
  - install -m 0755 -d /etc/apt/keyrings
  - curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  - chmod a+r /etc/apt/keyrings/docker.asc
  - echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" > /etc/apt/sources.list.d/docker.list
  - apt-get update
  - apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

  # GitHub SSH setup
  - ssh-keyscan github.com >> /root/.ssh/known_hosts

  # Clone repo with retry (gives user time to add deploy key)
  - |
    for i in $(seq 1 30); do
      GIT_SSH_COMMAND="ssh -i /root/.ssh/deploy_key -o StrictHostKeyChecking=no" \\
        git clone {GITHUB_REPO} {DEPLOY_DIR} && break
      echo "Clone attempt $i/30 failed, retrying in 10s..."
      sleep 10
    done

  # Write production .env
  - |
    SERVER_IP=$(curl -s http://169.254.169.254/hetzner/v1/metadata/public-ipv4)
    cat > {DEPLOY_DIR}/.env << ENVEOF
    DJANGO_SECRET_KEY={sec["django_secret"]}
    ENCRYPTION_KEY={sec["encryption_key"]}
    DB_NAME=mive
    DB_USER=mive
    DB_PASSWORD={sec["db_password"]}
    DB_HOST=db
    DB_PORT=5432
    DJANGO_DEBUG=0
    DJANGO_ALLOWED_HOSTS=$SERVER_IP
    CSRF_TRUSTED_ORIGINS=http://$SERVER_IP
    INTERNAL_API_KEY={sec["internal_api_key"]}
    JWT_SECRET={sec["django_secret"]}
    VITE_API_BASE=http://$SERVER_IP
    VITE_COLLAB_URL=ws://$SERVER_IP/ws
    ENVEOF

  # Start production stack
  - cd {DEPLOY_DIR} && docker compose -f docker-compose.prod.yml up -d --build
"""


def main():
    token = os.environ.get("HCLOUD_TOKEN")
    if not token:
        sys.exit("Set HCLOUD_TOKEN environment variable")

    client = Client(token=token)

    # 1. SSH key
    public_key, private_key = generate_ssh_key()
    ssh_key = find_or_create_ssh_key(client, SSH_KEY_NAME, public_key)

    # 2. Firewall
    firewall = find_or_create_firewall(client, FIREWALL_NAME)

    # 3. Secrets
    sec = generate_secrets()

    # 4. Check if server already exists
    existing = client.servers.get_by_name(SERVER_NAME)
    if existing:
        print(f"\nServer '{SERVER_NAME}' already exists!")
        print(f"  IP: {existing.public_net.ipv4.ip}")
        print(f"  SSH: ssh -i {SSH_KEY_PATH} root@{existing.public_net.ipv4.ip}")
        print(f"  App: http://{existing.public_net.ipv4.ip}")
        return

    # 5. Create server
    user_data = build_cloud_init(private_key, sec)
    print(f"Creating server '{SERVER_NAME}' ({SERVER_TYPE} in {LOCATION_NAME})...")
    response = client.servers.create(
        name=SERVER_NAME,
        server_type=ServerType(name=SERVER_TYPE),
        image=Image(name=IMAGE_NAME),
        location=Location(name=LOCATION_NAME),
        ssh_keys=[ssh_key],
        firewalls=[firewall],
        user_data=user_data,
    )
    server = response.server
    ip = server.public_net.ipv4.ip

    # 6. Print results
    print("\n" + "=" * 60)
    print("SERVER CREATED")
    print("=" * 60)
    print(f"  IP:  {ip}")
    print(f"  SSH: ssh -i {SSH_KEY_PATH} root@{ip}")
    print(f"  App: http://{ip}")
    print()
    print("NEXT STEP — Add this deploy key to GitHub:")
    print(f"  URL: https://github.com/EugedeTomaso/experiments/settings/keys")
    print(f"  Key: {public_key}")
    print()
    print("The server will retry cloning for ~5 minutes while you add the key.")
    print("Monitor progress: ssh root@{ip} 'tail -f /var/log/cloud-init-output.log'")
    print("=" * 60)


if __name__ == "__main__":
    main()
