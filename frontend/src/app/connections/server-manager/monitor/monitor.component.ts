import { DatePipe, SlicePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AgGridAngular } from 'ag-grid-angular';
import {
  ColDef,
  GridApi,
  GridReadyEvent,
  SelectionChangedEvent,
  themeBalham,
} from 'ag-grid-community';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { ProgressBarModule } from 'primeng/progressbar';
import { SkeletonModule } from 'primeng/skeleton';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { Subject, forkJoin, switchMap, timer } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ServerService } from '../server.service';
import { MonitorService } from './monitor.service';

// ── Interfaces (also used by MonitorService) ───────────────────────────────
export interface SystemOverview {
  hostname: string;
  uptime: string;
  os: string;
  kernel: string;
  arch: string;
  loadAvg: { load1: string; load5: string; load15: string };
}

export interface ResourceUsage {
  cpu: { usedPercent: number };
  ram: { total: number; used: number; available: number; usedPercent: number };
  disk: {
    total: number;
    used: number;
    available: number;
    usedPercent: number;
  };
}

export interface ProcessInfo {
  user: string;
  pid: number;
  cpu: number;
  mem: number;
  rss: number;
  stat: string;
  start: string;
  time: string;
  command: string;
}

export interface ServiceInfo {
  unit: string;
  load: string;
  active: string;
  sub: string;
  description: string;
}

