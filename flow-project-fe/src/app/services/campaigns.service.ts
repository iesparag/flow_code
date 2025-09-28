// In campaigns.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject, of } from 'rxjs';
import { map, tap, catchError } from 'rxjs/operators';
import { Campaign, CampaignListResponse, CampaignRecipient } from '../models/campaign.model';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class CampaignsService {
  private apiUrl = `${environment.apiBase}/api/campaigns`; // Updated to include /api prefix
  private campaignsSubject = new BehaviorSubject<Campaign[]>([]);
  campaigns$ = this.campaignsSubject.asObservable();

  constructor(private http: HttpClient) {}

  /**
   * Get a list of campaigns with pagination and filtering
   */
  list(
    page: number = 1, 
    limit: number = 20, 
    status?: string, 
    search?: string
  ): Observable<CampaignListResponse> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('limit', limit.toString())
      .set('_t', Date.now().toString()); // Cache busting

    if (status && status !== 'all') {
      params = params.set('status', status);
    }

    if (search) {
      params = params.set('search', search);
    }

    // Disable HTTP caching for real-time updates
    const httpOptions = {
      params,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    };

    return this.http.get<any>(this.apiUrl, httpOptions).pipe(
      // Normalize the response to always match CampaignListResponse
      map((response: any) => {
        console.log('Raw API response:', response);
        
        // If the backend returns a raw array, wrap it
        if (Array.isArray(response)) {
          const items = response as Campaign[];
          return {
            items,
            total: items.length,
            page,
            limit,
            totalPages: Math.ceil(items.length / limit)
          } as CampaignListResponse;
        }

        // If it's already an object, make sure fields exist
        const items: Campaign[] = Array.isArray(response.items) ? response.items : [];
        const total: number = typeof response.total === 'number' ? response.total : items.length;
        const normalized: CampaignListResponse = {
          items,
          total,
          page: typeof response.page === 'number' ? response.page : page,
          limit: typeof response.limit === 'number' ? response.limit : limit,
          totalPages: typeof response.totalPages === 'number' ? response.totalPages : Math.ceil(total / limit)
        };
        
        console.log('Normalized response:', normalized);
        return normalized;
      }),
      tap(response => {
        // Update the local cache
        if (page === 1) {
          this.campaignsSubject.next(response.items || []);
        } else {
          this.campaignsSubject.next([...this.campaignsSubject.value, ...(response.items || [])]);
        }
      }),
      catchError(error => {
        console.error('Error fetching campaigns:', error);
        return of({
          items: [],
          total: 0,
          page,
          limit,
          totalPages: 0
        });
      })
    );
  }

  /**
   * Create a new campaign
   */
  create(campaign: Partial<Campaign>): Observable<Campaign> {
    return this.http.post<Campaign>(this.apiUrl, campaign).pipe(
      tap(newCampaign => {
        // Add the new campaign to our local cache
        const currentCampaigns = this.campaignsSubject.value;
        this.campaignsSubject.next([newCampaign, ...currentCampaigns]);
      }),
      catchError(error => {
        console.error('Error creating campaign:', error);
        throw error;
      })
    );
  }

  /**
   * Start a campaign
   */
  startCampaign(campaignId: string): Observable<Campaign> {
    return this.http.post<Campaign>(`${this.apiUrl}/${campaignId}/start`, {}).pipe(
      tap(updatedCampaign => {
        // Update the campaign in our local cache
        const campaigns = this.campaignsSubject.value.map(campaign => 
          campaign._id === campaignId ? { ...campaign, ...updatedCampaign } : campaign
        );
        this.campaignsSubject.next(campaigns);
      }),
      catchError(error => {
        console.error(`Error starting campaign ${campaignId}:`, error);
        throw error;
      })
    );
  }

  /**
   * Pause a campaign
   */
  pauseCampaign(campaignId: string): Observable<Campaign> {
    return this.http.post<Campaign>(`${this.apiUrl}/${campaignId}/stop`, {}).pipe(
      tap(updatedCampaign => {
        // Update the campaign in our local cache
        const campaigns = this.campaignsSubject.value.map(campaign => 
          campaign._id === campaignId ? { ...campaign, ...updatedCampaign } : campaign
        );
        this.campaignsSubject.next(campaigns);
      }),
      catchError(error => {
        console.error(`Error pausing campaign ${campaignId}:`, error);
        throw error;
      })
    );
  }

  /**
   * Resume a campaign
   */
  resumeCampaign(campaignId: string): Observable<Campaign> {
    return this.http.post<Campaign>(`${this.apiUrl}/${campaignId}/resume`, {}).pipe(
      tap(updatedCampaign => {
        // Update the campaign in our local cache
        const campaigns = this.campaignsSubject.value.map(campaign => 
          campaign._id === campaignId ? { ...campaign, ...updatedCampaign } : campaign
        );
        this.campaignsSubject.next(campaigns);
      }),
      catchError(error => {
        console.error(`Error resuming campaign ${campaignId}:`, error);
        throw error;
      })
    );
  }

  /**
   * Delete a campaign
   */
  delete(campaignId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${campaignId}`).pipe(
      tap(() => {
        // Remove the campaign from our local cache
        const campaigns = this.campaignsSubject.value.filter(c => c._id !== campaignId);
        this.campaignsSubject.next(campaigns);
      }),
      catchError(error => {
        console.error(`Error deleting campaign ${campaignId}:`, error);
        throw error;
      })
    );
  }

  /**
   * Get campaign details
   */
  getDetails(campaignId: string): Observable<Campaign> {
    // Disable HTTP caching for real-time updates
    const httpOptions = {
      params: new HttpParams().set('_t', Date.now().toString()),
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    };

    return this.http.get<Campaign>(`${this.apiUrl}/${campaignId}`, httpOptions).pipe(
      catchError(error => {
        console.error(`Error fetching campaign ${campaignId}:`, error);
        throw error;
      })
    );
  }
}