import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { EmailTemplate } from '../models/template.model';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class TemplatesService {
  constructor(private http: HttpClient) {}

  list(): Observable<EmailTemplate[]> {
    return this.http.get<EmailTemplate[]>(`${environment.apiBase}/api/templates`);
  }

  get(id: string): Observable<EmailTemplate> {
    return this.http.get<EmailTemplate>(`${environment.apiBase}/api/templates/${id}`);
  }

  create(template: EmailTemplate): Observable<EmailTemplate> {
    return this.http.post<EmailTemplate>(`${environment.apiBase}/api/templates`, template);
  }

  update(id: string, patch: Partial<EmailTemplate>): Observable<EmailTemplate> {
    return this.http.put<EmailTemplate>(`${environment.apiBase}/api/templates/${id}`, patch);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${environment.apiBase}/api/templates/${id}`);
  }
}
