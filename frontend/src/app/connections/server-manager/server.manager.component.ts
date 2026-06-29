import { AsyncPipe } from '@angular/common';
import { Component, inject, input, OnInit, signal } from '@angular/core';
import { AgGridAngular } from 'ag-grid-angular';
import { GridApi, GridReadyEvent, themeBalham } from 'ag-grid-community';
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
  imports: [AgGridAngular, AsyncPipe],

  template: `
    @if (serverManager$ | async; as managerData) {
      <ag-grid-angular
        [theme]="theme"
        style="width: 750px; height:300px"
        [columnDefs]="serverGridService.activeSshUserColDef"
        [rowData]="managerData.sshUsers"
        (gridReady)="onGridReady($event)"
      ></ag-grid-angular>
    }
  `,
  styles: ``,
})
export class ServerManagerComponent implements OnInit {
  private serverService = inject(ServerService);

  private gridApi!: GridApi;

  public serverGridService = inject(ServerGridService);

  id = input<string>();

  // activeSshUsers = computed<ActiveSSHInfo[]>(() => {
  //   const { sshUsers } = this.initServer();
  //   return sshUsers ?? [];
  // });

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

    // serverManager$.subscribe((val) => {
    //   this.initServer.set(val.sshUsers);
    //   this.gridApi?.setGridOption('rowData', this.activeSshUsers());
    //   console.log({ val });
    // });
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
  }
}
