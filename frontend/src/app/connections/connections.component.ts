import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterOutlet } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { SelectButtonModule } from 'primeng/selectbutton';
import { SkeletonModule } from 'primeng/skeleton';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { TextareaModule } from 'primeng/textarea';
import { Connection } from './connection.model';
import { ConnectionsApiService } from './connections.api.service';
import { EmptyConnectionsComponent } from './empty-connections/empty-connection.component';

@Component({
  selector: 'app-connections',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ButtonModule,
    CardModule,
    DialogModule,
    InputTextModule,
    InputNumberModule,
    TextareaModule,
    PasswordModule,
    SelectButtonModule,
    TagModule,
    ToastModule,
    ConfirmDialogModule,
    SkeletonModule,
    EmptyConnectionsComponent,
    RouterOutlet,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './connections.component.html',
  styleUrl: './connections.component.scss',
})
export class ConnectionsComponent implements OnInit {
  private readonly api = inject(ConnectionsApiService);
  private readonly fb = inject(FormBuilder);
  private readonly msg = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);
  private readonly router = inject(Router);

  connections = signal<Connection[]>([]);
  loading = signal(false);
  dialogVisible = false;
  editingId: string | null = null;
  readonly skeletonItems = [1, 2, 3];

  readonly authOptions = [
    { label: 'Password', value: 'password' },
    { label: 'SSH Key', value: 'key' },
  ];

  form = this.fb.group({
    name: ['', Validators.required],
    host: ['', Validators.required],
    port: [22, [Validators.required, Validators.min(1), Validators.max(65535)]],
    username: ['', Validators.required],
    authType: ['password' as 'password' | 'key', Validators.required],
    password: [''],
    privateKey: [''],
    description: [''],
  });

  get isPasswordAuth(): boolean {
    return this.form.value.authType === 'password';
  }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.api.getAll().subscribe({
      next: (list) => {
        this.connections.set(list);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  openEdit(conn: Connection): void {
    this.editingId = conn.id;
    this.form.patchValue({ ...conn, password: '' });
    this.dialogVisible = true;
  }

  openNew(): void {
    this.editingId = null;
    this.form.reset({ port: 22, authType: 'password' });
    this.dialogVisible = true;
  }

  save(): void {
    if (this.form.invalid) return;
    const val = this.form.value;
    const payload = {
      name: val.name!,
      host: val.host!,
      port: Number(val.port),
      username: val.username!,
      authType: val.authType!,
      password:
        val.authType === 'password' ? val.password || undefined : undefined,
      privateKey:
        val.authType === 'key' ? val.privateKey || undefined : undefined,
      description: val.description || undefined,
    };

    const req$ = this.editingId
      ? this.api.update(this.editingId, payload)
      : this.api.create(payload);

    req$.subscribe({
      next: () => {
        this.dialogVisible = false;
        this.msg.add({
          severity: 'success',
          summary: this.editingId ? 'Updated' : 'Created',
          detail: `"${payload.name}" saved`,
        });
        this.load();
      },
      error: (e) =>
        this.msg.add({
          severity: 'error',
          summary: 'Error',
          detail: e.message,
        }),
    });
  }

  confirmDelete(conn: Connection): void {
    this.confirm.confirm({
      message: `Delete "${conn.name}"?`,
      header: 'Delete Connection',
      icon: 'pi pi-trash',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.api.delete(conn.id).subscribe({
          next: () => {
            this.msg.add({
              severity: 'success',
              summary: 'Deleted',
              detail: `"${conn.name}" removed`,
            });
            this.load();
          },
          error: (e) =>
            this.msg.add({
              severity: 'error',
              summary: 'Error',
              detail: e.message,
            }),
        });
      },
    });
  }

  navToServer(connection: Connection) {
    const { id } = connection;
    this.router.navigate(['/connections', id]);
  }
}
