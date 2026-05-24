# Aurral Pocket — Test Stack

A throwaway Aurral + Lidarr stack for testing the mobile app against. Runs locally on a dev machine or on a shared box for reviewers.

## Prerequisites

- Docker (Docker Desktop on macOS / Windows, or Docker Engine + Compose on Linux)
- Ports `3001` (Aurral) and `8686` (Lidarr) free on the host — or override them via `.env` if you already run an Aurral / Lidarr stack on this machine (see [Running alongside another stack](#running-alongside-another-stack))

## First run

```bash
cp .env.example .env
# edit .env if you want a non-default TZ / PUID / PGID
docker compose up -d
```

Then wire Aurral to Lidarr:

1. Open `http://localhost:8686`, finish Lidarr's setup wizard.
2. In Lidarr → Settings → General, copy the **API Key**.
3. Open `http://localhost:3001`, create an admin user.
4. In Aurral → Settings → Lidarr, set:
   - URL: `http://lidarr:8686` (inside the compose network)
   - API Key: paste from step 2
5. Add a Last.fm API key in Aurral → Settings if you want discovery to do anything interesting.

Optional but useful for meaningful testing:

- In Lidarr, add a Root Folder (`/music` works, even empty).
- Add at least one Indexer and one Download Client so request flows have somewhere to land. A disabled / dummy client is fine — the app just needs the state machine populated.

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

**Full wipe** — destroys all Lidarr and Aurral state:

```bash
docker compose down
rm -rf data/
docker compose up -d
```

**Snapshot + restore** — keep a curated "good" state to roll back to:

```bash
# After seeding Lidarr/Aurral the way you want reviewers to find it:
docker compose down
tar czf fixtures/seed.tar.gz data/

# To restore:
docker compose down
rm -rf data/
tar xzf fixtures/seed.tar.gz
docker compose up -d
```

Snapshots in `fixtures/` are intentionally **not** gitignored — commit the tarball if you want reviewers cloning the repo to get a known-good baseline. Don't commit one if it contains secrets (Lidarr API keys live in `data/lidarr/config/config.xml`).

## Running alongside another stack

This stack is safe to run next to your real Aurral / Lidarr on the same host except for one thing: **host port conflicts**. Container names, volumes (`./data/`), and the internal compose network are all scoped to this folder, so nothing else collides.

If your existing stack already binds `3001` / `8686`, override the host ports in `.env`:

```env
AURRAL_PORT=3101
LIDARR_PORT=8786
```

Then `docker compose up -d` again. Update the URLs you point the app at accordingly (`http://localhost:3101`, etc.). The compose file falls back to the defaults (`3001` / `8686`) when these are unset.

## Pinning image versions

The compose file uses `:latest` for ease of first setup. Once the stack works for you, pin both images to specific tags so reviewers don't get silently upgraded mid-review:

```yaml
image: lscr.io/linuxserver/lidarr:2.x.x      # check Lidarr releases
image: ghcr.io/lklynet/aurral:vX.Y.Z         # check Aurral releases
```

## Tearing down

```bash
docker compose down            # stop containers, keep data
docker compose down -v         # stop and remove named volumes (none here, but safe)
rm -rf data/                   # nuke all state
```
