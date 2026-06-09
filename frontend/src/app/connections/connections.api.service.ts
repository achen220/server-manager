import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Connection, CreateConnectionRequest } from './connection.model';

@Injectable({ providedIn: 'root' })
export class ConnectionsApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/connections`;

  getAll(): Observable<Connection[]> {
    return this.http.get<Connection[]>(this.base);
  }

  create(body: CreateConnectionRequest): Observable<Connection> {
    return this.http.post<Connection>(this.base, body);
  }

  update(id: string, body: CreateConnectionRequest): Observable<Connection> {
    return this.http.put<Connection>(`${this.base}/${id}`, body);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
