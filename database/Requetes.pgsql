-- DROP TABLE IF EXISTS QuestionsDefi;
-- DROP TABLE IF EXISTS DefiSolo;

-- DROP TABLE IF EXISTS Questions;
-- DROP TABLE IF EXISTS Subthemes;

-- -- DROP TABLE IF EXISTS users;
-- DROP TABLE IF EXISTS Themes;


-- Basic tables for the app :

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

-- Tables for DefiSolo

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



-- INSERT INTO users (username, password_hash, Description, admin)
-- VALUES
-- ('admin', '$2a$10$WPwpecAkN611LTKQ9UhFgeisZ3RZWLa6RvEOgVn03BKCJLjaxIBf.', 'Administrator account', TRUE);

-- select * from users;


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

-- Table principale pour stocker les tentatives sur un pool de questions
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

-- Table détaillée pour stocker les réponses à chaque question
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