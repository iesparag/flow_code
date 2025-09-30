# 🚀 Quick Start Testing Guide - Flow Project

## 🎯 Complete Flow Testing (Step by Step)

### Prerequisites
```bash
# Make sure these are running:
# 1. MongoDB
# 2. Redis
# 3. SMTP server configured in .env
```

### Step 1: Start the Services 🔧

```bash
# Terminal 1 - Start API Server
cd flow-project-be
npm start

# Terminal 2 - Start Worker
cd flow-project-be  
npm run worker

# You should see these logs:
# API: 🎉 API server is running on http://localhost:3000
# Worker: 🎉 Worker is ready to process jobs
```

### Step 2: Create an Audience 👥

```bash
curl -X POST http://localhost:3000/api/audiences \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Audience",
    "source": "csv",
    "recipients": [
      {
        "email": "test1@example.com",
        "name": "Test User 1"
      },
      {
        "email": "test2@example.com", 
        "name": "Test User 2"
      }
    ]
  }'

# Expected logs:
# 📝 Creating new audience...
# ✅ Validation passed for audience: Test Audience
# 📊 Recipients count: 2
# 🎉 Audience created successfully with ID: {audienceId}

# Save the returned audienceId for next step
```

### Step 3: Create an Automation Flow 🔄

```bash
curl -X POST http://localhost:3000/api/auto-flows \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Welcome Series Test",
    "startNodeId": "welcome_email",
    "nodes": [
      {
        "id": "welcome_email",
        "type": "sendEmail",
        "title": "Welcome Email",
        "template": {
          "subject": "Welcome {{email}}!",
          "body": "<h1>Hello {{email}}</h1><p>Welcome to our platform!</p>"
        },
        "next": [{"to": "wait_1day"}]
      },
      {
        "id": "wait_1day",
        "type": "wait", 
        "title": "Wait 1 Day",
        "delayMs": 10000,
        "next": [{"to": "followup_email"}]
      },
      {
        "id": "followup_email",
        "type": "sendEmail",
        "title": "Follow-up Email", 
        "template": {
          "subject": "How are you finding our platform?",
          "body": "<h1>Hi {{email}}</h1><p>We hope you are enjoying our platform!</p>"
        },
        "next": [{"to": "end_flow"}]
      },
      {
        "id": "end_flow",
        "type": "end",
        "title": "End Flow"
      }
    ]
  }'

# Save the returned flowId for next step
```

### Step 4: Create a Campaign 📧

```bash
curl -X POST http://localhost:3000/api/campaigns \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Welcome Campaign",
    "flowId": "FLOW_ID_FROM_STEP_3",
    "audienceId": "AUDIENCE_ID_FROM_STEP_2", 
    "sender": {
      "fromEmail": "test@yourdomain.com",
      "replyTo": "reply@yourdomain.com"
    }
  }'

# Expected logs:
# 🚀 Creating new campaign...
# 🔍 Looking up flow with ID: {flowId}
# ✅ Flow found: Welcome Series Test (version 1)
# 🔍 Looking up audience with ID: {audienceId}
# ✅ Audience found: Test Audience (2 recipients)
# 🎉 Campaign created successfully with ID: {campaignId}

# Save the returned campaignId for next step
```

### Step 5: Start the Campaign 🎬

```bash
curl -X POST http://localhost:3000/api/campaigns/CAMPAIGN_ID_FROM_STEP_4/start

# Expected logs sequence:
# 🎬 Starting campaign with ID: {campaignId}
# 📋 Campaign found: Test Welcome Campaign (Status: draft)
# ✅ Flow found: Welcome Series Test (Start node: welcome_email)
# ✅ Audience found: Test Audience (2 recipients)
# 📝 Creating recipient states for 2 recipients...
# 📧 Processing recipient 1/2: test1@example.com
# ⏰ Queuing job for test1@example.com at node welcome_email
# 📧 Processing recipient 2/2: test2@example.com  
# ⏰ Queuing job for test2@example.com at node welcome_email
# 🚀 Campaign Test Welcome Campaign started successfully
```

### Step 6: Watch the Magic Happen! ✨

**Worker will immediately start processing:**

```bash
# Worker logs you should see:
🔄 Processing job {jobId} for recipient: test1@example.com
🔄 Processing recipient: test1@example.com at node: welcome_email
📋 Campaign found: Test Welcome Campaign (Status: running)
✅ Recipient state found - Current node: welcome_email, Reply detected: false
🎯 Processing node: welcome_email (Type: sendEmail, Title: Welcome Email)

# Email sending logs:
📧 Attempting to send email to test1@example.com for campaign {campaignId}
📝 Subject: Welcome test1@example.com!
👤 From: test@yourdomain.com
🔍 Added tracking pixel: /api/campaigns/track/open/{campaignId}/test1@example.com
✅ Email sent successfully! MessageId: <message-id>
📊 Creating email event record...
📈 Updating campaign stats...
✅ Campaign stats updated. Modified count: 1

# Next node scheduling:
⏭️ Scheduling 1 next node(s) for recipient test1@example.com
📅 Scheduling node wait_1day for recipient test1@example.com
⏰ Adding job to queue: Campaign {campaignId}, Recipient test1@example.com, Node wait_1day
```

