import { Component, OnInit, OnDestroy, ViewChild, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCardModule } from '@angular/material/card';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatTableModule } from '@angular/material/table';
import { MatDialogModule } from '@angular/material/dialog';
import { Subscription, Observable } from 'rxjs';

import { CampaignsService } from '../../services/campaigns.service';
import { AutoFlowsService } from '../../services/auto-flows.service';
import { AudiencesService } from '../../services/audiences.service';
import { WebsocketService } from '../../services/websocket.service';

import { Campaign, CampaignListResponse, CampaignRecipient } from '../../models/campaign.model';
import { AutomationFlow } from '../../models/automation-flow.model';
import { Audience } from '../../models/audience.model';

// Define interfaces for missing types
interface StatusStat {
  label: string;
  count: number;
  value: number;
  status: string;
  tooltip: string;
}

interface Activity {
  type: 'info' | 'success' | 'error';
  title: string;
  description?: string;
  timestamp: Date;
}

@Component({
  selector: 'app-campaigns-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCardModule,
    MatButtonToggleModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatTableModule,
    MatDialogModule,
  ],
  templateUrl: './campaigns-page.component.html',
  styleUrls: ['./campaigns-page.component.scss']
})
export class CampaignsPageComponent implements OnInit, OnDestroy {
  // Make Math available in the template
  public Math = Math;

  // Component state
  items: Campaign[] = [];
  filteredCampaigns: Campaign[] = [];
  selectedCampaign: Campaign | null = null;
  isLoading = false;
  showCreateForm = false;
  
  // Pagination
  currentPage = 1;
  itemsPerPage = 10;
  totalItems = 0;

  // Filtering
  searchQuery = '';
  statusFilter = 'all';

  // Form fields
  name = '';
  flowId = '';
  audienceId = '';
  fromEmail = '';
  replyTo = '';

  // Data for dropdowns
  flows: AutomationFlow[] = [];
  audiences: Audience[] = [];

  // Dialogs and templates
  @ViewChild('deleteDialog') deleteDialogTemplate!: TemplateRef<any>;
  campaignToDelete: Campaign | null = null;

  // For stat change indicators
  previousStats: any = null;
  
  // Table columns
  displayedColumns: string[] = ['email', 'status', 'sentAt', 'actions'];
  
  private campaignUpdateSubscription: Subscription | null = null;

