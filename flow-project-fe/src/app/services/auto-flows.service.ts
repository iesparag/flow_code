import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AutomationFlow } from '../models/automation-flow.model';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AutoFlowsService {
  constructor(private http: HttpClient) {}

  list(): Observable<AutomationFlow[]> {
    return this.http.get<AutomationFlow[]>(`${environment.apiBase}/api/auto-flows`);
  }

  get(id: string): Observable<AutomationFlow> {
    return this.http.get<AutomationFlow>(`${environment.apiBase}/api/auto-flows/${id}`);
  }

  create(flow: AutomationFlow): Observable<AutomationFlow> {
    return this.http.post<AutomationFlow>(`${environment.apiBase}/api/auto-flows`, flow);
  }

  update(id: string, patch: Partial<AutomationFlow>): Observable<AutomationFlow> {
    return this.http.put<AutomationFlow>(`${environment.apiBase}/api/auto-flows/${id}`, patch);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${environment.apiBase}/api/auto-flows/${id}`);
  }

  publish(id: string): Observable<AutomationFlow> {
    return this.http.post<AutomationFlow>(`${environment.apiBase}/api/auto-flows/${id}/publish`, {});
  }
}