**After 10 seconds (wait node):**

```bash
# Wait node processing:
🔄 Processing recipient: test1@example.com at node: wait_1day
🎯 Processing node: wait_1day (Type: wait, Title: Wait 1 Day)
⏰ Wait node: delaying 10000ms (10s) for recipient test1@example.com
📅 Will schedule 1 next node(s) after delay
⏳ Scheduling node followup_email with delay 10000ms for recipient test1@example.com

# After another 10 seconds - Follow-up email:
🔄 Processing recipient: test1@example.com at node: followup_email
📧 Attempting to send email to test1@example.com
📝 Subject: How are you finding our platform?
✅ Email sent successfully!

# Finally - End node:
🔄 Processing recipient: test1@example.com at node: end_flow
🏁 End node reached for recipient test1@example.com - Flow completed
✅ Recipient test1@example.com completed the flow successfully
```

### Step 7: Check Campaign Status 📊

```bash
curl http://localhost:3000/api/campaigns/CAMPAIGN_ID_FROM_STEP_4

# You should see updated stats:
{
  "name": "Test Welcome Campaign",
  "status": "running",
  "stats": {
    "total": 2,
    "sent": 4,        // 2 recipients × 2 emails each
    "delivered": 4,
    "opened": 0,      // Will increase when emails are opened
    "replied": 0,
    "errors": 0,
    "openRate": 0,
    "responseRate": 0
  },
  "recipients": [
    {
      "email": "test1@example.com",
      "status": "sent",
      "sentAt": "2025-09-30T05:48:11.000Z",
      "messageId": "<message-id>"
    }
  ]
}
```

### Step 8: Test Email Tracking 📈

```bash
# Simulate email open (normally happens when user opens email)
curl -X POST http://localhost:3000/api/campaigns/test/open/CAMPAIGN_ID/test1@example.com

# Expected logs:
📧 Manually triggering open for test1@example.com in campaign {campaignId}
✅ Open manually triggered: test1@example.com for campaign {campaignId}

# Simulate reply
curl -X POST http://localhost:3000/api/campaigns/test/reply/CAMPAIGN_ID/test1@example.com

# Expected logs:
🤔 Manually triggering reply for test1@example.com in campaign {campaignId}
✅ Reply manually triggered: test1@example.com for campaign {campaignId}
```

## 🔍 Real-time Monitoring Commands

### Watch Logs Live:
```bash
# API Server logs
tail -f logs/app.log | grep -E "(CAMPAIGN|EMAIL|FLOW)"

# Worker logs  
tail -f logs/worker.log | grep -E "(WORKER|QUEUE|FLOW)"

# All logs with colors
tail -f logs/app.log | grep --color=always -E "(✅|❌|🎉|📧|🔄)"
```

### Check Queue Status:
```bash
redis-cli
> LLEN bull:automation-process-recipient:waiting
> LLEN bull:automation-process-recipient:active  
> LLEN bull:automation-process-recipient:completed
```

### Database Queries:
```javascript
// Check campaign progress
db.campaigns.findOne({name: "Test Welcome Campaign"}, {stats: 1, status: 1})

// Check recipient states
db.recipientstates.find({campaignId: ObjectId("CAMPAIGN_ID")})

// Check email events
db.emailevents.find({campaignId: ObjectId("CAMPAIGN_ID")}).sort({createdAt: -1})
```

## 🚨 Troubleshooting Quick Fixes

### Campaign Not Starting:
```bash
# Check if flow and audience exist
curl http://localhost:3000/api/auto-flows/FLOW_ID
curl http://localhost:3000/api/audiences/AUDIENCE_ID
```

### Emails Not Sending:
```bash
# Check SMTP configuration in .env
echo $SMTP_HOST
echo $SMTP_PORT
echo $SMTP_USER

# Test SMTP connection manually
telnet $SMTP_HOST $SMTP_PORT
```

### Worker Not Processing:
```bash
# Check if Redis is running
redis-cli ping

# Check if worker process is running
ps aux | grep worker

# Restart worker if needed
pkill -f worker
npm run worker
```

### No Logs Appearing:
```bash
# Check log level
echo $LOG_LEVEL

# Set to debug for more verbose logs
LOG_LEVEL=debug npm start
LOG_LEVEL=debug npm run worker
```

## 🎯 Success Indicators

**✅ Everything Working When You See:**
1. Server starts with all green checkmarks
2. Worker connects and shows "ready to process jobs"
3. Campaign creation returns valid IDs
4. Campaign start shows recipient processing logs
5. Email sending shows success messages
6. Stats update correctly in campaign status

**🔥 Pro Tips:**
- Use multiple terminal windows to monitor different components
- Keep Redis CLI open to watch queue status
- Use MongoDB Compass to visualize data changes
- Test with small audiences first (1-2 recipients)
- Check email spam folders if using real email addresses

---

**Happy Testing! 🚀 Your flow project is now fully logged and ready for debugging!**
