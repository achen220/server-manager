import { Component, OnInit, inject, signal } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { SupabaseService } from '../core/supabase.service';
import { ThemeService } from '../core/theme.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterModule, ButtonModule],
  template: `
    <header class="app-header">
      <div class="header-brand">
        <i class="pi pi-server header-logo"></i>
        <span class="header-title">Server Manager</span>
      </div>

      <nav class="header-nav">
        <a routerLink="/connections" routerLinkActive="nav-active" class="nav-link">
          <i class="pi pi-list"></i>
          Connections
        </a>
      </nav>

      <div class="header-actions">
        <button
          class="icon-btn"
          [title]="theme.isDark() ? 'Switch to light mode' : 'Switch to dark mode'"
          (click)="theme.toggle()"
        >
          <i [class]="theme.isDark() ? 'pi pi-sun' : 'pi pi-moon'"></i>
        </button>

        @if (userEmail()) {
          <span class="user-email" [title]="userEmail()!">{{ userEmail() }}</span>
          <p-button
            label="Sign Out"
            icon="pi pi-sign-out"
            severity="secondary"
            size="small"
            (onClick)="signOut()"
          />
        }
      </div>
    </header>
  `,
  styles: `
    .app-header {
      display: flex;
      align-items: center;
      padding: 0 1.5rem;
      height: 3.5rem;
      background: var(--p-surface-card);
      border-bottom: 1px solid var(--p-surface-border);
      gap: 1.5rem;
      position: sticky;
      top: 0;
      z-index: 100;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
    }

    .header-brand {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-shrink: 0;
    }

    .header-logo {
      font-size: 1.25rem;
      color: var(--p-primary-color);
    }

    .header-title {
      font-size: 1rem;
      font-weight: 700;
      white-space: nowrap;
      color: var(--p-text-color);
      letter-spacing: -0.01em;
    }

    .header-nav {
      display: flex;
      gap: 0.25rem;
      flex: 1;
    }

    .nav-link {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      padding: 0.375rem 0.75rem;
      border-radius: 0.375rem;
      text-decoration: none;
      color: var(--p-text-muted-color);
      font-size: 0.875rem;
      font-weight: 500;
      transition:
        background 0.15s,
        color 0.15s;

      &:hover {
        background: var(--p-surface-hover);
        color: var(--p-text-color);
      }
    }

    .nav-active {
      background: color-mix(in srgb, var(--p-primary-color) 12%, transparent);
      color: var(--p-primary-color);
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-left: auto;
    }

    .icon-btn {
      width: 2rem;
      height: 2rem;
      border-radius: 50%;
      border: 1px solid var(--p-surface-border);
      background: transparent;
      color: var(--p-text-color);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.875rem;
      transition: background 0.15s;
      flex-shrink: 0;

      &:hover {
        background: var(--p-surface-hover);
      }
    }

    .user-email {
      font-size: 0.8125rem;
      color: var(--p-text-muted-color);
      max-width: 14rem;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  `,
})
export class HeaderComponent implements OnInit {
  readonly theme = inject(ThemeService);
  private readonly supabase = inject(SupabaseService);
  private readonly router = inject(Router);

  userEmail = signal<string | null>(null);

  async ngOnInit() {
    const session = await this.supabase.getSession();
    this.userEmail.set(session?.user.email ?? null);
  }

  async signOut() {
    await this.supabase.signOut();
    this.router.navigate(['/login']);
  }
}
