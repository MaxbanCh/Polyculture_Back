import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

// Get the connection string from the environment variable
// const databaseUrl = Deno.env.get("DATABASE_URL");

let client = new Client({
    hostname: "database", // Matches the service name in docker-compose.yml
    port: 5432,
    user: "postgres",
    password: "admin",
    database: "polyculture",
  });

let isConnected = false;

export async function connectToDatabase() {
  if (isConnected) {
    console.log("Database is already connected.");
    return;
  }

  let retries = 5;
  while (retries > 0) {
    try {
      await client.connect();
      isConnected = true;
      console.log("Connected to the database!");
      return;
    } catch (_err) {
      console.error("Database connection failed. Retrying in 5 seconds...");
      retries--;
      await new Promise((res) => setTimeout(res, 5000));
    }
  }
  throw new Error("Could not connect to the database after multiple attempts.");
}

export async function disconnectFromDatabase() {
  if (!isConnected) {
    console.log("Database is not connected.");
    return;
  }

  try {
    await client.end();
    isConnected = false;
    console.log("Disconnected from the database.");
  } catch (err) {
    console.error("Error while disconnecting from the database:", err);
  }
}

export async function executeQuery(query, params) {
  if (!isConnected) await connectToDatabase();
  try {
    return await client.queryObject(query, params);
  } catch (_error) {
    // Gestion appropriée des erreurs
  }
}

export async function withTransaction(callback) {
  if (!isConnected) await connectToDatabase();
  try {
    await client.queryObject("BEGIN");
    const result = await callback(client);
    await client.queryObject("COMMIT");
    return result;
  } catch (error) {
    await client.queryObject("ROLLBACK");
    throw error;
  }
}

// Function to check if database tables already exist
async function tablesExist() {
  try {
    const result = await executeQuery(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
      );
    `, []);
    
    return result.rows[0].exists;
  } catch (error) {
    console.error("Error checking if tables exist:", error);
    return false;
  }
}

// Function to initialize the database
export async function initializeDatabase() {
  console.log("Starting database initialization...");
  
  try {
    await connectToDatabase();
    
    // Check if tables already exist
    const exists = await tablesExist();
    if (exists) {
      console.log("Database tables already exist. Initialization skipped.");
      return;
    }
    
    console.log("No existing tables found. Creating database structure...");
    
    // Drop existing tables
    console.log("Dropping any partial tables if needed...");
    await executeQuery(`
      DROP TABLE IF EXISTS PoolAttemptQuestion;
      DROP TABLE IF EXISTS PoolAttempt;
      DROP TABLE IF EXISTS QuestionPool_Questions;
      DROP TABLE IF EXISTS QuestionPool;
      DROP TABLE IF EXISTS QuestionsDefi;
      DROP TABLE IF EXISTS DefiSolo;
      DROP TABLE IF EXISTS Questions;
      DROP TABLE IF EXISTS Subthemes;
      DROP TABLE IF EXISTS Themes;
      DROP TABLE IF EXISTS users;
    `, []);
    
    // Create basic tables
    console.log("Creating base tables...");
    await executeQuery(`
      CREATE TABLE users (
          id SERIAL PRIMARY KEY,
          username VARCHAR(100) NOT NULL UNIQUE,
          password_hash VARCHAR(100) NOT NULL,
          Description TEXT,
          admin BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE Themes (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100) NOT NULL UNIQUE,
          description TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE Subthemes (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100) NOT NULL UNIQUE,
          description TEXT,
          theme_id INT REFERENCES Themes(id),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE Questions (
          id SERIAL PRIMARY KEY,
          subtheme_id INT REFERENCES Subthemes(id),
          question TEXT NOT NULL,
          question_type VARCHAR(50) NOT NULL,
          answer TEXT NOT NULL,
          media TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `, []);
    
    // Create DefiSolo tables
    console.log("Creating DefiSolo tables...");
    await executeQuery(`
      CREATE TABLE DefiSolo (
          id SERIAL PRIMARY KEY,
          user_id INT REFERENCES users(id),
          score INT DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE QuestionsDefi (
          id SERIAL PRIMARY KEY,
          question_id INT REFERENCES Questions(id),
          defi_id INT REFERENCES DefiSolo(id),
          answer TEXT,
          time_taken INT
      );
    `, []);
    
    // Create QuestionPool tables
    console.log("Creating QuestionPool tables...");
    await executeQuery(`
      CREATE TABLE QuestionPool (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          description TEXT,
          user_id INT REFERENCES users(id),
          is_public BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE QuestionPool_Questions (
          id SERIAL PRIMARY KEY,
          pool_id INT REFERENCES QuestionPool(id) ON DELETE CASCADE,
          question_id INT REFERENCES Questions(id) ON DELETE CASCADE,
          position INT,
          UNIQUE(pool_id, question_id)
      );
      
      -- Index pour améliorer les performances des requêtes courantes
      CREATE INDEX idx_questionpool_questions_pool_id ON QuestionPool_Questions(pool_id);
      CREATE INDEX idx_questionpool_questions_question_id ON QuestionPool_Questions(question_id);
    `, []);
    
    // Create PoolAttempt tables
    console.log("Creating PoolAttempt tables and indexes...");
    await executeQuery(`
      CREATE TABLE PoolAttempt (
          id SERIAL PRIMARY KEY,
          user_id INT REFERENCES users(id),
          pool_id INT REFERENCES QuestionPool(id),
          correct_answers INT DEFAULT 0,
          total_questions INT DEFAULT 0,
          total_time_seconds INT DEFAULT 0,
          completed BOOLEAN DEFAULT false,
          started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          completed_at TIMESTAMP
      );

      CREATE TABLE PoolAttemptQuestion (
          id SERIAL PRIMARY KEY,
          attempt_id INT REFERENCES PoolAttempt(id) ON DELETE CASCADE,
          question_id INT REFERENCES Questions(id),
          user_answer TEXT,
          is_correct BOOLEAN,
          time_taken_seconds INT,
          answered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(attempt_id, question_id)
      );
      
      -- Index pour améliorer les performances
      CREATE INDEX idx_poolattempt_user_id ON PoolAttempt(user_id);
      CREATE INDEX idx_poolattempt_pool_id ON PoolAttempt(pool_id);
      CREATE INDEX idx_poolattemptquestion_attempt_id ON PoolAttemptQuestion(attempt_id);
    `, []);
    
    // Create admin user
    console.log("Creating admin user...");
    await executeQuery(`
      INSERT INTO users (username, password_hash, Description, admin)
      VALUES ('admin', '$2a$10$WPwpecAkN611LTKQ9UhFgeisZ3RZWLa6RvEOgVn03BKCJLjaxIBf.', 'Administrator account', TRUE);
    `, []);
    
    console.log("Database initialization completed successfully!");
    
  } catch (error) {
    console.error("Database initialization failed:", error);
    throw error;
  }
}

export default client;



