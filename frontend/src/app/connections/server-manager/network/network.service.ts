import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  DnsConfig,
  FirewallStatus,
  NetworkInterface,
  PortInfo,
} from './network.component';

@Injectable({ providedIn: 'root' })
export class NetworkService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/network`;

  getInterfaces(): Observable<NetworkInterface[]> {
    return this.http.get<NetworkInterface[]>(`${this.base}/interfaces`);
  }

  getPorts(): Observable<PortInfo[]> {
    return this.http.get<PortInfo[]>(`${this.base}/ports`);
  }

  getFirewallRules(): Observable<FirewallStatus> {
    return this.http.get<FirewallStatus>(`${this.base}/firewall`);
  }

  addFirewallRule(
    rule: string,
    action: 'allow' | 'deny',
  ): Observable<{ success: boolean }> {
    return this.http.post<{ success: boolean }>(`${this.base}/firewall`, {
      rule,
      action,
    });
  }

  deleteFirewallRule(num: number): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(
      `${this.base}/firewall/${num}`,
    );
  }

  getDnsConfig(): Observable<DnsConfig> {
    return this.http.get<DnsConfig>(`${this.base}/dns`);
  }
}
