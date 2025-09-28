# Cold Outreach Automation - Hinglish Notes (flow-project-be)

Yeh file aapko bataati hai ki backend me kya-kya add kiya gaya hai, kaise chalana hai, aur har cheez ka role kya hai.

## High-level Overview
- __API Server (`src/index.ts` + `src/server.ts`)__
  - Express app run karta hai. Routes register hote hain: forms, flows (UI flows), auto-flows (automation flows), audiences, templates, campaigns, analytics, submissions, runner.
- __Worker Process (`src/worker/index.ts`)__
  - Background jobs (BullMQ) run karta hai: emails bhejna, wait karna, reply check pe branch karna.
- __Queues (`src/queues/automation.ts`)__
  - `automation-process-recipient` queue: per-recipient jobs schedule/execute hoti hain.
- __Mongo Models (`src/models/*`)__
  - AutomationFlow, Audience, Campaign, RecipientState, EmailTemplate, EmailEvent, (existing) Flow, Form, Submission, Analytics.
- __Email Service (`src/services/email.ts`)__
  - Nodemailer ke through SMTP se emails bhejta hai.

## Environment Variables (`.env`)
- __MongoDB__
  - `MONGODB_URI` (default: `mongodb://localhost:27017/flow_project`)
- __Server__
  - `PORT` (default: 4000)
- __Redis (BullMQ)__
  - `REDIS_URL` (default: `redis://localhost:6379`)
