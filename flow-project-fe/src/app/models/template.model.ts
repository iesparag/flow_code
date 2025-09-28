export interface EmailAttachment { name: string; url?: string; contentBase64?: string }

export interface EmailTemplate {
  _id?: string;
  name: string;
  subject: string;
  body: string;
  attachments?: EmailAttachment[];
}
