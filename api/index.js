import { kv } from '@vercel/kv';

export default async function handler(req, res) {

  if (req.method === 'GET' && req.query.discordLogin) {
    const params = new URLSearchParams({
      client_id: process.env.DISCORD_CLIENT_ID,
      redirect_uri: process.env.DISCORD_REDIRECT_URI,
      response_type: 'code',
      scope: 'identify guilds.members.read'
    });
    return res.redirect(`https://discord.com/oauth2/authorize?${params}`);
  }

  if (req.method === 'GET' && req.query.code) {
    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID,
        client_secret: process.env.DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code: req.query.code,
        redirect_uri: process.env.DISCORD_REDIRECT_URI
      })
    }).then(r => r.json());

    const userRes = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${tokenRes.access_token}` }
    }).then(r => r.json());

    if (process.env.DISCORD_BOT_TOKEN) {
      await fetch(
        `https://discord.com/api/guilds/${process.env.DISCORD_GUILD_ID}/members/${userRes.id}/roles/${process.env.DISCORD_ROLE_ID}`,
        { method: 'PUT', headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` } }
      );
    }

    return res.redirect('/');
  }

  if (req.method === 'POST') {
    const { email, orderId, items } = req.body;
    if (!email || !orderId) return res.status(400).json({ error: 'Missing email or order ID' });

    const alreadyClaimed = await kv.get(orderId);
    if (alreadyClaimed) return res.json({ success: true, alreadyClaimed: true });

    await kv.set(orderId, true);

    await fetch(process.env.DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [{
          title: '🛒 Order Claimed',
          fields: [
            { name: 'Email', value: email },
            { name: 'Order Number', value: orderId },
            { name: 'Items', value: items || 'N/A' }
          ]
        }]
      })
    });

    return res.json({ success: true });
  }

  return res.status(405).end();
}
