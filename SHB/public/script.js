const symptomList = window.symptomList;

document.addEventListener("DOMContentLoaded", () => {
    
    const authForm = document.getElementById("authForm");
    const formTitle = document.getElementById("formTitle");
    const toggleForm = document.getElementById("toggleForm");

    let isLogin = true;
    toggleForm?.addEventListener("click", (e) => {
        e.preventDefault();
        isLogin = !isLogin;

        if (isLogin) {
            formTitle.innerText = "Login";
            toggleForm.innerHTML = "Don't have an account? <a href='#'>Sign up</a>";
        } else {
            formTitle.innerText = "Sign Up";
            toggleForm.innerHTML = "Already have an account? <a href='#'>Login</a>";
        }
    });

    authForm?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const username = document.getElementById("username").value;
        const password = document.getElementById("password").value;
        const endpoint = isLogin ? "/login" : "/signup";

        const response = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();
        sessionStorage.setItem("username", username);
        if (data.success) window.location.href = "/dashboard";
        else alert(data.message);
    });

    const user = sessionStorage.getItem("username") || "User";
    const userSpan = document.getElementById("username");
    if (userSpan) userSpan.innerText = user;

    
});

// Logout
document.getElementById("logoutBtn")?.addEventListener("click", async () => {
    const res = await fetch("/logout", { method: "GET", credentials: "same-origin" });
    const data = await res.json();
    if (data.success) {
        sessionStorage.clear();
        window.location.href = "/";
    } else {
        alert("Logout failed");
    }
});



function extractSymptomVector(userText, symptoms) {
    const text = userText.toLowerCase();
    return symptoms.map(symptom => text.includes(symptom.replace(/_/g, " ")) ? 1 : 0);
}

function openChat() {
    document.getElementById("chatbot-container").style.display = "block";
}

function closeChat() {
    document.getElementById("chatbot-container").style.display = "none";
}

async function sendMessage() {
    const inputField = document.getElementById("chat-input");
    const message = inputField.value.trim();
    if (!message) return;

    const chatBox = document.getElementById("chat-box");
    chatBox.innerHTML += `<p><strong>You:</strong> ${message}</p>`;
    inputField.value = "";
    navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
  
          const response = await fetch("/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message, latitude, longitude })
          });
  
          const data = await response.json();
          chatBox.innerHTML += `<p><strong>Bot:</strong> ${data.response}</p>`;
          chatBox.scrollTop = chatBox.scrollHeight;
          if (data.hospitals && data.hospitals.length > 0) {
              chatBox.innerHTML += `<p><strong>Nearby Hospitals:</strong></p>`;
              data.hospitals.forEach((h, i) => {
                chatBox.innerHTML += `
                  <p>${i + 1}. <b>${h.name}</b><br>
                  📍 ${h.address}<br>
                  📞 <a href="tel:" style="text-decoration: none;">Call</a> | 
                  <a href="https://www.google.com/maps/search/?api=1&query=${h.lat},${h.lon}" target="_blank">🗺️ Directions</a></p>
                `;
              });
            }
        },
        
        (error) => {
          alert("Please enable location access to find nearby hospitals.");
        }
      );

    try {
        const response = await fetch("/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message })
        });
        const data = await response.json();

        let detectedLang = "en";
        if (message.match(/[அ-ஹ]/)) detectedLang = "ta";
        else if (message.match(/[ऀ-ॿ]/)) detectedLang = "hi";

        chatBox.innerHTML += `
            <p><strong>Bot:</strong> ${data.response}</p>
            <button onclick="speak(\`${data.response}\`, '${detectedLang}')">🔊 Listen</button>
        `;

        // 🧠 Extract symptoms
        const symptomVector = extractSymptomVector(message, symptomList);
        const sum = symptomVector.reduce((a, b) => a + b, 0);

        if (sum >= 2) {
            const predictRes = await fetch("/predict_disease", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ symptoms: symptomVector })
            });

            if (!predictRes.ok) throw new Error("Prediction request failed");

            const data = await response.json();
            chatBox.innerHTML += `<p><strong>Bot:</strong><br>${data.response}</p>`;
        }

        chatBox.scrollTop = chatBox.scrollHeight;
    } catch (err) {
        console.error("Fetch Error:", err);
        chatBox.innerHTML += `<p><strong>Bot:</strong> An error occurred. Please try again later.</p>`;
    }
}


