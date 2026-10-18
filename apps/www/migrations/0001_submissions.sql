-- Form submissions from koomerce.app (worker/index.ts). `data` is the form's own fields as JSON.
CREATE TABLE submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL CHECK (kind IN ('waitlist', 'contact', 'changelog')),
  email TEXT NOT NULL,
  data TEXT NOT NULL DEFAULT '{}',
  country TEXT,
  created_at TEXT NOT NULL
);

-- One waitlist or changelog entry per email; contact messages may repeat.
CREATE UNIQUE INDEX submissions_kind_email ON submissions (kind, email) WHERE kind <> 'contact';

CREATE INDEX submissions_created ON submissions (created_at);
