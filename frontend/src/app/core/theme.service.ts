import { effect, Injectable, signal } from '@angular/core';

const STORAGE_KEY = 'server-manager-theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  // Default to dark mode — suits a server management tool
  readonly isDark = signal<boolean>(this.loadPreference());

  constructor() {
    // Apply theme on every change and persist to localStorage
    effect(() => {
      const dark = this.isDark();
      if (dark) {
        document.documentElement.classList.add('dark-mode');
      } else {
        document.documentElement.classList.remove('dark-mode');
      }
      localStorage.setItem(STORAGE_KEY, dark ? 'dark' : 'light');
    });
  }

  toggle(): void {
    this.isDark.update((v) => !v);
  }

  private loadPreference(): boolean {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return stored === 'dark';
    // Fall back to OS preference, default dark if unset
    return window.matchMedia('(prefers-color-scheme: dark)').matches ?? true;
  }
}
