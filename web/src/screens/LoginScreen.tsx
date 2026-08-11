import { useEffect, useRef, type CSSProperties } from 'react';
import { GOOGLE_CLIENT_ID } from '../config';
import { useAdminAuth } from '../auth/AdminAuthContext';

function LoginScreen() {
  const { signInWithGoogle, error } = useAdminAuth();
  const buttonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!window.google || !buttonRef.current) {
      return;
    }
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: response => {
        signInWithGoogle(response.credential);
      },
    });
    window.google.accounts.id.renderButton(buttonRef.current, {
      theme: 'outline',
      size: 'large',
    });
  }, [signInWithGoogle]);

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Rayna Admin</h1>
      <div ref={buttonRef} />
      {error && <p style={styles.error}>{error}</p>}
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
  error: {
    color: '#b3261e',
  },
};

export default LoginScreen;
