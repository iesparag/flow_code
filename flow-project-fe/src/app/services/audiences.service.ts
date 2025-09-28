import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Audience } from '../models/audience.model';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AudiencesService {
  constructor(private http: HttpClient) {}

  list(): Observable<Audience[]> {
    return this.http.get<Audience[]>(`${environment.apiBase}/api/audiences`);
  }

  get(id: string): Observable<Audience> {
    return this.http.get<Audience>(`${environment.apiBase}/api/audiences/${id}`);
  }

  create(audience: Audience): Observable<Audience> {
    return this.http.post<Audience>(`${environment.apiBase}/api/audiences`, audience);
  }

  update(id: string, patch: Partial<Audience>): Observable<Audience> {
    return this.http.put<Audience>(`${environment.apiBase}/api/audiences/${id}`, patch);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${environment.apiBase}/api/audiences/${id}`);
  }
}
