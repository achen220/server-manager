import { AsyncPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  input,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AgGridAngular } from 'ag-grid-angular';
import { GridApi, GridReadyEvent, themeBalham } from 'ag-grid-community';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { ToastModule } from 'primeng/toast';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { Observable, forkJoin, map, of, switchMap } from 'rxjs';
import { ServerService } from './server.service';
import { ServerGridService } from './services/server-grid.service';

export interface ServerManager {
  sshUsers?: ActiveSSHInfo[];
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
    ToastModule,
    ToggleSwitchModule,
  ],
  template: `
    <p-toast />
    <div id="ssh-grid-wrapper">
      @if (serverManager$ | async; as managerData) {
        <div class="toolbar">
          <p-button
            label="Open Terminal"
            icon="pi pi-desktop"
            severity="secondary"
            (onClick)="openTerminal()"
          />
          <p-button
            label="Add User"
            icon="pi pi-user-plus"
            (onClick)="dialogVisible.set(true)"
          />
        </div>
        <ag-grid-angular
          [theme]="theme"
          style="width: 100%; height: 400px"
          [columnDefs]="serverGridService.activeSshUserColDef"
          [rowData]="managerData.sshUsers"
          [gridOptions]="serverGridService.activeSshUserGridOptions"
          (gridReady)="onGridReady($event)"
        />
      }
    </div>

    <p-dialog
      [visible]="dialogVisible()"
      (visibleChange)="dialogVisible.set($event)"
      header="Add SSH User"
      [modal]="true"
      [style]="{ width: '28rem' }"
      [draggable]="false"
    >
      <form
        [formGroup]="addUserForm"
        (ngSubmit)="submitAddUser()"
        class="add-user-form"
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
          @if (
            addUserForm.get('username')?.invalid &&
            addUserForm.get('username')?.touched
          ) {
            <small class="error-text">
              Lowercase letters, digits, _ and - only (max 32 chars)
            </small>
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
          @if (
            addUserForm.get('password')?.invalid &&
            addUserForm.get('password')?.touched
          ) {
            <small class="error-text">Minimum 8 characters</small>
          }
        </div>

        <div class="field field-row">
          <label for="addIsAdmin">Grant sudo access</label>
          <p-toggleswitch inputId="addIsAdmin" formControlName="isAdmin" />
        </div>

        <div class="dialog-footer">
          <p-button
            label="Cancel"
            severity="secondary"
            type="button"
            (onClick)="dialogVisible.set(false)"
          />
          <p-button
            label="Create User"
            icon="pi pi-user-plus"
            type="submit"
            [loading]="addUserLoading()"
            [disabled]="addUserForm.invalid"
          />
        </div>
      </form>
    </p-dialog>
  `,
  styles: `
    #ssh-grid-wrapper { padding: 1rem; }
    .toolbar { display: flex; gap: 0.5rem; margin-bottom: 0.75rem; }
    .add-user-form { display: flex; flex-direction: column; gap: 1rem; padding-top: 0.5rem; }
    .field { display: flex; flex-direction: column; gap: 0.375rem; }
    .field-row { flex-direction: row; align-items: center; justify-content: space-between; }
    .dialog-footer { display: flex; justify-content: flex-end; gap: 0.5rem; padding-top: 0.5rem; }
    .error-text { color: var(--p-red-400); font-size: 0.75rem; }
    label { font-size: 0.875rem; font-weight: 500; }
  `,
})
export class ServerManagerComponent implements OnInit {
  private readonly serverService = inject(ServerService);
  serverGridService = inject(ServerGridService);
  private readonly router = inject(Router);
  private readonly msg = inject(MessageService);
  private readonly fb = inject(FormBuilder);

  private gridApi!: GridApi;

  id = input<string>();
  dialogVisible = signal<boolean>(false);
  addUserLoading = signal<boolean>(false);
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

  ngOnInit(): void {
    this.serverManager$ = this.serverService.initSSH(this.id() as string).pipe(
      switchMap(() => forkJoin({ sshUsers: this.serverService.activeSSHUsers() })),
    );
  }

  onGridReady(params: GridReadyEvent): void {
    this.gridApi = params.api;
  }

  openTerminal(): void {
    this.router.navigate(['/connections', this.id(), 'terminal']);
  }

  submitAddUser(): void {
    if (this.addUserForm.invalid) return;
    this.addUserLoading.set(true);
    const { username, password, isAdmin } = this.addUserForm.getRawValue();

    this.serverService
      .addSshUser({
        username: username!,
        password: password!,
        isAdmin: isAdmin!,
      })
      .subscribe({
        next: () => {
          this.addUserLoading.set(false);
          this.dialogVisible.set(false);
          this.addUserForm.reset({ isAdmin: false });
          this.msg.add({
            severity: 'success',
            summary: 'User created',
            detail: `${username} added successfully`,
          });
          this.serverManager$ = this.serverService
            .activeSSHUsers()
            .pipe(map((sshUsers) => ({ sshUsers })));
        },
        error: (err: { error?: { message?: string } }) => {
          this.addUserLoading.set(false);
          this.msg.add({
            severity: 'error',
            summary: 'Error',
            detail: err.error?.message ?? 'Failed to create user',
          });
        },
      });
  }
}

