-- =============================================
-- Studio EISF - Database Schema
-- =============================================

-- Table users
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW(),
  last_login TIMESTAMP
);

-- Table projects
CREATE TABLE IF NOT EXISTS projects (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  status VARCHAR(20) DEFAULT 'draft',
  source_file_path VARCHAR(500),
  cleaned_text TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_opened_at TIMESTAMP,
  macro_score INTEGER,
  macro_feedback JSONB
);

-- Table podcasts
CREATE TABLE IF NOT EXISTS podcasts (
  id SERIAL PRIMARY KEY,
  project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  order_index INTEGER,
  word_count INTEGER,
  duration_seconds INTEGER,
  fidelity_score DECIMAL(5,2),
  ia_feedback JSONB,
  audio_url VARCHAR(500),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Table chapters
CREATE TABLE IF NOT EXISTS chapters (
  id SERIAL PRIMARY KEY,
  project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL,
  title VARCHAR(200) NOT NULL,
  content TEXT NOT NULL,
  word_count INTEGER,
  podcast_id INTEGER REFERENCES podcasts(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Table dialogues
CREATE TABLE IF NOT EXISTS dialogues (
  id SERIAL PRIMARY KEY,
  podcast_id INTEGER REFERENCES podcasts(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL,
  character VARCHAR(50) NOT NULL,
  text_studio TEXT NOT NULL,
  text_reading TEXT NOT NULL,
  duration_seconds INTEGER,
  section VARCHAR(50)
);

-- Table project_shares
CREATE TABLE IF NOT EXISTS project_shares (
  id SERIAL PRIMARY KEY,
  project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
  shared_with_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  permission VARCHAR(20) DEFAULT 'read_only',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index pour performances
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_podcasts_project_id ON podcasts(project_id);
CREATE INDEX IF NOT EXISTS idx_dialogues_podcast_id ON dialogues(podcast_id);
