const express = require('express');
const path = require('path');
const cors = require('cors');
const dotenv = require('dotenv');
const fetch = require('node-fetch');
const serverless = require('serverless-http');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
  console.warn('Missing OPENAI_API_KEY in environment. The API route will fail without it.');
}

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname)));

const rateStore = new Map();
const DAILY_LIMIT = 140;
const COOLDOWN_MS = 5000;

function getClientId(req) {
  return (req.headers['x-forwarded-for'] || req.ip || 'unknown').toString();
}

function rateLimiter(req, res, next) {
  const id = getClientId(req);
  const now = Date.now();
  const record = rateStore.get(id) || { count: 0, last: 0, reset: now + 24 * 60 * 60 * 1000 };

  if (now > record.reset) {
    record.count = 0;
    record.reset = now + 24 * 60 * 60 * 1000;
  }

  if (now - record.last < COOLDOWN_MS) {
    return res.status(429).json({ error: 'Slow down: please wait a few seconds between requests.' });
  }

  if (record.count >= DAILY_LIMIT) {
    return res.status(429).json({ error: 'Daily request limit reached. Come back tomorrow.' });
  }

  record.count += 1;
  record.last = now;
  rateStore.set(id, record);
  next();
}

function buildMessageStack(prompt, intent) {
  const instructions = [
    { role: 'system', content: 'You are an AI tutor for algebra and physics. Explain problems step by step in simple language.' }
  ];

  if (intent === 'easier') {
    instructions.push({ role: 'system', content: 'Explain this problem in simpler terms and use everyday language for each step.' });
  }

  if (intent === 'short') {
    instructions.push({ role: 'system', content: 'Provide only the final answer and a short supporting equation. Keep the explanation concise.' });
  }

  if (intent === 'similar') {
    instructions.push({ role: 'system', content: 'Generate a similar practice problem and then solve it step-by-step.' });
  }

  if (intent === 'translate') {
    instructions.push({ role: 'system', content: 'Translate the solution into simple language and explain the reasoning clearly.' });
  }

  const userPrompt = `Problem: ${prompt}\n\nUse markdown and math formatting. Keep the answer beginner friendly.`;
  instructions.push({ role: 'user', content: userPrompt });

  return instructions;
}

app.post('/api/complete', rateLimiter, async (req, res) => {
  const { prompt, intent = 'default' } = req.body;

  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Valid prompt text is required.' });
  }

  if (!OPENAI_API_KEY) {
    return res.status(500).json({ error: 'Server is not configured with an OpenAI API key.' });
  }

  const messages = buildMessageStack(prompt, intent);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages,
        temperature: 0.2,
        max_tokens: 1200,
        stream: true
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      res.write(`data: [ERROR] ${errorText}\n\n`);
      return res.end();
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split(/\r?\n/).filter(Boolean);

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const payload = line.replace(/^data:\s*/, '');
          if (payload === '[DONE]') {
            res.write('data: [DONE]\n\n');
            return res.end();
          }

          try {
            const parsed = JSON.parse(payload);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              res.write(`data: ${delta}\n\n`);
            }
          } catch (error) {
            // ignore parse errors and continue
          }
        }
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    res.write(`data: [ERROR] ${error.message}\n\n`);
    res.end();
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Homework AI server listening on http://localhost:${PORT}`);
  });
}

module.exports.handler = serverless(app);
