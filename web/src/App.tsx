import { useState } from 'react';
import ContactsView from './screens/ContactsView';
import EmailAccountsView from './screens/EmailAccountsView';

type Tab = 'contacts' | 'emails';

// TEMPORARY: login screen removed for local testing — goes straight to the
// data views. Backend auth is also disabled to match (see server/src/routes/admin.ts).
// Restore AdminAuthProvider/LoginScreen before this runs anywhere but localhost.
function App() {
  const [tab, setTab] = useState<Tab>('contacts');

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

export default App;
