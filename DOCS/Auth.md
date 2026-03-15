GitHub Copilot Implementation Prompt
SIES-ByteCamp — Auth, GitHub Repo Picker & Agentic AI Chat
Complete Schema Changes, Migration Queries & Step-by-Step Feature Implementation Guide
How to Use This Document
This document is the single source of truth for implementing three production-ready features on top of the existing SIES-ByteCamp codebase. Copy each section's prompt verbatim into GitHub Copilot Chat (Ctrl+I / @workspace), or use it as an Agent-mode instruction. Each feature section contains:
A plain-English spec of what to build
All new / modified Neo4j Cypher schema statements to run first
Every new file to create and every existing file to modify, with precise diffs
End-to-end wiring notes so Copilot has full context
Run the schema migrations in order (0 → 1 → 2 → 3) before any code changes.
Current Codebase Context (Read Before Implementing)
Hand this summary to Copilot so it understands the project before reading any feature prompt.
Stack
Layer
Technology
Notes
Frontend
React 18 + Vite + Redux Toolkit + React Router v6
src/ with pages/, contexts/, store/, components/
Backend
Node.js ES Modules + Express 5
Backend/ with src/controllers, services, routes, db
Graph DB
Neo4j 6 (neo4j-driver)
Backend/src/config/neo4j.js + Backend/src/db/neo4j.queries.js
AI Engine
Node.js CLI (AI-Engine/src/index.js)
Called via child_process from scan.controller.js
Auth (current)
Mock — localStorage only, no real backend
Frontend/src/contexts/AuthContext.jsx
Chat (current)
Does not exist yet
Agentic AI feature to be built from scratch


Key Existing Files — DO NOT DELETE
File
Purpose
Backend/src/controllers/scan.controller.js
Core scan logic — postScan, getGraph, analyzeDependencies*
Backend/src/db/neo4j.queries.js
All Neo4j queries including seedParsedGraph, findSymbolOccurrences
Backend/app.js
Express app wiring — add new routers here
Frontend/src/contexts/AuthContext.jsx
REPLACE this with real GitHub OAuth (keep same export shape)
Frontend/src/App.jsx
Route definitions — add /chat here
Frontend/src/store/slices/apiSlice.js
RTK Query endpoints — add GitHub & Chat endpoints here
Frontend/src/pages/UploadRepo.jsx
Add 'Browse My GitHub Repos' button here


Part 1 — Neo4j Schema Changes & Migration Queries
Run ALL of the following Cypher statements against your Neo4j instance BEFORE writing any code. They are additive — they will not break existing data.
Migration 0 — User Node (new)
Stores authenticated GitHub users. Every Scan will link to a User.
// Create User node constraint
CREATE CONSTRAINT user_github_id_unique IF NOT EXISTS
  FOR (n:User) REQUIRE n.githubId IS UNIQUE;

CREATE CONSTRAINT user_id_unique IF NOT EXISTS
  FOR (n:User) REQUIRE n.id IS UNIQUE;

CREATE INDEX user_email_idx IF NOT EXISTS FOR (n:User) ON (n.email);
CREATE INDEX user_login_idx  IF NOT EXISTS FOR (n:User) ON (n.githubLogin);
User node property schema:
Property
Type
Notes
id
string
UUID v4. Primary key.
githubId
string
Numeric GitHub user ID (e.g. '12345678'). Unique.
githubLogin
string
GitHub username, e.g. 'octocat'
name
string
Display name from GitHub profile
email
string
Primary email from GitHub (may be null)
avatarUrl
string
GitHub avatar_url
accessToken
string
GitHub OAuth access token — encrypted at rest
refreshToken
string
GitHub OAuth refresh token (if available)
tokenExpiresAt
datetime
ISO datetime when access token expires
createdAt
datetime
First login timestamp
lastSeenAt
datetime
Most recent login timestamp


Migration 1 — ChatSession Node (new)
Stores one Agentic AI chat session per user per scan. Each session has many ChatMessage children.
CREATE CONSTRAINT chat_session_id_unique IF NOT EXISTS
  FOR (n:ChatSession) REQUIRE n.id IS UNIQUE;

