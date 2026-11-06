# AI Resume Builder

An AI-assisted resume workspace for creating, editing, improving, and previewing professional resumes. The project includes session-based authentication, MongoDB persistence, AI-assisted section refinement, and browser print-to-PDF support.

## Features
- Registration, login, and protected workspace
- MongoDB Atlas persistence
- Profile and resume editing
- AI-assisted resume section improvement
- Live resume preview
- Browser print-to-PDF workflow
- Billing integration scaffolding for Pro and Team plans
- Responsive interface and Vercel API routes

## Stack
React 18 · Vite 5 · Node.js 24 · Express · Mongoose · MongoDB Atlas · OpenAI-compatible API · optional Stripe · Vercel

## Requirements
Node.js 24.x, npm, MongoDB Atlas, and an OpenAI API key. Stripe credentials and price IDs are needed only if billing is enabled.

## Setup
```bash
git clone https://github.com/Siddharthsingh123456/ai-resume-builder.git
cd ai-resume-builder
npm install
```
Configure a local, untracked `.env` file:
```env
MONGODB_URI=your_mongodb_connection_string
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4o-mini
STRIPE_SECRET_KEY=
STRIPE_PRO_PRICE_ID=
STRIPE_TEAM_PRICE_ID=
BILLING_SUCCESS_URL=
BILLING_CANCEL_URL=
```
Never commit secrets. Leave Stripe variables unset unless the billing feature is configured.

## Run and build
```bash
npm run dev
npm run build
npm run preview
```
The `check` script runs the production build.

## Authentication
This version uses server-side sessions rather than JWT. Random session tokens are stored as hashes in MongoDB and delivered using an HTTP-only cookie. Passwords use salted scrypt hashes. Review the implementation before adapting it for production.

## Deploy
Deploy the repository root to Vercel. Configure environment variables for each environment and configure MongoDB Atlas network access securely. Test registration, login, logout, editing, AI refinement, and PDF printing after deployment.

## Privacy and accuracy
Resumes contain personal information. Restrict database access and review AI suggestions carefully. Never invent qualifications, experience, or achievements.

## License
No license file is currently specified. Contact the repository owner before reuse.
