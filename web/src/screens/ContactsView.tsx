import { useCallback, useEffect, useState } from 'react';
import { API_BASE_URL } from '../config';
import { useAdminAuth } from '../auth/AdminAuthContext';
import Pagination from '../components/Pagination';
import useDebouncedValue from '../hooks/useDebouncedValue';

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

const PAGE_SIZE = 25;

function ContactsView({
  userId,
  onBack,
}: {
  userId?: number;
  onBack?: () => void;
}) {
  const { token } = useAdminAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [state, setState] = useState<LoadState>('loading');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const debouncedSearch = useDebouncedValue(search, 300);

  // A new search term (or switching which user's contacts we're viewing)
  // invalidates whatever page we were on — always land back on page 1.
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
      params.set('pageSize', String(PAGE_SIZE));

      const res = await fetch(`${API_BASE_URL}/api/admin/contacts?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401 || res.status === 403) {
        setState('forbidden');
        return;
      }
      if (!res.ok) {
        throw new Error(`Request failed with status ${res.status}`);
      }
      const json = (await res.json()) as { contacts: Contact[]; total: number };
      setContacts(json.contacts);
      setTotal(json.total);
      setState('ready');
    } catch {
      setState('error');
    }
  }, [token, userId, debouncedSearch, page]);

  useEffect(() => {
    load();
  }, [load]);

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
        placeholder="Search by name, email, or mobile…"
        value={search}
        onChange={e => setSearch(e.target.value)}
      />
      {state === 'loading' && <p className="status-note">Loading contacts…</p>}
      {state === 'forbidden' && <p className="status-note error">You don&apos;t have admin access.</p>}
      {state === 'error' && (
        <p className="status-note error">
          Something went wrong. <button className="btn-outline" onClick={load}>Retry</button>
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
                  <th>Mobile</th>
                  <th>Source</th>
                  <th>Synced</th>
                  {!userId && <th>Added by</th>}
                </tr>
              </thead>
              <tbody>
                {contacts.map(c => (
                  <tr key={c.id}>
                    <td>{c.name ?? '—'}</td>
                    <td>{c.email ?? '—'}</td>
                    <td className="numeric">{c.mobile ?? '—'}</td>
                    <td>{c.sources ?? '—'}</td>
                    <td className="numeric">{c.synced_date ? new Date(c.synced_date).toLocaleString() : '—'}</td>
                    {!userId && <td>{c.owner_name ?? c.owner_email}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}

export default ContactsView;
