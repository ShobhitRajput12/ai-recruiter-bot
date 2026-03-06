# AI Recruiter Bot

An intelligent recruiter chatbot that uses AI to analyze candidate data and answer recruitment questions.

## Features

- **AI-Powered Chat Interface**: Uses Groq API with Llama 3.3 model for intelligent responses
- **Candidate Database**: MongoDB-backed candidate storage and management
- **File Upload**: Support for uploading candidate CVs (PDF and Word documents)
- **Real-Time Responses**: Fast API responses using Groq's optimized models

## Tech Stack

### Backend
- **Node.js** with Express.js
- **MongoDB** with Mongoose for data management
- **Groq API** for AI/LLM capabilities
- **Axios** for API requests
- **Multer** for file uploads
- **pdf-parse** and **Mammoth** for document parsing

### Frontend
- **React** 19.2.0
- **Vite** for build tooling
- **Axios** for API communication
- **Tailwind CSS** for styling
- **ESLint** for code quality

## Prerequisites

Before you begin, ensure you have:
- Node.js (v14 or higher)
- npm or yarn package manager
- MongoDB instance (local or Atlas cloud)
- Groq API key from [console.groq.com](https://console.groq.com)

## Setup Instructions

### 1. Clone the Repository
```bash
git clone https://github.com/ShobhitRajput12/ai-recruiter-bot.git
cd ai-recruiter-bot
```

### 2. Configure Environment Variables

#### Backend Setup
```bash
cd backend
cp .env.example .env
```

Edit `backend/.env` with your credentials:
```
GROQ_API_KEY=your_groq_api_key_here
MONGO_URI=your_mongodb_connection_string_here
```

**Get your keys:**
- **Groq API Key**: [Sign up at console.groq.com](https://console.groq.com)
- **MongoDB URI**: [Create a free cluster at MongoDB Atlas](https://www.mongodb.com/cloud/atlas)

#### Frontend Setup
```bash
cd frontend
npm install
```

### 3. Install Dependencies

**Backend:**
```bash
cd backend
npm install
```

**Frontend:**
```bash
cd frontend
npm install
```

### 4. Start the Application

**Terminal 1 - Start Backend:**
```bash
cd backend
npm start
# Server runs on http://localhost:5000
```

**Terminal 2 - Start Frontend:**
```bash
cd frontend
npm run dev
# Frontend runs on http://localhost:5173
```

### 5. Open in Browser

Navigate to `http://localhost:5173` and you'll see the Recruiter Chatbot interface.

## API Endpoints

### Chat
- **POST** `/chat` - Send a question to the AI recruiter
  ```json
  {
    "question": "Show me candidates with 2 years experience"
  }
  ```

### Upload
- **POST** `/upload` - Upload candidate CVs
  - Supported formats: PDF, DOCX

### Candidates
- **GET** `/candidates` - Fetch all candidates
- **POST** `/candidates` - Add a new candidate

## Project Structure

```
ai-recruiter-bot/
├── backend/
│   ├── models/
│   │   └── Candidate.js          # MongoDB Candidate schema
│   ├── routes/
│   │   ├── chat.js               # Chat endpoint
│   │   └── upload.js             # File upload endpoint
│   ├── utils/
│   │   ├── aiScore.js            # AI scoring logic
│   │   └── parser.js             # Document parsing utility
│   ├── server.js                 # Express server entry point
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── App.jsx               # Main React component
│   │   ├── ChatBot.jsx           # Chatbot interface
│   │   ├── Upload.jsx            # File upload component
│   │   ├── CandidateList.jsx     # Display candidates
│   │   ├── main.jsx              # React entry point
│   │   └── index.css             # Global styles
│   ├── index.html
│   ├── vite.config.js            # Vite configuration
│   └── package.json
└── README.md
```

## Current AI Model

The application uses **Llama 3.3 70B Versatile** model from Groq for optimal performance and cost-effectiveness.

## Troubleshooting

### "Chatbot temporarily unavailable"
- Check `.env` file has correct API keys
- Verify MongoDB connection
- Check backend console for error details

### File Upload Not Working
- Ensure MongoDB is running
- Check file size limits in multer configuration
- Verify supported file formats (PDF, DOCX)

### API Key Issues
- Generate a new key from [console.groq.com](https://console.groq.com)
- Ensure API key is set in `.env` file
- Restart backend server after changing `.env`

## Contributing

Feel free to submit issues and enhancement requests!

## License

This project is open source and available under the MIT License.

## Support

For questions or issues:
1. Check the [Groq Documentation](https://console.groq.com/docs)
2. Review [MongoDB Atlas Docs](https://docs.mongodb.com/manual/)
3. Open an issue on GitHub

---

**Happy recruiting! 🚀**
