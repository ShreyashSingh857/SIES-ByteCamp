// Migration 0 - User Node
CREATE CONSTRAINT user_github_id_unique IF NOT EXISTS
  FOR (n:User) REQUIRE n.githubId IS UNIQUE;

CREATE CONSTRAINT user_id_unique IF NOT EXISTS
  FOR (n:User) REQUIRE n.id IS UNIQUE;

CREATE INDEX user_email_idx IF NOT EXISTS FOR (n:User) ON (n.email);
CREATE INDEX user_login_idx IF NOT EXISTS FOR (n:User) ON (n.githubLogin);

// Migration 1 - ChatSession Node
CREATE CONSTRAINT chat_session_id_unique IF NOT EXISTS
  FOR (n:ChatSession) REQUIRE n.id IS UNIQUE;

CREATE INDEX chat_session_user_idx IF NOT EXISTS FOR (n:ChatSession) ON (n.userId);
CREATE INDEX chat_session_scan_idx IF NOT EXISTS FOR (n:ChatSession) ON (n.scanId);
CREATE INDEX chat_session_created IF NOT EXISTS FOR (n:ChatSession) ON (n.createdAt);

// Migration 2 - ChatMessage Node
CREATE CONSTRAINT chat_message_id_unique IF NOT EXISTS
  FOR (n:ChatMessage) REQUIRE n.id IS UNIQUE;

CREATE INDEX chat_message_session_idx IF NOT EXISTS FOR (n:ChatMessage) ON (n.sessionId);
CREATE INDEX chat_message_created_idx IF NOT EXISTS FOR (n:ChatMessage) ON (n.createdAt);

// Migration 3 - New relationships are enforced in application logic
// (User)-[:OWNS]->(Scan)
// (User)-[:HAS_SESSION]->(ChatSession)
// (ChatSession)-[:HAS_MESSAGE]->(ChatMessage)
// (ChatSession)-[:ABOUT_SCAN]->(Scan)

// Migration 4 - Extend Scan Node / backfill
CREATE INDEX scan_user_idx IF NOT EXISTS FOR (n:Scan) ON (n.userId);

MERGE (u:User {id: 'system-user-000'})
  SET u.githubLogin = 'system',
      u.name = 'System User',
      u.createdAt = datetime()
WITH u
MATCH (s:Scan) WHERE s.userId IS NULL
SET s.userId = 'system-user-000'
MERGE (u)-[:OWNS]->(s);
