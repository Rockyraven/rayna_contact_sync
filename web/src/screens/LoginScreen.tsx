import { useState, type SyntheticEvent } from 'react';
import { useAdminAuth } from '../auth/AdminAuthContext';
import logo from '../assets/rayna-logo.png';

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
    <div className="login-page">
      <div className="login-card">
        <img src={logo} alt="Rayna" className="login-logo" />
        <p className="login-subtitle">Admin sign in</p>

        <form onSubmit={handleSubmit} className="login-form">
          <label className="login-label" htmlFor="identifier">
            Email or username
          </label>
          <input
            id="identifier"
            type="text"
            placeholder="you@raynatours.com"
            value={identifier}
            onChange={e => setIdentifier(e.target.value)}
            className="login-input"
            autoComplete="username"
          />

          <label className="login-label" htmlFor="password">
            Password
          </label>
          <div className="login-password-row">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="login-password-input"
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(v => !v)}
              className="login-eye-button"
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>

          <button type="submit" disabled={signingIn} className="login-button">
            {signingIn ? 'Signing in…' : 'Sign in'}
          </button>
          {error && <p className="login-error">{error}</p>}
        </form>
      </div>
    </div>
  );
}

export default LoginScreen;
