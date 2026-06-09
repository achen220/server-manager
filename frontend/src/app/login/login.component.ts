import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { MessageModule } from 'primeng/message';
import { SupabaseService } from '../core/supabase.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, CardModule, ButtonModule, MessageModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  loading = false;
  errorMessage = '';

  private readonly supabase = inject(SupabaseService);

  async signInWithGoogle(): Promise<void> {
    this.loading = true;
    this.errorMessage = '';
    const { error } = await this.supabase.signInWithGoogle();
    if (error) {
      this.errorMessage = error;
      this.loading = false;
    }
    // On success Supabase redirects to Google — loading stays true
  }
}
