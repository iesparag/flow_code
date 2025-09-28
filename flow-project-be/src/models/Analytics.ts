import mongoose, { Schema } from 'mongoose';

export interface IAnalyticsDoc {
  flowId: string;
  flowVersion: number;
  updatedAt: Date;
  metrics: any;
  perQuestion: any;
  funnels: any[];
}

const AnalyticsSchema = new Schema<IAnalyticsDoc>({
  flowId: { type: String, required: true },
  flowVersion: { type: Number, required: true },
  updatedAt: { type: Date, required: true },
  metrics: Schema.Types.Mixed,
  perQuestion: Schema.Types.Mixed,
  funnels: { type: [Schema.Types.Mixed], default: [] },
}, { timestamps: true });

export const AnalyticsModel = mongoose.model<IAnalyticsDoc>('Analytics', AnalyticsSchema);
