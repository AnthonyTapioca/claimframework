export default async function handler(req, res) {
  const claimedOrders = global.claimedOrders || (global.claimedOrders = new Set());

  // Discord OAuth
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

  // Handle POST (Shopify claim)
  if (req.method === 'POST') {
    const { email, orderId, fetchOnly, source } = req.body;
    if (!email) return res.status(400).json({ error: 'Missing email' });

    try {
      const shopifyRes = await fetch(
        `https://${process.env.SHOPIFY_STORE}/admin/api/2024-01/orders.json?status=any&limit=20&query=email:${email}`,
        {
          headers: {
            Authorization:
              'Basic ' +
              Buffer.from(
                `${process.env.SHOPIFY_CLIENT_ID}:${process.env.SHOPIFY_CLIENT_SECRET}`
              ).toString('base64')
          }
        }
      ).then(r => r.json());

      const orders = shopifyRes.orders || [];
      if (!orders.length) return res.status(404).json({ error: 'No orders found' });

      if (fetchOnly) return res.json({ orders });

      const order = orders.find(o => o.name === orderId);
      if (!order) return res.status(404).json({ error: 'Order not found' });

      if (claimedOrders.has(order.name)) return res.json({ success: true, alreadyClaimed: true });
      claimedOrders.add(order.name);

      const items = order.line_items.map(i => `• ${i.title} x${i.quantity}`).join('\n');

      await fetch(process.env.DISCORD_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          embeds: [{
            title: source === 'pixel' ? '🛒 Auto Purchase' : '🛒 Order Claimed',
            fields: [
              { name: 'Email', value: email },
              { name: 'Order Number', value: order.name },
              { name: 'Items', value: items }
            ]
          }]
        })
      });

      return res.json({ success: true });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  return res.status(405).end();
}
