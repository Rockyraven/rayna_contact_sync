import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import { API_BASE_URL, GOOGLE_WEB_CLIENT_ID } from '../config';
import { useAuth } from '../auth/AuthContext';
import { formatRelativeTime, isOlderThanDays } from '../utils/time';
import { colors } from '../theme';
import Pagination from '../components/Pagination';

const GMAIL_READONLY_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
const STALE_SYNC_DAYS = 7;
const CONTACTS_PAGE_SIZE = 25;

type LinkedAccount = {
  id: number;
  email: string;
  created_at: string;
  last_synced_at: string | null;
};

type Contact = {
  id: number;
  name: string | null;
  email: string;
  last_seen_at: string;
};

type LoadState = 'loading' | 'ready' | 'error';

function initialFor(source: string): string {
  return source.trim().charAt(0).toUpperCase() || '?';
}

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
  const [state, setState] = useState<LoadState>('loading');
  const [syncError, setSyncError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const loadContacts = useCallback(async () => {
    setState('loading');
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', String(CONTACTS_PAGE_SIZE));
      const response = await fetch(
        `${API_BASE_URL}/api/email-accounts/${account.id}/messages?${params.toString()}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }
      const json = (await response.json()) as {
        messages: Contact[];
        total: number;
        sync_error: string | null;
      };
      setContacts(json.messages);
      setTotal(json.total);
      setSyncError(json.sync_error);
      setState('ready');
    } catch {
      setState('error');
    }
  }, [account.id, token, page]);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  return (
    <FlatList
      data={state === 'ready' ? contacts : []}
      keyExtractor={item => String(item.id)}
      style={styles.list}
      contentContainerStyle={styles.listContent}
      ListHeaderComponent={
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={onBack}>
            <Text style={styles.backText}>{'‹ Back'}</Text>
          </TouchableOpacity>
          <Text style={styles.inboxHeader}>{account.email}</Text>
          <Text style={styles.statLabel}>{total} contacts</Text>
          {state === 'ready' && syncError && (
            <Text style={styles.errorText}>
              Live sync failed: {syncError} (showing last-synced data below)
            </Text>
          )}
        </View>
      }
      ListEmptyComponent={
        state === 'loading' ? (
          <ActivityIndicator size="large" color={colors.accent} style={styles.spacerTop} />
        ) : state === 'error' ? (
          <View style={styles.centered}>
            <Text style={styles.message}>Couldn&apos;t load this inbox.</Text>
            <TouchableOpacity style={styles.button} onPress={loadContacts}>
              <Text style={styles.buttonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <Text style={styles.message}>Inbox is empty.</Text>
        )
      }
      renderItem={({ item }) => (
        <View style={styles.row}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initialFor(item.name || item.email)}</Text>
          </View>
          <View style={styles.rowBody}>
            <Text style={styles.fieldName}>{item.name || '—'}</Text>
            <Text style={styles.fieldEmail}>{item.email}</Text>
            <Text style={styles.fieldSynced}>Last synced {formatRelativeTime(item.last_seen_at)}</Text>
          </View>
        </View>
      )}
      ListFooterComponent={
        state === 'ready' && total > 0 ? (
          <Pagination page={page} pageSize={CONTACTS_PAGE_SIZE} total={total} onPageChange={setPage} />
        ) : null
      }
    />
  );
}

function LinkedEmailsScreen() {
  const { token } = useAuth();
  const [accounts, setAccounts] = useState<LinkedAccount[]>([]);
  const [state, setState] = useState<LoadState>('loading');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [selected, setSelected] = useState<LinkedAccount | null>(null);
  const [resyncingId, setResyncingId] = useState<number | null>(null);
  const [resyncError, setResyncError] = useState<string | null>(null);

  const loadAccounts = useCallback(async () => {
    setState('loading');
    try {
      const response = await fetch(`${API_BASE_URL}/api/email-accounts`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }
      const json = (await response.json()) as { accounts: LinkedAccount[] };
      setAccounts(json.accounts);
      setState('ready');
    } catch {
      setState('error');
    }
  }, [token]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  const addAccount = useCallback(async () => {
    setAddError(null);
    setAdding(true);
    try {
      GoogleSignin.configure({
        webClientId: GOOGLE_WEB_CLIENT_ID,
        offlineAccess: true,
        scopes: [GMAIL_READONLY_SCOPE],
        // Google only issues a refresh_token the first time a user
        // grants an app+scope combination — repeat sign-ins (or a
        // different device) otherwise return a serverAuthCode that
        // exchanges to an access token with no refresh_token at all.
        forceCodeForRefreshToken: true,
      });
      await GoogleSignin.hasPlayServices();
      // Force a fresh consent screen: signing in again while already
      // authenticated can silently return a stale grant that never
      // negotiated the gmail.readonly scope this flow actually needs.
      await GoogleSignin.signOut().catch(() => {});
      const response = await GoogleSignin.signIn();
      if (!isSuccessResponse(response)) {
        return;
      }

      const { serverAuthCode, user } = response.data;
      if (!serverAuthCode) {
        throw new Error('Google did not return a server auth code');
      }

      const res = await fetch(`${API_BASE_URL}/api/email-accounts/link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ serverAuthCode, email: user.email }),
      });
      if (!res.ok) {
        throw new Error(`Linking failed with status ${res.status}`);
      }
      await loadAccounts();
    } catch (e) {
      if (isErrorWithCode(e) && e.code === statusCodes.SIGN_IN_CANCELLED) {
        // user cancelled, not an error worth surfacing
      } else {
        setAddError(e instanceof Error ? e.message : 'Failed to add account');
      }
    } finally {
      GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });
      setAdding(false);
    }
  }, [token, loadAccounts]);

  const resyncAccount = useCallback(
    async (accountId: number) => {
      setResyncingId(accountId);
      setResyncError(null);
      try {
        const res = await fetch(`${API_BASE_URL}/api/email-accounts/${accountId}/resync`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error ?? `Resync failed with status ${res.status}`);
        }
        await loadAccounts();
      } catch (e) {
        setResyncError(e instanceof Error ? e.message : 'Resync failed');
      } finally {
        setResyncingId(null);
      }
    },
    [token, loadAccounts],
  );

  if (selected) {
    return <InboxView account={selected} token={token} onBack={() => setSelected(null)} />;
  }

  return (
    <FlatList
      data={state === 'ready' ? accounts : []}
      keyExtractor={item => String(item.id)}
      style={styles.list}
      contentContainerStyle={styles.listContent}
      ListHeaderComponent={
        <View style={styles.headerRow}>
          <View style={styles.statRow}>
            <Text style={styles.statValue}>{accounts.length}</Text>
            <Text style={styles.statLabel}>Linked Email Accounts</Text>
          </View>
          <TouchableOpacity style={styles.addButton} onPress={addAccount} disabled={adding}>
            {adding ? (
              <ActivityIndicator size="small" color={colors.accentInk} />
            ) : (
              <Text style={styles.buttonText}>+ Add Account</Text>
            )}
          </TouchableOpacity>
          {addError && <Text style={styles.errorText}>{addError}</Text>}
          {resyncError && <Text style={styles.errorText}>{resyncError}</Text>}
        </View>
      }
      ListEmptyComponent={
        state === 'loading' ? (
          <ActivityIndicator size="large" color={colors.accent} style={styles.spacerTop} />
        ) : state === 'error' ? (
          <View style={styles.centered}>
            <Text style={styles.message}>Couldn&apos;t load linked accounts.</Text>
            <TouchableOpacity style={styles.button} onPress={loadAccounts}>
              <Text style={styles.buttonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <Text style={styles.message}>No linked email accounts yet.</Text>
        )
      }
      renderItem={({ item }) => {
        const stale = !item.last_synced_at || isOlderThanDays(item.last_synced_at, STALE_SYNC_DAYS);
        return (
          <TouchableOpacity style={styles.accountRow} onPress={() => setSelected(item)}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initialFor(item.email)}</Text>
            </View>
            <View style={styles.accountRowMain}>
              <Text style={styles.email}>{item.email}</Text>
              <View style={styles.syncRow}>
                <View style={[styles.dot, stale ? styles.dotStale : styles.dotFresh]} />
                <Text style={stale ? styles.lastSyncedStale : styles.lastSynced}>
                  {item.last_synced_at
                    ? `Last synced ${formatRelativeTime(item.last_synced_at)}`
                    : 'Never synced'}
                </Text>
              </View>
            </View>
            {stale && (
              <TouchableOpacity
                style={styles.resyncButton}
                onPress={() => resyncAccount(item.id)}
                disabled={resyncingId === item.id}
              >
                {resyncingId === item.id ? (
                  <ActivityIndicator size="small" color={colors.accentInk} />
                ) : (
                  <Text style={styles.resyncButtonText}>Resync</Text>
                )}
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  spacerTop: {
    marginTop: 48,
  },
  message: {
    textAlign: 'center',
    fontSize: 16,
    marginBottom: 16,
    color: colors.inkSoft,
  },
  button: {
    backgroundColor: colors.accent,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  buttonText: {
    color: colors.accentInk,
    fontWeight: '600',
  },
  list: {
    backgroundColor: colors.bg,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  headerRow: {
    marginVertical: 16,
  },
  statRow: {
    marginBottom: 12,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.accent,
    lineHeight: 32,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  inboxHeader: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: 2,
  },
  backText: {
    color: colors.accent,
    fontWeight: '600',
    marginBottom: 8,
  },
  addButton: {
    backgroundColor: colors.accent,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  errorText: {
    color: colors.warn,
    marginTop: 8,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  accountRowMain: {
    flex: 1,
    marginRight: 12,
  },
  email: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.ink,
  },
  syncRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 6,
  },
  dotFresh: {
    backgroundColor: colors.good,
  },
  dotStale: {
    backgroundColor: colors.warn,
  },
  lastSynced: {
    fontSize: 12,
    color: colors.muted,
  },
  lastSyncedStale: {
    fontSize: 12,
    color: colors.warn,
  },
  resyncButton: {
    backgroundColor: colors.accent,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  resyncButtonText: {
    color: colors.accentInk,
    fontWeight: '600',
    fontSize: 13,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.accent,
  },
  rowBody: {
    flex: 1,
  },
  fieldName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.ink,
  },
  fieldEmail: {
    fontSize: 13,
    color: colors.muted,
    marginTop: 1,
  },
  fieldSynced: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 3,
  },
});

export default LinkedEmailsScreen;
