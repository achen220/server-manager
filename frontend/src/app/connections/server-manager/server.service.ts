import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ServerService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/server`;

  initSSH(id: string) {
    // const { host, username, password, port } = connectionInfo;
    // TODO: make subscription in component not service
    this.http.post(`${this.base}/ssh-connection`, { id }).subscribe();
  }
}
