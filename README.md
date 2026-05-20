# Homework AI

Modern AI-powered homework solver with OCR, streaming chat, Firebase auth, PWA install support, and backend security.

## Features

- Dark glassmorphism startup UI
- OCR scanning with `rus+eng` recognition
- Mobile camera capture and drag/drop upload
- Streaming OpenAI answer generation
- Markdown rendering, highlighted code, and MathJax formulas
- Firebase Google login and cloud conversation save
- Rate limiting, request cooldown, and spam protection
- PWA installable app with offline caching
- Physics toolkit with unit converter and formula cards
- Secure Express backend hiding the OpenAI API key

## Setup

1. Copy `.env.example` to `.env`
2. Add your OpenAI and Firebase credentials
3. Install dependencies:

```bash
npm install
```

4. Run locally:

```bash
npm run dev
```

5. Open `http://localhost:3000`

## Deployment

### Vercel

1. Install Vercel CLI or use dashboard
2. Push the project to GitHub
3. Connect repository to Vercel
4. Add `.env` variables in Vercel dashboard
5. Deploy

### Notes

- The backend route is available at `/api/complete`
- The frontend never exposes your OpenAI API key
- Firebase auth uses client-side login and Firestore saving

## Project Structure

- `index.html` - startup UI frontend
- `styles.css` - premium dark theme
- `script.js` - frontend logic, OCR, stream UI, auth, PWA
- `server.js` - secure Express backend for OpenAI proxy
- `.env.example` - environment variable template
- `manifest.json` - progressive web app manifest
- `service-worker.js` - offline asset caching

## License

MIT
