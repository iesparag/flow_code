# Flow Automation Project

A comprehensive email campaign automation platform built with Angular frontend and Node.js backend.

## 🚀 Features

### ✅ **Email Campaign Management**
- Create and manage email campaigns
- Real-time campaign statistics (sent, delivered, opened, replied)
- Audience management and segmentation
- Email template system

### ✅ **Flow Automation**
- Visual flow builder with drag-and-drop interface
- Multiple node types: Send Email, Wait, Condition (Reply), End
- Automated follow-up sequences based on recipient behavior
- Real-time flow execution monitoring

### ✅ **Real-time Updates**
- Socket.IO integration for live campaign updates
- Instant UI refresh when emails are sent/opened/replied
- Live recipient status tracking

### ✅ **Email Tracking**
- Open tracking with pixel implementation
- Reply detection and automated flow branching
- Comprehensive analytics and reporting

## 🛠 Tech Stack

### **Frontend (Angular)**
- Angular 18+ with standalone components
- Angular Material UI components
- Socket.IO client for real-time updates
- Responsive design with modern UI/UX

### **Backend (Node.js)**
- Express.js REST API
- MongoDB with Mongoose ODM
- BullMQ for job queue management
- Socket.IO for real-time communication
- Nodemailer for email sending
- Email tracking and analytics

## 📦 Project Structure

```
flow_project/
├── flow-project-fe/          # Angular Frontend
│   ├── src/
│   │   ├── app/
│   │   │   ├── pages/
│   │   │   │   ├── campaigns/     # Campaign management
│   │   │   │   ├── flows/         # Flow builder
│   │   │   │   └── audiences/     # Audience management
│   │   │   ├── services/          # API and WebSocket services
│   │   │   └── models/            # TypeScript interfaces
│   │   └── environments/          # Environment configs
│   └── proxy.conf.json           # Development proxy
│
└── flow-project-be/          # Node.js Backend
    ├── src/
    │   ├── controllers/           # Route controllers
    │   ├── models/               # MongoDB models
    │   ├── routes/               # API routes
    │   ├── services/             # Business logic
    │   ├── processors/           # Email processing
    │   ├── queues/               # Job queues
    │   └── worker/               # Background worker
    └── .env                      # Environment variables
```

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- MongoDB database
- Redis (for job queues)
- Gmail SMTP credentials

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/iesparag/flow_code.git
cd flow_code
```

2. **Setup Backend**
```bash
cd flow-project-be
npm install
cp .env.example .env  # Configure your environment variables
```

3. **Setup Frontend**
```bash
cd ../flow-project-fe
npm install
```

### Environment Configuration

Create `.env` file in `flow-project-be/`:

```env
PORT=4000
MONGODB_URI=your_mongodb_connection_string
REDIS_URL=your_redis_connection_string
BASE_URL=http://localhost:4000
CORS_ORIGIN=http://localhost:4200 || https://flow-project-fjwy0b2qz-iesparagjaingmailcoms-projects.vercel.app

# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password

# IMAP Configuration (for reply detection)
IMAP_HOST=imap.gmail.com
IMAP_PORT=993
IMAP_USER=your_email@gmail.com
IMAP_PASS=your_app_password
```

### Running the Application

1. **Start Backend Server**
```bash
cd flow-project-be
npm run start:dev
```

2. **Start Background Worker**
```bash
cd flow-project-be
npm run start:worker
```

3. **Start Frontend**
```bash
cd flow-project-fe
npm start
```

4. **Access the application**
- Frontend: http://localhost:4200
- Backend API: http://localhost:4000

## 📊 Key Features Explained

### **Campaign Management**
- Create campaigns with flow automation
- Select audiences and email templates
- Real-time monitoring of campaign progress
- Detailed analytics and recipient tracking

### **Flow Builder**
- Visual drag-and-drop interface
- Multiple node types for complex workflows
- Conditional branching based on recipient actions
- Automated follow-up sequences

### **Real-time Updates**
- Socket.IO integration for instant updates
- Live campaign statistics
- Real-time recipient status changes
- Automatic UI refresh without page reload

### **Email Tracking**
- Invisible pixel tracking for email opens
- Reply detection with IMAP integration
- Comprehensive analytics dashboard
- Export capabilities for campaign data

## 🧪 Testing

### Manual Testing Endpoints

```bash
# Test email open tracking
curl -X POST "http://localhost:4000/api/campaigns/test/open/CAMPAIGN_ID/EMAIL"

# Test reply detection
curl -X POST "http://localhost:4000/api/campaigns/test/reply/CAMPAIGN_ID/EMAIL"
```

## 🔧 Development

### Key Components

- **CampaignsPageComponent**: Main campaign management interface
- **FlowBuilderComponent**: Visual flow creation tool
- **SocketService**: Real-time communication handler
- **EmailProcessor**: Background email processing
- **CampaignController**: API endpoints for campaign operations

### Database Models

- **Campaign**: Campaign configuration and statistics
- **AutomationFlow**: Flow definitions and nodes
- **Audience**: Recipient lists and segmentation
- **RecipientState**: Individual recipient tracking
- **EmailEvent**: Email interaction logging

## 🚀 Deployment

The application is designed for easy deployment with:
- Docker containerization support
- Environment-based configuration
- Scalable architecture with job queues
- Production-ready error handling

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📝 License

This project is licensed under the MIT License.

## 👨‍💻 Author

**Parag Jain**
- Email: iesparagjain@gmail.com
- GitHub: [@iesparag](https://github.com/iesparag)

---

Built with ❤️ using Angular, Node.js, and modern web technologies.
