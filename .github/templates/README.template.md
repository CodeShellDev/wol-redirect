# WoL Redirect

WoL Redirect is a Docker Container with graphical interface, which allows users to wake up their services.
Integrates with all of the WoL Containers.

## Installation

Get the latest `docker-compose.yaml` file:

```yaml
{ { file.docker-compose.yaml } }
```

```bash
docker compose up -d
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
