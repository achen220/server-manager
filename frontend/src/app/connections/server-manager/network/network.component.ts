import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  inject,
  input,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
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
import { SelectButtonModule } from 'primeng/selectbutton';
import { SkeletonModule } from 'primeng/skeleton';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { Subject, forkJoin } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { switchMap } from 'rxjs/operators';
import { ServerService } from '../server.service';
import { NetworkService } from './network.service';

// ── Interfaces ────────────────────────────────────────────────────────────
export interface NetworkInterface {
  name: string;
  index: number;
  state: 'up' | 'down' | 'unknown';
  mac: string;
  mtu: number;
  flags: string[];
  addresses: { family: string; address: string; prefix: number; broadcast?: string }[];
}

export interface PortInfo {
  protocol: string;
  state: string;
  address: string;
  port: number;
  process: string;
  pid: number;
}

export interface FirewallStatus {
  active: boolean;
  rules: FirewallRule[];
}

export interface FirewallRule {
  num: number;
  to: string;
  action: string;
  from: string;
}

export interface DnsConfig {
  nameservers: string[];
  search: string[];
  raw: string;
}

@Component({
  selector: 'app-network',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [MessageService],
  imports: [
    FormsModule,
    AgGridAngular,
    ButtonModule,
    CardModule,
    DialogModule,
    InputTextModule,
    SelectButtonModule,
    SkeletonModule,
    TagModule,
    ToastModule,
  ],
  template: `
    <p-toast />

    <div class="network-page">
      <!-- Header -->
      <div class="page-header">
        <p-button icon="pi pi-arrow-left" severity="secondary" [text]="true" size="small" (onClick)="goBack()" />
        <span class="page-title"><i class="pi pi-wifi"></i> Network</span>
        <p-button icon="pi pi-refresh" label="Refresh" severity="secondary" size="small" [loading]="loading()" (onClick)="loadAll()" />
      </div>

      @if (loadError()) {
        <div class="error-banner"><i class="pi pi-exclamation-triangle"></i> {{ loadError() }}</div>
      } @else if (initialLoading()) {
        <div class="skeleton-grid">
          @for (_ of [1,2,3]; track $index) {
            <p-card><p-skeleton width="100%" height="5rem" /></p-card>
          }
        </div>
      } @else {
        <!-- Tabs -->
        <div class="tabs-section">
          <div class="tab-bar">
            <button class="tab-btn" [class.active]="tab() === 'interfaces'" (click)="tab.set('interfaces')">
              <i class="pi pi-sitemap"></i> Interfaces
            </button>
            <button class="tab-btn" [class.active]="tab() === 'ports'" (click)="tab.set('ports')">
              <i class="pi pi-link"></i> Open Ports
            </button>
            <button class="tab-btn" [class.active]="tab() === 'firewall'" (click)="tab.set('firewall')">
              <i class="pi pi-shield"></i> Firewall
            </button>
            <button class="tab-btn" [class.active]="tab() === 'dns'" (click)="tab.set('dns')">
              <i class="pi pi-globe"></i> DNS
            </button>
          </div>

          <!-- Interfaces tab -->
          @if (tab() === 'interfaces') {
            <div class="ifaces-list">
              @if (interfaces().length === 0) {
                <p class="empty-text">No interfaces found.</p>
              }
              @for (iface of interfaces(); track iface.name) {
                <div class="iface-card">
                  <div class="iface-header">
                    <div class="iface-name">
                      <span class="dot" [class.up]="iface.state === 'up'"></span>
                      <strong>{{ iface.name }}</strong>
                      <span class="iface-state">{{ iface.state }}</span>
                    </div>
                    <div class="iface-meta">
                      <span class="badge">{{ iface.mac || 'no MAC' }}</span>
                      <span class="badge">MTU {{ iface.mtu }}</span>
                    </div>
                  </div>
                  <div class="iface-addrs">
                    @for (addr of iface.addresses; track addr.address) {
                      <div class="addr-row">
                        <span class="addr-family">{{ addr.family }}</span>
                        <code>{{ addr.address }}/{{ addr.prefix }}</code>
                        @if (addr.broadcast) {
                          <span class="addr-brd">brd {{ addr.broadcast }}</span>
                        }
                      </div>
                    }
                    @if (iface.addresses.length === 0) {
                      <span class="addr-none">No addresses assigned</span>
                    }
                  </div>
                </div>
              }
            </div>
          }

          <!-- Ports tab -->
          @if (tab() === 'ports') {
            <ag-grid-angular
              [theme]="theme"
              style="width:100%; height:420px"
              [columnDefs]="portColDefs"
              [rowData]="ports()"
              [gridOptions]="{ autoSizeStrategy: { type: 'fitCellContents' } }"
            />
          }

          <!-- Firewall tab -->
          @if (tab() === 'firewall') {
            <div class="fw-toolbar">
              @if (!firewall()?.active) {
                <span class="fw-inactive"><i class="pi pi-exclamation-circle"></i> UFW is inactive or unavailable on this server.</span>
              } @else {
                <span class="fw-active"><i class="pi pi-shield"></i> UFW active — {{ firewall()!.rules.length }} rules</span>
              }
              <p-button label="Add Rule" icon="pi pi-plus" size="small" (onClick)="addRuleDialogVisible.set(true)" />
              @if (selectedRule()) {
                <span class="toolbar-sep"></span>
                <span class="selected-label">Rule #{{ selectedRule()!.num }}</span>
                <p-button label="Delete Rule" icon="pi pi-trash" severity="danger" size="small" [loading]="deleteRuleLoading()" (onClick)="confirmDeleteRule()" />
              }
            </div>
            <ag-grid-angular
              [theme]="theme"
              style="width:100%; height:360px"
              [columnDefs]="firewallColDefs"
              [rowData]="firewall()?.rules ?? []"
              [gridOptions]="{ autoSizeStrategy: { type: 'fitCellContents' }, rowSelection: 'single' }"
              (gridReady)="onFwGridReady($event)"
              (selectionChanged)="onFwSelectionChanged($event)"
            />
          }

          <!-- DNS tab -->
          @if (tab() === 'dns') {
            <div class="dns-panel">
              <div class="dns-section">
                <h3 class="dns-heading">Nameservers</h3>
                @if (dns()?.nameservers?.length === 0) {
                  <p class="empty-text">None configured.</p>
                }
                @for (ns of dns()?.nameservers ?? []; track ns) {
                  <div class="ns-row">
                    <i class="pi pi-server"></i>
                    <code>{{ ns }}</code>
                  </div>
                }
              </div>
              @if ((dns()?.search ?? []).length > 0) {
                <div class="dns-section">
                  <h3 class="dns-heading">Search Domains</h3>
                  @for (s of dns()?.search ?? []; track s) {
                    <div class="ns-row"><i class="pi pi-globe"></i> <code>{{ s }}</code></div>
                  }
                </div>
              }
              <div class="dns-section">
                <h3 class="dns-heading">Raw /etc/resolv.conf</h3>
                <pre class="dns-raw">{{ dns()?.raw }}</pre>
              </div>
            </div>
          }
        </div>
      }
    </div>

    <!-- Add Firewall Rule Dialog -->
    <p-dialog
      [visible]="addRuleDialogVisible()"
      (visibleChange)="addRuleDialogVisible.set($event)"
      header="Add Firewall Rule"
      [modal]="true"
      [style]="{ width: '26rem' }"
      [draggable]="false"
    >
      <div class="add-rule-form">
        <div class="field">
          <label>Rule <span class="hint">(e.g. 22/tcp, 80, 443/tcp)</span></label>
          <input pInputText [(ngModel)]="newRule" placeholder="22/tcp" class="w-full" />
        </div>
        <div class="field">
          <label>Action</label>
          <p-selectbutton
            [options]="actionOptions"
            [(ngModel)]="newRuleAction"
            optionLabel="label"
            optionValue="value"
          />
        </div>
        <div class="dialog-footer">
          <p-button label="Cancel" severity="secondary" (onClick)="addRuleDialogVisible.set(false)" />
          <p-button
            label="Add Rule"
            icon="pi pi-plus"
            [loading]="addRuleLoading()"
            [disabled]="!newRule.trim()"
            (onClick)="submitAddRule()"
          />
        </div>
      </div>
    </p-dialog>
  `,
  styles: `
    .network-page { padding: 1.5rem; display: flex; flex-direction: column; gap: 1.25rem; }

    .page-header {
      display: flex; align-items: center; gap: 0.75rem;
    }
    .page-title {
      font-size: 1rem; font-weight: 700; display: flex; align-items: center; gap: 0.375rem; flex: 1;
    }

    .error-banner {
      padding: 1rem 1.25rem;
      background: color-mix(in srgb, var(--p-red-500) 12%, transparent);
      border: 1px solid color-mix(in srgb, var(--p-red-500) 30%, transparent);
      border-radius: 0.5rem; color: var(--p-red-400);
      display: flex; align-items: center; gap: 0.5rem;
    }

    .skeleton-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem; }

    /* Tabs */
    .tabs-section {
      border: 1px solid var(--p-surface-border); border-radius: 0.5rem; overflow: hidden;
    }
    .tab-bar {
      display: flex; background: var(--p-surface-ground);
      border-bottom: 1px solid var(--p-surface-border);
    }
    .tab-btn {
      padding: 0.625rem 1.25rem; border: none; background: transparent;
      color: var(--p-text-muted-color); font-size: 0.875rem; font-weight: 500;
      cursor: pointer; display: flex; align-items: center; gap: 0.375rem;
      border-bottom: 2px solid transparent; margin-bottom: -1px;
      transition: background 0.15s, color 0.15s;
      &:hover { background: var(--p-surface-hover); color: var(--p-text-color); }
      &.active { color: var(--p-primary-color); border-bottom-color: var(--p-primary-color); background: var(--p-surface-card); }
    }

    /* Interfaces */
    .ifaces-list { padding: 1rem; display: flex; flex-direction: column; gap: 0.75rem; }
    .iface-card {
      border: 1px solid var(--p-surface-border); border-radius: 0.5rem;
      overflow: hidden;
    }
    .iface-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 0.625rem 1rem; background: var(--p-surface-ground);
      gap: 1rem; flex-wrap: wrap;
    }
    .iface-name { display: flex; align-items: center; gap: 0.5rem; font-size: 0.9375rem; }
    .dot {
      width: 8px; height: 8px; border-radius: 50%;
      background: var(--p-text-muted-color);
      &.up { background: var(--p-green-500); }
    }
    .iface-state { font-size: 0.75rem; color: var(--p-text-muted-color); }
    .iface-meta { display: flex; gap: 0.375rem; flex-wrap: wrap; }
    .badge {
      font-size: 0.6875rem; padding: 0.1rem 0.4rem;
      background: var(--p-surface-hover); border-radius: 0.25rem;
      font-family: monospace; color: var(--p-text-muted-color);
    }
    .iface-addrs { padding: 0.5rem 1rem; display: flex; flex-direction: column; gap: 0.25rem; }
    .addr-row { display: flex; align-items: center; gap: 0.625rem; font-size: 0.8125rem; }
    .addr-family {
      width: 3.5rem; text-align: right; font-size: 0.6875rem; font-weight: 600;
      text-transform: uppercase; color: var(--p-primary-color);
    }
    .addr-brd { color: var(--p-text-muted-color); font-size: 0.75rem; }
    .addr-none { font-size: 0.8125rem; color: var(--p-text-muted-color); }

    /* Firewall toolbar */
    .fw-toolbar {
      display: flex; align-items: center; gap: 0.5rem; padding: 0.625rem 1rem;
      background: var(--p-surface-card); border-bottom: 1px solid var(--p-surface-border);
      flex-wrap: wrap;
    }
    .fw-inactive { color: var(--p-yellow-400); font-size: 0.875rem; display: flex; align-items: center; gap: 0.375rem; }
    .fw-active { color: var(--p-green-500); font-size: 0.875rem; display: flex; align-items: center; gap: 0.375rem; }
    .toolbar-sep { width: 1px; height: 1.5rem; background: var(--p-surface-border); }
    .selected-label { font-size: 0.8125rem; font-weight: 600; color: var(--p-primary-color); }

    /* DNS */
    .dns-panel { padding: 1.25rem; display: flex; flex-direction: column; gap: 1.25rem; }
    .dns-section { display: flex; flex-direction: column; gap: 0.5rem; }
    .dns-heading { font-size: 0.875rem; font-weight: 600; margin: 0; color: var(--p-text-muted-color); text-transform: uppercase; letter-spacing: 0.05em; }
    .ns-row { display: flex; align-items: center; gap: 0.5rem; font-size: 0.875rem; }
    .dns-raw {
      background: var(--p-surface-ground); border: 1px solid var(--p-surface-border);
      border-radius: 0.375rem; padding: 0.75rem; font-size: 0.75rem;
      font-family: monospace; white-space: pre-wrap; margin: 0;
      color: var(--p-text-color); max-height: 300px; overflow-y: auto;
    }

    /* Add rule form */
    .add-rule-form { display: flex; flex-direction: column; gap: 1rem; padding-top: 0.5rem; }
    .field { display: flex; flex-direction: column; gap: 0.375rem; }
    label { font-size: 0.875rem; font-weight: 500; }
    .hint { font-size: 0.75rem; font-weight: 400; color: var(--p-text-muted-color); }
    .dialog-footer { display: flex; justify-content: flex-end; gap: 0.5rem; padding-top: 0.5rem; }

    .empty-text { color: var(--p-text-muted-color); font-size: 0.875rem; padding: 1rem; margin: 0; }
  `,
})
export class NetworkComponent implements OnInit, OnDestroy {
  private readonly networkService = inject(NetworkService);
  private readonly serverService = inject(ServerService);
  private readonly router = inject(Router);
  private readonly msg = inject(MessageService);

