const express = require("express");
const mysql = require("mysql2/promise"); 
const firebase = require("firebase-admin");
const session = require("express-session");
const bcrypt = require("bcrypt"); 
const bodyParser = require("body-parser");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");
const { spawnSync } = require("child_process");
const translate = require("@vitalets/google-translate-api");
const axios = require("axios");

const app = express();
const PORT = 3000;

// Firebase Setup
const serviceAccount = require("./firebase-key.json");
firebase.initializeApp({
    credential: firebase.credential.cert(serviceAccount),
    databaseURL: "https://your-firebase-project.firebaseio.com"
});

// MySQL Connection
let db;
async function connectDB() {
    try {
        db = await mysql.createConnection({
            host: "localhost",
            user: "root",
            password: "Md112233",
            database: "healthchat"
        });
        console.log("✅ Connected to MySQL database");
    } catch (err) {
        console.error("❌ Database connection failed:", err);
        process.exit(1); // Exit if DB connection fails
    }
}
connectDB();

// Middleware
app.use(express.static(path.join(__dirname, "public")));
app.use(bodyParser.json());
app.use(session({
    secret: "supersecret",
    resave: false,
    saveUninitialized: true
}));

// Signup Route
app.post("/signup", async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.json({ success: false, message: "Username and password are required" });
    }

    try {
        const [users] = await db.execute("SELECT * FROM users WHERE username = ?", [username]);
        if (users.length > 0) {
            return res.json({ success: false, message: "User already exists" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        await db.execute("INSERT INTO users (username, password) VALUES (?, ?)", [username, hashedPassword]);

        req.session.user = username;
        return res.json({ success: true, message: "Signup successful" });
    } catch (err) {
        console.error("❌ Signup Error:", err);
        return res.json({ success: false, message: "Database error" });
    }
});

// Login Route
app.post("/login", async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.json({ success: false, message: "Username and password are required" });
    }

    try {
        const [users] = await db.execute("SELECT * FROM users WHERE username = ?", [username]);
        if (users.length === 0) {
            return res.json({ success: false, message: "Invalid credentials" });
        }

        const validPassword = await bcrypt.compare(password, users[0].password);
        if (!validPassword) {
            return res.json({ success: false, message: "Invalid credentials" });
        }

        req.session.user = username;
        return res.json({ success: true, message: "Login successful" });
    } catch (err) {
        console.error("❌ Login Error:", err);
        return res.json({ success: false, message: "Database error" });
    }
});

// Logout Route
app.get("/logout", (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error("❌ Logout error:", err);
            return res.status(500).json({ success: false, message: "Logout failed" });
        }
        res.clearCookie("connect.sid", { path: "/" });
        return res.json({ success: true, message: "Logged out successfully" });
    });
});

// Emergency Contact Save API
app.post("/save-emergency-contact", async (req, res) => {
    const { username, phoneNumber } = req.body;

    if (!username || !phoneNumber) {
        return res.status(400).json({ success: false, message: "Username and phone number are required." });
    }

    try {
        await db.execute("UPDATE users SET emergency_contact = ? WHERE username = ?", [phoneNumber, username]);
        res.json({ success: true, message: "Emergency contact saved." });
    } catch (error) {
        console.error("❌ Saving emergency contact failed:", error.message);
        res.status(500).json({ success: false, message: "Database error" });
    }
});

// Twilio Emergency Alert
app.post("/trigger-emergency", async (req, res) => {
    const { username } = req.body;
    try {
        const [rows] = await db.execute("SELECT emergency_contact FROM users WHERE username = ?", [username]);
        const phoneNumber = rows[0]?.emergency_contact;

        if (!phoneNumber) {
            return res.status(400).json({ success: false, message: "No emergency contact found." });
        }

        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const authToken = process.env.TWILIO_AUTH_TOKEN;
        const fromNumber = process.env.TWILIO_FROM_NUMBER;
        const twilio = require("twilio")(accountSid, authToken);

        await twilio.messages.create({
            body: `🚨 Emergency Alert: ${username} may need urgent help. Sent via HealthChat.`,
            from: fromNumber,
            to: phoneNumber
        });

        res.json({ success: true, message: "Emergency SMS sent successfully." });
    } catch (err) {
        console.error("❌ Emergency Alert Error:", err.message);
        res.status(500).json({ success: false, message: "Emergency alert failed." });
    }
});


// Serve Dashboard Page
app.get("/dashboard", (req, res) => {
    if (!req.session.user) return res.redirect("/");
    res.sendFile(path.join(__dirname, "public", "dashboard.html"));
});

// Gemini Chat Route (simplified for demonstration)
const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function translateWithGoogle(text, targetLang = "en") {
    try {
        const res = await translate(text, { to: targetLang });
        return res.text;
    } catch (err) {
        console.error("Google Translate Error:", err.message);
        return text;
    }
}

async function detectUserLang(text) {
    if (text.match(/[அ-ஹ]/)) return "ta";
    if (text.match(/[ऀ-ॿ]/)) return "hi";
    return "en";
}
async function getHospitalSpecialtyFromGemini(message) {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
    const prompt = `Given the user's health query: "${message}", return ONLY the type of medical hospital/specialist they should see. Example responses: "eye hospital", "cardiologist", "dermatologist", "orthopedic". Do NOT include sentences.`;
    const result = await model.generateContent(prompt);
    return result?.response?.text()?.trim().toLowerCase() || "hospital";
}