- __SMTP (Emails bhejne ke liye)__
  - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_SECURE`
- __IMAP (Reply detection ke liye - optional abhi)__
  - `IMAP_HOST`, `IMAP_PORT`, `IMAP_USER`, `IMAP_PASS`

## Naye Routes (Automation ke liye)
- __Automation Flows (`src/routes/autoFlows.ts`)__ → `/api/auto-flows`
  - POST `/` → naya automation flow create
  - GET `/:id` → flow fetch
  - PUT `/:id` → flow update
  - POST `/:id/publish` → version bump + publish
  - GET `/` → list flows
- __Audiences (`src/routes/audiences.ts`)__ → `/api/audiences`
  - POST `/` → Audience create (recipients list ke saath)
  - GET `/:id` → ek audience fetch
  - GET `/` → list audiences
- __Templates (`src/routes/templates.ts`)__ → `/api/templates`
  - POST `/` → Email template create (subject/body/attachments)
  - GET `/:id` → ek template
  - GET `/` → list templates
- __Campaigns (`src/routes/campaigns.ts`)__ → `/api/campaigns`
  - POST `/` → nayi campaign create (flow + audience + sender)
  - POST `/:id/start` → campaign start (RecipientState create + jobs enqueue)
  - GET `/:id` → campaign fetch
  - GET `/` → list campaigns

## Automation Flow Node Types (`src/models/AutomationFlow.ts`)
- __sendEmail__
  - Template se email bhejta hai (templateId ya inline `template: { subject, body }`).
- __wait__
  - `delayMs` jitna wait karta hai, phir next node par jaata hai.
- __conditionReply__
  - `replyDetected` flag dekh kar branch karta hai. Convention: `next[0]` → TRUE (replied), `next[1]` → FALSE (no reply yet).
- __end__
  - Recipient ke liye flow complete.

## Data Models (Important Fields)
- __AutomationFlow__
  - `startNodeId`, `nodes[]`, `status`, `version`, `meta` (UI positions, etc.)
- __Audience__
  - `recipients: [{ email, name?, customFields? }]`
- __Campaign__
  - `flowId`, `flowVersion`, `audienceId`, `status`, `sender.fromEmail`, `stats`
- __RecipientState__
  - `recipientEmail`, `campaignId`, `currentNodeId`, `replyDetected`, `history[]`, `lastMessageId`
- __EmailTemplate__
  - `name`, `subject`, `body`, `attachments` (optional)
- __EmailEvent__
  - `type: sent|delivered|bounced|opened|replied|error` + `payload`

## Execution Engine (Queue + Worker)
- __Queue Name__: `automation-process-recipient`
- __Processor (`src/processors/processRecipient.ts`)__
  - Job data: `{ campaignId, recipientEmail, nodeId }`
  - Node handling:
    - sendEmail → template render + send + history update → next edges schedule
    - wait → `delayMs` ke baad next edges schedule
    - conditionReply → `replyDetected` dekh kar TRUE/FALSE branch
    - end → history me `completed`
- __Worker (`src/worker/index.ts`)__
  - Mongo + Redis connect karta hai, queue worker start karta hai, job completion/failure log karta hai.

## Kaise Chalaye (Local Setup)
1. __MongoDB__ chal rahi honi chahiye.
2. __Redis__ chalaye (Docker example):
   ```bash
   docker run -p 6379:6379 redis:7-alpine
   ```
3. `.env` fill karein (`.env.example` ko base bana kar): SMTP creds zaroori hain email bhejne ke liye.
4. Install + Run API server:
   ```bash
   cd flow-project-be
   npm i
   npm run dev
   ```
5. Alag terminal me Worker start karein:
   ```bash
   cd flow-project-be
   npm run worker
   ```

## Quick Test (Postman/Thunder Client)
1. Template banaye:
   - POST `/api/templates`
   ```json
   { "name": "greet", "subject": "Hi {{name}}", "body": "<p>Hello {{name}}, quick hello!</p>" }
   ```
2. Automation Flow banaye:
   - POST `/api/auto-flows`
   ```json
   {
     "name": "Outreach Flow v1",
     "startNodeId": "n1",
     "nodes": [
       { "id": "n1", "type": "sendEmail", "title": "Greeting", "templateId": "<templateId>", "next": [{ "to": "n2" }] },
       { "id": "n2", "type": "wait", "title": "Wait 1h", "delayMs": 3600000, "next": [{ "to": "n3" }] },
       { "id": "n3", "type": "conditionReply", "title": "Replied?", "next": [{ "to": "end" }, { "to": "n4" }] },
       { "id": "n4", "type": "sendEmail", "title": "Follow-up", "template": { "subject": "Following up", "body": "Checking in..." }, "next": [{ "to": "end" }] },
       { "id": "end", "type": "end", "title": "End" }
     ]
   }
   ```
3. Audience banaye:
   - POST `/api/audiences`
   ```json
   { "name": "Test Audience", "source": "csv", "recipients": [{ "email": "demo@example.com", "name": "Demo" }] }
   ```
4. Campaign banaye:
   - POST `/api/campaigns`
   ```json
   { "name": "Campaign 1", "flowId": "<autoFlowId>", "audienceId": "<audienceId>", "sender": { "fromEmail": "you@yourdomain.com" } }
   ```
5. Campaign start karein:
   - POST `/api/campaigns/<campaignId>/start`

## Typical Real-world Cadence Example
- n1: sendEmail (Greeting)
- n2: wait (1 hour)
- n3: sendEmail (Resume attach)
- n4: wait (2 days)
- n5: conditionReply (TRUE → end, FALSE → n6)
- n6: sendEmail (Follow-up #1)
- n7: wait (3 days)
- n8: conditionReply (branch...) → further follow-ups (7d, 15d, 30d) → end

## Abhi Kya Pending Hai (Next Up)
- __Reply Detection (IMAP Poller)__: `imapflow` se mailbox poll karke `RecipientState.replyDetected = true` karna + immediate job schedule.
- __CSV Upload Endpoint__: audiences ke liye file upload + column mapping.
- __Throttling/Rate Limits__: SMTP provider ke hisaab se per-minute caps.
- __Campaign Dashboard__: stats aggregation, charts.
- __Frontend Integration__: automation nodes builder UI + audiences/templates/campaigns pages.

## Troubleshooting
- __Queue name error__: BullMQ me `:` allowed nahi, isliye queue name `automation-process-recipient` rakha gaya hai.
- __Redis connect error__: Ensure Redis chal rahi hai aur `REDIS_URL` sahi hai.
- __SMTP error__: SMTP creds check karein; kuch providers me `SMTP_SECURE=true` chahiye hota hai (port 465).
- __Emails Spam me ja rahi__: DMARC/DKIM/SPF records consider karein.

Agar kisi step pe error aata hai, console logs paste karein; mai turant fix/guide karunga.
