# Aurral Pocket — Test Stack

A throwaway Aurral server for testing the mobile app against. Runs locally on a dev machine or on a shared box for reviewers.

## Prerequisites

- Docker (Docker Desktop on macOS / Windows, or Docker Engine + Compose on Linux)
- Port `3001` free on the host — or override it via `.env` if you already run Aurral on this machine (see [Running alongside another stack](#running-alongside-another-stack))

## First run

```bash
cp .env.example .env
# edit .env if you want a non-default PUID / PGID
docker compose up -d
```

Aurral keeps its database and settings in `./data/config`, mounted at `/config`, and music in `./data/music`, mounted at `/data`.

Then set Aurral up:

1. Open `http://localhost:3001` and run the onboarding: create an admin account, then set **Library folder** to `/data/downloads/aurral`. On the host that's `./data/music/downloads/aurral`.
2. Recommendations work out of the box, with no API keys.

The built-in yt-dlp source needs no setup, so adding a monitored artist or requesting an album downloads real tracks into the Library folder. Cancel what you don't need from Activity.

## Pointing Aurral Pocket at this stack

| Where the app runs                | Use this Aurral URL                                             |
| --------------------------------- | --------------------------------------------------------------- |
| iOS simulator on the host         | `http://localhost:3001`                                         |
| Android emulator on the host      | `http://10.0.2.2:3001`                                          |
| Physical device on the same Wi-Fi | `http://<host-LAN-IP>:3001` (`ipconfig getifaddr en0` on macOS) |
| Remote test server (Tailscale)    | `http://<tailscale-hostname>:3001`                              |

If a physical device can't connect, check the host firewall isn't blocking the port and that the device is on the same subnet.

## Resetting state between test sessions

The whole stack lives under `./data/` (gitignored). Two patterns:

**Full wipe** — destroys all Aurral state:

```bash
docker compose down
rm -rf data/
docker compose up -d
```

**Snapshot + restore** — keep a curated "good" state to roll back to:

```bash
# After seeding Aurral the way you want reviewers to find it:
docker compose down
tar czf fixtures/seed.tar.gz data/

# To restore:
docker compose down
rm -rf data/
tar xzf fixtures/seed.tar.gz
docker compose up -d
```

Snapshots in `fixtures/` are intentionally **not** gitignored — commit the tarball if you want reviewers cloning the repo to get a known-good baseline. Don't commit one if it contains secrets, such as API keys saved in Aurral's settings, which live in `data/config/aurral.db`.

## Running alongside another stack

This stack is safe to run next to your real Aurral on the same host except for one thing: **host port conflicts**. Container names, volumes (`./data/`), and the internal compose network are all scoped to this folder, so nothing else collides.

If your existing Aurral already binds `3001`, override the host port in `.env`:

```env
AURRAL_PORT=3101
```

Then `docker compose up -d` again. Update the URL you point the app at accordingly (`http://localhost:3101`). The compose file falls back to `3001` when it is unset.

## Pinning image versions

The compose file uses `:latest` for ease of first setup. Once the stack works for you, pin the image to a specific tag so reviewers don't get silently upgraded mid-review:

```yaml
image: ghcr.io/lklynet/aurral:X.Y.Z # tags have no "v" prefix
```

To test against the Aurral version the app is built for, use the one in [`.aurral-version`](../../.aurral-version).

## Tearing down

```bash
docker compose down            # stop containers, keep data
docker compose down -v         # stop and remove named volumes (none here, but safe)
rm -rf data/                   # nuke all state
```