CREATE INDEX chat_session_user_idx  IF NOT EXISTS FOR (n:ChatSession) ON (n.userId);
CREATE INDEX chat_session_scan_idx  IF NOT EXISTS FOR (n:ChatSession) ON (n.scanId);
CREATE INDEX chat_session_created   IF NOT EXISTS FOR (n:ChatSession) ON (n.createdAt);
Property
Type
Notes
id
string
UUID v4
userId
string
FK → User.id
scanId
string
FK → Scan.id (nullable — session may not be tied to a scan)
repoId
string
Local repoId string from the file system graph
title
string
Auto-generated from first user message (first 60 chars)
messageCount
integer
Incremented on each message append
createdAt
datetime
Session start
updatedAt
datetime
Last message timestamp


Migration 2 — ChatMessage Node (new)
CREATE CONSTRAINT chat_message_id_unique IF NOT EXISTS
  FOR (n:ChatMessage) REQUIRE n.id IS UNIQUE;

CREATE INDEX chat_message_session_idx IF NOT EXISTS FOR (n:ChatMessage) ON (n.sessionId);
CREATE INDEX chat_message_created_idx IF NOT EXISTS FOR (n:ChatMessage) ON (n.createdAt);
Property
Type
Notes
id
string
UUID v4
sessionId
string
FK → ChatSession.id
userId
string
FK → User.id
role
string
'user' | 'assistant' | 'system'
content
string
Raw message text
toolCalls
string
JSON string of any tool calls made by the AI
tokenCount
integer
Estimated token count for context window tracking
createdAt
datetime
Message timestamp
model
string
LLM model used, e.g. 'gpt-4.1-mini'


Migration 3 — New Relationships
// User OWNS Scan (replaces userId string property for graph traversal)
// Relationship: (User)-[:OWNS]->(Scan)
// No extra constraint needed — enforced via application logic

// User HAS_SESSION ChatSession
// Relationship: (User)-[:HAS_SESSION]->(ChatSession)

// ChatSession HAS_MESSAGE ChatMessage
// Relationship: (ChatSession)-[:HAS_MESSAGE]->(ChatMessage)

// Scan REFERENCES ChatSession (optional link)
// Relationship: (ChatSession)-[:ABOUT_SCAN]->(Scan)
Migration 4 — Extend Scan Node
Add userId property index (already defined in base schema, but re-run is safe) and link existing scans to a placeholder user if needed:
// Ensure index exists (idempotent)
CREATE INDEX scan_user_idx IF NOT EXISTS FOR (n:Scan) ON (n.userId);

// If you want to backfill a 'system' user for pre-auth scans:
MERGE (u:User {id: 'system-user-000'})
  SET u.githubLogin = 'system',
      u.name = 'System User',
      u.createdAt = datetime()
WITH u
MATCH (s:Scan) WHERE s.userId IS NULL
SET s.userId = 'system-user-000'
MERGE (u)-[:OWNS]->(s);
Part 2 — Feature 1: GitHub OAuth (Backend + Frontend)
IMPORTANT: The current AuthContext.jsx uses a fully mocked login with localStorage. Replace it entirely with real GitHub OAuth 2.0 using PKCE on the frontend and a token-exchange endpoint on the backend. Keep the same exported API shape: { user, login, logout, loading, isAuthenticated }.
Step 1 — Register a GitHub OAuth App
Go to https://github.com/settings/developers → 'New OAuth App'
Set Homepage URL: http://localhost:5173
Set Authorization callback URL: http://localhost:5000/api/auth/github/callback
Copy the Client ID and generate a Client Secret
Add to Backend/.env:
GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret
GITHUB_CALLBACK_URL=http://localhost:5000/api/auth/github/callback
JWT_SECRET=a_long_random_string_at_least_64_chars
JWT_REFRESH_SECRET=another_long_random_string
CLIENT_URL=http://localhost:5173
NODE_ENV=development
Add to Frontend/.env:
VITE_API_URL=http://localhost:5000/api
VITE_GITHUB_CLIENT_ID=your_client_id
Step 2 — Backend: Create auth.service.js
CREATE new file: Backend/src/services/auth.service.js
This service handles GitHub token exchange, user upsert into Neo4j, and JWT issuance. Implement the following functions:
exchangeGithubCode(code) — POST to https://github.com/login/oauth/access_token with client_id, client_secret, code. Return { access_token }.
getGithubUser(accessToken) — GET https://api.github.com/user with Authorization: Bearer {accessToken}. Return raw GitHub user object.
upsertUserInNeo4j(githubUser, accessToken) — MERGE on githubId, SET all properties, return the full User node.
issueJwt(userId) — sign a short-lived JWT (15m) with { sub: userId }. Return { accessToken, refreshToken }.
verifyJwt(token) — verify and decode. Throw on invalid.
Use the existing neo4j getSession() from Backend/src/config/neo4j.js. The Cypher MERGE pattern for upsert:
MERGE (u:User {githubId: $githubId})
SET u.id = COALESCE(u.id, $newId),
    u.githubLogin = $login,
    u.name = $name,
    u.email = $email,
    u.avatarUrl = $avatarUrl,
    u.accessToken = $accessToken,
    u.lastSeenAt = datetime()
