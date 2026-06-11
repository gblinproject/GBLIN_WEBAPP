'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

export default function AureusLogin() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/aureus/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        router.push('/aureus');
        router.refresh();
      } else {
        setError('Password errata.');
      }
    } catch {
      setError('Errore di rete.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-950 font-sans">
      <div className="w-full max-w-sm px-6">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-gray-100">GBLIN Aureus</h1>
          <p className="text-sm text-gray-500 mt-1">Area riservata</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="password" className="block text-xs uppercase tracking-wide text-gray-500 mb-2">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-white/5 border border-gray-700 rounded-lg px-4 py-3 text-gray-100 focus:outline-none focus:border-gray-400 transition-colors"
              placeholder="••••••••"
              autoFocus
              required
            />
          </div>
          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gray-100 text-gray-900 font-semibold rounded-lg py-3 hover:bg-white transition-colors disabled:opacity-50"
          >
            {loading ? 'Verifica...' : 'Accedi'}
          </button>
        </form>
      </div>
    </main>
  );
}
