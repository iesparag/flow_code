export interface Recipient {
  email: string;
  name?: string;
  customFields?: Record<string, any>;
}

export interface Audience {
  _id?: string;
  name: string;
  source: 'csv' | 'db';
  recipients: Recipient[];
}
