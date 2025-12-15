<h1 align="center">WoL Redirect</h1>

<p align="center">
🖥️ On-demand service wake-up · Web UI · ⚙️ flexible and configurable · Multi-Environment
</p>

<div align="center">
  <a href="https://github.com/codeshelldev/wol-redirect/releases">
    <img 
        src="https://img.shields.io/github/v/release/codeshelldev/wol-redirect?sort=semver&logo=github&label=Release" 
        alt="GitHub release"
    >
  </a>
  <a href="https://github.com/codeshelldev/wol-redirect/stargazers">
    <img 
        src="https://img.shields.io/github/stars/codeshelldev/wol-redirect?style=flat&logo=github&label=Stars" 
        alt="GitHub stars"
    >
  </a>
    <a href="https://github.com/codeshelldev/wol-redirect/pkgs/container/wol-redirect">
    <img 
        src="https://ghcr-badge.egpl.dev/codeshelldev/wol-redirect/size?color=%2344cc11&tag=latest&label=Image+Size&trim="
        alt="Docker image size"
    >
  </a>
  <a href="https://github.com/codeshelldev/wol-redirect/pkgs/container/wol-redirect">
    <img 
        src="https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fghcr-badge.elias.eu.org%2Fapi%2Fcodeshelldev%2Fwol-dockerized%2Fwol-dockerized&query=downloadCount&label=Downloads&color=2344cc11"
        alt="Docker image Pulls"
    >
  </a>
  <a href="./LICENSE">
    <img 
        src="https://img.shields.io/badge/License-MIT-green.svg"
        alt="License: MIT"
    >
  </a>
</div>

---

## Installation

Download the latest `docker-compose.yaml`:

```yaml
services:
  wol:
    container_name: wol-client
    image: ghcr.io/codeshelldev/wol-client:latest
    restart: unless-stopped
    security_opt:
      - label=disable
    networks:
      network:
        aliases:
          - wol-client

  wolred:
    container_name: wol-redirect
    image: ghcr.io/codeshelldev/wol-redirect:latest
    networks:
      - network
    ports:
      - "80:80"
    volumes:
      - ./config:/app/config:ro
    depends_on:
      - wol
    restart: unless-stopped

networks:
  network:
```

Start the container:

```bash
docker compose up -d
```

## Reverse Proxy

The following example uses **Traefik** as a reverse proxy:

```yaml
services:
  wolred:
    container_name: wol-redirect
    image: ghcr.io/codeshelldev/wol-redirect:latest
    networks:
      - network
      - proxy
    labels:
      - traefik.enable=true
      - traefik.http.routers.wolred-https.rule=Host(`wol-redirect.mydomain.com`)
      - traefik.http.routers.wolred-https.priority=10
      - traefik.http.routers.wolred-https.entrypoints=websecure
      - traefik.http.routers.wolred-https.tls=true
      - traefik.http.routers.wolred-https.tls.certresolver=cloudflare
      - traefik.http.routers.wolred-https.service=wolred-svc

      - traefik.http.services.wolred-svc.loadbalancer.server.port=6789
      - traefik.docker.network=proxy
    volumes:
      - ./config:/app/config:ro
    depends_on:
      - wol
    restart: unless-stopped

networks:
  network:
  proxy:
    external: true
```

Example service configuration using **Jellyfin**:

```yaml
file not found: /home/runner/work/wol-redirect/wol-redirect/examples/jellyfin.yaml
```

## Configuration

Basic service-to-host mappings:

```json
{
	"hosts": {
		"server-1": {
			"ip": "192.168.1.1",
			"mac": "XX:XX:XX:XX:XX:XX",
			"startupTime": 60
		}
	},
	"routes": {
		"server-1": {
			"route": ["server-1"]
		}
	},
	"records": {
		"*.mydomain.com": "server-1"
	}
}
```

Environment variables:

```dotenv
CLIENT_ID=CLIENT_ID
CLIENT_SECRET=CLIENT_SECRET

# Authentik setup
AUTH_URL=https://authentication.mydomain.com/application/o/authorize/
TOKEN_URL=https://authentication.mydomain.com/application/o/token/
REDIRECT_URL=https://wol-redirect.mydomain.com/auth/callback/
RESOURCE_URL=https://authentication.mydomain.com/application/o/userinfo/
LOGOUT_URL=https://authentication.mydomain.com/application/o/wol-red/end-session/

SESSION_KEY=MY_SESSION_KEY # generate this with openssl
SCOPE=openid
```

## Advanced Setups

WoL Redirect supports two main scenarios depending on how your services are hosted.

## Virtualized Hosts (VMs, LXCs, Hypervisors)

If your services run inside virtual machines or containers managed by a hypervisor (for example Proxmox VE, ..., or similar platforms), you may want to wake up the physical host **and** start specific VMs or LXCs.

Since VMs and LXCs do not support Wake-on-LAN directly, an external helper is required.

This setup requires an additional helper to be installed on the hypervisor: [**WoL VE**](https://github.com/codeshelldev/wol-ve)

Example mapping configuration:

```json
{
	"hosts": {
		"hypervisor": {
			"ip": "192.168.1.1",
			"mac": "XX:XX:XX:XX:XX:XX",
			"startupTime": 40
		},
		"lxc": {
			"ip": "192.168.1.1",
			"id": "100",
			"startupTime": 10
		},
		"vm": {
			"ip": "192.168.1.1",
			"id": "200",
			"startupTime": 10
		}
	},
	"routes": {
		"hypervisor-lxc": {
			"route": ["hypervisor", "lxc"]
		}
	},
	"records": {
		"*.mydomain.com": "hypervisor-lxc"
	}
}
```

This approach is applicable to:

- Proxmox VE
- Other hypervisors with API-controlled VM/container startup
- Mixed virtualization environments

## Docker Hosts (Non-Virtualized)

If Docker is running directly on a physical server, you may want to:

- Wake up the server only when needed
- Start specific Docker containers on demand

For this use case, use [**WoL Dockerized**](https://github.com/codeshelldev/wol-dockerized).

Example mapping configuration:

```json
{
	"hosts": {
		"docker-server": {
			"ip": "192.168.5.10",
			"docker": true
		}
	},
	"routes": {
		"docker": {
			"route": ["docker-server"]
		}
	},
	"records": {
		"jellyfin.mydomain.com": "docker",
		"*.mydomain.com": "docker"
	}
}
```

## Combined Setup (Virtualization + Docker)

If your environment uses both virtualization and Docker (for example Docker running inside VMs, or mixed workloads), you can combine both approaches.

Example mapping configuration:

```json
file not found: /home/runner/work/wol-redirect/wol-redirect/examples/config/virtual-docker.mapping.json
```

This setup requires:

- [WoL VE](https://github.com/codeshelldev/wol-ve)
- [WoL Dockerized](https://github.com/codeshelldev/wol-dockerized)

## Usage

Configure your reverse proxy to forward requests from a service domain (e.g. `https://jellyfin.mydomain.com`) to `https://wol-red.mydomain.com`.

WoL Redirect inspects the incoming request, matches it against the configuration, and:

1. Wakes up the target host if necessary
2. Starts the required VM, container, or service
3. Redirects traffic once the service is available

## Contributing

Have feedback, ideas, or found a bug? Open an issue or submit a pull request.

## Supporting

If you find this project useful, consider starring ⭐️ the repository to help others discover it.

## License

This project is licensed under the [MIT License](./LICENSE)
