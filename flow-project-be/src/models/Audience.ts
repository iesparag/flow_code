import mongoose, { Schema } from 'mongoose';

export interface IRecipient {
  email: string;
  name?: string;
  customFields?: Record<string, any>;
}

export interface IAudience {
  name: string;
  source: 'csv' | 'db';
  recipients: IRecipient[];
}

const RecipientSchema = new Schema<IRecipient>({
  email: { type: String, required: true, index: true },
  name: String,
  customFields: Schema.Types.Mixed,
}, { _id: false });

const AudienceSchema = new Schema<IAudience>({
  name: { type: String, required: true },
  source: { type: String, enum: ['csv', 'db'], required: true },
  recipients: { type: [RecipientSchema], default: [] },
}, { timestamps: true });

export const AudienceModel = mongoose.model<IAudience>('Audience', AudienceSchema);
