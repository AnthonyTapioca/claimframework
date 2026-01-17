import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

function generateCode() {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { email, orderId, items } = req.body;
    if (!email || !orderId) return res.status(400).json({ error: 'Missing email or order ID' });

    let existing;
    try {
      const { data, error } = await supabase
        .from('claimed_orders')
        .select('code')
        .eq('order_id', orderId)
        .single();
      if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows
      existing = data;
    } catch (err) {
      console.error('Fetch existing code error:', err);
      return res.status(500).json({ error: 'Database fetch error' });
    }

    if (existing) {
      return res.json({ success: true, alreadyClaimed: true, code: existing.code });
    }

    const code = generateCode();

    try {
      const { error } = await supabase
        .from('claimed_orders')
        .insert([{ order_id: orderId, email, items, code }]);
      if (error) throw error;
    } catch (err) {
      console.error('Insert code error:', err);
      return res.status(500).json({ error: 'Database insert error' });
    }

    return res.json({ success: true, alreadyClaimed: false, code });
  } catch (err) {
    console.error('API error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}
