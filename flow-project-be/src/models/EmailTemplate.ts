import mongoose, { Schema } from 'mongoose';

export interface IEmailAttachment {
  name: string;
  url?: string; // public URL
  contentBase64?: string; // inline content
}

export interface IEmailTemplate {
  name: string;
  subject: string;
  body: string; // can include variables like {{name}}
  attachments?: IEmailAttachment[];
}

const AttachmentSchema = new Schema<IEmailAttachment>({
  name: { type: String, required: true },
  url: String,
  contentBase64: String,
}, { _id: false });

const EmailTemplateSchema = new Schema<IEmailTemplate>({
  name: { type: String, required: true },
  subject: { type: String, required: true },
  body: { type: String, required: true },
  attachments: { type: [AttachmentSchema], default: [] },
}, { timestamps: true });

export const EmailTemplateModel = mongoose.model<IEmailTemplate>('EmailTemplate', EmailTemplateSchema);