ON CREATE SET u.createdAt = datetime()
RETURN u
Step 3 — Backend: Create auth.controller.js
CREATE or REPLACE: Backend/src/controllers/auth.controller.js
Implement 4 exported async functions:
githubRedirect(req, res) — redirects browser to https://github.com/login/oauth/authorize?client_id=...&scope=repo,user:email&state=<random>. Set state in a signed cookie for CSRF protection.
githubCallback(req, res, next) — receives code + state, validates state cookie, calls exchangeGithubCode, getGithubUser, upsertUserInNeo4j, issueJwt. Sets refreshToken in httpOnly cookie. Redirects to CLIENT_URL + '/auth/callback?token=' + accessToken.
refreshToken(req, res, next) — reads refreshToken cookie, verifies it, issues new accessToken. Returns { data: { accessToken } }.
logout(req, res) — clears refreshToken cookie. Returns { success: true }.
Step 4 — Backend: Create auth.middleware.js
CREATE new file: Backend/src/middlewares/auth.middleware.js
Export requireAuth middleware: extract Bearer token from Authorization header, call verifyJwt, attach decoded user to req.user. On failure return 401. This middleware will protect all scan, chat, and user routes.
Step 5 — Backend: Wire auth routes
REPLACE Backend/src/routes/auth.route.js with:
import express from 'express';
import { githubRedirect, githubCallback, refreshToken, logout }
  from '../controllers/auth.controller.js';
