import { Injectable } from '@angular/core';
import { ColDef, GridOptions } from 'ag-grid-community';

@Injectable({
  providedIn: 'root',
})
export class ServerGridService {
  activeSshUserGridOptions: GridOptions = {
    autoSizeStrategy: { type: 'fitCellContents' },
    rowSelection: 'single',
  };

  activeSshUserColDef: ColDef[] = [
    {
      field: 'username',
      headerName: 'Username',
      flex: 1,
      filter: 'agTextColumnFilter',
      sortable: true,
    },
    { field: 'uid', headerName: 'UID', width: 80 },
    { field: 'gid', headerName: 'GID', width: 80 },
    { field: 'home', headerName: 'Home', flex: 1 },
    { field: 'shell', headerName: 'Shell', flex: 1 },
    { field: 'isActive', headerName: 'Online', width: 90, sortable: true },
    { field: 'lastLogin', headerName: 'Last Login', flex: 1, sortable: true },
    { field: 'hasValidShell', headerName: 'Valid Shell', width: 110, sortable: true },
    { field: 'isAdmin', headerName: 'Admin', width: 90, sortable: true },
  ];

  groupsGridOptions: GridOptions = {
    autoSizeStrategy: { type: 'fitCellContents' },
    rowSelection: 'single',
  };

  groupsColDef: ColDef[] = [
    {
      field: 'name',
      headerName: 'Group',
      flex: 1,
      sortable: true,
      filter: 'agTextColumnFilter',
    },
    { field: 'gid', headerName: 'GID', width: 90 },
    {
      headerName: 'Members',
      flex: 2,
      valueGetter: (p) => (p.data?.members as string[])?.join(', ') ?? '',
    },
    {
      headerName: 'Count',
      width: 80,
      sortable: true,
      valueGetter: (p) => (p.data?.members as string[])?.length ?? 0,
    },
  ];
}
