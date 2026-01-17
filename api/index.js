import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

function generateCode() {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const { email, orderId } = req.body;
    if (!email || !orderId) {
      return res.status(400).json({ error: 'Missing email or order ID' });
    }

    // Check if order already claimed
    const { data: existing, error: fetchError } = await supabase
      .from('claimed_orders')
      .select('code')
      .eq('order_id', orderId)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      // PGRST116 = no rows, which is fine
      console.error(fetchError);
      return res.status(500).json({ error: 'Database error' });
    }

    if (existing) {
      return res.json({ success: true, alreadyClaimed: true, code: existing.code });
    }

    // Generate new claim code
    const code = generateCode();

    const { error: insertError } = await supabase
      .from('claimed_orders')
      .insert([{ order_id: orderId, email, code }]);

    if (insertError) {
      console.error(insertError);
      return res.status(500).json({ error: 'Database insert error' });
    }

    return res.json({ success: true, alreadyClaimed: false, code });
  } catch (err) {
    console.error('Backend error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}