const router = express.Router();
router.get('/github',           githubRedirect);
router.get('/github/callback',  githubCallback);
router.post('/refresh-token',   refreshToken);
router.post('/logout',          logout);
export default router;
ADD to Backend/app.js (after existing imports):
import authRouter from './src/routes/auth.route.js';
// ... inside app setup ...
app.use('/api/auth', authRouter);
Step 6 — Frontend: Replace AuthContext.jsx
REPLACE Frontend/src/contexts/AuthContext.jsx with a real implementation. Keep the same exported shape: { user, login, logout, loading, isAuthenticated }. The new logic:
On mount: check localStorage for accessToken. If present, call GET /api/users/me to hydrate user state. On 401, attempt token refresh via POST /api/auth/refresh-token. If refresh fails, clear and set user = null.
login() — redirect window.location to /api/auth/github. This starts the OAuth flow.
After OAuth callback, the backend redirects to /auth/callback?token=<jwt>. Create a new page Frontend/src/pages/AuthCallback.jsx that reads the token from the URL, stores it in localStorage as 'accessToken', then navigates to /home.
logout() — call POST /api/auth/logout, clear localStorage, set user = null, navigate to /.
Add the callback route in App.jsx:
const AuthCallback = lazy(() => import('./pages/AuthCallback'));
// In <Routes>:
<Route path='/auth/callback' element={<AuthCallback />} />
Step 7 — Frontend: Update Login page
MODIFY Frontend/src/pages/Login.jsx: Replace the email/password form with a single 'Continue with GitHub' button. On click, call login() from useAuth (which redirects to GitHub). Show a loading spinner while redirecting. Keep the Logo component and existing styling.
Step 8 — Backend: Protect scan routes
MODIFY Backend/src/routes/scan.routes.js: import requireAuth middleware and apply it to all routes except GET /api/health. Also set req.user.id as the userId when creating a Scan node. Pass it from the controller.
Part 3 — Feature 2: GitHub Repository Picker
After login, users can browse their own GitHub repositories and click one to auto-fill the scan form, instead of manually pasting a URL. This is a convenience enhancement to UploadRepo.jsx.
Step 1 — Backend: Add GitHub Repos endpoint
CREATE new file: Backend/src/controllers/user.controller.js
Implement getMyRepos(req, res, next):
Fetch the authenticated user's GitHub access token from Neo4j using req.user.id.
Call GitHub API: GET https://api.github.com/user/repos?sort=updated&per_page=100&type=owner with the token.
Return array of { id, name, full_name, description, private, language, stargazers_count, updated_at, html_url, clone_url, default_branch }.
MODIFY Backend/src/routes/user.route.js:
import express from 'express';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { getMyRepos } from '../controllers/user.controller.js';
const router = express.Router();
router.use(requireAuth);
router.get('/me/repos', getMyRepos);
export default router;
MODIFY Backend/app.js — add the user router:
import userRouter from './src/routes/user.route.js';
app.use('/api/users', userRouter);
Step 2 — Frontend: Add RTK Query endpoint
MODIFY Frontend/src/store/slices/apiSlice.js — add inside the endpoints builder:
getMyRepos: builder.query({
  query: () => '/users/me/repos',
  transformResponse: (response) => response.data ?? response,
}),
Export the new hook: export const { useGetMyReposQuery } = apiSlice;
Step 3 — Frontend: Create RepoPicker component
CREATE new file: Frontend/src/components/RepoPicker.jsx
This is a modal/drawer component. Props: { open, onClose, onSelect }. Implementation:
Call useGetMyReposQuery() on mount. Show a loading skeleton while fetching.
Render a searchable list of repos. Search filters by repo name client-side.
Each row shows: repo name (bold), language badge (color-coded), star count, last updated date, and a private/public indicator.
Clicking a repo calls onSelect({ url: repo.clone_url, branch: repo.default_branch, name: repo.name }).
Style consistent with existing dark-mode theme (use var(--bg), var(--border), var(--text), var(--primary-500)).
Step 4 — Frontend: Wire RepoPicker into UploadRepo
MODIFY Frontend/src/pages/UploadRepo.jsx:
Import RepoPicker and add a state variable: const [pickerOpen, setPickerOpen] = useState(false).
Add a button next to the URL input: 'Browse My Repos' with a Github icon. On click, setPickerOpen(true).
Implement handleRepoSelect({ url, branch, name }): set url into the url state, set branch, then automatically call handleAdd() to add it to the queue.
Render <RepoPicker open={pickerOpen} onClose={() => setPickerOpen(false)} onSelect={handleRepoSelect} /> at the bottom of the component.
Part 4 — Feature 3: Agentic AI Chat (Protected, Persistent)
Build a persistent, session-based AI chat interface that is only accessible after login. Chat history is stored in Neo4j. The AI has awareness of the current graph context (repoId + scanId).
Step 1 — Backend: ChatSession & ChatMessage queries
CREATE new file: Backend/src/db/chat.queries.js — implement the following Neo4j query functions:
// createChatSession({ id, userId, scanId, repoId, title })
// → MERGE (u:User {id:$userId})
//   CREATE (s:ChatSession {id:$id, ...})
//   MERGE (u)-[:HAS_SESSION]->(s)
//   OPTIONAL MATCH (scan:Scan {id:$scanId})
//   FOREACH (_ IN CASE WHEN scan IS NOT NULL THEN [1] ELSE [] END |
//     MERGE (s)-[:ABOUT_SCAN]->(scan))
//   RETURN s

// appendMessage({ id, sessionId, userId, role, content, model, tokenCount })
// → MATCH (s:ChatSession {id:$sessionId})
//   CREATE (m:ChatMessage {id:$id, ...})
//   MERGE (s)-[:HAS_MESSAGE]->(m)
//   SET s.updatedAt = datetime(), s.messageCount = s.messageCount + 1
//   RETURN m

