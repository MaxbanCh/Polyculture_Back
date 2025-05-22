import { pool } from '../database';

interface QuestionData {
  id: string;
  question: string;
  answer: string;
  theme: string;
}

export async function getQuestionsByThemes(themes: string[], count: number): Promise<QuestionData[]> {
  try {
    // Example using a database pool
    const themeList = themes.map(theme => `'${theme}'`).join(',');
    const query = `
      SELECT id, question, answer, theme 
      FROM questions 
      WHERE theme IN (${themeList || "'General'"})
      ORDER BY RANDOM() 
      LIMIT $1
    `;
    
    const result = await pool.query(query, [count]);
    return result.rows;
  } catch (error) {
    console.error('Database error:', error);
    
    // Return fallback questions if database fails
    return [
      { id: "1", question: "What is the capital of France?", answer: "Paris", theme: "Geography" },
      { id: "2", question: "Who painted the Mona Lisa?", answer: "Leonardo da Vinci", theme: "Art" },
      { id: "3", question: "What is the chemical symbol for gold?", answer: "Au", theme: "Science" },
      { id: "4", question: "Which planet is known as the Red Planet?", answer: "Mars", theme: "Astronomy" },
      { id: "5", question: "What is the tallest mountain in the world?", answer: "Mount Everest", theme: "Geography" },
      { id: "6", question: "Who wrote 'Romeo and Juliet'?", answer: "William Shakespeare", theme: "Literature" },
      { id: "7", question: "What is the largest organ in the human body?", answer: "Skin", theme: "Biology" },
      { id: "8", question: "In which year did World War II end?", answer: "1945", theme: "History" },
      { id: "9", question: "What is the capital of Japan?", answer: "Tokyo", theme: "Geography" },
      { id: "10", question: "Who discovered penicillin?", answer: "Alexander Fleming", theme: "Science" }
    ].slice(0, count);
  }
}