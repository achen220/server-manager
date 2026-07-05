import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  ProcessInfo,
  ResourceUsage,
  ServiceInfo,
  SystemOverview,
} from './monitor.component';

@Injectable({ providedIn: 'root' })
export class MonitorService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/monitor`;

  getSystemOverview(): Observable<SystemOverview> {
    return this.http.get<SystemOverview>(`${this.base}/overview`);
  }

  getResourceUsage(): Observable<ResourceUsage> {
    return this.http.get<ResourceUsage>(`${this.base}/resources`);
  }

  getProcesses(): Observable<ProcessInfo[]> {
    return this.http.get<ProcessInfo[]>(`${this.base}/processes`);
  }

  killProcess(pid: number): Observable<{ success: boolean }> {
    return this.http.post<{ success: boolean }>(
      `${this.base}/processes/kill`,
      { pid },
    );
  }

  getServices(): Observable<ServiceInfo[]> {
    return this.http.get<ServiceInfo[]>(`${this.base}/services`);
  }

  controlService(
    name: string,
    action: string,
  ): Observable<{ success: boolean }> {
    return this.http.post<{ success: boolean }>(
      `${this.base}/services/${encodeURIComponent(name)}/${action}`,
      {},
    );
  }

  getLogs(lines = 200): Observable<string[]> {
    return this.http.get<string[]>(`${this.base}/logs`, {
      params: { lines },
    });
  }
}
