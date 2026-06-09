import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { from, switchMap } from 'rxjs';
import { SupabaseService } from './supabase.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  return from(inject(SupabaseService).getSession()).pipe(
    switchMap((session) => {
      if (session?.access_token) {
        req = req.clone({
          setHeaders: { Authorization: `Bearer ${session.access_token}` },
        });
      }
      return next(req);
    })
  );
};
