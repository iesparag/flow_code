import mongoose, { Schema } from 'mongoose';

export type Condition = any; // validated and evaluated in services

export interface INextEdge { to: string; when?: Condition }

export interface INode {
  id: string;
  type: 'form' | 'end';
  formId?: string;
  title?: string;
  next?: INextEdge[];
}

export interface IFlow {
  name: string;
  version: number;
  status: 'draft' | 'published';
  startNodeId: string;
  nodes: INode[];
  meta?: any;
}

const NextEdgeSchema = new Schema<INextEdge>({
  to: { type: String, required: true },
  when: Schema.Types.Mixed,
}, { _id: false });

const NodeSchema = new Schema<INode>({
  id: { type: String, required: true },
  type: { type: String, enum: ['form', 'end'], required: true },
  formId: String,
  title: String,
  next: { type: [NextEdgeSchema], default: [] },
}, { _id: false });

const FlowSchema = new Schema<IFlow>({
  name: { type: String, required: true },
  version: { type: Number, required: true, default: 1 },
  status: { type: String, enum: ['draft', 'published'], default: 'draft' },
  startNodeId: { type: String, required: true },
  nodes: { type: [NodeSchema], default: [] },
  meta: Schema.Types.Mixed,
}, { timestamps: true });

export const FlowModel = mongoose.model<IFlow>('Flow', FlowSchema);