  id = input<string>();

  // Data
  interfaces = signal<NetworkInterface[]>([]);
  ports = signal<PortInfo[]>([]);
  firewall = signal<FirewallStatus | null>(null);
  dns = signal<DnsConfig | null>(null);

  // UI state
  initialLoading = signal(true);
  loading = signal(false);
  loadError = signal<string | null>(null);
  tab = signal<'interfaces' | 'ports' | 'firewall' | 'dns'>('interfaces');

  // Firewall actions
  selectedRule = signal<FirewallRule | null>(null);
  addRuleDialogVisible = signal(false);
  addRuleLoading = signal(false);
  deleteRuleLoading = signal(false);
  newRule = '';
  newRuleAction: 'allow' | 'deny' = 'allow';
  readonly actionOptions = [
    { label: 'Allow', value: 'allow' },
    { label: 'Deny', value: 'deny' },
  ];

  theme = themeBalham;
  private fwGridApi!: GridApi;
  private destroy$ = new Subject<void>();

  portColDefs: ColDef[] = [
    { field: 'protocol', headerName: 'Protocol', width: 90, sortable: true },
    { field: 'state', headerName: 'State', width: 100 },
    { field: 'address', headerName: 'Address', flex: 1 },
    { field: 'port', headerName: 'Port', width: 80, sortable: true, sort: 'asc' },
    { field: 'process', headerName: 'Process', flex: 1 },
    { field: 'pid', headerName: 'PID', width: 80 },
  ];

