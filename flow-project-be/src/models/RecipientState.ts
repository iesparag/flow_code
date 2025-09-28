import mongoose, { Schema, Types } from 'mongoose';

export interface IHistoryEvent {
  nodeId: string;
  event: 'queued' | 'sent' | 'wait' | 'replied' | 'skipped' | 'error' | 'completed';
  timestamp: Date;
  details?: any;
}

export interface IRecipientState {
  campaignId: Types.ObjectId;
  recipientEmail: string;
  currentNodeId: string;
  replyDetected: boolean;
  lastMessageId?: string;
  nextRunAt?: Date;
  history: IHistoryEvent[];
}

const HistoryEventSchema = new Schema<IHistoryEvent>({
  nodeId: { type: String, required: true },
  event: { type: String, required: true },
  timestamp: { type: Date, required: true },
  details: Schema.Types.Mixed,
}, { _id: false });

const RecipientStateSchema = new Schema<IRecipientState>({
  campaignId: { type: Schema.Types.ObjectId, ref: 'Campaign', index: true, required: true },
  recipientEmail: { type: String, index: true, required: true },
  currentNodeId: { type: String, required: true },
  replyDetected: { type: Boolean, default: false },
  lastMessageId: String,
  nextRunAt: Date,
  history: { type: [HistoryEventSchema], default: [] },
}, { timestamps: true });

RecipientStateSchema.index({ campaignId: 1, recipientEmail: 1 }, { unique: true });

export const RecipientStateModel = mongoose.model<IRecipientState>('RecipientState', RecipientStateSchema);
