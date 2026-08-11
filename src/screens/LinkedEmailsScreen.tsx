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

const GMAIL_READONLY_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
const STALE_SYNC_DAYS = 7;

type LinkedAccount = {
  id: number;
  email: string;
  created_at: string;
  last_synced_at: string | null;
};

type Message = {
  id: string;
  from: string;
  to: string;
};

type LoadState = 'loading' | 'ready' | 'error';

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
  const [state, setState] = useState<LoadState>('loading');

  const loadMessages = useCallback(async () => {
    setState('loading');
    try {
      const response = await fetch(`${API_BASE_URL}/api/email-accounts/${account.id}/messages`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }
      const json = (await response.json()) as { messages: Message[] };
      setMessages(json.messages);
      setState('ready');
    } catch {
      setState('error');
    }
  }, [account.id, token]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  return (
    <FlatList
      data={state === 'ready' ? messages : []}
      keyExtractor={item => item.id}
      contentContainerStyle={styles.list}
      ListHeaderComponent={
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={onBack}>
            <Text style={styles.backText}>{'‹ Back'}</Text>
          </TouchableOpacity>
          <Text style={styles.header}>{account.email}</Text>
        </View>
      }
      ListEmptyComponent={
        state === 'loading' ? (
          <ActivityIndicator size="large" color="#ee7623" style={styles.spacerTop} />
        ) : state === 'error' ? (
          <View style={styles.centered}>
            <Text style={styles.message}>Couldn&apos;t load this inbox.</Text>
            <TouchableOpacity style={styles.button} onPress={loadMessages}>
              <Text style={styles.buttonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <Text style={styles.message}>Inbox is empty.</Text>
        )
      }
      renderItem={({ item }) => (
        <View style={styles.messageRow}>
          <Text style={styles.from}>From: {item.from}</Text>
          <Text style={styles.to}>To: {item.to}</Text>
        </View>
      )}
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
      try {
        const res = await fetch(`${API_BASE_URL}/api/email-accounts/${accountId}/resync`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          throw new Error(`Resync failed with status ${res.status}`);
        }
        await loadAccounts();
      } catch {
        // resync is a best-effort nudge; leave the stale indicator showing on failure
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
      contentContainerStyle={styles.list}
      ListHeaderComponent={
        <View style={styles.headerRow}>
          <Text style={styles.header}>{accounts.length} linked accounts</Text>
          <TouchableOpacity style={styles.addButton} onPress={addAccount} disabled={adding}>
            {adding ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.buttonText}>+ Add Account</Text>
            )}
          </TouchableOpacity>
          {addError && <Text style={styles.errorText}>{addError}</Text>}
        </View>
      }
      ListEmptyComponent={
        state === 'loading' ? (
          <ActivityIndicator size="large" color="#ee7623" style={styles.spacerTop} />
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
            <View style={styles.accountRowMain}>
              <Text style={styles.email}>{item.email}</Text>
              <Text style={stale ? styles.lastSyncedStale : styles.lastSynced}>
                {item.last_synced_at
                  ? `Last synced ${formatRelativeTime(item.last_synced_at)}`
                  : 'Never synced'}
              </Text>
            </View>
            {stale && (
              <TouchableOpacity
                style={styles.resyncButton}
                onPress={() => resyncAccount(item.id)}
                disabled={resyncingId === item.id}
              >
                {resyncingId === item.id ? (
                  <ActivityIndicator size="small" color="#ffffff" />
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
    color: '#555555',
  },
  button: {
    backgroundColor: '#ee7623',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  headerRow: {
    marginVertical: 16,
  },
  header: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  backText: {
    color: '#ee7623',
    fontWeight: '600',
    marginBottom: 8,
  },
  addButton: {
    backgroundColor: '#ee7623',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  errorText: {
    color: '#b3261e',
    marginTop: 8,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#cccccc',
  },
  accountRowMain: {
    flex: 1,
    marginRight: 12,
  },
  email: {
    fontSize: 16,
    fontWeight: '600',
  },
  lastSynced: {
    fontSize: 12,
    color: '#888888',
    marginTop: 2,
  },
  lastSyncedStale: {
    fontSize: 12,
    color: '#b3261e',
    marginTop: 2,
  },
  resyncButton: {
    backgroundColor: '#ee7623',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  resyncButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 13,
  },
  messageRow: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#cccccc',
  },
  from: {
    fontSize: 14,
    fontWeight: '600',
  },
  to: {
    fontSize: 13,
    color: '#555555',
    marginTop: 2,
  },
});

export default LinkedEmailsScreen;
