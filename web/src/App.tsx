import { useState } from 'react';
import { AdminAuthProvider, useAdminAuth } from './auth/AdminAuthContext';
import LoginScreen from './screens/LoginScreen';
import UsersOverview from './screens/UsersOverview';
import ContactsView from './screens/ContactsView';
import EmailAccountsView from './screens/EmailAccountsView';
import logo from './assets/rayna-logo.png';

type Tab = 'dashboard' | 'contacts' | 'emails';

function AppContent() {
  const { initializing, token, user, signOut } = useAdminAuth();
  const [tab, setTab] = useState<Tab>('dashboard');
  const [filterUserId, setFilterUserId] = useState<number | undefined>(undefined);

  if (initializing) {
    return <p className="status-note">Loading…</p>;
  }
  if (!token) {
    return <LoginScreen />;
  }

  const goToDashboard = () => {
    setFilterUserId(undefined);
    setTab('dashboard');
  };

  const goToContacts = (userId?: number) => {
    setFilterUserId(userId);
    setTab('contacts');
  };

  const goToEmails = (userId?: number) => {
    setFilterUserId(userId);
    setTab('emails');
  };

  return (
    <div className="app">
      <header className="topbar">
        <img src={logo} alt="Rayna" />
        <div className="account">
          <span>{user?.email ?? user?.name}</span>
          <button className="btn-outline" onClick={signOut}>
            Sign out
          </button>
        </div>
      </header>

      <nav className="tabs">
        <button onClick={goToDashboard} disabled={tab === 'dashboard'}>
          Dashboard
        </button>
        <button onClick={() => goToContacts(undefined)} disabled={tab === 'contacts' && !filterUserId}>
          All Contacts
        </button>
        <button onClick={() => goToEmails(undefined)} disabled={tab === 'emails' && !filterUserId}>
          All Linked Emails
        </button>
      </nav>

      <main className="content">
        {tab === 'dashboard' && (
          <UsersOverview onViewContacts={goToContacts} onViewEmails={goToEmails} />
        )}
        {tab === 'contacts' && (
          <ContactsView userId={filterUserId} onBack={filterUserId ? goToDashboard : undefined} />
        )}
        {tab === 'emails' && (
          <EmailAccountsView userId={filterUserId} onBack={filterUserId ? goToDashboard : undefined} />
        )}
      </main>
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