  firewallColDefs: ColDef[] = [
    { field: 'num', headerName: '#', width: 60 },
    { field: 'to', headerName: 'To / Rule', flex: 1, sortable: true },
    {
      field: 'action',
      headerName: 'Action',
      width: 130,
      cellStyle: (p) => ({
        color: (p.value as string)?.includes('ALLOW')
          ? 'var(--p-green-500)'
          : (p.value as string)?.includes('DENY') || (p.value as string)?.includes('REJECT')
            ? 'var(--p-red-500)'
            : 'var(--p-text-color)',
        fontWeight: '600',
      }),
    },
    { field: 'from', headerName: 'From', flex: 1 },
  ];

  ngOnInit(): void {
    this.serverService
      .initSSH(this.id()!)
      .pipe(
        switchMap(() =>
          forkJoin({
            interfaces: this.networkService.getInterfaces(),
            ports: this.networkService.getPorts(),
            firewall: this.networkService.getFirewallRules(),
            dns: this.networkService.getDnsConfig(),
          }),
        ),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: (data) => {
          this.interfaces.set(data.interfaces);
          this.ports.set(data.ports);
          this.firewall.set(data.firewall);
          this.dns.set(data.dns);
          this.initialLoading.set(false);
        },
        error: (err: { error?: { message?: string } }) => {
          this.initialLoading.set(false);
          this.loadError.set(err.error?.message ?? 'Failed to load network data');
        },
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadAll(): void {
    this.loading.set(true);
    forkJoin({
      interfaces: this.networkService.getInterfaces(),
      ports: this.networkService.getPorts(),
      firewall: this.networkService.getFirewallRules(),
      dns: this.networkService.getDnsConfig(),
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.interfaces.set(data.interfaces);
          this.ports.set(data.ports);
          this.firewall.set(data.firewall);
          this.dns.set(data.dns);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  goBack(): void {
    this.router.navigate(['/connections', this.id()]);
  }

  onFwGridReady(e: GridReadyEvent): void {
    this.fwGridApi = e.api;
  }

  onFwSelectionChanged(e: SelectionChangedEvent): void {
    const rows = e.api.getSelectedRows() as FirewallRule[];
    this.selectedRule.set(rows[0] ?? null);
  }

  submitAddRule(): void {
    if (!this.newRule.trim()) return;
    this.addRuleLoading.set(true);
    this.networkService
      .addFirewallRule(this.newRule.trim(), this.newRuleAction)
      .subscribe({
        next: () => {
          this.addRuleLoading.set(false);
          this.addRuleDialogVisible.set(false);
          this.newRule = '';
          this.msg.add({
            severity: 'success',
            summary: 'Rule added',
            detail: `${this.newRuleAction} ${this.newRule}`,
          });
          this.reloadFirewall();
        },
        error: (err: { error?: { message?: string } }) => {
          this.addRuleLoading.set(false);
          this.msg.add({
            severity: 'error',
            summary: 'Error',
            detail: err.error?.message ?? 'Failed to add rule',
          });
        },
      });
  }

  confirmDeleteRule(): void {
    if (!this.selectedRule()) return;
    this.deleteRuleLoading.set(true);
    this.networkService.deleteFirewallRule(this.selectedRule()!.num).subscribe({
      next: () => {
        this.deleteRuleLoading.set(false);
        this.selectedRule.set(null);
        this.msg.add({ severity: 'success', summary: 'Rule deleted' });
        this.reloadFirewall();
      },
      error: (err: { error?: { message?: string } }) => {
        this.deleteRuleLoading.set(false);
        this.msg.add({
          severity: 'error',
          summary: 'Error',
          detail: err.error?.message ?? 'Failed to delete rule',
        });
      },
    });
  }

  private reloadFirewall(): void {
    this.networkService.getFirewallRules().subscribe({
      next: (fw) => this.firewall.set(fw),
    });
  }
}
