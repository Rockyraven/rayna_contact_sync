/**
 * @format
 */

import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/auth/AuthContext';
import SplashScreen from './src/screens/SplashScreen';
import SignInScreen from './src/screens/SignInScreen';
import ContactsScreen from './src/screens/ContactsScreen';
import LinkedEmailsScreen from './src/screens/LinkedEmailsScreen';

type Tab = 'contacts' | 'emails';

function AppContent() {
  const [showSplash, setShowSplash] = useState(true);
  const [tab, setTab] = useState<Tab>('contacts');
  const { initializing, token, user, signOut } = useAuth();

  if (showSplash) {
    return <SplashScreen onFinish={() => setShowSplash(false)} />;
  }

  if (initializing) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#ee7623" />
      </View>
    );
  }

  if (!token) {
    return <SignInScreen />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.appBar}>
        <Image
          source={require('./src/assets/rayna-logo.png')}
          style={styles.appBarLogo}
          resizeMode="contain"
        />
        <View style={styles.appBarAccount}>
          {(() => {
            const label = user?.email || user?.username || user?.phone_number;
            return label ? (
              <Text style={styles.appBarEmail} numberOfLines={1}>
                {label}
              </Text>
            ) : null;
          })()}
          <TouchableOpacity onPress={signOut}>
            <Text style={styles.signOutText}>Sign out</Text>
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.tabBar}>
        <TouchableOpacity style={styles.tabButton} onPress={() => setTab('contacts')}>
          <Text style={[styles.tabLabel, tab === 'contacts' && styles.tabLabelActive]}>
            My Contacts
          </Text>
          {tab === 'contacts' && <View style={styles.tabIndicator} />}
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabButton} onPress={() => setTab('emails')}>
          <Text style={[styles.tabLabel, tab === 'emails' && styles.tabLabelActive]}>Emails</Text>
          {tab === 'emails' && <View style={styles.tabIndicator} />}
        </TouchableOpacity>
      </View>
      <View style={styles.content}>{tab === 'contacts' ? <ContactsScreen /> : <LinkedEmailsScreen />}</View>
    </View>
  );
}

function App() {
  const isDarkMode = useColorScheme() === 'dark';

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor="#ffffff" />
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e5e5',
  },
  appBarLogo: {
    width: 110,
    height: undefined,
    aspectRatio: 617 / 229,
  },
  appBarAccount: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
  },
  appBarEmail: {
    fontSize: 12,
    color: '#666666',
    marginRight: 12,
    flexShrink: 1,
  },
  signOutText: {
    fontSize: 13,
    color: '#ee7623',
    fontWeight: '600',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e5e5',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
  },
  tabLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#999999',
  },
  tabLabelActive: {
    color: '#ee7623',
  },
  tabIndicator: {
    marginTop: 6,
    height: 3,
    width: 32,
    borderRadius: 2,
    backgroundColor: '#ee7623',
  },
});

export default App;
