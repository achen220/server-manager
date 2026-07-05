import { AsyncPipe } from '@angular/common';
import { Component, inject, input, OnInit, signal } from '@angular/core';
import { AgGridAngular } from 'ag-grid-angular';
import { GridApi, GridReadyEvent, themeBalham } from 'ag-grid-community';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { forkJoin, Observable, of, switchMap } from 'rxjs';
import { ServerService } from './server.service';
import { ServerGridService } from './services/server-grid.service';

export interface ServerManager {
  sshUsers?: ActiveSSHInfo[];
}

export interface ActiveSSHInfo {
  username: string;
  type: string;
  terminal: string | Date;
  login: string | Date | any;
  ip: string | null;
}

@Component({
  selector: 'app-server-manager',
  standalone: true,
  imports: [AgGridAngular, AsyncPipe, ButtonModule, DialogModule],

  template: `
    <div id="ssh-grid-wrapper">
      @if (serverManager$ | async; as managerData) {
        <button pButton type="button" (click)="this.dialogVisible.set(true)">
          Add User
        </button>
        <ag-grid-angular
          [theme]="theme"
          style="width: 100%; height:300px"
          [columnDefs]="serverGridService.activeSshUserColDef"
          [rowData]="managerData.sshUsers"
          [gridOptions]="serverGridService.activeSshUserGridOptions"
          (gridReady)="onGridReady($event)"
        ></ag-grid-angular>
      }
    </div>
    <p-dialog
      [visible]="dialogVisible()"
      (visibleChange)="dialogVisible.set($event)"
      header="Add User"
      [modal]="true"
    >
      <!-- dialog content -->
    </p-dialog>
  `,
  styles: `
    #ssh-grid-wrapper {
      max-width: 50%;
    }
  `,
})
export class ServerManagerComponent implements OnInit {
  private serverService = inject(ServerService);

  private gridApi!: GridApi;

  public serverGridService = inject(ServerGridService);

  id = input<string>();

  dialogVisible = signal<boolean>(false);

  theme = themeBalham;

  activeSshUsers = signal<ActiveSSHInfo[]>([]);

  serverManager$: Observable<ServerManager> = of({});

  ngOnInit(): void {
    const test = this.serverService.initSSH(this.id() as string).pipe(
      switchMap((x) =>
        forkJoin({
          sshUsers: this.serverService.activeSSHUsers(),
        }),
      ),
    );
    this.serverManager$ = this.serverService.initSSH(this.id() as string).pipe(
      switchMap((x) =>
        forkJoin({
          sshUsers: this.serverService.activeSSHUsers(),
        }),
      ),
    );
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
  }
}