@Component({
  selector: 'app-monitor',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [MessageService, DatePipe],
  imports: [
    RouterModule,
    FormsModule,
    AgGridAngular,
    ButtonModule,
    CardModule,
    DatePipe,
    DialogModule,
    InputTextModule,
    ProgressBarModule,
    SkeletonModule,
    SlicePipe,
    TagModule,
    ToastModule,
  ],
  template: `
    <p-toast />

    <div class="monitor-page">
      <!-- ── Page header ── -->
      <div class="page-header">
        <p-button
          icon="pi pi-arrow-left"
          severity="secondary"
          [text]="true"
          size="small"
          (onClick)="goBack()"
        />
        <div class="header-info">
          @if (overview()) {
            <span class="hostname">
              <i class="pi pi-server"></i> {{ overview()!.hostname }}
            </span>
            <span class="uptime">{{ overview()!.uptime }}</span>
          } @else {
            <p-skeleton width="10rem" height="1rem" />
          }
        </div>
        <div class="header-actions">
          <span class="refresh-label">
            <i class="pi pi-clock"></i>
            {{ lastRefreshed() ? ('Updated ' + (lastRefreshed() | date:'HH:mm:ss')) : 'Loading…' }}
          </span>
          <p-button
            [icon]="autoRefresh() ? 'pi pi-pause' : 'pi pi-play'"
            [label]="autoRefresh() ? 'Pause' : 'Resume'"
            severity="secondary"
            size="small"
            (onClick)="autoRefresh.set(!autoRefresh())"
          />
          <p-button
            icon="pi pi-refresh"
            label="Refresh"
            severity="secondary"
            size="small"
            [loading]="resourcesLoading()"
            (onClick)="refreshAll()"
          />
        </div>
      </div>

      @if (loadError()) {
        <div class="error-banner">
          <i class="pi pi-exclamation-triangle"></i> {{ loadError() }}
        </div>
      } @else if (initialLoading()) {
        <!-- Skeleton state -->
        <div class="stats-row">
          @for (_ of [1,2,3,4]; track $index) {
            <p-card styleClass="stat-card">
              <p-skeleton width="5rem" height="0.75rem" styleClass="mb-2" />
              <p-skeleton width="9rem" height="1.1rem" />
            </p-card>
          }
        </div>
        <div class="resource-row">
          @for (_ of [1,2,3]; track $index) {
            <p-card styleClass="resource-card">
              <p-skeleton width="6rem" height="0.9rem" styleClass="mb-3" />
              <p-skeleton width="100%" height="0.5rem" styleClass="mb-2" />
              <p-skeleton width="8rem" height="0.75rem" />
            </p-card>
          }
        </div>
      } @else {
        <!-- ── System overview cards ── -->
        <div class="stats-row">
          <p-card styleClass="stat-card">
            <div class="stat-label">Hostname</div>
            <div class="stat-value">{{ overview()?.hostname ?? '—' }}</div>
          </p-card>
          <p-card styleClass="stat-card">
            <div class="stat-label">OS</div>
            <div class="stat-value">{{ overview()?.os ?? '—' }}</div>
          </p-card>
          <p-card styleClass="stat-card">
            <div class="stat-label">Kernel</div>
            <div class="stat-value">{{ overview()?.kernel ?? '—' }}</div>
          </p-card>
          <p-card styleClass="stat-card">
            <div class="stat-label">Load Average</div>
            <div class="stat-value">
              {{ overview()?.loadAvg?.load1 }}
              <span class="stat-sub">/ {{ overview()?.loadAvg?.load5 }} / {{ overview()?.loadAvg?.load15 }}</span>
            </div>
          </p-card>
        </div>

        <!-- ── Resource usage cards ── -->
        <div class="resource-row">
          <p-card styleClass="resource-card">
            <div class="resource-header">
              <span class="resource-title"><i class="pi pi-microchip"></i> CPU</span>
              <span class="resource-pct">{{ resources()?.cpu?.usedPercent ?? 0 }}%</span>
            </div>
            <p-progressbar
              [value]="resources()?.cpu?.usedPercent ?? 0"
              [showValue]="false"
              [styleClass]="progressClass(resources()?.cpu?.usedPercent ?? 0)"
            />
            <div class="resource-sub">avg since boot</div>
          </p-card>

          <p-card styleClass="resource-card">
            <div class="resource-header">
              <span class="resource-title"><i class="pi pi-database"></i> RAM</span>
              <span class="resource-pct">{{ resources()?.ram?.usedPercent ?? 0 }}%</span>
            </div>
            <p-progressbar
              [value]="resources()?.ram?.usedPercent ?? 0"
              [showValue]="false"
              [styleClass]="progressClass(resources()?.ram?.usedPercent ?? 0)"
            />
            <div class="resource-sub">
              {{ formatBytes(resources()?.ram?.used ?? 0) }} /
              {{ formatBytes(resources()?.ram?.total ?? 0) }}
            </div>
          </p-card>

          <p-card styleClass="resource-card">
            <div class="resource-header">
              <span class="resource-title"><i class="pi pi-hard-drive"></i> Disk (/)</span>
              <span class="resource-pct">{{ resources()?.disk?.usedPercent ?? 0 }}%</span>
            </div>
            <p-progressbar
              [value]="resources()?.disk?.usedPercent ?? 0"
              [showValue]="false"
              [styleClass]="progressClass(resources()?.disk?.usedPercent ?? 0)"
            />
            <div class="resource-sub">
              {{ formatBytes(resources()?.disk?.used ?? 0) }} /
              {{ formatBytes(resources()?.disk?.total ?? 0) }}
            </div>
          </p-card>
        </div>

        <!-- ── Tabs ── -->
        <div class="tabs-section">
          <div class="tab-bar">
            <button
              class="tab-btn"
              [class.active]="activeTab() === 'processes'"
              (click)="activeTab.set('processes')"
            >
              <i class="pi pi-cog"></i> Processes
            </button>
            <button
              class="tab-btn"
              [class.active]="activeTab() === 'services'"
              (click)="activeTab.set('services')"
            >
              <i class="pi pi-server"></i> Services
            </button>
            <button
              class="tab-btn"
              [class.active]="activeTab() === 'logs'"
              (click)="activeTab.set('logs')"
            >
              <i class="pi pi-file-edit"></i> Logs
            </button>
          </div>

          <!-- Processes tab -->
          @if (activeTab() === 'processes') {
            <div class="tab-toolbar">
              @if (selectedProcess()) {
                <span class="selected-label">
                  PID {{ selectedProcess()!.pid }} — {{ selectedProcess()!.command | slice:0:40 }}
                </span>
                <p-button
                  label="Kill Process"
                  icon="pi pi-times-circle"
                  severity="danger"
                  size="small"
                  (onClick)="killDialogVisible.set(true)"
                />
              }
              <p-button
                icon="pi pi-refresh"
                severity="secondary"
                size="small"
                [text]="true"
                [loading]="processesLoading()"
                (onClick)="loadProcesses()"
              />
            </div>
            <ag-grid-angular
              [theme]="theme"
              style="width:100%; height:380px"
              [columnDefs]="processColDefs"
              [rowData]="processes()"
              [gridOptions]="{ autoSizeStrategy: { type: 'fitCellContents' }, rowSelection: 'single' }"
              (gridReady)="onProcessGridReady($event)"
              (selectionChanged)="onProcessSelectionChanged($event)"
            />
          }

          <!-- Services tab -->
          @if (activeTab() === 'services') {
            <div class="tab-toolbar">
              @if (selectedService()) {
                <span class="selected-label">
                  {{ selectedService()!.unit }}
                </span>
                <p-button label="Start" icon="pi pi-play" severity="success" size="small" [loading]="serviceActionLoading()" (onClick)="controlService('start')" />
                <p-button label="Stop" icon="pi pi-stop" severity="danger" size="small" [loading]="serviceActionLoading()" (onClick)="controlService('stop')" />
                <p-button label="Restart" icon="pi pi-refresh" severity="warn" size="small" [loading]="serviceActionLoading()" (onClick)="controlService('restart')" />
              }
              <p-button
                icon="pi pi-refresh"
                severity="secondary"
                size="small"
                [text]="true"
                [loading]="servicesLoading()"
                (onClick)="loadServices()"
              />
            </div>
            <ag-grid-angular
              [theme]="theme"
              style="width:100%; height:380px"
              [columnDefs]="serviceColDefs"
              [rowData]="services()"
              [gridOptions]="{ autoSizeStrategy: { type: 'fitCellContents' }, rowSelection: 'single' }"
              (gridReady)="onServiceGridReady($event)"
              (selectionChanged)="onServiceSelectionChanged($event)"
            />
          }

          <!-- Logs tab -->
          @if (activeTab() === 'logs') {
            <div class="tab-toolbar">
              <input
                pInputText
                [(ngModel)]="logFilter"
                placeholder="Filter logs…"
                class="log-filter-input"
              />
              <p-button
                icon="pi pi-refresh"
                severity="secondary"
                size="small"
                [text]="true"
                [loading]="logsLoading()"
                (onClick)="loadLogs()"
              />
              <span class="log-count">{{ filteredLogs().length }} lines</span>
            </div>
            <div class="log-viewer" #logViewer>
              @for (line of filteredLogs(); track $index) {
                <div
                  class="log-line"
                  [class.log-error]="isErrorLine(line)"
                  [class.log-warn]="isWarnLine(line)"
                >{{ line }}</div>
              }
            </div>
          }
        </div>
      }
    </div>

    <!-- Kill process confirmation -->
    <p-dialog
      [visible]="killDialogVisible()"
      (visibleChange)="killDialogVisible.set($event)"
      header="Kill Process"
      [modal]="true"
      [style]="{ width: '22rem' }"
      [draggable]="false"
    >
      <p class="confirm-text">
        Kill PID <strong>{{ selectedProcess()?.pid }}</strong>
        (<code>{{ selectedProcess()?.command | slice:0:50 }}</code>)?
        This sends SIGKILL and cannot be undone.
      </p>
      <div class="confirm-footer">
        <p-button label="Cancel" severity="secondary" (onClick)="killDialogVisible.set(false)" />
        <p-button label="Kill" icon="pi pi-times-circle" severity="danger" [loading]="killLoading()" (onClick)="confirmKill()" />
      </div>
    </p-dialog>
  `,
  styles: `
    .monitor-page {
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    /* Page header */
    .page-header {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      flex-wrap: wrap;
    }

    .header-info {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      flex: 1;
    }

    .hostname {
      font-size: 1rem;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 0.375rem;
      color: var(--p-text-color);
    }

    .uptime {
      font-size: 0.8125rem;
      color: var(--p-text-muted-color);
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-wrap: wrap;
    }

    .refresh-label {
      font-size: 0.75rem;
      color: var(--p-text-muted-color);
      display: flex;
      align-items: center;
      gap: 0.25rem;
    }

    /* Error */
    .error-banner {
      padding: 1rem 1.25rem;
      background: color-mix(in srgb, var(--p-red-500) 12%, transparent);
      border: 1px solid color-mix(in srgb, var(--p-red-500) 30%, transparent);
      border-radius: 0.5rem;
      color: var(--p-red-400);
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    /* Stats row */
    .stats-row {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 0.75rem;
    }

    :host ::ng-deep .stat-card .p-card-body { padding: 0.875rem 1rem; }

    .stat-label {
      font-size: 0.7rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--p-text-muted-color);
      margin-bottom: 0.3rem;
    }

    .stat-value {
      font-size: 0.9375rem;
      font-weight: 600;
      color: var(--p-text-color);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .stat-sub {
      font-size: 0.8125rem;
      font-weight: 400;
      color: var(--p-text-muted-color);
    }

    /* Resource row */
    .resource-row {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 0.75rem;
    }

    :host ::ng-deep .resource-card .p-card-body { padding: 1rem 1.25rem; }

    .resource-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.625rem;
    }

    .resource-title {
      font-size: 0.875rem;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 0.375rem;
    }

    .resource-pct {
      font-size: 1.25rem;
      font-weight: 700;
      color: var(--p-primary-color);
    }

    .resource-sub {
      font-size: 0.75rem;
      color: var(--p-text-muted-color);
      margin-top: 0.375rem;
    }

    :host ::ng-deep .prog-ok .p-progressbar-value { background: var(--p-green-500); }
    :host ::ng-deep .prog-warn .p-progressbar-value { background: var(--p-yellow-500); }
    :host ::ng-deep .prog-danger .p-progressbar-value { background: var(--p-red-500); }

    /* Tabs */
    .tabs-section {
      display: flex;
      flex-direction: column;
      gap: 0;
      border: 1px solid var(--p-surface-border);
      border-radius: 0.5rem;
      overflow: hidden;
    }

    .tab-bar {
      display: flex;
      background: var(--p-surface-ground);
      border-bottom: 1px solid var(--p-surface-border);
    }

    .tab-btn {
      padding: 0.625rem 1.25rem;
      border: none;
      background: transparent;
      color: var(--p-text-muted-color);
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 0.375rem;
      transition: background 0.15s, color 0.15s;
      border-bottom: 2px solid transparent;
      margin-bottom: -1px;

      &:hover { background: var(--p-surface-hover); color: var(--p-text-color); }
      &.active { color: var(--p-primary-color); border-bottom-color: var(--p-primary-color); background: var(--p-surface-card); }
    }

    .tab-toolbar {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.625rem 1rem;
      background: var(--p-surface-card);
      border-bottom: 1px solid var(--p-surface-border);
      flex-wrap: wrap;
    }

    .selected-label {
      font-size: 0.8125rem;
      font-weight: 600;
      color: var(--p-primary-color);
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .log-filter-input { width: 16rem; font-size: 0.875rem; }
    .log-count { font-size: 0.75rem; color: var(--p-text-muted-color); margin-left: auto; }

    /* Log viewer */
    .log-viewer {
      height: 420px;
      overflow-y: auto;
      background: var(--p-surface-ground);
      font-family: 'JetBrains Mono', 'Fira Code', ui-monospace, monospace;
      font-size: 0.75rem;
      line-height: 1.6;
      padding: 0.5rem;
    }

    .log-line {
      padding: 0.05rem 0.25rem;
      border-radius: 2px;
      white-space: pre-wrap;
      word-break: break-all;
      color: var(--p-text-color);
    }

    .log-error { color: var(--p-red-400); }
    .log-warn { color: var(--p-yellow-400); }

    /* Confirm dialog */
    .confirm-text { margin: 0 0 1rem; line-height: 1.6; }
    .confirm-footer { display: flex; justify-content: flex-end; gap: 0.5rem; }

    /* mb helpers for skeleton */
    .mb-2 { margin-bottom: 0.5rem; }
    .mb-3 { margin-bottom: 0.75rem; }
  `,
})
export class MonitorComponent implements OnInit, OnDestroy {
  private readonly monitorService = inject(MonitorService);
  private readonly serverService = inject(ServerService);
  private readonly router = inject(Router);
  private readonly msg = inject(MessageService);
  private readonly datePipe = inject(DatePipe);

