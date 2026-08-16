import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Linking,
  PermissionsAndroid,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Contacts, { Contact } from 'react-native-contacts';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config';
import { useAuth } from '../auth/AuthContext';
import { formatRelativeTime, isOlderThanDays } from '../utils/time';
import Pagination from '../components/Pagination';

const LAST_SYNCED_KEY = 'rayna_contacts_last_synced';
const STALE_SYNC_DAYS = 7;
// Sending a whole address book in one request means a body large enough to trip
// proxy size limits, and a server round trip long enough to hit their timeouts.
// Batching keeps each request small and lets a big sync make partial progress.
const SYNC_BATCH_SIZE = 200;
const CONTACTS_PAGE_SIZE = 25;

type PermissionState = 'loading' | 'denied' | 'ready' | 'error';
type SyncState = 'idle' | 'syncing' | 'success' | 'error';
type ListState = 'loading' | 'ready' | 'error';

type SyncedContact = {
  id: number;
  name: string | null;
  email: string | null;
  mobile: string | null;
  synced_date: string | null;
};

async function hasContactsPermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.READ_CONTACTS,
      {
        title: 'Contacts Permission',
        message: 'Rayna Contact Sync needs access to your contacts.',
        buttonPositive: 'Allow',
      },
    );
    return result === PermissionsAndroid.RESULTS.GRANTED;
  }
  const permission = await Contacts.requestPermission();
  return permission === 'authorized' || permission === 'limited';
}

