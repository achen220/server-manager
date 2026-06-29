import { Injectable } from '@angular/core';
import { ColDef } from 'ag-grid-community';

@Injectable({
  providedIn: 'root',
})
export class ServerGridService {
  activeSshUserColDef: ColDef[] = [
    {
      field: 'username',
      headerName: 'Username',
      flex: 1,
      minWidth: 120,
      filter: 'agTextColumnFilter',
      sortable: true,
    },
    {
      field: 'type',
      headerName: 'Type',
      width: 100,
      filter: 'agTextColumnFilter',
      sortable: true,
    },
    {
      field: 'terminal',
      headerName: 'Terminal',
      flex: 1,
      minWidth: 140,
      sortable: true,
      filter: 'agTextColumnFilter',
      valueFormatter: ({ value }) =>
        value instanceof Date ? value.toLocaleString() : (value ?? '—'),
    },
    {
      field: 'login',
      headerName: 'Login',
      flex: 1,
      minWidth: 160,
      sortable: true,
      filter: 'agDateColumnFilter',
      valueFormatter: ({ value }) => {
        if (value instanceof Date) return value.toLocaleString();
        if (typeof value === 'string') return value;
        return value ? String(value) : '—';
      },
    },
    {
      field: 'ip',
      headerName: 'IP Address',
      width: 150,
      filter: 'agTextColumnFilter',
      sortable: true,
      valueFormatter: ({ value }) => value ?? '—',
      cellStyle: { fontFamily: 'monospace' },
    },
  ];
}
