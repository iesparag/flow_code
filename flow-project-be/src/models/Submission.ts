import mongoose, { Schema } from 'mongoose';

export interface IAnswerEntry {
  nodeId: string;
  formId: string;
  values: Record<string, any>;
  submittedAt: Date;
}

export interface ISubmission {
  flowId: string;
  flowVersion: number;
  sessionId: string;
  answers: IAnswerEntry[];
  path: string[];
  completed: boolean;
  meta?: any;
}

const AnswerEntrySchema = new Schema<IAnswerEntry>({
  nodeId: { type: String, required: true },
  formId: { type: String, required: true },
  values: { type: Schema.Types.Mixed, required: true },
  submittedAt: { type: Date, required: true },
}, { _id: false });

const SubmissionSchema = new Schema<ISubmission>({
  flowId: { type: String, required: true },
  flowVersion: { type: Number, required: true },
  sessionId: { type: String, required: true, index: true },
  answers: { type: [AnswerEntrySchema], default: [] },
  path: { type: [String], default: [] },
  completed: { type: Boolean, default: false },
  meta: Schema.Types.Mixed,
}, { timestamps: true });

export const SubmissionModel = mongoose.model<ISubmission>('Submission', SubmissionSchema);
