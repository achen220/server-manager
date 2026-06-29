import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community';
import { providePrimeNG } from 'primeng/config';
import { appRoutes } from './app.routes';
import { authInterceptor } from './core/auth.interceptor';

// Sky-blue primary + deep-slate dark surfaces
const AppTheme = definePreset(Aura, {
  semantic: {
    primary: {
      50: '#f0f9ff',
      100: '#e0f2fe',
      200: '#bae6fd',
      300: '#7dd3fc',
      400: '#38bdf8',
      500: '#0ea5e9',
      600: '#0284c7',
      700: '#0369a1',
      800: '#075985',
      900: '#0c4a6e',
      950: '#082f49',
    },
    colorScheme: {
      light: {
        surface: {
          ground: '{surface.50}',
          section: '{surface.0}',
          card: '{surface.0}',
          overlay: '{surface.0}',
          border: '{surface.200}',
          hover: '{surface.100}',
        },
      },
      dark: {
        surface: {
          ground: '#0f172a',
          section: '#1e293b',
          card: '#1e293b',
          overlay: '#1e293b',
          border: '#334155',
          hover: '#334155',
        },
      },
    },
  },
});

ModuleRegistry.registerModules([AllCommunityModule]);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),

    provideRouter(appRoutes, withComponentInputBinding()),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideAnimationsAsync(),
    providePrimeNG({
      theme: {
        preset: AppTheme,
        options: { darkModeSelector: '.dark-mode' },
      },
    }),
  ],
};
