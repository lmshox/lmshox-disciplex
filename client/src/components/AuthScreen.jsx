import { useState } from 'react';

export function AuthScreen({ onAuthenticate, online }) {
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const register = mode === 'register';

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onAuthenticate(mode, username.trim(), password);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-[80dvh] max-w-sm flex-col justify-center px-5 py-12">
      <div className="mb-10">
        <div className="mb-4 flex items-center gap-2">
          <span aria-hidden className="block size-3 bg-alert" />
          <span className="text-lg font-black tracking-[0.35em]">DISCIPLEX</span>
        </div>
        <h1 className="text-3xl font-black uppercase leading-tight tracking-tight">
          Deadlines are enforced.<br />
          <span className="text-muted">Excuses are not.</span>
        </h1>
        <ul className="mt-5 space-y-1.5 text-xs text-muted">
          <li>— Miss a deadline: task FAILS, −10 score, +1 strike.</li>
          <li>— 3 strikes: system lockout + written accountability log.</li>
          <li>— Lockouts double in length each time.</li>
        </ul>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <label className="block space-y-1.5">
          <span className="label">Username</span>
          <input className="field" autoComplete="username" autoCapitalize="none" value={username} onChange={(e) => setUsername(e.target.value)} required minLength={3} maxLength={32} />
        </label>
        <label className="block space-y-1.5">
          <span className="label">Password</span>
          <input className="field" type="password" autoComplete={register ? 'new-password' : 'current-password'} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
        </label>
        {error && <p role="alert" className="text-xs font-semibold text-alert">{error}</p>}
        {!online && <p className="text-xs font-semibold text-warn">You're offline. Connect to sign in.</p>}
        <button type="submit" className="btn-primary w-full" disabled={busy || !online}>
          {busy ? 'Working…' : register ? 'Create account & commit' : 'Sign in'}
        </button>
      </form>

      <button
        type="button"
        onClick={() => { setMode(register ? 'login' : 'register'); setError(null); }}
        className="mt-6 text-xs uppercase tracking-widest text-muted hover:text-white"
      >
        {register ? 'Have an account? Sign in' : 'New here? Create an account'}
      </button>
    </main>
  );
}
