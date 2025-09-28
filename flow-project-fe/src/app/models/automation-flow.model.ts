export type AutomationNodeType = 'sendEmail' | 'wait' | 'conditionReply' | 'end';

export interface NextEdge { to: string; when?: any }

export interface AutomationNodeBase { id: string; type: AutomationNodeType; title?: string; next?: NextEdge[] }

export interface AutomationNodeSendEmail extends AutomationNodeBase {
  type: 'sendEmail';
  templateId?: string;
  template?: { subject: string; body: string; attachments?: { name: string; url?: string; contentBase64?: string }[] };
}

export interface AutomationNodeWait extends AutomationNodeBase {
  type: 'wait';
  delayMs: number;
}

export interface AutomationNodeConditionReply extends AutomationNodeBase {
  type: 'conditionReply';
  windowMs?: number;
}

export type AutomationNode =
  | AutomationNodeSendEmail
  | AutomationNodeWait
  | AutomationNodeConditionReply
  | AutomationNodeBase;

export interface AutomationFlow {
  _id?: string;
  name: string;
  version?: number;
  status?: 'draft' | 'published';
  startNodeId: string;
  nodes: AutomationNode[];
  meta?: any;
}
