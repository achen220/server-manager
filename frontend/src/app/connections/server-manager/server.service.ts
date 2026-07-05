import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ActiveSSHInfo, GroupInfo } from './server.manager.component';

@Injectable({ providedIn: 'root' })
export class ServerService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/server`;

  initSSH(id: string) {
    return this.http.post(`${this.base}/ssh-connection`, { id });
  }

  activeSSHUsers(): Observable<ActiveSSHInfo[]> {
    return this.http.get<ActiveSSHInfo[]>(`${this.base}/ssh-users`);
  }

  addSshUser(body: {
    username: string;
    password: string;
    isAdmin: boolean;
  }): Observable<{ success: boolean; username: string }> {
    return this.http.post<{ success: boolean; username: string }>(
      `${this.base}/add-ssh-user`,
      body,
    );
  }

  deleteUser(username: string): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(
      `${this.base}/ssh-user/${encodeURIComponent(username)}`,
    );
  }

  toggleAdmin(
    username: string,
    grant: boolean,
  ): Observable<{ success: boolean }> {
    return this.http.post<{ success: boolean }>(`${this.base}/toggle-admin`, {
      username,
      grant,
    });
  }

  getAuthorizedKeys(username: string): Observable<string[]> {
    return this.http.get<string[]>(
      `${this.base}/authorized-keys/${encodeURIComponent(username)}`,
    );
  }

  addAuthorizedKey(
    username: string,
    publicKey: string,
  ): Observable<{ success: boolean }> {
    return this.http.post<{ success: boolean }>(
      `${this.base}/authorized-keys/${encodeURIComponent(username)}`,
      { publicKey },
    );
  }

  removeAuthorizedKey(
    username: string,
    keyIndex: number,
  ): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(
      `${this.base}/authorized-keys/${encodeURIComponent(username)}/${keyIndex}`,
    );
  }

  getGroups(): Observable<GroupInfo[]> {
    return this.http.get<GroupInfo[]>(`${this.base}/groups`);
  }

  createGroup(groupName: string): Observable<{ success: boolean }> {
    return this.http.post<{ success: boolean }>(`${this.base}/groups`, {
      groupName,
    });
  }

  deleteGroup(groupName: string): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(
      `${this.base}/groups/${encodeURIComponent(groupName)}`,
    );
  }

  assignUserToGroup(
    username: string,
    groupName: string,
    add: boolean,
  ): Observable<{ success: boolean }> {
    return this.http.post<{ success: boolean }>(`${this.base}/groups/assign`, {
      username,
      groupName,
      add,
    });
  }
}
