import mongoose, { Schema } from 'mongoose';

export type Condition = any; // JSON expression evaluated by worker

export interface INextEdge { to: string; when?: Condition }

export type AutomationNodeType = 'sendEmail' | 'wait' | 'conditionReply' | 'end';

export interface IAutomationNodeBase { id: string; type: AutomationNodeType; title?: string; next?: INextEdge[] }

export interface IAutomationNodeSendEmail extends IAutomationNodeBase {
  type: 'sendEmail';
  templateId?: string; // reference template
  template?: { subject: string; body: string; attachments?: { name: string; url?: string; contentBase64?: string }[] };
}

export interface IAutomationNodeWait extends IAutomationNodeBase {
  type: 'wait';
  delayMs: number;
}

export interface IAutomationNodeConditionReply extends IAutomationNodeBase {
  type: 'conditionReply';
  windowMs?: number; // optional window to consider reply
}

export type IAutomationNode = IAutomationNodeSendEmail | IAutomationNodeWait | IAutomationNodeConditionReply | IAutomationNodeBase;

export interface IAutomationFlow {
  name: string;
  version: number;
  status: 'draft' | 'published';
  startNodeId: string;
  nodes: IAutomationNode[];
  meta?: any;
}

const NextEdgeSchema = new Schema<INextEdge>({
  to: { type: String, required: true },
  when: Schema.Types.Mixed,
}, { _id: false });

const NodeSchema = new Schema<any>({
  id: { type: String, required: true },
  type: { type: String, enum: ['sendEmail', 'wait', 'conditionReply', 'end'], required: true },
  title: String,
  next: { type: [NextEdgeSchema], default: [] },
  // sendEmail
  templateId: String,
  template: Schema.Types.Mixed,
  // wait
  delayMs: Number,
  // conditionReply
  windowMs: Number,
}, { _id: false });

const AutomationFlowSchema = new Schema<IAutomationFlow>({
  name: { type: String, required: true },
  version: { type: Number, required: true, default: 1 },
  status: { type: String, enum: ['draft', 'published'], default: 'draft' },
  startNodeId: { type: String, required: true },
  nodes: { type: [NodeSchema], default: [] },
  meta: Schema.Types.Mixed,
}, { timestamps: true });

export const AutomationFlowModel = mongoose.model<IAutomationFlow>('AutomationFlow', AutomationFlowSchema);
