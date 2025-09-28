import 'dotenv/config';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { FormModel } from '../models/Form.js';
import { FlowModel } from '../models/Flow.js';

async function run() {
  await mongoose.connect(env.MONGODB_URI);

  const form1 = await FormModel.create({
    name: 'Basic Info',
    status: 'published',
    version: 1,
    fields: [
      { id: 'q1', label: 'Age', type: 'number', required: true, validators: [{ name: 'min', args: 13 }] },
      { id: 'q2', label: 'Preferred contact', type: 'select', required: true, options: [
        { label: 'Email', value: 'email' },
        { label: 'Phone', value: 'phone' }
      ] }
    ]
  });

  const formAdult = await FormModel.create({
    name: 'Adult Preferences',
    status: 'published',
    version: 1,
    fields: [
      { id: 'q5', label: 'Favorite category', type: 'select', options: [
        { label: 'Sports', value: 'sports' },
        { label: 'Finance', value: 'finance' }
      ] }
    ]
  });

  const formTeen = await FormModel.create({
    name: 'Teen Preferences',
    status: 'published',
    version: 1,
    fields: [
      { id: 'q6', label: 'Favorite game', type: 'text' }
    ]
  });

  const flow = await FlowModel.create({
    name: 'Demo Flow',
    status: 'published',
    version: 1,
    startNodeId: 'n_start',
    nodes: [
      { id: 'n_start', type: 'form', formId: form1._id.toString(), title: 'Start', next: [
        { to: 'n_b', when: { field: 'q1', op: '>=', value: 18 } },
        { to: 'n_c', when: { field: 'q1', op: '<', value: 18 } }
      ] },
      { id: 'n_b', type: 'form', formId: formAdult._id.toString(), title: 'Adults', next: [ { to: 'n_end' } ] },
      { id: 'n_c', type: 'form', formId: formTeen._id.toString(), title: 'Teens', next: [ { to: 'n_end' } ] },
      { id: 'n_end', type: 'end' }
    ]
  });

  console.log('Seeded forms and flow:', { form1: form1._id, formAdult: formAdult._id, formTeen: formTeen._id, flow: flow._id });
  await mongoose.disconnect();
}

run().catch((e) => { console.error(e); process.exit(1); });
