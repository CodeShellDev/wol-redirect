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
{{{ #://docker-compose.yaml }}}
```

Start the container:

```bash
docker compose up -d
```

## Reverse Proxy

The following example uses **Traefik** as a reverse proxy:

```yaml
{{{ #://examples/traefik.docker-compose.yaml }}}
```

Example service configuration using **Jellyfin**:

```yaml
{{{ #://examples/jellyfin.yaml }}}
```

## Configuration

Basic service-to-host mappings:

```json
{{{ #://examples/config/mapping.json }}}
```

Environment variables:

```dotenv
{{{ #://examples/config/config.env }}}
```

## Advanced Setups

WoL Redirect supports two main scenarios depending on how your services are hosted.

## Virtualized Hosts (VMs, LXCs, Hypervisors)

If your services run inside virtual machines or containers managed by a hypervisor (for example Proxmox VE, ..., or similar platforms), you may want to wake up the physical host **and** start specific VMs or LXCs.

Since VMs and LXCs do not support Wake-on-LAN directly, an external helper is required.

This setup requires an additional helper to be installed on the hypervisor: [**WoL VE**](https://github.com/codeshelldev/wol-ve)

Example mapping configuration:

```json
{{{ #://examples/config/virtual.mapping.json }}}
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
{{{ #://examples/config/docker.mapping.json }}}
```

## Combined Setup (Virtualization + Docker)

If your environment uses both virtualization and Docker (for example Docker running inside VMs, or mixed workloads), you can combine both approaches.

Example mapping configuration:

```json
{{{ #://examples/config/virtual-docker.mapping.json }}}
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
