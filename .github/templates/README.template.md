# WoL Redirect

WoL Redirect is a Docker Container with graphical interface, which allows users to wake up their services.
Integrates with all of the WoL Containers.

_Well, except for meteorite_

## Installation

Get the latest `docker-compose.yaml` file:

```yaml
{ { file.docker-compose.yaml } }
```

```bash
docker compose up -d
```

### Reverse Proxy

In this example we'll be using traefik:

```yaml
{ { file.examples/traefik.docker-compose.yaml } }
```

Let's use jellyfin for example

```yaml
{ { file.examples/jellyfin.yaml } }
```

### Configuration

```json
{ { file.examples/config/mapping.json } }
```

#### PVE (VMs + LXCs)

If you are trying to wakeup a host running PVE, you will probably want to wakeup LXCs or VMs too.
Sadly LXCs (and VMs) don't have `Wake-on-LAN` functionalities.
For that you will need (WoL PVE)[https://github.com/codeshelldev/wol-pve]

```json
{ { file.examples/config/mapping-pve.json } }
```

#### Docker

If you are running docker on your resource-hungry server, you might want to start docker-containers only if needed.
For this to work you will need (WoL Dockerized)[https://github.com/codeshelldev/wol-dockerized]

```json
{ { file.examples/config/mapping-docker.json } }
```

#### Or both

```json
{ { file.examples/config/mapping-pve-docker.json } }
```

_You will need both (WoL PVE)[https://github.com/codeshelldev/wol-pve] and (WoL Dockerized)[https://github.com/codeshelldev/wol-dockerized]_

## Usage

Use a Reverse Proxy to redirect you from a service `https://jellyfin.mydomain.com` on another machine to `https://wol-red.mydomain.com`,
WoL Redirect will use the `config.json` to get the host of the requested service.

## Contributing

## License

[MIT](https://choosealicense.com/licenses/mit/)
