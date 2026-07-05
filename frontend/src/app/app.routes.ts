import { Route } from '@angular/router';
import { authGuard } from './core/auth.guard';

export const appRoutes: Route[] = [
  {
    path: 'login',
    loadComponent: () =>
      import('./login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'connections',
    loadComponent: () =>
      import('./connections/connections.component').then(
        (m) => m.ConnectionsComponent,
      ),
    canActivate: [authGuard],
  },

  {
    path: 'connections/:id',
    loadComponent: () =>
      import('./connections/server-manager/server.manager.component').then(
        (m) => m.ServerManagerComponent,
      ),
    canActivate: [authGuard],
  },

  {
    path: 'connections/:id/terminal',
    loadComponent: () =>
      import('./terminal/terminal.component').then((m) => m.TerminalComponent),
    canActivate: [authGuard],
  },

  {
    path: 'connections/:id/monitor',
    loadComponent: () =>
      import('./connections/server-manager/monitor/monitor.component').then(
        (m) => m.MonitorComponent,
      ),
    canActivate: [authGuard],
  },

  {
    path: 'connections/:id/network',
    loadComponent: () =>
      import('./connections/server-manager/network/network.component').then(
        (m) => m.NetworkComponent,
      ),
    canActivate: [authGuard],
  },

  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: '**', redirectTo: 'login' },
];
