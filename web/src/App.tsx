import { useState } from 'react';
import { AdminAuthProvider, useAdminAuth } from './auth/AdminAuthContext';
import LoginScreen from './screens/LoginScreen';
import ContactsView from './screens/ContactsView';
import EmailAccountsView from './screens/EmailAccountsView';

type Tab = 'contacts' | 'emails';

function AppContent() {
  const { initializing, token, user, signOut } = useAdminAuth();
  const [tab, setTab] = useState<Tab>('contacts');

  if (initializing) {
    return <p>Loading…</p>;
  }
  if (!token) {
    return <LoginScreen />;
  }

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif' }}>
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: 16,
          borderBottom: '1px solid #ccc',
        }}
      >
        <h1 style={{ color: '#ee7623', margin: 0 }}>Rayna Admin</h1>
        <div>
          <span style={{ marginRight: 12 }}>{user?.email ?? user?.name}</span>
          <button onClick={signOut}>Sign out</button>
        </div>
      </header>
      <nav style={{ display: 'flex', gap: 8, padding: 16 }}>
        <button onClick={() => setTab('contacts')} disabled={tab === 'contacts'}>
          Contacts
        </button>
        <button onClick={() => setTab('emails')} disabled={tab === 'emails'}>
          Linked Emails
        </button>
      </nav>
      <main style={{ padding: 16 }}>{tab === 'contacts' ? <ContactsView /> : <EmailAccountsView />}</main>
    </div>
  );
}

function App() {
  return (
    <AdminAuthProvider>
      <AppContent />
    </AdminAuthProvider>
  );
}

export default App;
