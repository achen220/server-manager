import { Injectable } from '@angular/core';
import { ColDef, GridOptions } from 'ag-grid-community';

@Injectable({
  providedIn: 'root',
})
export class ServerGridService {
  activeSshUserGridOptions: GridOptions = {
    autoSizeStrategy: { type: 'fitCellContents' },
  };

  activeSshUserColDef: ColDef[] = [
    {
      field: 'username',
      headerName: 'Username',
      flex: 1,

      filter: 'agTextColumnFilter',
      sortable: true,
    },
    {
      field: 'uid',
      headerName: 'uid',
    },
    {
      field: 'gid',
      headerName: 'gid',
    },
    {
      field: 'home',
      headerName: 'home',
    },
    {
      field: 'shell',
      headerName: 'shell',
    },
    {
      field: 'isActive',
      headerName: 'isActive',
    },
    {
      field: 'lastLogin',
      headerName: 'Last Login',
      sortable: true,
    },
    {
      field: 'hasValidShell',
      headerName: 'Valid Shell',
      sortable: true,
    },
    {
      field: 'isAdmin',
      headerName: 'Admin',
    },
  ];
}
