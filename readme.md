Phase 1: SSH Execution Layer (Backend)
New shared service for running commands on remote servers via SSH.

Install node-ssh as a backend dependency
Create backend/src/ssh/ssh.service.ts — exec(connectionId, userId, command) method that calls ConnectionsService.getCredentials() for decrypted creds, opens an SSH connection, runs the command, returns {stdout, stderr, code}
Create backend/src/ssh/ssh.module.ts — imports ConnectionsModule (which exports ConnectionsService), exports SshService
Phase 2: Samba Backend Module
No DB entity needed — all state lives on the remote server. Backend is a pass-through.

Create backend/src/samba/samba.service.ts — injects SshService, one method per operation:
Service: getStatus → systemctl is-active smbd nmbd, controlService(action) → sudo systemctl {action} smbd nmbd
Users: listUsers → pdbedit -L (parse), addUser → smbpasswd -a, removeUser → smbpasswd -x, enableUser/disableUser → smbpasswd -e/-d, changePassword → smbpasswd -s
Shares: listShares → read + parse /etc/samba/smb.conf INI sections, createShare/updateShare → rewrite section + smbcontrol smbd reload-config, deleteShare → remove section + reload
Create backend/src/samba/samba.controller.ts — @UseGuards(JwtAuthGuard), base path /samba/:connectionId, routes for all 11 operations, extracts req.user.sub as userId
Create backend/src/samba/samba.module.ts — imports SshModule
Modify app.module.ts — register SambaModule
Phase 3: Frontend Angular Component
Follows the exact same patterns as the connections component.

Create frontend/src/app/samba/samba.model.ts — interfaces SambaUser, SambaShare, SambaStatus
Create frontend/src/app/samba/samba.api.service.ts — mirrors connections.api.service.ts, all methods accept connectionId
Create frontend/src/app/samba/samba.component.ts/.html/.scss:
Reads :id (connectionId) and ?name= from route, same as terminal
PrimeNG TabView with three tabs:
Service tab: Running/Stopped badges for smbd & nmbd; Start/Stop/Restart buttons with loading state
Users tab: Table with enabled badge column; Add User dialog (username + password); inline enable/disable toggle; Delete with ConfirmationService; Change Password action
Shares tab: Table (name, path, read-only); Add/Edit dialog with all share fields; Delete confirm
Signals for state, MessageService for toasts — identical to connections.component.ts
Add lazy-loaded route to app.routes.ts: connections/:id/samba
Add "Samba" button to connections.component.html alongside the existing terminal button
Relevant files

connections.service.ts — reuse getCredentials() in SshService
connections.module.ts — reference for module structure; must export ConnectionsService
connections.component.ts — template for signals + PrimeNG patterns
terminal.component.ts — reference for per-connection route params pattern
app.routes.ts — add samba route
Verification

GET /api/samba/:id/status returns 401 without token, valid status with token
Add a user via UI → confirm via pdbedit -L on the server
Toggle disable → confirm smbd rejects login
Add/delete a share → confirm in /etc/samba/smb.conf
Start/Stop/Restart → confirm systemctl status smbd
Navigate connections list → Samba page → back navigation works
Decisions & Assumptions

The SSH user stored in each connection must have passwordless sudo for smbpasswd, systemctl, and smb.conf writes — worth documenting in the UI
smb.conf is edited directly as an INI file (more universal than samba-tool, works on all distros)
Excluded: Samba groups, active connections monitoring
