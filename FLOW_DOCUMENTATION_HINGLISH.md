# Flow Project - Complete Documentation (Hinglish)

## 🚀 Project Overview

Ye ek **Email Marketing Automation Platform** hai jo audience ko target karke automated email campaigns run karta hai. Isme flow-based system hai jahan aap step-by-step define kar sakte ho ki kya karna hai.

## 📁 Project Structure

```
flow-project-be/
├── src/
│   ├── config/          # Environment configuration
│   ├── controllers/     # Business logic controllers
│   ├── models/          # MongoDB schemas
│   ├── processors/      # Queue job processors
│   ├── queues/          # BullMQ queue setup
│   ├── routes/          # API endpoints
│   ├── services/        # External services (email, socket)
│   ├── utils/           # Utility functions & logger
│   ├── worker/          # Background worker
│   ├── index.ts         # Main server entry point
│   └── server.ts        # Express server setup
```

## 🔄 Complete Flow Explanation

### Step 1: Audience Banao 👥
**Kya hota hai:** Pehle aapko audience create karni padti hai

**API Endpoint:** `POST /api/audiences`

**Request Body:**
```json
{
  "name": "My Test Audience",
  "source": "csv",
  "recipients": [
    {
      "email": "user1@example.com",
      "name": "User 1",
      "customFields": {}
    }
  ]
}
```

**Backend mein kya hota hai:**
1. `audiencesRouter.post('/')` hit hota hai
2. Validation hoti hai Zod schema se
3. MongoDB mein `AudienceModel.create()` se save hota hai
4. Response mein audience ID milti hai

**Logs dekhne ke liye:**
- `📝 Creating new audience...`
- `✅ Validation passed for audience: {name}`
- `📊 Recipients count: {count}`
- `🎉 Audience created successfully with ID: {id}`

### Step 2: Automation Flow Banao 🔧
**Kya hota hai:** Flow define karte ho ki emails kaise bhejni hai

**Flow Types:**
- **sendEmail**: Email bhejta hai
- **wait**: Delay karta hai
- **conditionReply**: Check karta hai reply aaya ya nahi
- **end**: Flow khatam karta hai

**Example Flow:**
```json
{
  "name": "Welcome Series",
  "startNodeId": "email1",
  "nodes": [
    {
      "id": "email1",
      "type": "sendEmail",
      "template": {
        "subject": "Welcome {{email}}!",
        "body": "Hello {{email}}, welcome to our platform!"
      },
      "next": [{"to": "wait1"}]
    },
    {
      "id": "wait1", 
      "type": "wait",
      "delayMs": 86400000,
      "next": [{"to": "email2"}]
    }
  ]
}
```

### Step 3: Campaign Banao 📧
**Kya hota hai:** Audience aur Flow ko connect karte ho

**API Endpoint:** `POST /api/campaigns`

**Request Body:**
```json
{
  "name": "My Campaign",
  "flowId": "flow_id_here",
  "audienceId": "audience_id_here", 
  "sender": {
    "fromEmail": "sender@example.com",
    "replyTo": "reply@example.com"
  }
}
```

**Backend Process:**
1. `campaignsRouter.post('/')` hit hota hai
2. Flow aur Audience validate karte hai
3. Campaign create hota hai `draft` status mein
4. Stats initialize hote hai (total, sent, replied, etc.)

**Logs:**
- `🚀 Creating new campaign...`
- `🔍 Looking up flow with ID: {flowId}`
- `✅ Flow found: {name} (version {version})`
- `🎉 Campaign created successfully with ID: {id}`

### Step 4: Campaign Start Karo 🎬
**Kya hota hai:** Ye sabse important step hai - yahan actual magic hota hai!

**API Endpoint:** `POST /api/campaigns/{id}/start`

**Backend Process (Step by Step):**

1. **Campaign Validation:**
   ```
   📋 Campaign found: {name} (Status: {status})
   ```

2. **Flow & Audience Lookup:**
   ```
   🔍 Looking up flow: {flowId} (version {version})
   ✅ Flow found: {name} (Start node: {startNodeId})
   👥 Looking up audience: {audienceId}
   ✅ Audience found: {name} ({count} recipients)
   ```

3. **Recipient States Create Karna:**
   ```
   📝 Creating recipient states for {count} recipients...
   📧 Processing recipient 1/{total}: user@example.com
   ```
   - Har recipient ke liye `RecipientState` document banata hai
   - Current node ID set karta hai flow ke start node pe

4. **Queue Jobs Add Karna:**
   ```
   ⏰ Queuing job for user@example.com at node email1
   ```
   - Har recipient ke liye BullMQ job add karta hai
   - Job data: `{campaignId, recipientEmail, nodeId}`

5. **Campaign Status Update:**
   ```
   🚀 Campaign {name} started successfully at {timestamp}
   ```
   - Status `draft` se `running` ho jata hai
   - `startedAt` timestamp set hota hai

### Step 5: Background Worker Processing 👷‍♂️

**Worker Start Hona:**
```bash
npm run worker  # Separate process
```

**Worker Logs:**
```
🔧 Starting automation worker...
👷 Creating BullMQ worker...
🎉 Worker is ready to process jobs
⏳ Waiting for jobs to process...
```

**Job Processing (`processRecipient.ts`):**

1. **Job Receive Hona:**
   ```
   🔄 Processing recipient: user@example.com at node: email1 (Campaign: {id})
   ```

