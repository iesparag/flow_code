export interface CampaignRecipient {
  email: string;
  status: 'pending' | 'sent' | 'delivered' | 'opened' | 'replied' | 'bounced' | 'error';
  sentAt?: Date;
  deliveredAt?: Date;
  openedAt?: Date;
  repliedAt?: Date;
  error?: string;
  messageId?: string;
}

export interface CampaignStats {
  total: number;
  sent: number;
  delivered: number;
  opened: number;
  replied: number;
  bounced: number;
  errors: number;
  responseRate: number;
  openRate: number;
  lastUpdated: Date;
}

// For API responses
export interface CampaignListResponse {
  items: Campaign[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// In campaign.model.ts
export interface Campaign {
  _id?: string;
  name: string;
  flowId: string;
  audienceId: string;
  status: 'draft' | 'scheduled' | 'running' | 'paused' | 'completed' | 'failed';
  sender: {
    fromEmail: string;
    replyTo?: string;
  };
  stats?: {
    total: number;
    sent: number;
    delivered: number;
    opened: number;
    replied: number;
    bounced: number;
    errors: number;
    responseRate: number;
    openRate: number;
    lastUpdated?: Date;
  };
  recipients?: CampaignRecipient[]; // <-- make optional
  startedAt?: Date;
  completedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

// Add default values when creating a new campaign
export function createDefaultCampaign(): Campaign {
  return {
    name: '',
    flowId: '',
    audienceId: '',
    status: 'draft',
    sender: {
      fromEmail: '',
      replyTo: ''
    },
    stats: {
      total: 0,
      sent: 0,
      delivered: 0,
      opened: 0,
      replied: 0,
      bounced: 0,
      errors: 0,
      responseRate: 0,
      openRate: 0
    },
    recipients: [] // Always initialize as empty array
  }
}