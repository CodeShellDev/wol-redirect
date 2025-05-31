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

## Usage

Use a Reverse Proxy to redirect you from a service `https://jellyfin.mydomain.com` on another machine to `https://wol-red.mydomain.com`,
WoL Redirect will use the `config.json` to get the host of the requested service.

```json
{ { file.config/mapping.json } }
```

## Contributing

## License

[MIT](https://choosealicense.com/licenses/mit/)