  id = input<string>();

  // Data signals
  overview = signal<SystemOverview | null>(null);
  resources = signal<ResourceUsage | null>(null);
  processes = signal<ProcessInfo[]>([]);
  services = signal<ServiceInfo[]>([]);
  logs = signal<string[]>([]);

  // UI state
  initialLoading = signal(true);
  loadError = signal<string | null>(null);
  resourcesLoading = signal(false);
  processesLoading = signal(false);
  servicesLoading = signal(false);
  logsLoading = signal(false);
  autoRefresh = signal(true);
  lastRefreshed = signal<Date | null>(null);
  activeTab = signal<'processes' | 'services' | 'logs'>('processes');

  // Selection
  selectedProcess = signal<ProcessInfo | null>(null);
  selectedService = signal<ServiceInfo | null>(null);

  // Kill dialog
  killDialogVisible = signal(false);
  killLoading = signal(false);
  serviceActionLoading = signal(false);

  // Logs filter
  logFilter = '';
  filteredLogs = computed(() => {
    const f = this.logFilter.toLowerCase();
    return f
      ? this.logs().filter((l) => l.toLowerCase().includes(f))
      : this.logs();
  });

  theme = themeBalham;

  private processGridApi!: GridApi;
  private serviceGridApi!: GridApi;
  private destroy$ = new Subject<void>();

