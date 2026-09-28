# AI Resume Builder

MERN + AI resume builder with live preview, ATS-friendly editing, MongoDB-backed session authentication, AI section improvement, billing-ready plans and Vercel deployment.

## Features

- Session-based registration, login and protected workspace
- MongoDB Atlas persistence
- Profile and resume editing
- Section-aware OpenAI resume improvement
- Live professional resume preview
- Print-to-PDF browser workflow
- Stripe-ready Pro and Team plans
- Responsive UI
- Vercel serverless API routes

## Required Vercel Environment Variables

Add these in **Vercel → Project → Settings → Environment Variables** for **Production** (and Preview/Development if you use them):

```env
MONGODB_URI=mongodb+srv://<database-user>:<url-encoded-password>@<current-atlas-host>/ai-resume-builder?retryWrites=true&w=majority
OPENAI_API_KEY=<your-openai-key>
OPENAI_MODEL=gpt-4o-mini
```

There is **no JWT secret or JWT environment variable** in this version. Authentication uses random, server-side session tokens stored as hashes in MongoDB and delivered through an HTTP-only cookie.

Optional billing variables:

```env
STRIPE_SECRET_KEY=<stripe-secret>
STRIPE_PRO_PRICE_ID=<stripe-pro-price-id>
STRIPE_TEAM_PRICE_ID=<stripe-team-price-id>
BILLING_SUCCESS_URL=https://ai-resume-builder-rho-sandy.vercel.app/?billing=success
BILLING_CANCEL_URL=https://ai-resume-builder-rho-sandy.vercel.app/?billing=cancel
```

## MongoDB Atlas

Create a MongoDB Atlas database user and use its credentials in `MONGODB_URI`.

If the password contains characters such as `@`, `:`, `/`, `?`, `#`, `[`, `]` or `%`, URL-encode the password before placing it in the connection string.

For Vercel serverless access, Atlas Network Access must allow Vercel's connections. A temporary `0.0.0.0/0` entry can be used for testing, but restrict network access where your deployment architecture allows it.

## Authentication

Authentication is session-based:

1. Passwords are still stored as salted scrypt hashes.
2. Login/registration creates a cryptographically random session token.
3. Only a SHA-256 hash of the session token is stored in MongoDB.
4. The raw token is sent only as an HTTP-only cookie.
5. Sessions expire after 7 days and can be revoked by logout.

No JWT library, JWT signing secret, or JWT environment variable is required.

## Health Check

After deployment, open:

`/api/auth/health`

A healthy deployment returns:

```json
{
  "ok": true,
  "database": "connected",
  "authentication": "session-based"
}
```

If it returns `bad auth : authentication failed`, the Atlas database username/password in `MONGODB_URI` does not match the Atlas Database Access user.

## Local Development

```bash
npm install
npm run dev
```

Build verification:

```bash
npm run build
```
