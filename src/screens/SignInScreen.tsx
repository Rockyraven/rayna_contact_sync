import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../auth/AuthContext';

function SignInScreen() {
  const { signIn, signInWithPassword, register, signingIn, error } = useAuth();
  const [mode, setMode] = useState<'login' | 'create'>('login');

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');

  const [name, setName] = useState('');
  const [newIdentifier, setNewIdentifier] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const handleLogin = () => {
    if (!identifier.trim() || !password) {
      return;
    }
    signInWithPassword(identifier.trim(), password);
  };

  const handleCreateAccount = () => {
    if (!newIdentifier.trim() || !newPassword) {
      return;
    }
    register({
      name: name.trim() || undefined,
      identifier: newIdentifier.trim(),
      password: newPassword,
    });
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <Image
          source={require('../assets/rayna-logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />

        <View style={styles.modeSwitch}>
          <TouchableOpacity
            style={[styles.modeTab, mode === 'login' && styles.modeTabActive]}
            onPress={() => setMode('login')}
          >
            <Text style={[styles.modeTabText, mode === 'login' && styles.modeTabTextActive]}>
              Log in
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeTab, mode === 'create' && styles.modeTabActive]}
            onPress={() => setMode('create')}
          >
            <Text style={[styles.modeTabText, mode === 'create' && styles.modeTabTextActive]}>
              Create account
            </Text>
          </TouchableOpacity>
        </View>

        {mode === 'login' ? (
          <View style={styles.form}>
            <TextInput
              style={styles.input}
              placeholder="Username, email, or phone number"
              placeholderTextColor="#999999"
              autoCapitalize="none"
              autoCorrect={false}
              value={identifier}
              onChangeText={setIdentifier}
            />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="#999999"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
            <TouchableOpacity
              style={styles.button}
              onPress={handleLogin}
              disabled={signingIn}
            >
              {signingIn ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.buttonText}>Log in</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.form}>
            <TextInput
              style={styles.input}
              placeholder="Full name (optional)"
              placeholderTextColor="#999999"
              value={name}
              onChangeText={setName}
            />
            <TextInput
              style={styles.input}
              placeholder="Username, email, or phone number"
              placeholderTextColor="#999999"
              autoCapitalize="none"
              autoCorrect={false}
              value={newIdentifier}
              onChangeText={setNewIdentifier}
            />
            <TextInput
              style={styles.input}
              placeholder="Password (min. 8 characters)"
              placeholderTextColor="#999999"
              secureTextEntry
              value={newPassword}
              onChangeText={setNewPassword}
            />
            <TouchableOpacity
              style={styles.button}
              onPress={handleCreateAccount}
              disabled={signingIn}
            >
              {signingIn ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.buttonText}>Create account</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>OR</Text>
          <View style={styles.dividerLine} />
        </View>

        <TouchableOpacity style={styles.googleButton} onPress={signIn} disabled={signingIn}>
          <Text style={styles.googleButtonText}>Sign in with Google</Text>
        </TouchableOpacity>

        {error && <Text style={styles.error}>{error}</Text>}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  container: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  logo: {
    width: '60%',
    height: undefined,
    aspectRatio: 617 / 229,
    marginBottom: 32,
  },
  modeSwitch: {
    flexDirection: 'row',
    backgroundColor: '#f2f2f2',
    borderRadius: 10,
    padding: 4,
    width: '100%',
    marginBottom: 20,
  },
  modeTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  modeTabActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  modeTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#999999',
  },
  modeTabTextActive: {
    color: '#222222',
  },
  form: {
    width: '100%',
  },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#222222',
    marginBottom: 12,
  },
  hint: {
    fontSize: 12,
    color: '#888888',
    marginBottom: 14,
    marginTop: -4,
  },
  button: {
    backgroundColor: '#ee7623',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 16,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#d9d9d9',
  },
  dividerText: {
    marginHorizontal: 10,
    fontSize: 12,
    color: '#999999',
    fontWeight: '600',
  },
  googleButton: {
    borderWidth: 1,
    borderColor: '#d9d9d9',
    paddingVertical: 14,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
  },
  googleButtonText: {
    color: '#222222',
    fontWeight: '600',
    fontSize: 16,
  },
  error: {
    color: '#b3261e',
    marginTop: 16,
    textAlign: 'center',
  },
});

export default SignInScreen;
