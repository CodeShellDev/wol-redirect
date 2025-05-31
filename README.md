# WoL Redirect

WoL Redirect is a Docker Container with graphical interface, which allows users to wake up their services.
Integrates with all of the WoL Containers.

## Installation

Get the latest `docker-compose.yaml` file:

```yaml
---
services:
  myservice:
    container_name: myservice
```

```bash
docker compose up -d
```

## Usage

Use a Reverse Proxy to redirect you from a service `https://jellyfin.mydomain.com` on another machine to `https://wol-red.mydomain.com`,
WoL Redirect will use the `config.json` to get the host of the requested service.

```json
{
	"hosts": {
		"pve": {
			"ip": "192.XXX.XXX.1",
			"mac": "XX:XX:XX:XX",
			"startupTime": 40
		},
		"lxc": {
			"ip": "192.XXX.XXX.10",
			"id": "100",
			"startupTime": 10,
			"isVirtual": true
		},
		"ubuntu-vm": {
			"ip": "192.XXX.XXX.10",
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