async function findNearbyHospitals(lat, lon, specialty) {
    const radius = 10000; // 10km
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lon}&radius=${radius}&keyword=${encodeURIComponent(specialty)}&type=hospital&key=${apiKey}`;

    try {
        const response = await axios.get(url);
        return response.data.results.map(h => ({
            name: h.name,
            address: h.vicinity,
            rating: h.rating || "N/A",
            lat: h.geometry.location.lat,
            lon: h.geometry.location.lng
        })).slice(0, 5);
    } catch (err) {
        console.error("❌ Error fetching hospitals:", err.message);
        return [];
    }
}

async function safeGeminiCall(prompt, retries = 3) {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

    for (let i = 0; i < retries; i++) {
        try {
            const result = await model.generateContent(prompt);
            return result?.response?.text()?.trim();
        } catch (error) {
            if (error.message.includes("503") && i < retries - 1) {
                console.warn(`Gemini is overloaded. Retrying in 2s... (Attempt ${i + 1})`);
                await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
            } else {
                throw error;
            }
        }
    }
}


app.post("/chat", async (req, res) => {
    const { message, latitude, longitude } = req.body;

    try {
        const userLang = await detectUserLang(message);
        let messageInEnglish = userLang !== "en" ? await translateWithGoogle(message, "en") : message;

        let finalResponse = "";
        let hospitalList = [];

        const qaResult = spawnSync("python3", ["predict.py", messageInEnglish]);
        const medquadAnswer = qaResult.stdout.toString().trim();

        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        let geminiPrompt = "";

        if ((userLang === "hi" || userLang === "ta") && medquadAnswer) {
            geminiPrompt = `
You are a helpful multilingual AI medical assistant.
A user said: "${messageInEnglish}".
Please respond clearly and kindly in **${userLang === "hi" ? "Hindi" : "Tamil"}**.
Avoid suggesting medication. Keep it simple and educational.`;
        } else if (medquadAnswer) {
            geminiPrompt = `
You are a helpful AI healthcare assistant.

The following is a trusted medical answer from a verified dataset:
"${medquadAnswer}"

Please rephrase this to be friendly, clear, and easy to understand. Avoid medication advice.`;
        } else {
            return res.json({ response: "❌ Sorry, no reliable answer found for this query." });
        }

        try {
            const result = await model.generateContent(geminiPrompt);
            finalResponse = result?.response?.text()?.trim() || medquadAnswer;
        } catch (err) {
            console.warn("⚠️ Gemini failed. Showing MedQuad answer only.");
            finalResponse = medquadAnswer;
        }

        // Hospital Finder (only if English + geolocation provided)
        if (userLang === "en" && latitude && longitude) {
            const specialty = await getHospitalSpecialtyFromGemini(messageInEnglish);
            hospitalList = await findNearbyHospitals(latitude, longitude, specialty);
            if (hospitalList.length > 0) {
                finalResponse += `\n\n🏥 *Nearby ${specialty}s:*\n`;
                hospitalList.forEach((h, i) => {
                    finalResponse += `${i + 1}. **${h.name}** - ${h.address} (⭐ ${h.rating})\n`;
                });
            }
        }

        // Translate back to user's language if needed
        if (userLang !== "en") {
            finalResponse = await translateWithGoogle(finalResponse, userLang);
        } else {
            finalResponse = `📚 *Medical Insight*:\n${finalResponse}`;
        }
        if (req.session?.user) {
            try {
                await db.execute(
                    "INSERT INTO chat_history (username, user_message, bot_response) VALUES (?, ?, ?)",
                    [req.session.user, message, finalResponse]
                );
            } catch (e) {
                console.warn("⚠️ Failed to log chat to DB:", e.message);
            }
        }

        return res.json({ response: finalResponse, hospitals: hospitalList });

    } catch (err) {
        console.error("❌ Chatbot Error:", err.message);
        return res.json({
            response: "Something went wrong. Please try again later or consult a doctor directly."
        });
    }
});

app.get("/chat-history", async (req, res) => {
    const username = req.session?.user;
    if (!username) return res.status(403).json({ error: "Unauthorized" });

    try {
        const [rows] = await db.execute(
            "SELECT * FROM chat_history WHERE username = ? ORDER BY timestamp DESC LIMIT 50",
            [username]
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: "Database error" });
    }
});

// Disease prediction route
app.post("/predict_disease", (req, res) => {
    const symptoms = req.body.symptoms;
    const py = spawn("python3", ["predict.py", JSON.stringify(symptoms)]);

    let responseSent = false;

    py.stdout.on("data", (data) => {
        if (!responseSent) {
            const prediction = data.toString().trim();
            res.json({ disease: prediction });
            responseSent = true;
        }
    });

    py.stderr.on("data", (err) => {
        if (!responseSent) {
            console.error("Python error:", err.toString());
            res.status(500).json({ error: "Prediction failed." });
            responseSent = true;
        }
    });

    py.on("close", (code) => {
        if (!responseSent) {
            res.status(500).json({ error: "No prediction result returned." });
        }
    });
});



app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));