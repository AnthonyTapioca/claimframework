import { kv } from '@vercel/kv';

function generateCode() {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { email, orderId } = req.body;
    if (!email || !orderId) return res.status(400).json({ error: 'Missing email or order ID' });

    const existing = await kv.get(orderId);
    if (existing) return res.json({ success: true, alreadyClaimed: true, code: existing });

    const code = generateCode();
    await kv.set(orderId, code);

    return res.json({ success: true, alreadyClaimed: false, code });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
