-- core tables
CREATE TABLE documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  title text NOT NULL,
  blob_url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE doc_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  page int NOT NULL,
  content text NOT NULL,
  embedding vector(1536),
  tokens int,
  CONSTRAINT uniq_doc_page_content UNIQUE(document_id, page, content)
);

CREATE TABLE quizzes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  title text NOT NULL,
  topic text,
  difficulty text NOT NULL CHECK (difficulty IN ('easy','hard')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  prompt text NOT NULL,
  difficulty text NOT NULL CHECK (difficulty IN ('easy','hard')),
  options jsonb NOT NULL,
  correct text NOT NULL,
  explanation text NOT NULL,
  rationales jsonb NOT NULL,
  source_refs jsonb NOT NULL
);

CREATE TABLE attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  started_at timestamptz DEFAULT now(),
  submitted_at timestamptz,
  score_pct int
);

CREATE TABLE answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id uuid NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  chosen_option_id text,
  is_correct boolean,
  feedback text
);

CREATE INDEX ON doc_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
