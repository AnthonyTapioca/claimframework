import { useState } from 'react';

export default function Home() {
  const [email, setEmail] = useState('');
  const [orders, setOrders] = useState([]);
  const [selected, setSelected] = useState(0);

  const fetchOrders = async () => {
    if (!email) return alert('Enter your email');
    try {
      const res = await fetch('/api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, fetchOnly: true })
      });
      const data = await res.json();
      if (!res.ok || !data.orders.length) return alert('No orders found');
      setOrders(data.orders);
    } catch (err) {
      console.error(err);
      alert('Error fetching orders');
    }
  };

  const redeemOrder = async () => {
    if (!orders[selected]) return;
    try {
      const res = await fetch('/api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, orderId: orders[selected].name, source: 'frontend' })
      });
      if (!res.ok) throw new Error('Failed to redeem');
      window.location.href = '/api?discordLogin=true';
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-orange-50 flex items-center justify-center px-6">
      <div className="w-full max-w-xl bg-white p-10 rounded-3xl shadow-lg">
        <h1 className="text-4xl font-bold text-center mb-6">SHOP<span className="text-purple-600">LOX</span></h1>

        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="Email used at checkout"
          className="w-full mb-4 p-4 border rounded-xl"
        />
        <button onClick={fetchOrders} className="w-full py-4 rounded-xl bg-purple-600 text-white font-bold mb-4">
          Find My Orders
        </button>

        {orders.length > 0 && (
          <>
            <select
              className="w-full p-4 border rounded-xl mb-4"
              value={selected}
              onChange={e => setSelected(Number(e.target.value))}
            >
              {orders.map((o, idx) => (
                <option key={o.name} value={idx}>
                  {o.name} — {new Date(o.created_at).toLocaleDateString()}
                </option>
              ))}
            </select>
            <button onClick={redeemOrder} className="w-full py-4 rounded-xl bg-green-600 text-white font-bold">
              Redeem Selected Order
            </button>
          </>
        )}

        <p className="text-sm text-gray-500 mt-2">
          Enter your email and select your order. The system will automatically handle Discord login and ticket creation.
        </p>
      </div>
    </main>
  );
}
