import mongoose, { Schema } from 'mongoose';

export type FieldOption = { label: string; value: any };
export type FieldValidator = { name: string; args?: any };
export type FieldVisibilityRule = any; // kept flexible; validated at service layer

export interface IField {
  id: string;
  label: string;
  type: string;
  placeholder?: string;
  required?: boolean;
  validators?: FieldValidator[];
  visibleIf?: FieldVisibilityRule;
  options?: FieldOption[] | null;
  default?: any;
}

export interface IForm {
  name: string;
  version: number;
  status: 'draft' | 'published';
  fields: IField[];
  meta?: any;
}

const FieldSchema = new Schema<IField>({
  id: { type: String, required: true },
  label: { type: String, required: true },
  type: { type: String, required: true },
  placeholder: String,
  required: Boolean,
  validators: [{ name: String, args: Schema.Types.Mixed }],
  visibleIf: Schema.Types.Mixed,
  options: [{ label: String, value: Schema.Types.Mixed }],
  default: Schema.Types.Mixed,
}, { _id: false });

const FormSchema = new Schema<IForm>({
  name: { type: String, required: true },
  version: { type: Number, required: true, default: 1 },
  status: { type: String, enum: ['draft', 'published'], default: 'draft' },
  fields: { type: [FieldSchema], default: [] },
  meta: Schema.Types.Mixed,
}, { timestamps: true });

export const FormModel = mongoose.model<IForm>('Form', FormSchema);
