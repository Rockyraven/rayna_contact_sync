import { useCallback, useEffect, useState } from 'react';
import { API_BASE_URL } from '../config';
import { useAdminAuth } from '../auth/AdminAuthContext';
import Pagination from '../components/Pagination';
import useDebouncedValue from '../hooks/useDebouncedValue';

type LinkedAccount = {
  id: number;
  email: string;
  owner_email: string;
  owner_name: string | null;
  created_at: string;
};

type Contact = {
  id: number;
  name: string | null;
  email: string;
  last_seen_at: string;
};

const MESSAGE_PAGE_SIZE = 25;
const ACCOUNT_PAGE_SIZE = 25;

function InboxView({
  account,
  token,
  onBack,
}: {
  account: LinkedAccount;
  token: string | null;
  onBack: () => void;
}) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const debouncedSearch = useDebouncedValue(search, 300);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, account.id]);

  const load = useCallback(async () => {
    setState('loading');
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set('search', debouncedSearch);
      params.set('page', String(page));
      params.set('pageSize', String(MESSAGE_PAGE_SIZE));

      const res = await fetch(
        `${API_BASE_URL}/api/admin/email-accounts/${account.id}/messages?${params.toString()}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) {
        throw new Error(`Request failed with status ${res.status}`);
      }
      const json = (await res.json()) as { messages: Contact[]; total: number };
      setContacts(json.messages);
      setTotal(json.total);
      setState('ready');
    } catch {
      setState('error');
    }
  }, [account.id, token, debouncedSearch, page]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <button className="back-link" onClick={onBack}>
        ‹ Back
      </button>
      <div className="view-heading">
        <h2>{account.email}</h2>
      </div>
      <input
        type="text"
        className="search-input"
        placeholder="Search by name or email…"
        value={search}
        onChange={e => setSearch(e.target.value)}
      />
      {state === 'loading' && <p className="status-note">Loading inbox…</p>}
      {state === 'error' && (
        <p className="status-note error">
          Couldn&apos;t load this inbox. <button className="btn-outline" onClick={load}>Retry</button>
        </p>
      )}
      {state === 'ready' && contacts.length === 0 && <p className="status-note">No contacts found.</p>}
      {state === 'ready' && contacts.length > 0 && (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Last seen</th>
                </tr>
              </thead>
              <tbody>
                {contacts.map(c => (
                  <tr key={c.id}>
                    <td>{c.name || '—'}</td>
                    <td>{c.email}</td>
                    <td className="numeric">{new Date(c.last_seen_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pageSize={MESSAGE_PAGE_SIZE} total={total} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}

type LoadState = 'loading' | 'ready' | 'error' | 'forbidden';

function EmailAccountsView({
  userId,
  onBack,
}: {
  userId?: number;
  onBack?: () => void;
}) {
  const { token } = useAdminAuth();
  const [accounts, setAccounts] = useState<LinkedAccount[]>([]);
  const [state, setState] = useState<LoadState>('loading');
  const [selected, setSelected] = useState<LinkedAccount | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const debouncedSearch = useDebouncedValue(search, 300);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, userId]);

  const load = useCallback(async () => {
    setState('loading');
    try {
      const params = new URLSearchParams();
      if (userId) params.set('user_id', String(userId));
      if (debouncedSearch) params.set('search', debouncedSearch);
      params.set('page', String(page));
      params.set('pageSize', String(ACCOUNT_PAGE_SIZE));

      const res = await fetch(`${API_BASE_URL}/api/admin/email-accounts?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401 || res.status === 403) {
        setState('forbidden');
        return;
      }
      if (!res.ok) {
        throw new Error(`Request failed with status ${res.status}`);
      }
      const json = (await res.json()) as { accounts: LinkedAccount[]; total: number };
      setAccounts(json.accounts);
      setTotal(json.total);
      setState('ready');
    } catch {
      setState('error');
    }
  }, [token, userId, debouncedSearch, page]);

  useEffect(() => {
    load();
  }, [load]);

  if (selected) {
    return <InboxView account={selected} token={token} onBack={() => setSelected(null)} />;
  }

  return (
    <div>
      {onBack && (
        <button className="back-link" onClick={onBack}>
          ‹ Back to Dashboard
        </button>
      )}
      <input
        type="text"
        className="search-input"
        placeholder={userId ? 'Search by linked email…' : 'Search by linked email or owner…'}
        value={search}
        onChange={e => setSearch(e.target.value)}
      />
      {state === 'loading' && <p className="status-note">Loading linked accounts…</p>}
      {state === 'forbidden' && <p className="status-note error">You don&apos;t have admin access.</p>}
      {state === 'error' && (
        <p className="status-note error">
          Something went wrong. <button className="btn-outline" onClick={load}>Retry</button>
        </p>
      )}
      {state === 'ready' && accounts.length === 0 && <p className="status-note">No linked email accounts found.</p>}
      {state === 'ready' && accounts.length > 0 && (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Linked email</th>
                  {!userId && <th>Added by</th>}
                  <th>Linked on</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map(a => (
                  <tr key={a.id} className="clickable" onClick={() => setSelected(a)}>
                    <td>{a.email}</td>
                    {!userId && <td>{a.owner_name ?? a.owner_email}</td>}
                    <td className="numeric">{new Date(a.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pageSize={ACCOUNT_PAGE_SIZE} total={total} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}

export default EmailAccountsView;
