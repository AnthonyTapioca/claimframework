import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { action, email, orderId, items, product, discordUserId } = req.body;
    if (!action) return res.status(400).json({ error: 'Missing action' });

    // ----------------- CREATE ORDER -----------------
    if (action === 'create') {
      if (!email || !orderId || !items) return res.status(400).json({ error: 'Missing parameters' });

      const code = crypto.randomBytes(4).toString('hex'); // 8-char claim code

      const { error } = await supabase
        .from('claimed_orders')
        .upsert({
          email,
          order_id: orderId,
          items,
          product: product || null,
          code,
          claimed: false
        }, { onConflict: ['order_id'] });

      if (error) return res.status(500).json({ error: 'Failed to save order', details: error.message });

      return res.json({ code, alreadyClaimed: false });
    }

    // ----------------- REDEEM (frontend users) -----------------
    if (action === 'redeem') {
      if (!orderId) return res.status(400).json({ error: 'Missing orderId' });

      const { data, error } = await supabase
        .from('claimed_orders')
        .select('order_id, code, product, claimed')
        .eq('order_id', orderId)
        .single();

      if (error) return res.status(404).json({ error: 'Order not found', details: error.message });

      return res.json({
        code: data.code,
        product: data.product,
        alreadyRedeemed: data.claimed
      });
    }

    // ----------------- CLAIM (Discord Bot) -----------------
    if (action === 'claim') {
      if (!orderId || !discordUserId) return res.status(400).json({ error: 'Missing parameters' });

      const { data, error } = await supabase
        .from('claimed_orders')
        .select('order_id, code, product, claimed')
        .eq('order_id', orderId)
        .single();

      if (error) return res.status(404).json({ error: 'Order not found', details: error.message });
      if (data.claimed) return res.status(400).json({ error: 'Already claimed' });

      await supabase
        .from('claimed_orders')
        .update({ claimed: true, discord_user_id: discordUserId })
        .eq('order_id', orderId);

      return res.json({ code: data.code, product: data.product });
    }

    return res.status(400).json({ error: 'Invalid action' });

  } catch (err) {
    console.error('[Backend] Unexpected error:', err);
    return res.status(500).json({ error: 'Server error', details: err.message });
  }
}
