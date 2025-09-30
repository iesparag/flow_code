# 🔍 Complete Logging Guide - Flow Project

## 📋 Log Categories & Modules

### Available Log Modules:
- **SERVER** - Express server setup & configuration
- **CAMPAIGN** - Campaign creation, start, stop operations
- **AUDIENCE** - Audience CRUD operations
- **FLOW** - Automation flow processing & node execution
- **EMAIL** - Email sending & tracking
- **QUEUE** - Redis queue operations & job management
- **WORKER** - Background worker processing
- **DATABASE** - MongoDB operations
- **API** - HTTP request/response logging

## 🎯 Key Log Patterns to Watch

### 1. Server Startup Sequence
```
🚀 Starting Flow Project Backend Server...
📊 Connecting to MongoDB...
✅ Successfully connected to MongoDB
🔧 Creating HTTP server...
🔌 Initializing Socket.IO service...
🎉 API server is running on http://localhost:3000
```

### 2. Campaign Creation Flow
```
🚀 Creating new campaign...
🔍 Looking up flow with ID: {flowId}
✅ Flow found: {name} (version {version})
🔍 Looking up audience with ID: {audienceId}
✅ Audience found: {name} ({count} recipients)
🎉 Campaign created successfully with ID: {id}
```

### 3. Campaign Start Process
```
🎬 Starting campaign with ID: {id}
📋 Campaign found: {name} (Status: draft)
📝 Creating recipient states for {count} recipients...
📧 Processing recipient 1/{total}: user@example.com
⏰ Queuing job for user@example.com at node email1
🚀 Campaign {name} started successfully
```

### 4. Worker Job Processing
```
🔄 Processing recipient: user@example.com at node: email1
📋 Campaign found: {name} (Status: running)
✅ Recipient state found - Current node: email1
🎯 Processing node: email1 (Type: sendEmail)
```

### 5. Email Sending Process
```
📧 Attempting to send email to user@example.com
📝 Subject: Welcome user@example.com!
👤 From: sender@example.com
🔍 Added tracking pixel: /api/campaigns/track/open/...
✅ Email sent successfully! MessageId: <message-id>
📊 Creating email event record...
📈 Updating campaign stats...
```

## 🚨 Error Patterns to Monitor

### Critical Errors:
```
❌ Campaign not found with ID: {id}
❌ AutomationFlow not found with ID: {flowId}
❌ Audience not found with ID: {audienceId}
❌ Failed to send email to {email}: {error}
💀 Fatal worker error: {error}
```

### Warning Patterns:
```
⚠️ Campaign {name} is already running
⚠️ Campaign is not running, deferring job for 60s
⚠️ No TRUE/FALSE branch available, ending flow
```

## 🔧 Debugging Commands

### 1. Real-time Log Monitoring
```bash
# Follow all logs
tail -f logs/app.log

# Filter by module
grep "CAMPAIGN" logs/app.log | tail -20
grep "EMAIL" logs/app.log | tail -20
grep "WORKER" logs/app.log | tail -20

# Filter by log level
grep "ERROR" logs/app.log | tail -10
grep "WARN" logs/app.log | tail -10
```

### 2. Campaign Debugging
```bash
# Check campaign creation
curl -X POST http://localhost:3000/api/campaigns \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Campaign",
    "flowId": "FLOW_ID",
    "audienceId": "AUDIENCE_ID",
    "sender": {"fromEmail": "test@example.com"}
  }'

# Start campaign
curl -X POST http://localhost:3000/api/campaigns/CAMPAIGN_ID/start

# Check campaign status
curl http://localhost:3000/api/campaigns/CAMPAIGN_ID
```

### 3. Queue Monitoring
```bash
# Redis CLI commands
redis-cli

# Check queue status
> KEYS *automation*
> LLEN bull:automation-process-recipient:waiting
> LLEN bull:automation-process-recipient:active
> LLEN bull:automation-process-recipient:completed
> LLEN bull:automation-process-recipient:failed

# View job details
> LRANGE bull:automation-process-recipient:waiting 0 -1
```

