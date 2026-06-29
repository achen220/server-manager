import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ActiveSSHInfo } from './server.manager.component';

@Injectable({ providedIn: 'root' })
export class ServerService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/server`;

  initSSH(id: string) {
    // const { host, username, password, port } = connectionInfo;
    // TODO: make subscription in component not service
    return this.http.post(`${this.base}/ssh-connection`, { id });
  }

  activeSSHUsers(): Observable<ActiveSSHInfo[]> {
    return this.http.get<ActiveSSHInfo[]>(`${this.base}/ssh-users`);
  }
}
