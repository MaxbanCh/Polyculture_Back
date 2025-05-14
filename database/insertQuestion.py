#!/usr/bin/env python3
# filepath: /polyculture/PolyCulture/Back/database/import_questions.py

import json
import psycopg2
from psycopg2 import sql

# Configuration de la base de données
DB_CONFIG = {
    'dbname': 'polyculture',  # remplacez par le nom de votre base de données
    'user': 'postgres',       # remplacez par votre nom d'utilisateur
    'password': 'admin',   # remplacez par votre mot de passe
    'host': 'localhost',
    'port': '5432'
}

def connect_to_db():
    """Établir une connexion à la base de données"""
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        print("Connexion à la base de données établie avec succès!")
        return conn
    except Exception as e:
        print(f"Erreur de connexion à la base de données: {e}")
        exit(1)

def load_questions_data(file_path):
    """Charger les questions depuis le fichier JSON"""
    try:
        with open(file_path, 'r', encoding='utf-8') as file:
            content = file.read()
            # Supprime les commentaires de type "// filepath: ..." s'ils existent
            if content.startswith('//'):
                content = content[content.find('\n[') + 1:]
            return json.loads(content)
    except Exception as e:
        print(f"Erreur lors du chargement des données: {e}")
        exit(1)

def insert_themes_and_subthemes(conn, questions_data):
    """Insérer les thèmes et sous-thèmes uniques dans la base de données"""
    themes = set()
    subthemes = {}  # {theme: set(subthemes)}
    
    # Collecter tous les thèmes et sous-thèmes uniques
    for question in questions_data:
        theme = question.get('theme', '').strip()
        subtheme = question.get('subtheme', '').strip()
        
        if theme:
            themes.add(theme)
            if theme not in subthemes:
                subthemes[theme] = set()
            if subtheme:
                subthemes[theme].add(subtheme)
    
    # Insérer les thèmes et sous-thèmes et garder leurs IDs
    theme_ids = {}
    subtheme_ids = {}
    
    cursor = conn.cursor()
    
    # Insérer les thèmes
    for theme in themes:
        cursor.execute(
            "INSERT INTO Themes (name) VALUES (%s) RETURNING id;",
            (theme,)
        )
        theme_id = cursor.fetchone()[0]
        theme_ids[theme] = theme_id
        print(f"Thème inséré: {theme} (ID: {theme_id})")
    
    # Insérer les sous-thèmes
    for theme, theme_subthemes in subthemes.items():
        theme_id = theme_ids.get(theme)
        if theme_id:
            for subtheme in theme_subthemes:
                if subtheme:  # Ignorer les sous-thèmes vides
                    cursor.execute(
                        "INSERT INTO Subthemes (name, theme_id) VALUES (%s, %s) RETURNING id;",
                        (subtheme, theme_id)
                    )
                    subtheme_id = cursor.fetchone()[0]
                    subtheme_ids[(theme, subtheme)] = subtheme_id
                    print(f"Sous-thème inséré: {subtheme} (Thème: {theme}, ID: {subtheme_id})")
    
    conn.commit()
    return theme_ids, subtheme_ids

def insert_questions(conn, questions_data, theme_ids, subtheme_ids):
    """Insérer les questions dans la base de données"""
    cursor = conn.cursor()
    questions_inserted = 0
    
    for question in questions_data:
        theme = question.get('theme', '').strip()
        subtheme = question.get('subtheme', '').strip()
        subtheme_id = subtheme_ids.get((theme, subtheme)) if theme and subtheme else None
        
        # Insérer la question
        cursor.execute(
            "INSERT INTO Questions (subtheme_id, question, question_type, answer) VALUES (%s, %s, %s, %s) RETURNING id;",
            (
                subtheme_id,
                question.get('question', ''),
                question.get('type', 'text'),
                question.get('answer', '')
            )
        )
        question_id = cursor.fetchone()[0]
        questions_inserted += 1
        
        if questions_inserted % 10 == 0:
            print(f"{questions_inserted} questions insérées...")
    
    conn.commit()
    print(f"Insertion terminée. {questions_inserted} questions insérées au total.")

def main():
    # Chemin vers votre fichier JSON
    file_path = '/polyculture/PolyCulture/Back/questions_with_ids.json'
    
    # Charger les données
    questions_data = load_questions_data(file_path)
    print(f"{len(questions_data)} questions chargées depuis le fichier JSON.")
    
    # Connexion à la base de données
    conn = connect_to_db()
    
    try:
        # Insérer les thèmes et sous-thèmes
        theme_ids, subtheme_ids = insert_themes_and_subthemes(conn, questions_data)
        
        # Insérer les questions
        insert_questions(conn, questions_data, theme_ids, subtheme_ids)
        
        print("Import réussi!")
    except Exception as e:
        conn.rollback()
        print(f"Erreur lors de l'importation: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    main()