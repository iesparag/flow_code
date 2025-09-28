import mongoose, { Schema, Types } from 'mongoose';

export interface ICampaign {
  name: string;
  flowId: Types.ObjectId;
  flowVersion: number;
  audienceId: Types.ObjectId;
  status: 'draft' | 'running' | 'paused' | 'completed';
  sender: {
    fromEmail: string;
    replyTo?: string;
  };
  // map of nodeId -> EmailTemplateId to override templates per sendEmail node
  templateOverrides?: Record<string, Types.ObjectId>;
  stats?: {
    total: number;
    sent: number;
    replied: number;
    errors: number;
    delivered?: number;
    opened?: number;
    bounced?: number;
    openRate?: number;
    responseRate?: number;
  };
  startedAt?: Date;
  completedAt?: Date;
}

const CampaignSchema = new Schema<ICampaign>({
  name: { type: String, required: true },
  flowId: { type: Schema.Types.ObjectId, ref: 'AutomationFlow', required: true },
  flowVersion: { type: Number, required: true },
  audienceId: { type: Schema.Types.ObjectId, ref: 'Audience', required: true },
  status: { type: String, enum: ['draft', 'running', 'paused', 'completed'], default: 'draft' },
  sender: {
    fromEmail: { type: String, required: true },
    replyTo: String,
  },
  templateOverrides: { type: Schema.Types.Mixed },
  stats: {
    total: { type: Number, default: 0 },
    sent: { type: Number, default: 0 },
    replied: { type: Number, default: 0 },
    errors: { type: Number, default: 0 },
    delivered: { type: Number, default: 0 },
    opened: { type: Number, default: 0 },
    bounced: { type: Number, default: 0 },
    openRate: { type: Number, default: 0 },
    responseRate: { type: Number, default: 0 },
  },
  startedAt: { type: Date },
  completedAt: { type: Date },
}, { timestamps: true });

export const CampaignModel = mongoose.model<ICampaign>('Campaign', CampaignSchema);
