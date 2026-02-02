---
name: Docker WSL Mobile Redis
overview: Install Docker in WSL via CLI, add Docker Compose for backend + Redis so you can run the Android app (on host/emulator) against the stack and verify Redis. Document iOS testing options (macOS or cloud).
todos: []
isProject: false
---

# Docker in WSL, Backend + Redis in Docker, and Mobile Testing

## Scope

- **Docker in WSL**: Install using agent/CLI (commands you run in a WSL terminal or via Cursor’s terminal in WSL).
- **Backend + Redis**: Run in Docker so the mobile app can talk to the API and use Redis (radio state, listener count, etc.).
- **Android**: Run the Flutter app on your machine (emulator or device); it connects to the backend running in Docker. The app is not run inside Docker.
- **iOS**: Requires macOS for the Simulator; alternatives are cloud macOS or device clouds.

---

## 1. Install Docker in WSL (agent CLI steps)

All commands below are intended to be run **inside WSL** (e.g. `wsl` from PowerShell, or open "Ubuntu" from Start).

**1.1 Ensure WSL2 and a Linux distro**

```bash
# From PowerShell (Admin): wsl --install -d Ubuntu
# Or list: wsl -l -v  (set default to WSL2 if needed: wsl --set-version Ubuntu 2)
```

**1.2 Install Docker inside WSL (Debian/Ubuntu)**

```bash
# Update and install prereqs
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg

# Add Docker’s official GPG key and repo
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker Engine and Compose plugin
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Start and enable
sudo service docker start
# Optional: run without sudo: sudo usermod -aG docker $USER then log out/in
```

**1.3 Verify**

```bash
docker --version
docker compose version
docker run --rm hello-world
```

**Alternative (Docker Desktop):** Install Docker Desktop for Windows with “Use WSL 2 based engine” and optionally “Add shortcut to WSL”. Then use `docker` / `docker compose` from WSL that talk to the Desktop engine.

---

## 2. Run backend + Redis in Docker (test Redis from mobile)

Goal: One stack (Redis + backend) the mobile app can call. Redis is used by [backend/src/radio/radio-state.service.ts](backend/src/radio/radio-state.service.ts) and [backend/src/config/redis.config.ts](backend/src/config/redis.config.ts) (`REDIS_URL`, default `redis://localhost:6379`).

**2.1 Add project files (to add in repo)**

- `**docker-compose.yml**` (repo root or in `backend/`):
  - Service `redis`: image `redis:7-alpine`, port `6379:6379`.
  - Service `backend`: build from `backend/`, env `REDIS_URL=redis://redis:6379`, `PORT=3000`, plus Supabase/Firebase/Stripe from env file; expose `3000:3000`; `depends_on: redis`.
- `**backend/Dockerfile**`: multi-stage: Node 20, `npm ci`, `npm run build`, `node dist/main`; copy `backend/` context.

**2.2 Environment**

- Backend needs `.env` (or `.env.docker`) with Supabase, Firebase, Stripe, etc. In Compose, use `env_file: .env` or pass `REDIS_URL=redis://redis:6379` and other vars.
- No code change required: [backend/src/config/redis.config.ts](backend/src/config/redis.config.ts) already reads `REDIS_URL`; in Docker the hostname is `redis` (service name).

**2.3 Run stack (from repo root, in WSL)**

```bash
# From project root (path under WSL, e.g. /mnt/c/.../RadioApp)
cd /mnt/c/Users/tmaku/OneDrive/Documents/GSU/Projects/RadioApp
docker compose up -d redis backend
# Or: docker compose up --build
```

**2.4 Reach backend from host/Android emulator**

- From Windows/WSL host: `http://localhost:3000`.
- From Android emulator: use `http://10.0.2.2:3000` (emulator’s alias to host) and set the mobile app’s `API_BASE_URL` (e.g. in `mobile/.env` or [mobile/lib/core/services/api_service.dart](mobile/lib/core/services/api_service.dart) `baseUrl`) to that base URL (e.g. `http://10.0.2.2:3000`).
- Ensure backend CORS and any firewall allow the app.

**2.5 Verify Redis**

- Backend logs “Redis client connected” ([redis.config.ts](backend/src/config/redis.config.ts)).
- Use the app: play radio, check listener count / radio state; or call backend endpoints that use Redis. Optionally run `docker exec -it <redis_container> redis-cli PING` and `KEYS *` to confirm keys.

---

## 3. Android app: run on host, backend in Docker

- **Do not** run the Flutter Android app inside Docker for normal development.
- **Do**: Run backend + Redis with `docker compose up`; on the same machine run:
  - Android Studio / SDK and an AVD, or a physical device.
  - In project: `cd mobile && flutter pub get && flutter run` (select Android).
- Point the app at the backend:
  - `API_BASE_URL=http://10.0.2.2:3000` for default Android emulator.
  - For a physical device on the same LAN, use the host machine’s IP (e.g. `http://192.168.1.x:3000`) and ensure the device can reach that IP.

This way you deploy and test the Android app against the Dockerized backend and Redis.

**Optional – Android in Docker (CI-style):** For headless/CI you can use an Android emulator image (e.g. `budtmo/docker-android`) and run `flutter run` inside that container; that’s a separate, heavier setup and not required for “run mobile app and test Redis.”

---

## 4. How to test the iOS app

- **iOS Simulator** requires **macOS** and Xcode. There is no official iOS Simulator on Windows or inside Linux/Docker.
- **Options:**


| Option              | Description                                                                                                                                                                                                                    |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Mac + Xcode**     | On a Mac: install Xcode, open `mobile/ios/Runner.xcworkspace`, run on Simulator; or `flutter run` and choose an iOS device/simulator. Point `API_BASE_URL` to your backend (e.g. Mac’s IP if backend runs on another machine). |
| **Cloud macOS**     | Use a macOS runner (e.g. GitHub Actions `runs-on: macos-latest`) to build and run `flutter run` or run tests on the Simulator.                                                                                                 |
| **Device cloud**    | Use Firebase Test Lab, BrowserStack, Sauce Labs, etc., to run the built iOS app on real devices in the cloud; you upload the built app and run automated or manual tests.                                                      |
| **Physical iPhone** | On a Mac, connect an iPhone and run `flutter run` with the device selected; backend can be on the same Mac or on Docker on another machine (use that machine’s IP for `API_BASE_URL`).                                         |


So: **local iOS testing = use a Mac**. For Windows-only, use cloud macOS or a device cloud for iOS.

---

## 5. Summary


| Task            | Approach                                                                                                                                   |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Docker in WSL   | Run the given `apt-get` / Docker install commands inside WSL (or use Docker Desktop with WSL2).                                            |
| Redis + backend | Add `docker-compose.yml` and `backend/Dockerfile`; `docker compose up`; set `REDIS_URL=redis://redis:6379` for backend.                    |
| Android + Redis | Backend + Redis in Docker; run Flutter Android app on host/emulator with `API_BASE_URL` pointing at backend (e.g. `http://10.0.2.2:3000`). |
| iOS testing     | On a Mac: Xcode + Simulator or device; on Windows-only: cloud macOS or device cloud (Firebase Test Lab, BrowserStack, etc.).               |


**Files to add**

- [docker-compose.yml](docker-compose.yml) (root or backend): `redis` + `backend` services.
- [backend/Dockerfile](backend/Dockerfile): Node 20, build and run NestJS.

**Optional doc**

- Add a short section to [README.md](README.md) or [SETUP.md](SETUP.md): “Running with Docker (WSL)” (install Docker in WSL, then `docker compose up`, mobile `API_BASE_URL` for emulator).

