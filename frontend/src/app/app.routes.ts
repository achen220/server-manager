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
  },

  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: '**', redirectTo: 'login' },
];