// getSessionMessages(sessionId) — returns messages ORDER BY createdAt ASC
// getUserSessions(userId) — returns sessions ORDER BY updatedAt DESC
// deleteSession(sessionId, userId) — DETACH DELETE session + messages
Step 2 — Backend: Chat controller
CREATE new file: Backend/src/controllers/chat.controller.js — implement:
listSessions(req, res, next) — GET sessions for req.user.id from Neo4j. Return array.
createSession(req, res, next) — POST { scanId?, repoId? }. Create a new ChatSession node. Return session.
getSessionHistory(req, res, next) — GET session messages. Return messages array.
sendMessage(req, res, next) — The main handler. POST { sessionId, content, repoId?, scanId? }:
Validate session belongs to req.user.id
Persist user message via appendMessage()
Build conversation history from getSessionMessages()
If repoId provided, load graph JSON from disk (getGraphFilePath) and inject a system message summarizing the graph topology (node count, edge count, top files)
Call OpenAI (using existing llm.service.js pattern: process.env.OPENAI_API_KEY) with model gpt-4.1-mini, streaming: false, max_tokens: 2000
Persist AI response via appendMessage() with role: 'assistant'
Return { userMessage, assistantMessage }
deleteSession(req, res, next) — DELETE session + all messages.
Step 3 — Backend: Chat routes
CREATE new file: Backend/src/routes/chat.routes.js:
import express from 'express';
import { requireAuth } from '../middlewares/auth.middleware.js';
import {
  listSessions, createSession, getSessionHistory,
  sendMessage, deleteSession
} from '../controllers/chat.controller.js';
const router = express.Router();
router.use(requireAuth);  // all chat routes require login
router.get   ('/',                    listSessions);
router.post  ('/',                    createSession);
router.get   ('/:sessionId',          getSessionHistory);
router.post  ('/:sessionId/messages', sendMessage);
router.delete('/:sessionId',          deleteSession);
export default router;
ADD to Backend/app.js:
import chatRouter from './src/routes/chat.routes.js';
app.use('/api/chat', chatRouter);
Step 4 — Frontend: Chat API slice
ADD to Frontend/src/store/slices/apiSlice.js inside the endpoints builder:
listChatSessions: builder.query({
  query: () => '/chat',
  providesTags: ['ChatSession'],
  transformResponse: (r) => r.data ?? r,
}),
createChatSession: builder.mutation({
  query: (body) => ({ url: '/chat', method: 'POST', body }),
  invalidatesTags: ['ChatSession'],
  transformResponse: (r) => r.data ?? r,
}),
getChatHistory: builder.query({
  query: (sessionId) => `/chat/${sessionId}`,
  providesTags: (r, e, sessionId) => [{ type: 'ChatMessage', id: sessionId }],
  transformResponse: (r) => r.data ?? r,
}),
sendChatMessage: builder.mutation({
  query: ({ sessionId, ...body }) => ({
    url: `/chat/${sessionId}/messages`,
    method: 'POST', body,
  }),
  invalidatesTags: (r, e, { sessionId }) => [{ type: 'ChatMessage', id: sessionId }],
  transformResponse: (r) => r.data ?? r,
}),
deleteChatSession: builder.mutation({
  query: (sessionId) => ({ url: `/chat/${sessionId}`, method: 'DELETE' }),
  invalidatesTags: ['ChatSession'],
}),
Add 'ChatSession' and 'ChatMessage' to the tagTypes array at the top of the apiSlice config.
Step 5 — Frontend: Create Chat page
CREATE new file: Frontend/src/pages/Chat.jsx — a full-page chat interface with the following layout:
LEFT SIDEBAR (w-64, hidden on mobile):
Header: 'AI Chat' + 'New Chat' button (Plus icon)
Session list: map over listChatSessions data. Each row shows session title (first 40 chars), date, delete button. Active session highlighted with var(--primary-500) background.
On click: set activeSessionId state, which triggers getChatHistory query.
MAIN PANEL:
If no session: welcome screen with 'Start a new chat' CTA. If scanId is in Redux state, show 'Chat about your current graph' shortcut.
Messages list: scroll to bottom on new messages. User messages right-aligned (var(--primary-500) bubble). Assistant messages left-aligned (var(--card) bubble). Show a typing indicator (3 animated dots) while sendChatMessage is loading.
Input bar at bottom: textarea (Shift+Enter = newline, Enter = send), Send button. Disable while loading.
On first message in a new session: call createChatSession first, then sendChatMessage with the new sessionId.
GRAPH CONTEXT BADGE: If user has a current repoId in Redux (from useSelector(s => s.graph.currentRepoId)), show a small badge above the input: 'Context: {repoName}'. This repoId is sent with every message so the backend can load the graph.
Step 6 — Frontend: Wire Chat into App and Layout
MODIFY Frontend/src/App.jsx — add Chat route inside the ProtectedRoute/Layout block:
const Chat = lazy(() => import('./pages/Chat'));
// inside <Route path='/*' element={<ProtectedRoute>...}>
<Route path='chat' element={<Chat />} />
MODIFY Frontend/src/components/layout/Layout.jsx (or wherever the nav sidebar is) — add a nav item for Chat with MessageSquare icon from lucide-react. Route: /chat. Only show this nav item to authenticated users (check isAuthenticated from useAuth).
Part 5 — Environment Variables & Final Wiring Checklist
Complete .env reference
Backend/.env — full list of required variables:
Variable
Example / Notes
PORT
5000
CLIENT_URL
http://localhost:5173
NEO4J_URI
bolt://localhost:7687
NEO4J_USER
neo4j
NEO4J_PASSWORD
your_neo4j_password
GITHUB_CLIENT_ID
From GitHub OAuth App
GITHUB_CLIENT_SECRET
From GitHub OAuth App
GITHUB_CALLBACK_URL
http://localhost:5000/api/auth/github/callback
JWT_SECRET
64+ char random string
JWT_REFRESH_SECRET
Different 64+ char random string
OPENAI_API_KEY
sk-... (for LLM chat features)
OPENAI_MODEL
gpt-4.1-mini
NODE_ENV
development


