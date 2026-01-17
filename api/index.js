import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { action, email, orderId, items, product, discordUserId, code } = req.body;
    if (!action) return res.status(400).json({ error: 'Missing action' });

    // ----------------- CREATE ORDER (Pixa pixel) -----------------
    if (action === 'create') {
      if (!email || !orderId || !items) return res.status(400).json({ error: 'Missing parameters' });

      // Generate friendly 8-character code
      const claimCode = crypto.randomBytes(4).toString('hex'); // e.g., 'a1b2c3d4'

      const { error } = await supabase
        .from('claimed_orders')
        .upsert({
          email,
          order_id: orderId.toString(),
          items,
          product: product || null,
          code: claimCode,
          claimed: false
        }, { onConflict: ['order_id'] });

      if (error) return res.status(500).json({ error: 'Failed to save order', details: error.message });

      return res.json({ code: claimCode, alreadyClaimed: false });
    }

    // ----------------- REDEEM BY CODE (frontend) -----------------
    if (action === 'redeem') {
      if (!code) return res.status(400).json({ error: 'Missing code' });

      const { data, error } = await supabase
        .from('claimed_orders')
        .select('order_id, code, product, claimed')
        .eq('code', code)
        .single();

      if (error) return res.status(404).json({ error: 'Invalid code', details: error.message });

      return res.json({
        orderId: data.order_id,
        product: data.product,
        alreadyRedeemed: data.claimed
      });
    }

    // ----------------- CLAIM (Discord Bot) -----------------
    if (action === 'claim') {
      if (!code || !discordUserId) return res.status(400).json({ error: 'Missing parameters' });

      const { data, error } = await supabase
        .from('claimed_orders')
        .select('order_id, code, product, claimed')
        .eq('code', code)
        .single();

      if (error) return res.status(404).json({ error: 'Invalid code', details: error.message });
      if (data.claimed) return res.status(400).json({ error: 'Already claimed' });

      await supabase
        .from('claimed_orders')
        .update({ claimed: true, discord_user_id: discordUserId })
        .eq('code', code);

      return res.json({ orderId: data.order_id, product: data.product });
    }

    return res.status(400).json({ error: 'Invalid action' });
  } catch (err) {
    console.error('[Backend] Unexpected error:', err);
    return res.status(500).json({ error: 'Server error', details: err.message });
  }
}
