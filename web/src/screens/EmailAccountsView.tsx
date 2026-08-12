import { useCallback, useEffect, useState } from 'react';
import { API_BASE_URL } from '../config';
import { useAdminAuth } from '../auth/AdminAuthContext';

type LinkedAccount = {
  id: number;
  email: string;
  owner_email: string;
  owner_name: string | null;
  created_at: string;
};

type Message = {
  id: string;
  from: string;
  to: string;
};

function InboxView({
  account,
  token,
  onBack,
}: {
  account: LinkedAccount;
  token: string | null;
  onBack: () => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

  const load = useCallback(async () => {
    setState('loading');
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/email-accounts/${account.id}/messages`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        throw new Error(`Request failed with status ${res.status}`);
      }
      const json = (await res.json()) as { messages: Message[] };
      setMessages(json.messages);
      setState('ready');
    } catch {
      setState('error');
    }
  }, [account.id, token]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <button onClick={onBack}>‹ Back</button>
      <h2>{account.email}</h2>
      {state === 'loading' && <p>Loading inbox…</p>}
      {state === 'error' && (
        <p>
          Couldn&apos;t load this inbox. <button onClick={load}>Retry</button>
        </p>
      )}
      {state === 'ready' && messages.length === 0 && <p>Inbox is empty.</p>}
      {state === 'ready' && (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {messages.map(m => (
            <li key={m.id} style={{ borderBottom: '1px solid #ccc', padding: '8px 0' }}>
              <div style={{ fontWeight: 600 }}>From: {m.from}</div>
              <div style={{ fontSize: 13, color: '#555' }}>To: {m.to}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type LoadState = 'loading' | 'ready' | 'error' | 'forbidden';

function EmailAccountsView() {
  const { token } = useAdminAuth();
  const [accounts, setAccounts] = useState<LinkedAccount[]>([]);
  const [state, setState] = useState<LoadState>('loading');
  const [selected, setSelected] = useState<LinkedAccount | null>(null);

  const load = useCallback(async () => {
    setState('loading');
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/email-accounts`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401 || res.status === 403) {
        setState('forbidden');
        return;
      }
      if (!res.ok) {
        throw new Error(`Request failed with status ${res.status}`);
      }
      const json = (await res.json()) as { accounts: LinkedAccount[] };
      setAccounts(json.accounts);
      setState('ready');
    } catch {
      setState('error');
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  if (selected) {
    return <InboxView account={selected} token={token} onBack={() => setSelected(null)} />;
  }

  if (state === 'loading') {
    return <p>Loading linked accounts…</p>;
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
          <th>Linked email</th>
          <th>Added by</th>
          <th>Linked on</th>
        </tr>
      </thead>
      <tbody>
        {accounts.map(a => (
          <tr
            key={a.id}
            onClick={() => setSelected(a)}
            style={{ cursor: 'pointer', borderBottom: '1px solid #eee' }}
          >
            <td>{a.email}</td>
            <td>{a.owner_name ?? a.owner_email}</td>
            <td>{new Date(a.created_at).toLocaleString()}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default EmailAccountsView;
