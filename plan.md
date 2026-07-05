# Server Manager — Feature Roadmap

## Phase 0 — Critical Fixes

- [x] **SSH connection pool** — replace singleton `ServerService.client` with `Map<userId, Client>`; per-user session isolation
- [x] **Command injection in `addSshUser`** — validate username with regex; pipe password via `chpasswd` stdin instead of shell interpolation
- [x] **Guard `/connections/:id`** — add `canActivate: [authGuard]` to `ServerManagerComponent` route

---

## Phase 1 — Complete Half-Built Features

- [x] **Real SSH terminal** — add `xterm.js`, open WebSocket/Socket.io channel in NestJS, pipe `ssh2` shell stream ↔ WebSocket; register `TerminalComponent` in router at `/connections/:id/terminal`
- [x] **Add SSH user dialog** — fill in empty `p-dialog` in `ServerManagerComponent` with reactive form; add missing `addSshUser()` HTTP call in frontend `ServerService`
- [x] **Fix `ActiveSSHInfo` interface** — align frontend type with backend response `{ username, uid, gid, home, shell, isActive, lastLogin, isAdmin, hasValidShell }`
- [x] **`GET /api/connections/:id`** — add missing `@Get(':id')` controller route (service method already exists)
- [x] **SSH key content storage** — store key content encrypted via `EncryptionService` instead of a local filesystem path

---

## Phase 2 — User & Permission Management

- [x] **Delete SSH user** — `userdel` + confirmation dialog + AG-Grid row action
- [ ] ~~**Change user password**~~ — skipped by user request
- [x] **Manage sudo/admin access** — `usermod -aG sudo` / `gpasswd -d`; toggle in grid
- [x] **Per-user SSH authorized_keys management** — list, add, remove SSH public keys in `~/.ssh/authorized_keys`
- [x] **Group management** — list system groups, create/delete, assign users

---

## Phase 3 — Server Monitoring Dashboard

- [x] **System overview** — `uname -a`, `uptime`, `lsb_release -a`, hostname; stats card row
- [x] **Resource usage** — CPU, RAM, disk; progress bars; polled every 5s
- [x] **Running processes** — `ps aux --sort=-%cpu`; searchable AG-Grid with kill action
- [x] **Service management** — `systemctl list-units --type=service`; start/stop/restart per row
- [x] **System logs** — `journalctl -n 200 --no-pager`; scrollable log viewer with filter/search

---

## Phase 4 — Network Management

- [ ] **Network interfaces** — `ip addr show`; interface list with IP, MAC, state
- [ ] **Open ports** — `ss -tulnp`; table of listening ports + owning process
- [ ] **Firewall rules** — `ufw status numbered` or `iptables -L`; add/delete rules via UI
- [ ] **DNS config** — read/edit `/etc/resolv.conf`; display nameservers

---

## Phase 5 — File Management (SFTP)

- [ ] **SFTP file browser** — use `ssh2` built-in SFTP client to browse directories
- [ ] **Upload / download files** — multipart upload from browser → NestJS → SFTP stream
- [ ] **Edit remote files** — fetch content, inline editor (Monaco), save back
- [ ] **File permissions** — `chmod`/`chown` from the file browser

---

## Phase 6 — Multi-Server & Samba

- [ ] **Connection groups / tags** — group connections by environment; filterable sidebar
- [ ] **Bulk command runner** — select N connections, run same command in parallel, see output per server
- [ ] **Connection status indicators** — TCP ping or SSH handshake on dashboard load; online/offline badges on cards
- [ ] **Samba share management** — implement `SambaService` stub; list, create, delete shares; user access control
- [ ] **Cron job manager** — `crontab -l`/`crontab -e`; form-based cron rule builder

---

## Phase 7 — Security & Audit

- [ ] **Audit log** — log every SSH command to `audit_logs` DB table: `userId, connectionId, command, timestamp, outcome`
- [ ] **Failed auth tracking** — `last -f /var/log/btmp`; show failed login attempts per server
- [ ] **SSH key rotation wizard** — generate key pair in browser (WebCrypto API), push public key to server, store private key encrypted
- [ ] **App-level RBAC** — use `role` from JWT payload in a `RolesGuard`; restrict admin-only operations
- [ ] **CORS lockdown** — dynamic CORS origin config per `NODE_ENV`; never `origin: '*'` in production
