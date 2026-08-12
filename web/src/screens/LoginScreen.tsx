import { useState, type CSSProperties, type SyntheticEvent } from 'react';
import { useAdminAuth } from '../auth/AdminAuthContext';

function LoginScreen() {
  const { signIn, signingIn, error } = useAdminAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!identifier || !password) {
      return;
    }
    signIn(identifier, password);
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Rayna Admin</h1>
      <form onSubmit={handleSubmit} style={styles.form}>
        <input
          type="text"
          placeholder="Email or username"
          value={identifier}
          onChange={e => setIdentifier(e.target.value)}
          style={styles.input}
          autoComplete="username"
        />
        <div style={styles.passwordRow}>
          <input
            type={showPassword ? 'text' : 'password'}
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            style={styles.passwordInput}
            autoComplete="current-password"
          />
          <button
            type="button"
            onClick={() => setShowPassword(v => !v)}
            style={styles.eyeButton}
          >
            {showPassword ? 'Hide' : 'Show'}
          </button>
        </div>
        <button type="submit" disabled={signingIn} style={styles.button}>
          {signingIn ? 'Signing in…' : 'Sign in'}
        </button>
        {error && <p style={styles.error}>{error}</p>}
      </form>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    gap: 16,
    fontFamily: 'system-ui, sans-serif',
  },
  title: {
    color: '#ee7623',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    width: 280,
  },
  input: {
    padding: '10px 12px',
    fontSize: 15,
    border: '1px solid #ccc',
    borderRadius: 6,
  },
  passwordRow: {
    display: 'flex',
    alignItems: 'center',
    border: '1px solid #ccc',
    borderRadius: 6,
  },
  passwordInput: {
    flex: 1,
    padding: '10px 12px',
    fontSize: 15,
    border: 'none',
    borderRadius: 6,
    outline: 'none',
  },
  eyeButton: {
    padding: '0 12px',
    fontSize: 13,
    fontWeight: 600,
    color: '#ee7623',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
  },
  button: {
    padding: '10px 12px',
    fontSize: 15,
    fontWeight: 600,
    color: '#ffffff',
    backgroundColor: '#ee7623',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
  },
  error: {
    color: '#b3261e',
    margin: 0,
  },
};

export default LoginScreen;
