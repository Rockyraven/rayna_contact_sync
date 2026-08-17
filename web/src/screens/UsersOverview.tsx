import { useCallback, useEffect, useMemo, useState } from 'react';
import { API_BASE_URL } from '../config';
import { useAdminAuth } from '../auth/AdminAuthContext';

type UserOverview = {
  id: number;
  name: string | null;
  email: string | null;
  username: string | null;
  phone_number: string | null;
  role: string;
  created_at: string;
  contact_count: number;
  contacts_last_synced: string | null;
  linked_email_count: number;
  email_last_synced: string | null;
  email_contact_count: number;
};

type LoadState = 'loading' | 'ready' | 'error' | 'forbidden';

const STALE_DAYS = 7;

function isStale(dateStr: string | null): boolean {
  if (!dateStr) {
    return true;
  }
  const diffMs = Date.now() - new Date(dateStr).getTime();
  return diffMs >= STALE_DAYS * 24 * 60 * 60 * 1000;
}

function formatSynced(dateStr: string | null): string {
  return dateStr ? new Date(dateStr).toLocaleString() : 'Never';
}

function SyncCell({
  count,
  lastSynced,
  secondaryCount,
  secondaryLabel,
}: {
  count: number;
  lastSynced: string | null;
  secondaryCount?: number;
  secondaryLabel?: string;
}) {
  const stale = count > 0 && isStale(lastSynced);
  return (
    <div>
      <div className="sync-count numeric">{count}</div>
      {secondaryCount !== undefined && (
        <div className="sync-secondary numeric">
          {secondaryCount} {secondaryLabel}
        </div>
      )}
      <div className={`sync-when numeric ${stale ? 'stale' : 'fresh'}`}>{formatSynced(lastSynced)}</div>
    </div>
  );
}

function UsersOverview({
  onViewContacts,
  onViewEmails,
}: {
  onViewContacts: (userId: number) => void;
  onViewEmails: (userId: number) => void;
}) {
  const { token } = useAdminAuth();
  const [users, setUsers] = useState<UserOverview[]>([]);
  const [state, setState] = useState<LoadState>('loading');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setState('loading');
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401 || res.status === 403) {
        setState('forbidden');
        return;
      }
      if (!res.ok) {
        throw new Error(`Request failed with status ${res.status}`);
      }
      const json = (await res.json()) as { users: UserOverview[] };
      setUsers(json.users);
      setState('ready');
    } catch {
      setState('error');
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) {
      return users;
    }
    return users.filter(u =>
      [u.name, u.email, u.username, u.phone_number].some(field =>
        field?.toLowerCase().includes(q),
      ),
    );
  }, [users, search]);

  const totals = useMemo(
    () => ({
      users: users.length,
      contacts: users.reduce((sum, u) => sum + u.contact_count, 0),
      linkedEmails: users.reduce((sum, u) => sum + u.linked_email_count, 0),
    }),
    [users],
  );

  if (state === 'loading') {
    return <p className="status-note">Loading users…</p>;
  }
  if (state === 'forbidden') {
    return <p className="status-note error">You don&apos;t have admin access.</p>;
  }
  if (state === 'error') {
    return (
      <p className="status-note error">
        Something went wrong. <button className="btn-outline" onClick={load}>Retry</button>
      </p>
    );
  }

  return (
    <div>
      <div className="stat-row">
        <SummaryCard label="Total users" value={totals.users} />
        <SummaryCard label="Contacts synced" value={totals.contacts} />
        <SummaryCard label="Linked email accounts" value={totals.linkedEmails} />
      </div>

      <input
        type="text"
        className="search-input"
        placeholder="Search by name, email, username, or phone…"
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Role</th>
              <th>Contacts</th>
              <th>Linked emails</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(u => (
              <tr key={u.id}>
                <td>
                  <div className="who-name">{u.name || u.username || u.phone_number || '—'}</div>
                  <div className="who-email">{u.email ?? u.username ?? '—'}</div>
                </td>
                <td>
                  <span className={`pill ${u.role === 'ADMIN' ? 'admin' : 'member'}`}>{u.role}</span>
                </td>
                <td>
                  <SyncCell count={u.contact_count} lastSynced={u.contacts_last_synced} />
                </td>
                <td>
                  <SyncCell
                    count={u.linked_email_count}
                    lastSynced={u.email_last_synced}
                    secondaryCount={u.email_contact_count}
                    secondaryLabel={u.email_contact_count === 1 ? 'email contact' : 'email contacts'}
                  />
                </td>
                <td>
                  <div className="row-actions">
                    <button onClick={() => onViewContacts(u.id)}>View Contacts</button>
                    <button onClick={() => onViewEmails(u.id)}>View Emails</button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="empty-note">
                  No users match your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="legend">
        <span><i className="fresh" /> Synced within 7 days</span>
        <span><i className="stale" /> Stale or never synced</span>
      </div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="stat-card">
      <div className="stat-value numeric">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

export default UsersOverview;