Frontend/.env:
Variable
Example / Notes
VITE_API_URL
http://localhost:5000/api
VITE_GITHUB_CLIENT_ID
Same as backend GITHUB_CLIENT_ID


Implementation Order — Follow Exactly
Run all 5 Neo4j migration Cypher blocks (Part 1)
Implement auth.service.js + auth.controller.js + auth.middleware.js (Feature 1, Steps 2-4)
Wire auth routes in app.js (Feature 1, Step 5)
Replace AuthContext.jsx + create AuthCallback.jsx (Feature 1, Step 6-7)
Protect scan routes with requireAuth (Feature 1, Step 8)
Create user.controller.js + user.route.js + wire in app.js (Feature 2, Steps 1-2)
Create RepoPicker.jsx + modify UploadRepo.jsx (Feature 2, Steps 3-4)
Create chat.queries.js (Feature 3, Step 1)
Create chat.controller.js (Feature 3, Step 2)
Create chat.routes.js + wire in app.js (Feature 3, Step 3)
Extend apiSlice.js with chat + repo endpoints (Features 2+3, Steps 2+4)
Create Chat.jsx (Feature 3, Step 5)
Update App.jsx and Layout for chat route/nav (Feature 3, Step 6)
End-to-end test: login → pick repo → scan → open chat → ask about graph
Security Notes for Copilot
NEVER store GitHub access tokens in plaintext in the JWT payload or localStorage. Store only userId in the JWT. Fetch the token from Neo4j when making GitHub API calls server-side.
Always validate that req.user.id matches the userId of the resource being accessed (chat sessions, scan data). Return 403 if they don't match.
CSRF: use the state parameter in GitHub OAuth and validate it server-side with a signed cookie before accepting the callback.
The refreshToken must be stored in an httpOnly, Secure, SameSite=Strict cookie — never in localStorage.
Rate-limit the /api/auth/github/callback endpoint (express-rate-limit, 10 req/15min per IP).
Part 6 — Ready-to-Use Copilot Chat Prompts (Copy-Paste)
Each prompt below is self-contained. Paste into GitHub Copilot Chat / Agent mode. Start with Prompt 0 and proceed in order.
Prompt 0 — Context Loader
Paste this first in every Copilot session to set context:
I am working on SIES-ByteCamp, a polyglot code dependency graph tool. Stack: React 18 + Vite frontend, Node.js ESM + Express 5 backend, Neo4j graph DB, Redux Toolkit + RTK Query, React Router v6. The backend uses neo4j-driver v6, jsonwebtoken, bcrypt, simple-git, axios, openai. The frontend uses lucide-react icons and a custom CSS variable theme (var(--bg), var(--text), var(--primary-500), var(--card), var(--border)). Do not suggest TypeScript migrations. Do not suggest Prisma — we use Neo4j exclusively. Read @workspace before generating code.
Prompt 1 — GitHub OAuth Backend
Implement GitHub OAuth 2.0 in the backend. Create Backend/src/services/auth.service.js with: exchangeGithubCode(code), getGithubUser(accessToken), upsertUserInNeo4j(githubUser, accessToken) using Cypher MERGE on githubId, issueJwt(userId) issuing a 15-minute access JWT and a 7-day refresh JWT. Create Backend/src/controllers/auth.controller.js with githubRedirect, githubCallback (sets refresh token in httpOnly cookie, redirects to CLIENT_URL/auth/callback?token=<jwt>), refreshToken, logout. Create Backend/src/middlewares/auth.middleware.js with requireAuth. Replace Backend/src/routes/auth.route.js. Add all routes to Backend/app.js. Use existing getSession() from Backend/src/config/neo4j.js. Use User node schema: { id, githubId, githubLogin, name, email, avatarUrl, accessToken, createdAt, lastSeenAt }.
Prompt 2 — GitHub OAuth Frontend
Replace Frontend/src/contexts/AuthContext.jsx. Keep the exact same export shape: { user, login, logout, loading, isAuthenticated }. login() redirects to /api/auth/github. On mount, check localStorage for 'accessToken', call GET /api/users/me to hydrate user, on 401 call POST /api/auth/refresh-token. Create Frontend/src/pages/AuthCallback.jsx that reads ?token= from URL, stores in localStorage as 'accessToken', then navigates to /home. Add <Route path='/auth/callback' element={<AuthCallback />} /> in App.jsx (as a public route, outside ProtectedRoute). Replace Login.jsx form with a single 'Continue with GitHub' button using the Github icon from lucide-react.
Prompt 3 — Repo Picker
Implement the GitHub repo picker. Backend: create Backend/src/controllers/user.controller.js with getMyRepos(req, res, next) that fetches the user's GitHub access token from Neo4j using req.user.id, then calls GET https://api.github.com/user/repos?sort=updated&per_page=100&type=owner and returns the array. Add route GET /users/me/repos in Backend/src/routes/user.route.js protected by requireAuth. Register in app.js. Frontend: add getMyRepos RTK Query endpoint to apiSlice.js. Create Frontend/src/components/RepoPicker.jsx — a modal with a search input and scrollable repo list (name, language badge, stars, updated date). On repo click, call prop onSelect({ url, branch, name }). Modify UploadRepo.jsx to add a 'Browse My Repos' button (Github icon) that opens RepoPicker, and on select auto-fills the URL and branch fields and adds the repo to the queue.
Prompt 4 — Agentic Chat Backend
Build the persistent Agentic AI chat backend. Create Backend/src/db/chat.queries.js with: createChatSession({ id, userId, scanId, repoId, title }), appendMessage({ id, sessionId, userId, role, content, model, tokenCount }), getSessionMessages(sessionId), getUserSessions(userId), deleteSession(sessionId, userId). ChatSession node: { id, userId, scanId, repoId, title, messageCount, createdAt, updatedAt }. ChatMessage node: { id, sessionId, userId, role, content, model, tokenCount, createdAt }. Relationships: (User)-[:HAS_SESSION]->(ChatSession)-[:HAS_MESSAGE]->(ChatMessage), (ChatSession)-[:ABOUT_SCAN]->(Scan). Create Backend/src/controllers/chat.controller.js with listSessions, createSession, getSessionHistory, sendMessage (loads graph JSON if repoId present, builds message history, calls OpenAI gpt-4.1-mini, persists response), deleteSession. Create Backend/src/routes/chat.routes.js protected by requireAuth. Register app.use('/api/chat', chatRouter) in app.js.
Prompt 5 — Agentic Chat Frontend
Build the Agentic AI chat UI. Extend apiSlice.js with: listChatSessions (query, GET /chat), createChatSession (mutation, POST /chat), getChatHistory (query, GET /chat/:sessionId), sendChatMessage (mutation, POST /chat/:sessionId/messages), deleteChatSession (mutation, DELETE /chat/:sessionId). Add 'ChatSession' and 'ChatMessage' to tagTypes. Create Frontend/src/pages/Chat.jsx with: left sidebar (session list with delete buttons, 'New Chat' button), main panel (message thread — user bubbles right-aligned primary-500, assistant bubbles left-aligned card color, animated typing indicator), input bar (textarea, Shift+Enter=newline, Enter=send). On first message auto-create a session then send. Show graph context badge above input if Redux state has a currentRepoId. Add <Route path='chat' element={<Chat />} /> inside the protected Layout route in App.jsx. Add Chat nav item with MessageSquare icon to the layout sidebar.

— End of Prompt Document —
