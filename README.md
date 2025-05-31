# WoL Redirect

WoL Redirect is a Docker Container with graphical interface, which allows users to wake up their services.
Integrates with all of the WoL Containers.

_Well, except for meteorite_

## Installation

Get the latest `docker-compose.yaml` file:

```yaml
---
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
        service: jellyfin-svc
        fallback: wolred-svc # the name of your wol redirect service
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

## Usage

Use a Reverse Proxy to redirect you from a service `https://jellyfin.mydomain.com` on another machine to `https://wol-red.mydomain.com`,
WoL Redirect will use the `config.json` to get the host of the requested service.

```json
{
	"hosts": {
		"pve": {
			"ip": "192.168.1.1",
			"mac": "XX:XX:XX:XX",
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

## Contributing

## License

[MIT](https://choosealicense.com/licenses/mit/)
