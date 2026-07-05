import { AsyncPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  input,
  signal,
} from '@angular/core';
import {
  FormBuilder,
  FormControl,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { AgGridAngular } from 'ag-grid-angular';
import {
  GridApi,
  GridReadyEvent,
  SelectionChangedEvent,
  themeBalham,
} from 'ag-grid-community';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { TextareaModule } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { Observable, forkJoin, map, of, switchMap } from 'rxjs';
import { ServerService } from './server.service';
import { ServerGridService } from './services/server-grid.service';

export interface ServerManager {
  sshUsers?: ActiveSSHInfo[];
  groups?: GroupInfo[];
}

export interface ActiveSSHInfo {
  username: string;
  uid: number;
  gid: number;
  home: string;
  shell: string;
  isActive: boolean;
  lastLogin: string | null;
  isAdmin: boolean;
  hasValidShell: boolean;
}

export interface GroupInfo {
  name: string;
  gid: number;
  members: string[];
}

@Component({
  selector: 'app-server-manager',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [MessageService],
  imports: [
    AgGridAngular,
    AsyncPipe,
    ButtonModule,
    DialogModule,
    InputTextModule,
    PasswordModule,
    ReactiveFormsModule,
    TextareaModule,
    ToastModule,
    ToggleSwitchModule,
  ],
  template: `
    <p-toast />
    <div id="ssh-grid-wrapper">
      @if (serverManager$ | async; as data) {

        <!-- ── Users Section ── -->
        <div class="section-header">
          <h2 class="section-title">
            <i class="pi pi-users"></i> SSH Users
          </h2>
          <div class="toolbar">
            <p-button
              label="Open Terminal"
              icon="pi pi-desktop"
              severity="secondary"
              size="small"
              (onClick)="openTerminal()"
            />
            <p-button
              label="Monitor"
              icon="pi pi-chart-bar"
              severity="secondary"
              size="small"
              (onClick)="openMonitor()"
            />
            <p-button
              label="Network"
              icon="pi pi-wifi"
              severity="secondary"
              size="small"
              (onClick)="openNetwork()"
            />
            <p-button
              label="Add User"
              icon="pi pi-user-plus"
              size="small"
              (onClick)="addUserDialogVisible.set(true)"
            />
            @if (selectedUser()) {
              <span class="toolbar-sep"></span>
              <span class="selected-label">
                <i class="pi pi-user"></i> {{ selectedUser()!.username }}
              </span>
              <p-button
                [label]="selectedUser()!.isAdmin ? 'Revoke Admin' : 'Grant Admin'"
                [icon]="selectedUser()!.isAdmin ? 'pi pi-shield' : 'pi pi-verified'"
                severity="warn"
                size="small"
                [loading]="adminToggleLoading()"
                (onClick)="toggleAdmin()"
              />
              <p-button
                label="Manage Keys"
                icon="pi pi-key"
                severity="info"
                size="small"
                (onClick)="openKeysDialog()"
              />
              <p-button
                label="Delete User"
                icon="pi pi-trash"
                severity="danger"
                size="small"
                (onClick)="deleteUserDialogVisible.set(true)"
              />
            }
          </div>
        </div>

        <ag-grid-angular
          [theme]="theme"
          style="width: 100%; height: 360px"
          [columnDefs]="serverGridService.activeSshUserColDef"
          [rowData]="data.sshUsers"
          [gridOptions]="serverGridService.activeSshUserGridOptions"
          (gridReady)="onGridReady($event)"
          (selectionChanged)="onUserSelectionChanged($event)"
        />

        <!-- ── Groups Section ── -->
        <div class="section-header" style="margin-top: 2rem">
          <h2 class="section-title">
            <i class="pi pi-sitemap"></i> System Groups
          </h2>
          <div class="toolbar">
            <p-button
              label="Add Group"
              icon="pi pi-plus"
              size="small"
              (onClick)="addGroupDialogVisible.set(true)"
            />
            @if (selectedGroup()) {
              <span class="toolbar-sep"></span>
              <span class="selected-label">
                <i class="pi pi-folder"></i> {{ selectedGroup()!.name }}
              </span>
              <p-button
                label="Manage Members"
                icon="pi pi-users"
                severity="info"
                size="small"
                (onClick)="openGroupMembersDialog()"
              />
              <p-button
                label="Delete Group"
                icon="pi pi-trash"
                severity="danger"
                size="small"
                (onClick)="deleteGroupDialogVisible.set(true)"
              />
            }
          </div>
        </div>

        <ag-grid-angular
          [theme]="theme"
          style="width: 100%; height: 260px"
          [columnDefs]="serverGridService.groupsColDef"
          [rowData]="data.groups"
          [gridOptions]="serverGridService.groupsGridOptions"
          (gridReady)="onGroupsGridReady($event)"
          (selectionChanged)="onGroupSelectionChanged($event)"
        />

      }
    </div>

    <!-- ── Add User Dialog ── -->
    <p-dialog
      [visible]="addUserDialogVisible()"
      (visibleChange)="addUserDialogVisible.set($event)"
      header="Add SSH User"
      [modal]="true"
      [style]="{ width: '28rem' }"
      [draggable]="false"
    >
      <form
        [formGroup]="addUserForm"
        (ngSubmit)="submitAddUser()"
        class="dialog-form"
      >
        <div class="field">
          <label for="addUsername">Username</label>
          <input
            pInputText
            id="addUsername"
            formControlName="username"
            placeholder="e.g. john_doe"
            class="w-full"
          />
          @if (addUserForm.get('username')?.invalid && addUserForm.get('username')?.touched) {
            <small class="error-text">Lowercase letters, digits, _ and - only (max 32 chars)</small>
          }
        </div>

        <div class="field">
          <label for="addPassword">Password</label>
          <p-password
            inputId="addPassword"
            formControlName="password"
            [feedback]="true"
            [toggleMask]="true"
            styleClass="w-full"
            inputStyleClass="w-full"
          />
          @if (addUserForm.get('password')?.invalid && addUserForm.get('password')?.touched) {
            <small class="error-text">Minimum 8 characters</small>
          }
        </div>

        <div class="field field-row">
          <label for="addIsAdmin">Grant sudo access</label>
          <p-toggleswitch inputId="addIsAdmin" formControlName="isAdmin" />
        </div>

        <div class="dialog-footer">
          <p-button label="Cancel" severity="secondary" type="button" (onClick)="addUserDialogVisible.set(false)" />
          <p-button label="Create User" icon="pi pi-user-plus" type="submit" [loading]="addUserLoading()" [disabled]="addUserForm.invalid" />
        </div>
      </form>
    </p-dialog>

    <!-- ── Delete User Confirmation ── -->
    <p-dialog
      [visible]="deleteUserDialogVisible()"
      (visibleChange)="deleteUserDialogVisible.set($event)"
      header="Delete User"
      [modal]="true"
      [style]="{ width: '24rem' }"
      [draggable]="false"
    >
      <p class="confirm-text">
        Delete user <strong>{{ selectedUser()?.username }}</strong>?
        This will permanently remove their account and home directory.
      </p>
      <div class="dialog-footer">
        <p-button label="Cancel" severity="secondary" (onClick)="deleteUserDialogVisible.set(false)" />
        <p-button label="Delete" icon="pi pi-trash" severity="danger" [loading]="deleteLoading()" (onClick)="confirmDeleteUser()" />
      </div>
    </p-dialog>

    <!-- ── Authorized Keys Dialog ── -->
    <p-dialog
      [visible]="keysDialogVisible()"
      (visibleChange)="keysDialogVisible.set($event)"
      [header]="'SSH Keys — ' + (selectedUser()?.username ?? '')"
      [modal]="true"
      [style]="{ width: '36rem' }"
      [draggable]="false"
    >
      @if (keysLoading()) {
        <div class="loading-placeholder">
          <i class="pi pi-spin pi-spinner"></i> Loading keys…
        </div>
      } @else {
        @if (authorizedKeys().length === 0) {
          <p class="empty-text">No authorized keys found.</p>
        } @else {
          <ul class="keys-list">
            @for (key of authorizedKeys(); track $index) {
              <li class="key-item">
                <code class="key-preview" [title]="key">{{ key.length > 60 ? (key.slice(0, 60) + '…') : key }}</code>
                <p-button icon="pi pi-trash" severity="danger" [text]="true" size="small" (onClick)="removeKey($index)" />
              </li>
            }
          </ul>
        }
        <div class="field" style="margin-top: 1rem">
          <label>Add Public Key</label>
          <textarea
            pTextarea
            [formControl]="newKeyControl"
            rows="3"
            placeholder="ssh-ed25519 AAAA... or ssh-rsa AAAA..."
            class="w-full key-input"
          ></textarea>
          <p-button
            label="Add Key"
            icon="pi pi-plus"
            size="small"
            styleClass="mt-2"
            [loading]="addKeyLoading()"
            [disabled]="!newKeyControl.value?.trim()"
            (onClick)="addKey()"
          />
        </div>
      }
    </p-dialog>

    <!-- ── Add Group Dialog ── -->
    <p-dialog
      [visible]="addGroupDialogVisible()"
      (visibleChange)="addGroupDialogVisible.set($event)"
      header="Create Group"
      [modal]="true"
      [style]="{ width: '22rem' }"
      [draggable]="false"
    >
      <form [formGroup]="addGroupForm" (ngSubmit)="submitAddGroup()" class="dialog-form">
        <div class="field">
          <label for="groupName">Group Name</label>
          <input pInputText id="groupName" formControlName="groupName" placeholder="e.g. developers" class="w-full" />
          @if (addGroupForm.get('groupName')?.invalid && addGroupForm.get('groupName')?.touched) {
            <small class="error-text">Lowercase letters, digits, _ and - only (max 32 chars)</small>
          }
        </div>
        <div class="dialog-footer">
          <p-button label="Cancel" severity="secondary" type="button" (onClick)="addGroupDialogVisible.set(false)" />
          <p-button label="Create" icon="pi pi-plus" type="submit" [loading]="groupLoading()" [disabled]="addGroupForm.invalid" />
        </div>
      </form>
    </p-dialog>

    <!-- ── Delete Group Confirmation ── -->
    <p-dialog
      [visible]="deleteGroupDialogVisible()"
      (visibleChange)="deleteGroupDialogVisible.set($event)"
      header="Delete Group"
      [modal]="true"
      [style]="{ width: '22rem' }"
      [draggable]="false"
    >
      <p class="confirm-text">
        Delete group <strong>{{ selectedGroup()?.name }}</strong>? Users will remain but the group will be removed.
      </p>
      <div class="dialog-footer">
        <p-button label="Cancel" severity="secondary" (onClick)="deleteGroupDialogVisible.set(false)" />
        <p-button label="Delete" icon="pi pi-trash" severity="danger" [loading]="deleteGroupLoading()" (onClick)="confirmDeleteGroup()" />
      </div>
    </p-dialog>

    <!-- ── Group Members Dialog ── -->
    <p-dialog
      [visible]="groupMembersDialogVisible()"
      (visibleChange)="groupMembersDialogVisible.set($event)"
      [header]="'Members — ' + (selectedGroup()?.name ?? '')"
      [modal]="true"
      [style]="{ width: '30rem' }"
      [draggable]="false"
    >
      @if (groupMembersLoading()) {
        <div class="loading-placeholder">
          <i class="pi pi-spin pi-spinner"></i> Updating…
        </div>
      } @else {
        @if (groupMembers().length === 0) {
          <p class="empty-text">No members in this group.</p>
        } @else {
          <ul class="keys-list">
            @for (member of groupMembers(); track member) {
              <li class="key-item">
                <span class="member-name"><i class="pi pi-user"></i> {{ member }}</span>
                <p-button icon="pi pi-times" severity="danger" [text]="true" size="small" (onClick)="removeMember(member)" />
              </li>
            }
          </ul>
        }
        <div class="field" style="margin-top: 1rem">
          <label>Add Member</label>
          <div class="add-member-row">
            <input pInputText [formControl]="newMemberControl" placeholder="username" class="w-full" />
            <p-button
              label="Add"
              icon="pi pi-user-plus"
              size="small"
              [loading]="addMemberLoading()"
              [disabled]="!newMemberControl.value?.trim()"
              (onClick)="addMember()"
            />
          </div>
        </div>
      }
    </p-dialog>
  `,
  styles: `
    #ssh-grid-wrapper { padding: 1.5rem; }

    .section-header {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-bottom: 0.75rem;
      flex-wrap: wrap;
    }

    .section-title {
      font-size: 1rem;
      font-weight: 600;
      margin: 0;
      display: flex;
      align-items: center;
      gap: 0.4rem;
      flex-shrink: 0;
      color: var(--p-text-color);
    }

    .toolbar {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-wrap: wrap;
    }

    .toolbar-sep {
      width: 1px;
      height: 1.5rem;
      background: var(--p-surface-border);
      margin: 0 0.25rem;
    }

    .selected-label {
      font-size: 0.8125rem;
      font-weight: 600;
      color: var(--p-primary-color);
      display: flex;
      align-items: center;
      gap: 0.25rem;
    }

    .dialog-form { display: flex; flex-direction: column; gap: 1rem; padding-top: 0.5rem; }
    .field { display: flex; flex-direction: column; gap: 0.375rem; }
    .field-row { flex-direction: row; align-items: center; justify-content: space-between; }
    .dialog-footer { display: flex; justify-content: flex-end; gap: 0.5rem; padding-top: 0.5rem; }
    .error-text { color: var(--p-red-400); font-size: 0.75rem; }
    label { font-size: 0.875rem; font-weight: 500; }

    .confirm-text { margin: 0 0 1rem; line-height: 1.5; }

    .loading-placeholder {
      padding: 1.5rem;
      text-align: center;
      color: var(--p-text-muted-color);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
    }

    .empty-text {
      color: var(--p-text-muted-color);
      font-size: 0.875rem;
      text-align: center;
      padding: 1rem 0;
      margin: 0;
    }

    .keys-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
      max-height: 240px;
      overflow-y: auto;
    }

    .key-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 0.75rem;
      background: var(--p-surface-ground);
      border-radius: 0.375rem;
      border: 1px solid var(--p-surface-border);
    }

    .key-preview {
      flex: 1;
      font-size: 0.75rem;
      font-family: monospace;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: var(--p-text-color);
    }

    .key-input { font-family: monospace; font-size: 0.8125rem; }

    .member-name {
      flex: 1;
      font-size: 0.875rem;
      display: flex;
      align-items: center;
      gap: 0.375rem;
    }

    .add-member-row {
      display: flex;
      gap: 0.5rem;
      align-items: center;
    }
  `,
})
export class ServerManagerComponent implements OnInit {
  private readonly serverService = inject(ServerService);
  readonly serverGridService = inject(ServerGridService);
  private readonly router = inject(Router);
  private readonly msg = inject(MessageService);
  private readonly fb = inject(FormBuilder);

  private gridApi!: GridApi;
  private groupsGridApi!: GridApi;

  id = input<string>();

  // Dialog visibility
  addUserDialogVisible = signal(false);
  deleteUserDialogVisible = signal(false);
  keysDialogVisible = signal(false);
  addGroupDialogVisible = signal(false);
  deleteGroupDialogVisible = signal(false);
  groupMembersDialogVisible = signal(false);

  // Loading states
  addUserLoading = signal(false);
  deleteLoading = signal(false);
  adminToggleLoading = signal(false);
  keysLoading = signal(false);
  addKeyLoading = signal(false);
  groupLoading = signal(false);
  deleteGroupLoading = signal(false);
  groupMembersLoading = signal(false);
  addMemberLoading = signal(false);

  // Selection
  selectedUser = signal<ActiveSSHInfo | null>(null);
  selectedGroup = signal<GroupInfo | null>(null);

  // Keys state
  authorizedKeys = signal<string[]>([]);
  newKeyControl = new FormControl('');

  // Group members state
  groupMembers = signal<string[]>([]);
  newMemberControl = new FormControl('');

  theme = themeBalham;
  serverManager$: Observable<ServerManager> = of({});

  addUserForm = this.fb.group({
    username: [
      '',
      [Validators.required, Validators.pattern(/^[a-z_][a-z0-9_-]{0,31}$/)],
    ],
    password: ['', [Validators.required, Validators.minLength(8)]],
    isAdmin: [false],
  });

  addGroupForm = this.fb.group({
    groupName: [
      '',
      [Validators.required, Validators.pattern(/^[a-z_][a-z0-9_-]{0,31}$/)],
    ],
  });

  ngOnInit(): void {
    this.serverManager$ = this.serverService.initSSH(this.id()!).pipe(
      switchMap(() =>
        forkJoin({
          sshUsers: this.serverService.activeSSHUsers(),
          groups: this.serverService.getGroups(),
        }),
      ),
    );
  }

  private refreshData(): void {
    this.serverManager$ = forkJoin({
      sshUsers: this.serverService.activeSSHUsers(),
      groups: this.serverService.getGroups(),
    });
  }

  onGridReady(params: GridReadyEvent): void {
    this.gridApi = params.api;
  }

  onGroupsGridReady(params: GridReadyEvent): void {
    this.groupsGridApi = params.api;
  }

  onUserSelectionChanged(event: SelectionChangedEvent): void {
    const rows = event.api.getSelectedRows() as ActiveSSHInfo[];
    this.selectedUser.set(rows[0] ?? null);
  }

  onGroupSelectionChanged(event: SelectionChangedEvent): void {
    const rows = event.api.getSelectedRows() as GroupInfo[];
    this.selectedGroup.set(rows[0] ?? null);
  }

  openTerminal(): void {
    this.router.navigate(['/connections', this.id(), 'terminal']);
  }

  openMonitor(): void {
    this.router.navigate(['/connections', this.id(), 'monitor']);
  }

  openNetwork(): void {
    this.router.navigate(['/connections', this.id(), 'network']);
  }

  // ── Add User ──────────────────────────────────────────────
  submitAddUser(): void {
    if (this.addUserForm.invalid) return;
    this.addUserLoading.set(true);
    const { username, password, isAdmin } = this.addUserForm.getRawValue();

    this.serverService
      .addSshUser({ username: username!, password: password!, isAdmin: isAdmin! })
      .subscribe({
        next: () => {
          this.addUserLoading.set(false);
          this.addUserDialogVisible.set(false);
          this.addUserForm.reset({ isAdmin: false });
          this.msg.add({ severity: 'success', summary: 'User created', detail: `${username} added successfully` });
          this.refreshData();
        },
        error: (err: { error?: { message?: string } }) => {
          this.addUserLoading.set(false);
          this.msg.add({ severity: 'error', summary: 'Error', detail: err.error?.message ?? 'Failed to create user' });
        },
      });
  }

  // ── Delete User ───────────────────────────────────────────
  confirmDeleteUser(): void {
    if (!this.selectedUser()) return;
    this.deleteLoading.set(true);
    const username = this.selectedUser()!.username;
    this.serverService.deleteUser(username).subscribe({
      next: () => {
        this.deleteLoading.set(false);
        this.deleteUserDialogVisible.set(false);
        this.selectedUser.set(null);
        this.msg.add({ severity: 'success', summary: 'User deleted', detail: `${username} has been removed` });
        this.refreshData();
      },
      error: (err: { error?: { message?: string } }) => {
        this.deleteLoading.set(false);
        this.msg.add({ severity: 'error', summary: 'Error', detail: err.error?.message ?? 'Delete failed' });
      },
    });
  }

  // ── Toggle Admin ──────────────────────────────────────────
  toggleAdmin(): void {
    if (!this.selectedUser() || this.adminToggleLoading()) return;
    const user = this.selectedUser()!;
    this.adminToggleLoading.set(true);
    this.serverService.toggleAdmin(user.username, !user.isAdmin).subscribe({
      next: () => {
        this.adminToggleLoading.set(false);
        const action = !user.isAdmin ? 'granted' : 'revoked';
        this.msg.add({ severity: 'success', summary: 'Admin access updated', detail: `sudo ${action} for ${user.username}` });
        this.refreshData();
      },
      error: (err: { error?: { message?: string } }) => {
        this.adminToggleLoading.set(false);
        this.msg.add({ severity: 'error', summary: 'Error', detail: err.error?.message ?? 'Failed to update admin access' });
      },
    });
  }

  // ── Authorized Keys ───────────────────────────────────────
  openKeysDialog(): void {
    if (!this.selectedUser()) return;
    this.keysDialogVisible.set(true);
    this.keysLoading.set(true);
    this.newKeyControl.reset();
    this.serverService.getAuthorizedKeys(this.selectedUser()!.username).subscribe({
      next: (keys) => { this.authorizedKeys.set(keys); this.keysLoading.set(false); },
      error: () => { this.authorizedKeys.set([]); this.keysLoading.set(false); },
    });
  }

  addKey(): void {
    const key = this.newKeyControl.value?.trim();
    if (!key || !this.selectedUser()) return;
    this.addKeyLoading.set(true);
    this.serverService.addAuthorizedKey(this.selectedUser()!.username, key).subscribe({
      next: () => {
        this.addKeyLoading.set(false);
        this.newKeyControl.reset();
        this.authorizedKeys.update((keys) => [...keys, key]);
        this.msg.add({ severity: 'success', summary: 'Key added' });
      },
      error: (err: { error?: { message?: string } }) => {
        this.addKeyLoading.set(false);
        this.msg.add({ severity: 'error', summary: 'Error', detail: err.error?.message ?? 'Failed to add key' });
      },
    });
  }

  removeKey(index: number): void {
    if (!this.selectedUser()) return;
    this.serverService.removeAuthorizedKey(this.selectedUser()!.username, index).subscribe({
      next: () => {
        this.authorizedKeys.update((keys) => keys.filter((_, i) => i !== index));
        this.msg.add({ severity: 'success', summary: 'Key removed' });
      },
      error: (err: { error?: { message?: string } }) => {
        this.msg.add({ severity: 'error', summary: 'Error', detail: err.error?.message ?? 'Failed to remove key' });
      },
    });
  }

  // ── Groups ────────────────────────────────────────────────
  submitAddGroup(): void {
    if (this.addGroupForm.invalid) return;
    this.groupLoading.set(true);
    const { groupName } = this.addGroupForm.getRawValue();
    this.serverService.createGroup(groupName!).subscribe({
      next: () => {
        this.groupLoading.set(false);
        this.addGroupDialogVisible.set(false);
        this.addGroupForm.reset();
        this.msg.add({ severity: 'success', summary: 'Group created', detail: groupName! });
        this.refreshData();
      },
      error: (err: { error?: { message?: string } }) => {
        this.groupLoading.set(false);
        this.msg.add({ severity: 'error', summary: 'Error', detail: err.error?.message ?? 'Failed to create group' });
      },
    });
  }

  confirmDeleteGroup(): void {
    if (!this.selectedGroup()) return;
    this.deleteGroupLoading.set(true);
    const name = this.selectedGroup()!.name;
    this.serverService.deleteGroup(name).subscribe({
      next: () => {
        this.deleteGroupLoading.set(false);
        this.deleteGroupDialogVisible.set(false);
        this.selectedGroup.set(null);
        this.msg.add({ severity: 'success', summary: 'Group deleted', detail: name });
        this.refreshData();
      },
      error: (err: { error?: { message?: string } }) => {
        this.deleteGroupLoading.set(false);
        this.msg.add({ severity: 'error', summary: 'Error', detail: err.error?.message ?? 'Failed to delete group' });
      },
    });
  }

  // ── Group Members ─────────────────────────────────────────
  openGroupMembersDialog(): void {
    if (!this.selectedGroup()) return;
    this.groupMembers.set([...(this.selectedGroup()!.members ?? [])]);
    this.newMemberControl.reset();
    this.groupMembersDialogVisible.set(true);
  }

  addMember(): void {
    const username = this.newMemberControl.value?.trim();
    if (!username || !this.selectedGroup()) return;
    this.addMemberLoading.set(true);
    this.serverService.assignUserToGroup(username, this.selectedGroup()!.name, true).subscribe({
      next: () => {
        this.addMemberLoading.set(false);
        this.newMemberControl.reset();
        this.groupMembers.update((m) => [...m, username]);
        this.msg.add({ severity: 'success', summary: 'Member added', detail: `${username} added to ${this.selectedGroup()!.name}` });
        this.refreshData();
      },
      error: (err: { error?: { message?: string } }) => {
        this.addMemberLoading.set(false);
        this.msg.add({ severity: 'error', summary: 'Error', detail: err.error?.message ?? 'Failed to add member' });
      },
    });
  }

  removeMember(username: string): void {
    if (!this.selectedGroup()) return;
    this.groupMembersLoading.set(true);
    this.serverService.assignUserToGroup(username, this.selectedGroup()!.name, false).subscribe({
      next: () => {
        this.groupMembersLoading.set(false);
        this.groupMembers.update((m) => m.filter((u) => u !== username));
        this.msg.add({ severity: 'success', summary: 'Member removed', detail: `${username} removed from ${this.selectedGroup()!.name}` });
        this.refreshData();
      },
      error: (err: { error?: { message?: string } }) => {
        this.groupMembersLoading.set(false);
        this.msg.add({ severity: 'error', summary: 'Error', detail: err.error?.message ?? 'Failed to remove member' });
      },
    });
  }
}