2. **Data Validation:**
   ```
   📋 Campaign found: {name} (Status: running)
   ✅ Recipient state found - Current node: email1, Reply detected: false
   ✅ Flow found: {name} with {count} nodes
   🎯 Processing node: email1 (Type: sendEmail, Title: Welcome Email)
   ```

3. **Node Type ke hisab se Processing:**

   **SendEmail Node:**
   ```
   📧 Preparing to send email...
   From: sender@example.com
   To: user@example.com
   Subject: Welcome user@example.com!
   ✅ Email sent successfully!
   MessageId: <message-id>
   ```
   - Template render hota hai variables ke saath
   - Tracking pixel add hota hai
   - Email service call hoti hai
   - Stats update hote hai
   - Next nodes schedule hote hai

   **Wait Node:**
   ```
   ⏸️ Wait node: delaying 86400000ms for recipient user@example.com
   📅 Scheduling node email2 with delay 86400000ms
   ```

   **Condition Node:**
   ```
   🤔 Condition node: recipient user@example.com replied=false
   🔀 Taking FALSE branch to node email2
   ```

### Step 6: Email Tracking 📊

**Open Tracking:**
- Email mein tracking pixel hota hai: `<img src="/api/campaigns/track/open/{campaignId}/{email}">`
- Jab user email open karta hai, ye endpoint hit hota hai
- `EmailEvent` create hota hai type `opened` ke saath
- Campaign stats update hote hai

**Reply Tracking:**
- Manual test endpoint: `POST /api/campaigns/test/reply/{campaignId}/{email}`
- `RecipientState` mein `replyDetected: true` set hota hai
- Stats update hote hai

## 🔍 Debugging Guide

### 1. Server Start Issues
**Check karo:**
```bash
# Logs dekhne ke liye
tail -f logs/server.log

# Environment variables check karo
echo $MONGODB_URI
echo $SMTP_HOST
```

**Common Issues:**
- MongoDB connection fail: `❌ Failed to start server`
- SMTP config wrong: Email sending fail hoga

### 2. Campaign Start Issues
**Logs check karo:**
```
🚀 Starting Flow Project Backend Server...
📊 Connecting to MongoDB...
✅ Successfully connected to MongoDB
```

**Agar campaign start nahi ho raha:**
- Flow ID valid hai?
- Audience ID valid hai?
- Recipients empty to nahi?

### 3. Email Not Sending
**Check sequence:**
1. Campaign started? `🎬 Starting campaign with ID`
2. Jobs queued? `⏰ Queuing job for {email}`
3. Worker running? `🔄 Processing job {id}`
4. Email service called? `📧 Preparing to send email`

**Common Issues:**
- SMTP credentials wrong
- Email service down
- Queue not processing (Redis issue)

### 4. Worker Not Processing
**Check karo:**
```bash
# Worker running hai?
ps aux | grep worker

# Redis connection
redis-cli ping

# Queue status
npm run queue:status
```

**Logs dekhne ke liye:**
```
🔧 Starting automation worker...
🎉 Worker is ready to process jobs
🔄 Processing job {id} for recipient: {email}
```

## 📋 Important Log Patterns

### Success Patterns:
```
✅ - Successful operations
🎉 - Major milestones
📊 - Stats/data operations
🔄 - Processing/workflow
```

### Warning Patterns:
```
⚠️ - Warnings
⏸️ - Paused/delayed operations
🤔 - Conditional logic
```

### Error Patterns:
```
❌ - Errors/failures
💀 - Fatal errors
🚨 - Critical issues
```

## 🛠️ Troubleshooting Commands

### Check Campaign Status:
```bash
curl http://localhost:3000/api/campaigns/{id}
```

### Check Queue Status:
```bash
# Redis mein jobs dekhne ke liye
redis-cli
> KEYS *automation*
> LLEN bull:automation-process-recipient:waiting
```

### Check Logs by Module:
```bash
# Server logs
grep "SERVER" logs/app.log

# Campaign logs  
grep "CAMPAIGN" logs/app.log

# Email logs
grep "EMAIL" logs/app.log

# Worker logs
grep "WORKER" logs/app.log
```

### Database Queries:
```javascript
// MongoDB mein check karo
db.campaigns.find({}).sort({createdAt: -1}).limit(5)
db.recipientstates.find({campaignId: ObjectId("...")})
db.emailevents.find({campaignId: ObjectId("...")}).sort({createdAt: -1})
```

## 🚨 Common Error Solutions

### 1. "Campaign not found"
- Campaign ID sahi hai?
- Database mein campaign exist karta hai?

### 2. "Flow not found" 
- Flow ID aur version sahi hai?
- Flow published hai?

### 3. "Audience not found"
- Audience ID valid hai?
- Recipients empty to nahi?

### 4. "Email sending failed"
- SMTP credentials check karo
- Network connectivity check karo
- Rate limits hit to nahi ho rahe?

### 5. "Worker not processing"
- Redis running hai?
- Worker process alive hai?
- Queue connection proper hai?

## 📈 Performance Monitoring

### Key Metrics:
- Campaign stats: `sent`, `opened`, `replied`, `errors`
- Queue metrics: waiting jobs, completed jobs, failed jobs
- Email delivery rates
- Processing time per recipient

### Scaling Tips:
- Multiple worker processes run karo
- Redis cluster use karo for high volume
- Database indexing proper karo
- Email service rate limits monitor karo

---

**Remember:** Har step mein proper logging hai, so debugging easy hai. Logs follow karo aur pattern samjho! 🎯
