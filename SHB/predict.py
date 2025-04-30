import sys
import pickle
import numpy as np
import xgboost as xgb
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity


qa_model = SentenceTransformer("all-MiniLM-L6-v2")
with open("medquad_embeddings.pkl", "rb") as f:
    qa_data = pickle.load(f)

texts = qa_data["texts"]
embeds = np.array(qa_data["embeddings"])

def get_medquad_answer(query):
    query_embed = qa_model.encode([query])
    sims = cosine_similarity(query_embed, embeds)[0]
    top_idx = int(np.argmax(sims))
    return texts[top_idx]

def get_offline_medquad_answer(query):
    query_embed = model.encode([query])
    sims = cosine_similarity(query_embed, embeds)[0]
    best_index = np.argmax(sims)
    return texts[best_index]

# -------------------------
# Load XGBoost model + label encoder
# -------------------------
with open("label_encoder_top50_v161.pkl", "rb") as f:
    label_encoder = pickle.load(f)

symptom_model = xgb.XGBClassifier()
symptom_model.load_model("xgboost_top50_model.json")

# Get expected features from the model
feature_names = symptom_model.get_booster().feature_names

# -------------------------
# Process Input
# -------------------------
input_text = sys.argv[1].strip().lower().replace("_", " ")

# Match symptoms from text
matched_symptoms = []
for col in feature_names:
    clean_col = col.lower().replace("_", " ")
    if clean_col in input_text:
        matched_symptoms.append(col)

# Build binary symptom vector
symptom_vector = [1 if col in matched_symptoms else 0 for col in feature_names]

# Predict disease using symptoms
try:
    if sum(symptom_vector) == 0:
        raise ValueError("No symptoms matched")

    prediction = symptom_model.predict([symptom_vector])[0]
    predicted_disease = label_encoder.inverse_transform([prediction])[0]
    print(predicted_disease)

except Exception as e:
    # Fallback to MedQuAD QA
    fallback_answer = get_medquad_answer(input_text)
    print(f"medquad||{fallback_answer}")