  // ── AG-Grid column definitions ────────────────────────────────────────────
  processColDefs: ColDef[] = [
    { field: 'user', headerName: 'User', width: 100 },
    { field: 'pid', headerName: 'PID', width: 80, sortable: true },
    {
      field: 'cpu',
      headerName: 'CPU%',
      width: 80,
      sortable: true,
      sort: 'desc',
      valueFormatter: (p) => `${p.value}%`,
    },
    {
      field: 'mem',
      headerName: 'MEM%',
      width: 80,
      sortable: true,
      valueFormatter: (p) => `${p.value}%`,
    },
    {
      field: 'rss',
      headerName: 'RSS',
      width: 90,
      sortable: true,
      valueFormatter: (p) => this.formatBytes((p.value as number) * 1024),
    },
    { field: 'stat', headerName: 'Stat', width: 70 },
    { field: 'start', headerName: 'Start', width: 80 },
    { field: 'time', headerName: 'Time', width: 80 },
    { field: 'command', headerName: 'Command', flex: 1 },
  ];

  serviceColDefs: ColDef[] = [
    { field: 'unit', headerName: 'Unit', flex: 1, sortable: true, filter: 'agTextColumnFilter' },
    { field: 'load', headerName: 'Load', width: 90 },
    {
      field: 'active',
      headerName: 'Active',
      width: 100,
      sortable: true,
      cellStyle: (p) => ({
        color:
          p.value === 'active'
            ? 'var(--p-green-500)'
            : p.value === 'failed'
              ? 'var(--p-red-500)'
              : 'var(--p-text-muted-color)',
        fontWeight: p.value === 'active' ? '600' : '400',
      }),
    },
    { field: 'sub', headerName: 'Sub', width: 100 },
    { field: 'description', headerName: 'Description', flex: 2 },
  ];

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.serverService
      .initSSH(this.id()!)
      .pipe(
        switchMap(() =>
          forkJoin({
            overview: this.monitorService.getSystemOverview(),
            resources: this.monitorService.getResourceUsage(),
            processes: this.monitorService.getProcesses(),
            services: this.monitorService.getServices(),
            logs: this.monitorService.getLogs(),
          }),
        ),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: (data) => {
          this.overview.set(data.overview);
          this.resources.set(data.resources);
          this.processes.set(data.processes);
          this.services.set(data.services);
          this.logs.set(data.logs);
          this.initialLoading.set(false);
          this.lastRefreshed.set(new Date());
          this.startResourcePolling();
        },
        error: (err: { error?: { message?: string } }) => {
          this.initialLoading.set(false);
          this.loadError.set(
            err.error?.message ?? 'Failed to load monitoring data',
          );
        },
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private startResourcePolling(): void {
    timer(5000, 5000)
      .pipe(
        takeUntil(this.destroy$),
      )
      .subscribe(() => {
        if (!this.autoRefresh()) return;
        this.resourcesLoading.set(true);
        this.monitorService.getResourceUsage().subscribe({
          next: (r) => {
            this.resources.set(r);
            this.lastRefreshed.set(new Date());
            this.resourcesLoading.set(false);
          },
          error: () => this.resourcesLoading.set(false),
        });
      });
  }

  // ── Grid events ───────────────────────────────────────────────────────────
  onProcessGridReady(e: GridReadyEvent): void {
    this.processGridApi = e.api;
  }

  onServiceGridReady(e: GridReadyEvent): void {
    this.serviceGridApi = e.api;
  }

  onProcessSelectionChanged(e: SelectionChangedEvent): void {
    const rows = e.api.getSelectedRows() as ProcessInfo[];
    this.selectedProcess.set(rows[0] ?? null);
  }

  onServiceSelectionChanged(e: SelectionChangedEvent): void {
    const rows = e.api.getSelectedRows() as ServiceInfo[];
    this.selectedService.set(rows[0] ?? null);
  }

  // ── Actions ───────────────────────────────────────────────────────────────
  goBack(): void {
    this.router.navigate(['/connections', this.id()]);
  }

  refreshAll(): void {
    this.loadProcesses();
    this.loadServices();
    this.loadLogs();
    this.resourcesLoading.set(true);
    this.monitorService.getResourceUsage().subscribe({
      next: (r) => {
        this.resources.set(r);
        this.lastRefreshed.set(new Date());
        this.resourcesLoading.set(false);
      },
      error: () => this.resourcesLoading.set(false),
    });
  }

  loadProcesses(): void {
    this.processesLoading.set(true);
    this.monitorService.getProcesses().subscribe({
      next: (p) => { this.processes.set(p); this.processesLoading.set(false); },
      error: () => this.processesLoading.set(false),
    });
  }

  loadServices(): void {
    this.servicesLoading.set(true);
    this.monitorService.getServices().subscribe({
      next: (s) => { this.services.set(s); this.servicesLoading.set(false); },
      error: () => this.servicesLoading.set(false),
    });
  }

  loadLogs(): void {
    this.logsLoading.set(true);
    this.monitorService.getLogs().subscribe({
      next: (l) => { this.logs.set(l); this.logsLoading.set(false); },
      error: () => this.logsLoading.set(false),
    });
  }

  confirmKill(): void {
    if (!this.selectedProcess()) return;
    this.killLoading.set(true);
    this.monitorService.killProcess(this.selectedProcess()!.pid).subscribe({
      next: () => {
        this.killLoading.set(false);
        this.killDialogVisible.set(false);
        this.selectedProcess.set(null);
        this.msg.add({ severity: 'success', summary: 'Process killed' });
        this.loadProcesses();
      },
      error: (err: { error?: { message?: string } }) => {
        this.killLoading.set(false);
        this.msg.add({ severity: 'error', summary: 'Error', detail: err.error?.message ?? 'Kill failed' });
      },
    });
  }

  controlService(action: 'start' | 'stop' | 'restart'): void {
    if (!this.selectedService() || this.serviceActionLoading()) return;
    this.serviceActionLoading.set(true);
    const unit = this.selectedService()!.unit;
    this.monitorService.controlService(unit, action).subscribe({
      next: () => {
        this.serviceActionLoading.set(false);
        this.msg.add({ severity: 'success', summary: `Service ${action}ed`, detail: unit });
        this.loadServices();
      },
      error: (err: { error?: { message?: string } }) => {
        this.serviceActionLoading.set(false);
        this.msg.add({ severity: 'error', summary: 'Error', detail: err.error?.message ?? `Failed to ${action} service` });
      },
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  progressClass(pct: number): string {
    if (pct >= 80) return 'prog-danger';
    if (pct >= 60) return 'prog-warn';
    return 'prog-ok';
  }

  formatBytes(bytes: number, decimals = 1): string {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
  }

  isErrorLine(line: string): boolean {
    return /\b(error|err|critical|crit|emerg|alert)\b/i.test(line);
  }

  isWarnLine(line: string): boolean {
    return /\b(warn|warning)\b/i.test(line);
  }
}
