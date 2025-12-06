# WoL Redirect

WoL Redirect is a Docker Container with graphical interface, which allows users to wake up their services.
Integrates with all of the WoL Containers.
s
_Well, except for meteorite_

## Installation

Get the latest `docker-compose.yaml` file:

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

```bash
docker compose up -d
```

### Reverse Proxy

In this example we'll be using traefik:

```yaml
services:
  # ...
  wolred:
    container_name: wol-redirect
    image: ghcr.io/codeshelldev/wol-redirect:latest
    networks:
      - network
      - proxy
    labels:
      - traefik.enable=true
      - traefik.http.routers.wolred-https.rule=Host(`wol-redirect.mydomain.com`)
      - traefik.http.routers.wolred-https.entrypoints=websecure
      - traefik.http.routers.wolred-https.tls=true
      - traefik.http.routers.wolred-https.tls.certresolver=cloudflare
      - traefik.http.routers.wolred-https.service=wolred-svc

      - traefik.http.services.wolred-svc.loadbalancer.server.port=80
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

Let's use jellyfin for example

```yaml
http:
  routers:
    jellyfin:
      entrypoints:
        - "websecure"
      rule: "Host(`jellyfin.mydomain.com`)"
      tls:
        certResolver: cloudflare
      service: jellyfin-failover

  services:
    jellyfin-failover:
      failover:
        service: jellyfin-svc@file
        fallback: wolred-svc@docker # the name of your wol redirect service
    jellyfin-svc:
      loadBalancer:
        serversTransport: transport
        healthCheck:
          # host your jellyfin instance with an additional port 12345, which is used for healthchecks
          # change this to port 80 / 443 if you are not hosting the docker host on top of PVE with wol-pve
          port: 12345
          interval: 5s
          timeout: 3s
          scheme: http
        servers:
          - url: "https://jellyfin.server2.mydomain.com" # actual url of jellyfin

  serversTransports:
    transport:
      insecureSkipVerify: true
```

### Configuration

```json
{
	"hosts": {
		"server-1": {
			"ip": "192.168.1.1",
			"mac": "XX:XX:XX:XX:XX:XX",
			"startupTime": 40
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

`.env`

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

#### PVE (VMs + LXCs)

If you are trying to wakeup a host running PVE, you will probably want to wakeup LXCs or VMs too.
Sadly LXCs (and VMs) don't have `Wake-on-LAN` functionalities.
For that you will need [WoL PVE](https://github.com/codeshelldev/wol-pve)

```json
{
	"hosts": {
		"pve": {
			"ip": "192.168.1.1",
			"mac": "XX:XX:XX:XX:XX:XX",
			"startupTime": 40
		},
		"lxc": {
			"ip": "192.168.1.1",
			"id": "100",
			"startupTime": 10,
			"isVirtual": true
		},
		"ubuntu-vm": {
			"ip": "192.168.1.1",
			"id": "100",
			"startupTime": 10,
			"isVirtual": true
		}
	},
	"routes": {
		"pve-lxc": {
			"route": ["pve", "lxc"]
		}
	},
	"records": {
		"*.mydomain.com": "pve-lxc"
	}
}
```

#### Docker

If you are running docker on your resource-hungry server, you might want to start docker-containers only if needed.
For this to work you will need [WoL Dockerized](https://github.com/codeshelldev/wol-dockerized)

```json
{
	"hosts": {
		"docker-server": {
			"ip": "192.168.1.1",
			"mac": "XX:XX:XX:XX:XX:XX",
			"startupTime": 10
		}
	},
	"routes": {
		"docker": {
			"route": ["docker-server"],
			"attributes": {
				"wakeDocker": true
			}
		}
	},
	"records": {
		"jellyfin.mydomain.com": "docker",
		"*.mydomain.com": "docker"
	}
}
```

#### Or both

```json
{
	"hosts": {
		"pve": {
			"ip": "192.168.1.1",
			"mac": "XX:XX:XX:XX:XX:XX",
			"startupTime": 40
		},
		"lxc": {
			"ip": "192.168.1.1",
			"id": "100",
			"startupTime": 10,
			"isVirtual": true
		},
		"ubuntu-vm": {
			"ip": "192.168.1.1",
			"id": "100",
			"startupTime": 10,
			"isVirtual": true
		}
	},
	"routes": {
		"pve-lxc": {
			"route": ["pve", "lxc"],
			"attributes": {
				"wakeDocker": true
			}
		}
	},
	"records": {
		"jellyfin.mydomain.com": "pve-lxc",
		"*.mydomain.com": "pve-lxc"
	}
}
```

_You will need both [WoL PVE](https://github.com/codeshelldev/wol-pve) and [WoL Dockerized](https://github.com/codeshelldev/wol-dockerized)_

## Usage

Use a Reverse Proxy to redirect you from a service `https://jellyfin.mydomain.com` on another machine to `https://wol-red.mydomain.com`,
WoL Redirect will use the `config.json` to get the host of the requested service.

## Contributing

Have feedback, new ideas or found a bug? Feel free to open up an issue or to start a Pull Request!

_But remember we are all volunteers, so be kind and respectful_

## Supporting

Like this project and want to support?
⭐️ this Repository to let others know about this Project.

## License

[MIT](https://choosealicense.com/licenses/mit/)