  constructor(
    public campaignsService: CampaignsService,
    private websocketService: WebsocketService,
    private flowsService: AutoFlowsService,
    private audiencesApi: AudiencesService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit() {
    this.loadCampaigns();
    this.loadFlows();
    this.loadAudiences();
    
    // Listen for real-time campaign updates via WebSocket
    console.log('[CampaignsPage] 🎧 Setting up WebSocket listener for campaign_updated events');
    
    this.campaignUpdateSubscription = this.websocketService
      .listen<{ campaignId: string }>('campaign_updated')
      .subscribe(update => {
        console.log(`[CampaignsPage] 🔔 Campaign update received for ID: ${update.campaignId}`);
        console.log(`[CampaignsPage] 🔔 Current selected campaign ID: ${this.selectedCampaign?._id}`);
        console.log(`[CampaignsPage] 🔔 Update data:`, update);
        
        // If the updated campaign is the one currently selected, refresh its details
        if (this.selectedCampaign?._id === update.campaignId) {
          console.log(`[CampaignsPage] 🔄 Refreshing selected campaign details`);
          this.campaignsService.getDetails(update.campaignId).subscribe(details => {
            this.selectedCampaign = { ...this.selectedCampaign, ...details };
            console.log(`[CampaignsPage] ✅ Selected campaign updated:`, this.selectedCampaign);
          });
        }

        // Also, refresh the campaign in the main list to update its summary stats
        const index = this.items.findIndex(c => c._id === update.campaignId);
        console.log(`[CampaignsPage] 🔍 Looking for campaign in list. Found at index: ${index}`);
        
        if (index !== -1) {
          console.log(`[CampaignsPage] 🔄 Refreshing campaign in list`);
          this.campaignsService.getDetails(update.campaignId).subscribe(details => {
            this.items[index] = { ...this.items[index], ...details };
            this.filterCampaigns(); // Re-apply filters to update the view
            console.log(`[CampaignsPage] ✅ Campaign list updated`);
          });
        }
      });
  }

  ngOnDestroy() {
    if (this.campaignUpdateSubscription) {
      this.campaignUpdateSubscription.unsubscribe();
    }
  }
  loadCampaigns(silent: boolean = false) {
    if (!silent) {
      this.isLoading = true;
    }
    
    this.campaignsService.list(this.currentPage, this.itemsPerPage)
      .subscribe({
        next: (response: CampaignListResponse) => {
          if (!response || !Array.isArray(response.items)) {
            this.items = [];
            this.filteredCampaigns = [];
            this.totalItems = 0;
            return;
          }
          
          this.items = response.items.map(campaign => ({ ...campaign }));
          this.totalItems = response.total || 0;
          this.filterCampaigns();
          
          if (this.items.length > 0 && !this.selectedCampaign) {
            this.selectCampaign(this.items[0]);
          }
          
          if (this.selectedCampaign) {
            const updatedCampaign = this.items.find(c => c._id === this.selectedCampaign?._id);
            if (updatedCampaign) {
              this.selectedCampaign = updatedCampaign;
            }
          }
          
          this.isLoading = false;
        },
        error: (error) => {
          console.error('Error loading campaigns:', error);
          this.isLoading = false;
          this.snackBar.open('Failed to load campaigns', 'Dismiss', { duration: 3000 });
        }
      });
  }
  
  loadFlows() {
    this.flowsService.list().subscribe({
      next: (flows) => this.flows = flows,
      error: (error) => console.error('Error loading flows:', error)
    });
  }
  
  loadAudiences() {
    this.audiencesApi.list().subscribe({
      next: (audiences) => this.audiences = audiences,
      error: (error) => console.error('Error loading audiences:', error)
    });
  }
  
  selectCampaign(campaign: Campaign) {
    this.previousStats = this.selectedCampaign?.stats ? { ...this.selectedCampaign.stats } : null;
    this.selectedCampaign = { ...campaign };
    
    this.campaignsService.getDetails(campaign._id!).subscribe({
      next: (details) => {
        this.selectedCampaign = { ...details };
      },
      error: (error) => {
        if (error.status === 404) {
          this.snackBar.open('Campaign not found - it may have been deleted', 'Dismiss', { duration: 5000 });
          this.selectedCampaign = null;
          this.loadCampaigns();
        } else {
          this.snackBar.open('Failed to load campaign details', 'Dismiss', { duration: 3000 });
        }
      }
    });
  }
  create() {
    if (!this.flowId || !this.audienceId || !this.fromEmail) {
      this.snackBar.open('Please fill in all required fields', 'Dismiss', { duration: 3000 });
      return;
    }
    
    const payload: Partial<Campaign> = {
      name: this.name || 'New Campaign',
      flowId: this.flowId,
      audienceId: this.audienceId,
      sender: { 
        fromEmail: this.fromEmail, 
        replyTo: this.replyTo || undefined 
      },
      status: 'draft',
    };
    
    this.isLoading = true;
    this.campaignsService.create(payload).subscribe({
      next: (newCampaign) => {
        this.resetForm();
        this.loadCampaigns();
        this.snackBar.open('Campaign created successfully', 'Dismiss', { duration: 3000 });
        this.selectCampaign(newCampaign);
      },
      error: (error) => {
        console.error('Error creating campaign:', error);
        this.snackBar.open('Failed to create campaign', 'Dismiss', { duration: 3000 });
        this.isLoading = false;
      }
    });
  }
  
  toggleCampaignStatus(campaign: Campaign) {
    let action$: Observable<Campaign>;
    let toastMsg = '';

    if (campaign.status === 'running' || campaign.status === 'scheduled') {
      action$ = this.campaignsService.pauseCampaign(campaign._id!);
      toastMsg = 'paused';
    } else if (campaign.status === 'paused') {
      action$ = this.campaignsService.resumeCampaign(campaign._id!);
      toastMsg = 'resumed';
    } else {
      action$ = this.campaignsService.startCampaign(campaign._id!);
      toastMsg = 'started';
    }

    action$.subscribe({
      next: () => {
        this.loadCampaigns(false);
        this.snackBar.open(`Campaign ${toastMsg}`, 'Dismiss', { 
          duration: 2000 
        });
      },
      error: (error: any) => {
        console.error('Error updating campaign status:', error);
        this.snackBar.open('Failed to update campaign status', 'Dismiss', { duration: 3000 });
      }
    });
  }
  
  confirmDelete(campaign: Campaign) {
    this.campaignToDelete = campaign;
    const dialogRef = this.dialog.open(this.deleteDialogTemplate, {
      width: '450px'
    });
    
    dialogRef.afterClosed().subscribe(confirmed => {
      if (confirmed) {
        this.deleteCampaign();
      }
      this.campaignToDelete = null;
    });
  }
  
  private deleteCampaign() {
    if (!this.campaignToDelete?._id) return;
    
    this.campaignsService.delete(this.campaignToDelete._id).subscribe({
      next: () => {
        if (this.selectedCampaign?._id === this.campaignToDelete?._id) {
          this.selectedCampaign = null;
        }
        this.loadCampaigns();
        this.snackBar.open('Campaign deleted successfully', 'Dismiss', { duration: 3000 });
      },
      error: (error) => {
        console.error('Error deleting campaign:', error);
        this.snackBar.open('Failed to delete campaign', 'Dismiss', { duration: 3000 });
      }
    });
  }
  getStatusStats(): StatusStat[] {
    if (!this.selectedCampaign?.stats) return [];
    
    const { stats } = this.selectedCampaign;
    const total = stats.total || 1; // Avoid division by zero
    
    return [
      {
        label: 'Sent',
        count: stats.sent || 0,
        value: (stats.sent / total) * 100,
        status: 'sent',
        tooltip: `${stats.sent} emails sent`
      },
      {
        label: 'Delivered',
        count: stats.delivered || 0,
        value: ((stats.delivered || 0) / total) * 100,
        status: 'delivered',
        tooltip: `${stats.delivered || 0} emails delivered`
      },
      {
        label: 'Opened',
        count: stats.opened || 0,
        value: ((stats.opened || 0) / total) * 100,
        status: 'opened',
        tooltip: `${stats.opened || 0} emails opened (${((stats.openRate || 0) * 100).toFixed(1)}% open rate)`
      },
      {
        label: 'Replied',
        count: stats.replied || 0,
        value: (stats.replied / total) * 100,
        status: 'replied',
        tooltip: `${stats.replied} replies received (${((stats.responseRate || 0) * 100).toFixed(1)}% response rate)`
      },
      {
        label: 'Bounced',
        count: stats.bounced || 0,
        value: ((stats.bounced || 0) / total) * 100,
        status: 'bounced',
        tooltip: `${stats.bounced || 0} emails bounced`
      },
      {
        label: 'Errors',
        count: stats.errors || 0,
        value: (stats.errors / total) * 100,
        status: 'error',
        tooltip: `${stats.errors} errors occurred`
      }
    ];
  }
  
  getChange(metric: string): number {
    if (!this.selectedCampaign || !this.selectedCampaign.stats) {
      return 0;
    }
    const current = this.selectedCampaign.stats[metric as keyof typeof this.selectedCampaign.stats] || 0;
    return Number(current);
  }
  
  getRecentActivity(): Activity[] {
    if (!this.selectedCampaign) return [];
    
    const activities: Activity[] = [];
    
    if (this.selectedCampaign.startedAt) {
      activities.push({
        type: 'info',
        title: 'Campaign started',
        timestamp: new Date(this.selectedCampaign.startedAt)
      });
    }
    
    if (this.selectedCampaign.completedAt) {
      activities.push({
        type: 'success',
        title: 'Campaign completed',
        timestamp: new Date(this.selectedCampaign.completedAt)
      });
    }
    
    const recentRecipients = [...(this.selectedCampaign.recipients || [])]
      .sort((a, b) => (b.sentAt?.getTime() || 0) - (a.sentAt?.getTime() || 0))
      .slice(0, 10);
    
    recentRecipients.forEach(recipient => {
      if (recipient.repliedAt) {
        activities.push({
          type: 'success',
          title: 'Reply received',
          description: `From: ${recipient.email}`,
          timestamp: new Date(recipient.repliedAt)
        });
      } else if (recipient.openedAt) {
        activities.push({
          type: 'info',
          title: 'Email opened',
          description: `By: ${recipient.email}`,
          timestamp: new Date(recipient.openedAt)
        });
      } else if (recipient.sentAt) {
        activities.push({
          type: 'info',
          title: 'Email sent',
          description: `To: ${recipient.email}`,
          timestamp: new Date(recipient.sentAt)
        });
      }
    });
    
    return activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }
  
  filterCampaigns() {
    try {
      if (!this.items || this.items.length === 0) {
        this.filteredCampaigns = [];
        return;
      }

      const searchQuery = (this.searchQuery || '').toLowerCase().trim();
      
      this.filteredCampaigns = this.items.filter(campaign => {
        if (!campaign) return false;
        
        const matchesSearch = !searchQuery || 
          (campaign.name && campaign.name.toLowerCase().includes(searchQuery)) ||
          (campaign.status && campaign.status.toLowerCase().includes(searchQuery));
        
        const matchesStatus = this.statusFilter === 'all' || 
          (campaign.status && campaign.status.toLowerCase() === this.statusFilter.toLowerCase());
        
        return matchesSearch && matchesStatus;
      });
      
    } catch (error) {
      console.error('Error filtering campaigns:', error);
      this.filteredCampaigns = [];
    }
  }
  
  refreshCampaign() {
    this.loadCampaigns(false);
    
    if (this.selectedCampaign?._id) {
      this.campaignsService.getDetails(this.selectedCampaign._id).subscribe({
        next: (details) => {
          this.selectedCampaign = { ...details };
          this.snackBar.open('Campaign data refreshed', 'Dismiss', { duration: 2000 });
        },
        error: (error) => {
          this.snackBar.open('Failed to refresh campaign', 'Dismiss', { duration: 3000 });
        }
      });
    }
  }
  
  exportCampaignData() {
    if (!this.selectedCampaign) return;
    
    const headers = ['Email', 'Status', 'Sent At', 'Delivered At', 'Opened At', 'Replied At', 'Error'];
    const rows = (this.selectedCampaign.recipients || []).map(recipient => ({
      email: `"${recipient.email}"`,
      status: recipient.status,
      sentAt: recipient.sentAt?.toISOString() || '',
      deliveredAt: recipient.deliveredAt?.toISOString() || '',
      openedAt: recipient.openedAt?.toISOString() || '',
      repliedAt: recipient.repliedAt?.toISOString() || '',
      error: `"${recipient.error || ''}"`
    }));
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => Object.values(row).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `campaign-${this.selectedCampaign.name}-${new Date().toISOString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
  
  viewRecipientDetails(recipient: CampaignRecipient) {
    this.snackBar.open(`Viewing details for ${recipient.email}`, 'Dismiss', { duration: 2000 });
  }
  
  resendToRecipient(recipient: CampaignRecipient) {
    if (!this.selectedCampaign?._id) return;
    
    this.campaignsService.startCampaign(this.selectedCampaign._id).subscribe({
      next: () => {
        this.snackBar.open(`Resent to ${recipient.email}`, 'Dismiss', { duration: 3000 });
        this.refreshCampaign();
      },
      error: (error: any) => {
        this.snackBar.open('Failed to resend email', 'Dismiss', { duration: 3000 });
      }
    });
  }
  
  cancelCreate() {
    this.showCreateForm = false;
    this.resetForm();
  }
  
  private resetForm() {
    this.name = '';
    this.flowId = '';
    this.audienceId = '';
    this.fromEmail = '';
    this.replyTo = '';
    this.showCreateForm = false;
  }
}