### 4. Database Queries
```javascript
// MongoDB queries for debugging
use your_database_name

// Check recent campaigns
db.campaigns.find({}).sort({createdAt: -1}).limit(5)

// Check recipient states for a campaign
db.recipientstates.find({campaignId: ObjectId("CAMPAIGN_ID")})

// Check email events
db.emailevents.find({campaignId: ObjectId("CAMPAIGN_ID")}).sort({createdAt: -1})

// Check campaign stats
db.campaigns.findOne({_id: ObjectId("CAMPAIGN_ID")}, {stats: 1, status: 1, name: 1})
```

## 📊 Performance Monitoring Logs

### Queue Performance:
```
✅ Job {jobId} completed successfully
❌ Job {jobId} failed: {reason}
🔄 Job {jobId} progress: {data}
```

### Email Performance:
```
📧 Preparing to send email...
✅ Email sent successfully!
MessageId: {messageId}
Response: {response}
```

### Campaign Stats Updates:
```
📈 Updating campaign stats...
✅ Campaign stats updated. Modified count: {count}
```

## 🎛️ Log Level Configuration

Set log level via environment variable:
```bash
# In .env file
LOG_LEVEL=debug  # debug, info, warn, error

# Or runtime
LOG_LEVEL=debug npm start
```

### Log Levels:
- **debug**: All logs including detailed debugging
- **info**: General information (default)
- **warn**: Warning messages only
- **error**: Error messages only

## 🔍 Specific Debugging Scenarios

### Scenario 1: Campaign Not Starting
**Check these logs in sequence:**
1. `🎬 Starting campaign with ID` - Campaign start initiated?
2. `📋 Campaign found` - Campaign exists?
3. `✅ Flow found` - Flow exists and valid?
4. `✅ Audience found` - Audience exists with recipients?
5. `⏰ Queuing job` - Jobs being queued?

### Scenario 2: Emails Not Sending
**Check these logs:**
1. `🔄 Processing job` - Worker processing jobs?
2. `📧 Attempting to send email` - Email sending initiated?
3. `✅ Email sent successfully` - Email service working?
4. `❌ Failed to send email` - Check error details

### Scenario 3: Worker Not Processing
**Check these logs:**
1. `🔧 Starting automation worker` - Worker starting?
2. `✅ Redis connected successfully` - Redis connection?
3. `🎉 Worker is ready to process jobs` - Worker ready?
4. `🔄 Processing job {id}` - Jobs being processed?

### Scenario 4: Flow Logic Issues
**Check these logs:**
1. `🎯 Processing node: {id} (Type: {type})` - Correct node?
2. `⏰ Wait node: delaying {ms}ms` - Wait times correct?
3. `🤔 Condition node: replied={bool}` - Condition logic?
4. `✅ Taking TRUE/FALSE branch` - Correct path taken?

## 📱 Real-time Monitoring Setup

### Using PM2 (Recommended):
```bash
# Install PM2
npm install -g pm2

# Start with logging
pm2 start npm --name "flow-api" -- start
pm2 start npm --name "flow-worker" -- run worker

# Monitor logs
pm2 logs flow-api
pm2 logs flow-worker
pm2 monit
```

### Log Rotation:
```bash
# Setup log rotation
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

## 🚀 Production Logging Best Practices

### 1. Structured Logging
All logs include:
- Timestamp
- Module name
- Log level
- Message with context
- Relevant IDs (campaignId, recipientEmail, etc.)

### 2. Log Aggregation
Consider using:
- **ELK Stack** (Elasticsearch, Logstash, Kibana)
- **Fluentd** + **Grafana**
- **DataDog** or **New Relic**

### 3. Alerting Rules
Set up alerts for:
- High error rates in email sending
- Queue backup (too many waiting jobs)
- Worker failures
- Database connection issues

### 4. Log Retention
- Keep detailed logs for 7-30 days
- Archive summary logs for longer periods
- Rotate logs to prevent disk space issues

---

**Remember**: Logs are your best friend for debugging! Follow the emoji patterns and trace the flow step by step. 🎯
