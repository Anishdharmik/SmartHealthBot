
const fs = require("fs");

const symptomColumns = JSON.parse(fs.readFileSync("symptom_columns.json", "utf-8"));

const symptomSynonyms = {
  "heart pain": "chest pain",
  "pain in heart": "chest pain",
  "running nose": "runny nose",
  "tiredness": "fatigue",
  "sick": "nausea"
};

// Simulate user input
const userInput = "I have heart pain and tiredness";
let inputText = userInput.toLowerCase();

// Apply synonym mapping
for (let phrase in symptomSynonyms) {
  if (inputText.includes(phrase)) {
    inputText += " " + symptomSynonyms[phrase];
  }
}

// Detect matched symptoms
const matchedSymptoms = symptomColumns.filter(symptom => {
  const plain = symptom.replace(/_/g, " ");
  const compressed = symptom.replace(/_/g, "");
  const spacedOut = symptom.split("_").join("");

  return (
    inputText.includes(plain) ||
    inputText.includes(compressed) ||
    inputText.includes(spacedOut)
  );
});

console.log("🧠 Matched symptoms from user input:");
console.log(matchedSymptoms);