function ContactsScreen() {
  const { token } = useAuth();
  const [deviceContacts, setDeviceContacts] = useState<Contact[]>([]);
  const [permissionState, setPermissionState] = useState<PermissionState>('loading');
  const [syncState, setSyncState] = useState<SyncState>('idle');
  const [syncError, setSyncError] = useState<string | null>(null);
  // undefined = not read from storage yet, null = read and never synced before.
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null | undefined>(undefined);

  const [syncedContacts, setSyncedContacts] = useState<SyncedContact[]>([]);
  const [listState, setListState] = useState<ListState>('loading');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    AsyncStorage.getItem(LAST_SYNCED_KEY).then(setLastSyncedAt);
  }, []);

  // The list shown to the user is what the server actually has stored — not
  // the raw device address book — so a contact only ever shows a real
  // synced-at time instead of one shared timestamp reused across every row.
  const loadSyncedContacts = useCallback(async () => {
    setListState('loading');
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', String(CONTACTS_PAGE_SIZE));
      const response = await fetch(`${API_BASE_URL}/api/contacts?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }
      const json = (await response.json()) as { contacts: SyncedContact[]; total: number };
      setSyncedContacts(json.contacts);
      setTotal(json.total);
      setListState('ready');
    } catch {
      setListState('error');
    }
  }, [token, page]);

  useEffect(() => {
    loadSyncedContacts();
  }, [loadSyncedContacts]);

  const syncContacts = useCallback(async () => {
    setSyncState('syncing');
    setSyncError(null);
    try {
      for (let start = 0; start < deviceContacts.length; start += SYNC_BATCH_SIZE) {
        const batch = deviceContacts.slice(start, start + SYNC_BATCH_SIZE);
        const response = await fetch(`${API_BASE_URL}/api/contacts/sync`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ contacts: batch }),
        });
        if (!response.ok) {
          const detail = await response.text().catch(() => '');
          throw new Error(`HTTP ${response.status} ${detail.slice(0, 120)}`.trim());
        }
      }
      const now = new Date().toISOString();
      await AsyncStorage.setItem(LAST_SYNCED_KEY, now);
      setLastSyncedAt(now);
      setSyncState('success');
      setPage(1);
      await loadSyncedContacts();
    } catch (e) {
      // Surfaced in the UI rather than swallowed: without the underlying
      // message there is no way to tell a permission problem from a network
      // one from a server error, on a device you can't attach a debugger to.
      setSyncError(e instanceof Error ? e.message : String(e));
      setSyncState('error');
    }
  }, [deviceContacts, token, loadSyncedContacts]);

  const loadDeviceContacts = useCallback(async () => {
    setPermissionState('loading');
    try {
      const granted = await hasContactsPermission();
      if (!granted) {
        setPermissionState('denied');
        return;
      }
      const all = await Contacts.getAll();
      setDeviceContacts(all);
      setPermissionState('ready');
    } catch {
      setPermissionState('error');
    }
  }, []);

  useEffect(() => {
    loadDeviceContacts();
  }, [loadDeviceContacts]);

  // First time ever (permission just granted, nothing synced before): sync
  // automatically, no manual button needed.
  useEffect(() => {
    if (permissionState === 'ready' && lastSyncedAt === null && syncState === 'idle') {
      syncContacts();
    }
  }, [permissionState, lastSyncedAt, syncState, syncContacts]);

  if (permissionState === 'loading') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#ee7623" />
      </View>
    );
  }

  if (permissionState === 'denied') {
    return (
      <View style={styles.centered}>
        <Text style={styles.message}>
          Contacts permission was denied. Enable it in device settings to
          sync your contacts.
        </Text>
        <TouchableOpacity style={styles.button} onPress={Linking.openSettings}>
          <Text style={styles.buttonText}>Open Settings</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (permissionState === 'error') {
    return (
      <View style={styles.centered}>
        <Text style={styles.message}>
          Something went wrong while reading your device contacts.
        </Text>
        <TouchableOpacity style={styles.button} onPress={loadDeviceContacts}>
          <Text style={styles.buttonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <FlatList
      data={listState === 'ready' ? syncedContacts : []}
      keyExtractor={item => String(item.id)}
      contentContainerStyle={styles.list}
      ListHeaderComponent={
        <View style={styles.headerRow}>
          <Text style={styles.header}>{total} synced contacts</Text>

          {syncState === 'syncing' && (
            <View style={styles.syncingRow}>
              <ActivityIndicator size="small" color="#ee7623" />
              <Text style={styles.syncingText}>Syncing your contacts…</Text>
            </View>
          )}

          {syncState !== 'syncing' && syncState === 'error' && (
            <TouchableOpacity style={styles.syncButton} onPress={syncContacts}>
              <Text style={styles.buttonText}>Retry Sync</Text>
            </TouchableOpacity>
          )}

          {syncState !== 'syncing' &&
            syncState !== 'error' &&
            !!lastSyncedAt &&
            isOlderThanDays(lastSyncedAt, STALE_SYNC_DAYS) && (
              <>
                <Text style={styles.staleReminder}>
                  It&apos;s been over a week since your last sync.
                </Text>
                <TouchableOpacity style={styles.syncButton} onPress={syncContacts}>
                  <Text style={styles.buttonText}>Resync Contacts</Text>
                </TouchableOpacity>
              </>
            )}

          {lastSyncedAt && (
            <Text style={styles.lastSynced}>Last synced {formatRelativeTime(lastSyncedAt)}</Text>
          )}
          {syncState === 'success' && (
            <Text style={styles.syncMessageSuccess}>Synced successfully</Text>
          )}
          {syncState === 'error' && (
            <>
              <Text style={styles.syncMessageError}>Sync failed. Try again.</Text>
              {!!syncError && <Text style={styles.syncErrorDetail}>{syncError}</Text>}
            </>
          )}
        </View>
      }
      ListEmptyComponent={
        listState === 'loading' ? (
          <ActivityIndicator size="large" color="#ee7623" style={styles.spacerTop} />
        ) : listState === 'error' ? (
          <View style={styles.centered}>
            <Text style={styles.message}>Something went wrong loading your contacts.</Text>
            <TouchableOpacity style={styles.button} onPress={loadSyncedContacts}>
              <Text style={styles.buttonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <Text style={styles.message}>No contacts synced yet.</Text>
        )
      }
      renderItem={({ item }) => (
        <View style={styles.row}>
          <Text style={styles.name}>{item.name || 'Unnamed'}</Text>
          {item.email && <Text style={styles.detail}>{item.email}</Text>}
          {item.mobile && <Text style={styles.detail}>{item.mobile}</Text>}
          <Text style={styles.syncedDate}>
            {item.synced_date ? `Synced ${formatRelativeTime(item.synced_date)}` : 'Not yet synced'}
          </Text>
        </View>
      )}
      ListFooterComponent={
        listState === 'ready' && total > 0 ? (
          <Pagination page={page} pageSize={CONTACTS_PAGE_SIZE} total={total} onPageChange={setPage} />
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
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
  staleReminder: {
    fontSize: 13,
    color: '#b3261e',
    marginBottom: 12,
  },
  syncingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  syncingText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#555555',
  },
  lastSynced: {
    fontSize: 12,
    color: '#888888',
    marginTop: 8,
  },
  syncButton: {
    backgroundColor: '#ee7623',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  syncMessageSuccess: {
    color: '#1a7a3c',
    marginTop: 8,
  },
  syncMessageError: {
    color: '#b3261e',
    marginTop: 8,
  },
  syncErrorDetail: {
    color: '#b3261e',
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
  row: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#cccccc',
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
  },
  detail: {
    fontSize: 14,
    color: '#555555',
    marginTop: 2,
  },
  syncedDate: {
    fontSize: 11,
    color: '#999999',
    marginTop: 3,
  },
});

export default ContactsScreen;
