import { useCallback, useEffect, useState } from 'react';
import { API_BASE_URL } from '../config';
import { useAdminAuth } from '../auth/AdminAuthContext';

type Contact = {
  id: number;
  name: string | null;
  email: string | null;
  mobile: string | null;
  sources: string | null;
  synced_date: string | null;
  owner_email: string;
  owner_name: string | null;
};

type LoadState = 'loading' | 'ready' | 'error' | 'forbidden';

function ContactsView() {
  const { token } = useAdminAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [state, setState] = useState<LoadState>('loading');

  const load = useCallback(async () => {
    setState('loading');
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/contacts`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401 || res.status === 403) {
        setState('forbidden');
        return;
      }
      if (!res.ok) {
        throw new Error(`Request failed with status ${res.status}`);
      }
      const json = (await res.json()) as { contacts: Contact[] };
      setContacts(json.contacts);
      setState('ready');
    } catch {
      setState('error');
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  if (state === 'loading') {
    return <p>Loading contacts…</p>;
  }
  if (state === 'forbidden') {
    return <p>You don&apos;t have admin access.</p>;
  }
  if (state === 'error') {
    return (
      <p>
        Something went wrong. <button onClick={load}>Retry</button>
      </p>
    );
  }

  return (
    <table cellPadding={8} style={{ borderCollapse: 'collapse', width: '100%' }}>
      <thead>
        <tr style={{ textAlign: 'left', borderBottom: '2px solid #ccc' }}>
          <th>Name</th>
          <th>Email</th>
          <th>Mobile</th>
          <th>Source</th>
          <th>Synced</th>
          <th>Added by</th>
        </tr>
      </thead>
      <tbody>
        {contacts.map(c => (
          <tr key={c.id} style={{ borderBottom: '1px solid #eee' }}>
            <td>{c.name ?? '—'}</td>
            <td>{c.email ?? '—'}</td>
            <td>{c.mobile ?? '—'}</td>
            <td>{c.sources ?? '—'}</td>
            <td>{c.synced_date ? new Date(c.synced_date).toLocaleString() : '—'}</td>
            <td>{c.owner_name ?? c.owner_email}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default ContactsView;
