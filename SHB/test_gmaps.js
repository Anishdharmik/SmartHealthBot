const axios = require("axios");
require("dotenv").config();

async function testGoogleMapsAPI() {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=12.9716,77.5946&radius=1000&type=hospital&key=${apiKey}`;

  try {
    const res = await axios.get(url);
    if (res.data.status === "OK") {
      console.log("✅ Google Maps API Key is working!");
      console.log("Sample hospital:", res.data.results[0].name);
    } else {
      console.log("❌ API error:", res.data.status);
    }
  } catch (err) {
    console.error("❌ Request failed:", err.message);
  }
}

testGoogleMapsAPI();