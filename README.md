# JOSEANGELITON AI

**Your Brain. Your Buddy. Your AI.**

A responsive browser-based assistant with a friendly branded interface, six prompt-guided tools, Firebase email/password authentication, private Firestore conversation storage, browser voice controls, and a server-side AI API integration. This repository currently contains a web application, not Flutter Android/iOS projects.

## What works (when configured)

- Home, Chat, Explore, History, and Profile views, with responsive desktop/mobile navigation and a dark/light theme.
- JOSEANGELITON Study, Writer, Creator, Business, Code, and Life prompt modes.
- Email/password sign-up and sign-in, Firebase password-reset email, and sign-out.
- Authenticated chat requests sent from the server to an OpenAI-compatible Chat Completions endpoint. The AI API key is read only by the backend.
- Conversation history and deletion, scoped to the verified Firebase user.
- Copy and regenerate responses, browser speech-to-text, text-to-speech, and an opt-in voice conversation mode where the browser supports those APIs.
- Request validation, Firebase ID-token verification, security headers, origin checks, and in-memory API/chat rate limits.

## Not implemented yet

- Image/file generation, profile picture uploads, native Flutter apps, Google/Apple login, and live response streaming.
- Paid subscriptions or checkout. The UI explicitly does not simulate a purchase. Add a verified payment provider and server-side entitlement checks before enabling premium access.
- The “Free” label is informational: there is no billing or product quota enforcement. Current API rate limits are abuse protection, not subscription limits.
- Native voice services are not bundled. Browser speech-recognition availability varies; microphone access generally requires HTTPS (localhost is allowed by modern browsers).

Do not treat AI output as professional, medical, legal, or financial advice. The assistant does not execute generated code or create image files.

## Requirements

- Node.js 20 or later.
- A Firebase project with Authentication (Email/Password) and Cloud Firestore enabled.
- Firebase Admin credentials for the server (Application Default Credentials or a service-account JSON file).
- An API key for an OpenAI-compatible chat-completions service.

## Setup

1. Install packages:

   ```powershell
   npm install
   ```

2. Copy `.env.example` to `.env` and set `FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN`, `FIREBASE_PROJECT_ID`, and `FIREBASE_APP_ID` from the Firebase console's Web app configuration. These web configuration values are public identifiers, not server secrets. Restrict the Firebase API key to the required Firebase APIs and your deployed domains.

3. In Firebase Console:
   - Create a Firebase project and register a Web app.
   - Enable **Authentication → Sign-in method → Email/Password**.
   - Create a Cloud Firestore database.
   - Deploy the restrictive rules and required query index from this project:

     ```powershell
     firebase deploy --only firestore:rules,firestore:indexes
     ```

   The command requires the Firebase CLI, a logged-in Firebase account, and a `.firebaserc` or `--project <project-id>` option. The rules deny direct client access; the server uses Firebase Admin after checking each user's ID token and conversation ownership.

4. Configure server-side Firebase Admin credentials. Prefer Application Default Credentials in production. For local development, create a service account with only the required Firestore access, store its JSON outside the project, and set `GOOGLE_APPLICATION_CREDENTIALS` to its absolute path. Never commit the service-account JSON or `.env`.

5. Add your AI key to `OPENAI_API_KEY`; optionally set `OPENAI_MODEL` and `OPENAI_BASE_URL` for a compatible provider. Never put this key in browser code or Firebase's public web configuration.

6. Set `APP_ORIGIN` to the exact origin used to open the app (for example `http://localhost:3000`), then start the server:

   ```powershell
   npm start
   ```

   Open `http://localhost:3000`. To restart automatically during development, use `npm run dev`.

`npm run check` checks JavaScript syntax with Node. The browser imports the Firebase Web SDK from Google's CDN, so users need network access to that service. Configure Firebase Authentication's authorized domains for your deployed hostname.

## Publish on Render

This project includes a `render.yaml` Blueprint. Push the project to a Git repository, connect that repository in Render, and create a Blueprint from it. During setup, enter the required values as Render environment secrets—especially `OPENAI_API_KEY` and the Firebase Admin service-account JSON in `FIREBASE_SERVICE_ACCOUNT_JSON`. Never commit these values. Once Render assigns a public service URL, set `APP_ORIGIN` to that exact HTTPS origin and add the hostname to Firebase Authentication's authorized domains. Deploy or redeploy after setting the variables.

The Render service is not live until a repository is connected and those environment values are supplied.

## Configuration and security notes

- `FIREBASE_API_KEY`, auth domain, project ID, and app ID are sent to the browser from `/api/config`; Firebase web-app config is not an authorization boundary. Restrict the API key and configure authorized domains.
- `OPENAI_API_KEY` and Firebase Admin credentials stay on the backend. Keep `.env`, service-account files, and production secrets out of source control.
- Firestore client rules deny access to the `conversations` collection. Every API data operation requires a verified Firebase ID token and checks the conversation owner.
- Conversation documents are limited to the most recent 40 messages. Chat input is limited to 8,000 characters; the API keeps at most 24 prior messages in model context.
- API abuse limits use in-memory storage and reset on process restart. For multiple server instances, replace them with a shared store (such as Redis) and configure trusted proxy hops accurately. Avoid enabling `TRUST_PROXY` unless the app is behind a known proxy.
- AI provider request/retention practices are determined by that provider. Users should avoid sending sensitive personal information.
- Configure Firebase Auth email templates and production password-reset redirect URLs before launch.
- Deploy over HTTPS, restrict origins, monitor provider spend, and review applicable privacy, data-retention, and age requirements before production use.

## Project files

- `index.html`, `styles.css`, `app.js` — browser application.
- `moranga-nyangau.jpeg` — founder portrait displayed on the Home view.
- `server.js` — Express API, authentication verification, rate limiting, Firestore access, and server-side AI requests.
- `render.yaml` — Render web-service Blueprint for deployment.
- `firestore.rules`, `firestore.indexes.json` — Firestore rules and conversation-history query index.
- `.env.example` — names of required environment variables; contains no credentials.

