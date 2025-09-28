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
  replied: number;
  errors: number;
  delivered?: number;
  opened?: number;
  bounced?: number;
  openRate?: number;
  responseRate?: number;
}

// For API responses
export interface CampaignListResponse {
  items: Campaign[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface Campaign {
  _id?: string;
  name: string;
  flowId: string;
  flowVersion: number;
  audienceId: string;
  status: 'draft' | 'scheduled' | 'running' | 'paused' | 'completed' | 'failed';
  sender: {
    fromEmail: string;
    replyTo?: string;
  };
  stats: CampaignStats;
  templateOverrides?: Record<string, string>;
  recipients?: CampaignRecipient[]; // Optional as it might not be included in list views
  createdAt?: string | Date;
  updatedAt?: string | Date;
  startedAt?: string | Date;
  completedAt?: string | Date;
  __v?: number;
}

// Helper function to create a default campaign with required fields
export function createDefaultCampaign(partial?: Partial<Campaign>): Campaign {
  return {
    name: '',
    flowId: '',
    flowVersion: 1,
    audienceId: '',
    status: 'draft',
    sender: {
      fromEmail: '',
      replyTo: ''
    },
    stats: {
      total: 0,
      sent: 0,
      replied: 0,
      errors: 0,
      delivered: 0,
      opened: 0,
      bounced: 0,
      openRate: 0,
      responseRate: 0
    },
    ...partial
  };
}