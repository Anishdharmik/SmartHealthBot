
import re

def extract_symptom_vector(text, symptom_list):
    text = text.lower()
    vector = []
    for symptom in symptom_list:
        # Normalize symptom like "muscle_pain" -> "muscle pain"
        sym_plain = symptom.replace("_", " ")
        if sym_plain in text or sym_plain.replace(" ", "") in text:
            vector.append(1)
        else:
            vector.append(0)
    return vector
