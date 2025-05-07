DROP TABLE IF EXISTS QuestionsDefi;
DROP TABLE IF EXISTS DefiSolo;

DROP TABLE IF EXISTS Questions;
DROP TABLE IF EXISTS Subthemes;

DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS Themes;


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



INSERT INTO users (username, password_hash, Description, admin)
VALUES
('admin', '$2a$10$WPwpecAkN611LTKQ9UhFgeisZ3RZWLa6RvEOgVn03BKCJLjaxIBf.', 'Administrator account', TRUE);

select * from users;