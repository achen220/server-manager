import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SupabaseService } from './supabase.service';

export const authGuard: CanActivateFn = async () => {
  const session = await inject(SupabaseService).getSession();
  if (session) return true;
  inject(Router).navigate(['/login']);
  return false;
};
