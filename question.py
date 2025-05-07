# import re
# import json

# # Chemin vers le fichier texte contenant le document LaTeX
# input_file_path = 'question.txt'
# output_file_path = 'questions.json'

# # Lire le contenu du fichier texte
# with open(input_file_path, 'r', encoding='utf-8') as file:
#     latex_text = file.read()

# # Expression régulière pour extraire les questions et réponses
# pattern = r"\\question\{\}\s*(.*?)\s*\(\\raisebox\{\\depth\}\{\\scalebox\{-1\}\[-1\]\{(.*?)\}\}\)"

# # Trouver toutes les correspondances
# matches = re.findall(pattern, latex_text)

# # Convertir en JSON
# questions_json = [{"question": match[0].strip(), "answer": match[1]} for match in matches]

# # Exporter le résultat dans un fichier JSON
# with open(output_file_path, 'w', encoding='utf-8') as json_file:
#     json.dump(questions_json, json_file, ensure_ascii=False, indent=4)

# print(f"Les questions ont été exportées dans {output_file_path}")


import json
import uuid

# Chemin vers le fichier JSON contenant les questions
input_file_path = 'questions.json'
output_file_path = 'questions_with_ids.json'

# Lire le contenu du fichier JSON
with open(input_file_path, 'r', encoding='utf-8') as file:
    questions_data = json.load(file)

# Ajouter un identifiant unique à chaque question
for question in questions_data:
    question['id'] = str(uuid.uuid4())

# Enregistrer les questions avec les identifiants dans un nouveau fichier JSON
with open(output_file_path, 'w', encoding='utf-8') as json_file:
    json.dump(questions_data, json_file, ensure_ascii=False, indent=4)

print(f"Les questions avec identifiants ont été enregistrées dans {output_file_path}")