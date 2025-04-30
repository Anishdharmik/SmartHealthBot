# SmartHealthBot

SmartHealthBot is a multilingual AI-powered healthcare chatbot that provides symptom-based diagnosis, medical Q&A, voice interaction, hospital recommendations, and emergency SMS alerts. Designed to be accessible both online and offline, it assists users in rural and low-connectivity areas using natural language processing and smart healthcare APIs.


🔍 Features
	•	✅ Medical Q&A Retrieval using MiniLM and MedQuad dataset
	•	✅ Symptom-based prediction using Semantic Search (cosine similarity)
	•	✅ Multilingual Support: Tamil, Hindi, English
	•	✅ Text-to-Speech using Web Speech API
	•	✅ Voice Input with Speech-to-Text (browser-based)
	•	✅ Google Maps API for nearby hospital recommendations
	•	✅ Twilio API Integration for SMS emergency alerts
	•	✅ User Authentication and chat session logging (via Firebase & MySQL)
	•	✅ Offline fallback using MedQuad if AI services are unavailable



🔧 Installation

git clone https://github.com/your-username/smarthealthbot.git
cd smarthealthbot
npm install

Make sure to add your API keys in a .env file.



🗝️ Environment Variables

Create a .env file in the root:

GEMINI_API_KEY=your_google_gemini_key
TWILIO_ACCOUNT_SID=your_sid
TWILIO_AUTH_TOKEN=your_token
TWILIO_FROM_NUMBER=your_twilio_number
GOOGLE_MAPS_API_KEY=your_google_maps_key


🚀 Run the App

node server.js

App runs at: http://localhost:3000



📦 Folder Structure

smarthealthbot/
│
├── public/               → Frontend files (HTML, JS, CSS)
├── medquad/              → MedQuad dataset (excluded in GitHub)
├── server.js             → Express backend logic
├── predict.py            → Symptom matcher using MiniLM
├── firebase-key.json     → Firebase Admin SDK (excluded)
├── .env                  → API keys (excluded)
├── README.md





⚠️ Notes
	•	🔒 The .env file and model datasets are excluded from GitHub for security and size reasons.
	•	🧠 For offline fallback, the predict.py script uses semantic search via pretrained sentence transformers.
	•	📤 Emergency contact and SMS functionality works only with verified numbers on Twilio Trial.



📜 License

MIT License © 2024

