import mongoose, { Schema, Types } from 'mongoose';

export interface IEmailEvent {
  campaignId: Types.ObjectId;
  recipientEmail: string;
  messageId?: string;
  threadId?: string;
  type: 'sent' | 'delivered' | 'bounced' | 'opened' | 'replied' | 'error';
  payload?: any;
}

const EmailEventSchema = new Schema<IEmailEvent>({
  campaignId: { type: Schema.Types.ObjectId, ref: 'Campaign', index: true, required: true },
  recipientEmail: { type: String, index: true, required: true },
  messageId: String,
  threadId: String,
  type: { type: String, required: true },
  payload: Schema.Types.Mixed,
}, { timestamps: true });

export const EmailEventModel = mongoose.model<IEmailEvent>('EmailEvent', EmailEventSchema);
