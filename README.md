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
        src="https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fghcr-badge.elias.eu.org%2Fapi%2Fcodeshelldev%2Fwol-redirect%2Fwol-redirect&query=downloadCount&label=Downloads&color=2344cc11"
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
      - "6789:6789"
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
		"server": {
			"ip": "192.168.1.1",
			"mac": "XX:XX:XX:XX:XX:XX",
			"startupTime": 60
		}
	},
	"routes": {
		"server-only": {
			"route": ["server"]
		}
	},
	"records": {
		"*.mydomain.com": "server-only"
	}
}
```

Environment variables:

```dotenv
############################
# Core Application Settings
############################

# Public URL where WoL Redirect is accessible
# Used for absolute redirects, links, and OAuth flows
# Example: https://wol-red.mydomain.com
APP_URL=

# Base path the application is served from
# Leave empty or "/" if served from the root
# Example: /wol or /apps/wol
BASE_PATH=/

# Path to the service mapping configuration file
CONFIG_PATH=/app/config/mapping.json

# Port WoL Redirect listens on
PORT=6789

# Log level: trace | debug | info | warn | error | fatal
LOG_LEVEL=info

# Expose logs via the UI or HTTP endpoint
EXPOSE_LOGS=true


############################
# Session & Security
############################

# Secret key used to sign sessions (REQUIRED)
# Generate a long random string
SESSION_KEY=change-me-to-a-random-secret


############################
# Redis Configuration
############################

# Redis hostname or service name
REDIS_HOST=redis

# Redis port
REDIS_PORT=6379

# Redis username (usually "default")
REDIS_USER=default

# Redis password (use long secure password)
REDIS_PASSWORD=


############################
# Wake-on-LAN / Helper Services
############################

# Default query pattern used to match WoL services
WOLD_QUERY_PATTERN=

# Base URL of default your WoL Client helper
# Example: http://wol-client:5555/wake
WOL_URL=

# Default port used by WoL Dockerized helper
WOLD_PORT=7777

# Default port used by virtualization helper (VMs / LXCs / hypervisors)
VIRTUAL_PORT=9999


############################
# OAuth Configuration
############################

# Enable or disable OAuth authentication
USE_OAUTH=true

# OAuth authorization endpoint
AUTHORIZATION_URL=

# OAuth resource / userinfo endpoint
RESOURCE_URL=

# OAuth logout endpoint
LOGOUT_URL=

# OAuth token endpoint
TOKEN_URL=

# Redirect URL registered with your OAuth provider
# Example: https://wol-red.mydomain.com/auth/callback
REDIRECT_URL=

# OAuth client credentials
CLIENT_ID=
CLIENT_SECRET=

# OAuth scopes
SCOPE=openid profile
```

## Hosts Configuration

The `hosts` section defines all machines, VMs, containers, or Docker services that WoL Redirect can wake up. Each host entry may have several optional or required fields depending on its type.

| Field          | Type    | Required                 | Description                                                                                             |
| -------------- | ------- | ------------------------ | ------------------------------------------------------------------------------------------------------- |
| `ip`           | string  | Yes                      | The IP address of the host. Used for all types; typically used for ping checks and default connections. |
| `mac`          | string  | Required for PHYSICAL    | MAC address for Wake-on-LAN. Only needed for physical hosts.                                            |
| `addr`         | string  | Optional, PHYSICAL only  | The network address used to send WoL packets, if different from `ip`.                                   |
| `id`           | string  | Required for VIRTUAL     | Identifier for virtual machines or LXCs.                                                                |
| `virtIP`       | string  | Optional                 | IP of the VM/LXC, used for pings. Defaults to `ip`.                                                     |
| `startupTime`  | number  | Optional                 | Seconds to wait after starting before pinging IP.                                                       |
| `url`          | string  | Optional                 | Override the default helper URL for this host.                                                          |
| `docker: true` | boolean | Optional                 | Can be set to `true` to mark a host as DOCKER type without additional settings.                         |
| `docker`       | object  | Required for DOCKER type | Docker-specific settings. See below.                                                                    |

### Docker Sub-Object (`docker`)

| Field          | Type   | Required | Description                                                                                |
| -------------- | ------ | -------- | ------------------------------------------------------------------------------------------ |
| `query`        | string | Optional | Raw query used for WoL Dockerized. Skips building query with `queryPattern`.               |
| `queryPattern` | string | Optional | Template used to build the query for WoL Dockerized. Falls back to `ENV.woldQueryPattern`. |
| `url`          | string | Optional | Override URL for Docker wake API. Defaults to `http://${host.ip}:${ENV.woldPort}/wake`.    |

### Host Type Inference

- **PHYSICAL** → has `mac` and `ip`
- **VIRTUAL** → has `id`
- **DOCKER** → has `docker` object or `docker: true`

## Advanced Setups

WoL Redirect supports two main scenarios depending on how your services are hosted.

## Virtualized Hosts (VMs, LXCs)

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
		"vm": {
			"ip": "192.168.1.1",
			"id": "200",
			"virtIP": "192.168.1.20",
			"startupTime": 15
		}
	},
	"routes": {
		"hypervisor-vm": {
			"route": ["hypervisor", "vm"]
		}
	},
	"records": {
		"*.mydomain.com": "hypervisor-vm"
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
			"ip": "192.168.1.10",
			"docker": {
				"queryPattern": "{{HOSTNAME}}"
			}
		}
	},
	"routes": {
		"docker-only": {
			"route": ["docker-server"]
		}
	},
	"records": {
		"jellyfin.mydomain.com": "docker-only",
		"*.mydomain.com": "docker-only"
	}
}
```

## Combined Setup (Virtualization + Docker)

If your environment uses both virtualization and Docker (for example Docker running inside VMs, or mixed workloads), you can combine both approaches.

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
			"virtIP": "10.0.0.10",
			"startupTime": 10
		},
		"docker-server": {
			"ip": "10.0.0.10",
			"docker": {
				"queryPattern": "{{HOSTNAME}}"
			}
		}
	},
	"routes": {
		"hypervisor-lxc-docker": {
			"route": ["hypervisor", "lxc", "docker-server"]
		}
	},
	"records": {
		"*.mydomain.com": "hypervisor-lxc-docker"
	}
}
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
