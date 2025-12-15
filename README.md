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

Let's use jellyfin for example

```yaml
file not found: /home/runner/work/wol-redirect/wol-redirect/examples/jellyfin.yaml
```

### Configuration

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
file not found: /home/runner/work/wol-redirect/wol-redirect/examples/config/mapping-pve.json
```

#### Docker

If you are running docker on your resource-hungry server, you might want to start docker-containers only if needed.
For this to work you will need [WoL Dockerized](https://github.com/codeshelldev/wol-dockerized)

```json
file not found: /home/runner/work/wol-redirect/wol-redirect/examples/config/mapping-docker.json
```

#### Or both

```json
file not found: /home/runner/work/wol-redirect/wol-redirect/examples/config/mapping-pve-docker.json
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