function startListening() {
    if (!('webkitSpeechRecognition' in window)) {
        alert("Speech Recognition not supported");
        return;
    }

    const selectedLang = document.getElementById("langSelect").value;
    const recognition = new webkitSpeechRecognition();
    recognition.lang = selectedLang;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
        const speech = event.results[0][0].transcript;
        document.getElementById("chat-input").value = speech;
    };

    recognition.onerror = (event) => {
        console.error("Speech recognition error:", event.error);
        alert("Speech recognition failed: " + event.error);
    };

    recognition.start();
}

function speak(text, lang) {
    if (!window.speechSynthesis) {
        alert("Speech synthesis not supported.");
        return;
    }

    const utterance = new SpeechSynthesisUtterance(text);

    // Set language tag
    if (lang === "ta") utterance.lang = "ta-IN";
    else if (lang === "hi") utterance.lang = "hi-IN";
    else utterance.lang = "en-IN";

    // Wait for voices to be loaded
    const speakWithVoice = () => {
        const voices = speechSynthesis.getVoices();
        const selectedVoice = voices.find(v => v.lang === utterance.lang || v.lang.startsWith(lang));

        if (selectedVoice) {
            utterance.voice = selectedVoice;
            speechSynthesis.speak(utterance);
        } else {
            console.warn(`⚠️ No voice found for ${utterance.lang}. Using default.`);
            speechSynthesis.speak(utterance);  // fallback
        }
    };

    // If voices are not yet loaded
    if (speechSynthesis.getVoices().length === 0) {
        speechSynthesis.addEventListener('voiceschanged', speakWithVoice);
    } else {
        speakWithVoice();
    }
}

function haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const toRad = (x) => (x * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

async function saveEmergencyContact() {
    const number = document.getElementById("emergencyNumber").value.trim();
    const status = document.getElementById("emergencyStatus");

    if (!number) {
        status.innerText = "Please enter a valid number.";
        return;
    }

    const username = sessionStorage.getItem("username");
    if (!username) {
        status.innerText = "User not found. Please log in again.";
        return;
    }

    const res = await fetch("/save-emergency-contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, phoneNumber: number })
    });

    const data = await res.json();
    status.innerText = data.message || "Saved.";
}

async function triggerEmergency() {
    const status = document.getElementById("emergencyStatus");
    const username = sessionStorage.getItem("username"); // ✅ fetch from session

    if (!username) {
        status.innerText = "User not found.";
        return;
    }

    const res = await fetch("/trigger-emergency", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }) // ✅ send username to server
    });

    if (!res.ok) {
        const errorText = await res.text();
        status.innerText = "❌ Error sending alert.";
        console.error("Error:", errorText);
        return;
    }

    const data = await res.json();
    status.innerText = data.message || "🚨 Alert sent!";
}
async function showChatHistory() {
    const modal = document.getElementById("chat-history-modal");
    const content = document.getElementById("chat-history-content");
    modal.classList.remove("hidden");
    content.innerHTML = "<p>Loading...</p>";
  
    try {
      const res = await fetch("/chat-history", {
        method: "GET",
        credentials: "same-origin"
      });
      const history = await res.json();
  
      if (!Array.isArray(history) || history.length === 0) {
        content.innerHTML = "<p>No chat history found.</p>";
        return;
      }
  
      content.innerHTML = history
        .map(entry => `
          <div style="margin-bottom: 15px;">
            <strong>You:</strong> ${entry.user_message}<br>
            <strong>Bot:</strong> ${entry.bot_response}<br>
            <small style="color: gray;">${new Date(entry.timestamp).toLocaleString()}</small>
          </div>
          <hr>
        `)
        .join("");
    } catch (err) {
      console.error("❌ Failed to load chat history", err);
      content.innerHTML = "<p>Failed to load chat history.</p>";
    }
  }
  
  function closeChatHistory() {
    document.getElementById("chat-history-modal").classList.add("hidden");
  }