import axios from 'axios';

export default async function handler(req, res) {

  // ===== DISCORD LOGIN REDIRECT =====
  if (req.method === 'GET' && req.query.discordLogin) {
    const params = new URLSearchParams({
      client_id: process.env.DISCORD_CLIENT_ID,
      redirect_uri: process.env.DISCORD_REDIRECT_URI,
      response_type: 'code',
      scope: 'identify guilds.members.read'
    });

    return res.redirect(
      `https://discord.com/oauth2/authorize?${params}`
    );
  }

  // ===== DISCORD CALLBACK =====
  if (req.method === 'GET' && req.query.code) {
    const code = req.query.code;

    const tokenRes = await axios.post(
      'https://discord.com/api/oauth2/token',
      new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID,
        client_secret: process.env.DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: process.env.DISCORD_REDIRECT_URI
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const userRes = await axios.get(
      'https://discord.com/api/users/@me',
      {
        headers: {
          Authorization: `Bearer ${tokenRes.data.access_token}`
        }
      }
    );

    // Assign role
    await axios.put(
      `https://discord.com/api/guilds/${process.env.DISCORD_GUILD_ID}/members/${userRes.data.id}/roles/${process.env.DISCORD_ROLE_ID}`,
      {},
      {
        headers: {
          Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`
        }
      }
    );

    return res.redirect('https://claimframework.vercel.app');
  }

  // ===== ORDER CLAIM =====
  if (req.method === 'POST') {
    const { email, orderId } = req.body;

    if (!email || !orderId) {
      return res.status(400).json({ error: 'Missing fields' });
    }

    try {
      const shopifyRes = await axios.get(
        `https://${process.env.SHOPIFY_STORE}/admin/api/2024-01/orders.json?name=${orderId}`,
        {
          auth: {
            username: process.env.SHOPIFY_CLIENT_ID,
            password: process.env.SHOPIFY_CLIENT_SECRET
          }
        }
      );

      const order = shopifyRes.data.orders[0];
      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }

      const items = order.line_items
        .map(i => `• ${i.title} x${i.quantity}`)
        .join('\n');

      // Discord ticket
      await axios.post(process.env.DISCORD_WEBHOOK_URL, {
        embeds: [{
          title: '🛒 New Claim',
          fields: [
            { name: 'Email', value: email },
            { name: 'Order', value: order.name },
            { name: 'Items', value: items }
          ]
        }]
      });

      return res.json({ success: true });

    } catch (err) {
      console.error(err.message);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  res.status(405).end();
}
