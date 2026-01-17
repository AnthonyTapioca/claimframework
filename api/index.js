import axios from 'axios';

const claimedOrders = new Set();

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
    const tokenRes = await axios.post(
      'https://discord.com/api/oauth2/token',
      new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID,
        client_secret: process.env.DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code: req.query.code,
        redirect_uri: process.env.DISCORD_REDIRECT_URI
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const userRes = await axios.get(
      'https://discord.com/api/users/@me',
      { headers: { Authorization: `Bearer ${tokenRes.data.access_token}` } }
    );

    if (process.env.DISCORD_BOT_TOKEN) {
      await axios.put(
        `https://discord.com/api/guilds/${process.env.DISCORD_GUILD_ID}/members/${userRes.data.id}/roles/${process.env.DISCORD_ROLE_ID}`,
        {},
        { headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` } }
      );
    }

    return res.redirect('https://claimframework.vercel.app');
  }

  if (req.method === 'POST') {
    const { email, orderId, fetchOnly, source } = req.body;
    if (!email) return res.status(400).json({ error: 'Missing email' });

    try {
      const shopifyRes = await axios.get(
        `https://${process.env.SHOPIFY_STORE}/admin/api/2024-01/orders.json`,
        {
          params: { status: 'any', limit: 20, query: `email:${email}` },
          auth: {
            username: process.env.SHOPIFY_CLIENT_ID,
            password: process.env.SHOPIFY_CLIENT_SECRET
          }
        }
      );

      const orders = shopifyRes.data.orders || [];
      if (!orders.length) return res.status(404).json({ error: 'No orders found' });

      if (fetchOnly) return res.json({ orders });

      const order = orders.find(o => o.name === orderId);
      if (!order) return res.status(404).json({ error: 'Order not found' });

      if (claimedOrders.has(order.name)) {
        return res.json({ success: true, alreadyClaimed: true });
      }

      claimedOrders.add(order.name);

      const items = order.line_items.map(i => `• ${i.title} x${i.quantity}`).join('\n');

      await axios.post(process.env.DISCORD_WEBHOOK_URL, {
        embeds: [{
          title: source === 'pixel' ? '🛒 Auto Purchase Detected' : '🛒 Order Claimed',
          fields: [
            { name: 'Email', value: email },
            { name: 'Order Number', value: order.name },
            { name: 'Items', value: items }
          ]
        }]
      });

      return res.json({ success: true });

    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  res.status(405).end();
}
