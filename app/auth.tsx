import { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import AntDesign from '@expo/vector-icons/AntDesign';
import { useAuth } from '../context/AuthContext';

type Provider = 'google' | 'github';

export default function Login() {
  const { signInWithProvider } = useAuth();
  const [active, setActive] = useState<Provider | null>(null);
  const [error, setError] = useState('');

  const handle = async (provider: Provider) => {
    setError('');
    setActive(provider);
    try {
      const { error: authError } = await signInWithProvider(provider);
      if (authError) setError(authError);
    } catch (e: any) {
      setError(e?.message || 'Sign in failed.');
    } finally {
      setActive(null);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.logo} />
        <Text style={styles.title}>Welcome</Text>
        <Text style={styles.subtitle}>Sign in or sign up to continue</Text>

        <Pressable
          style={({ pressed }) => [styles.button, (pressed || !!active) && styles.pressed]}
          onPress={() => handle('google')}
          disabled={!!active}
        >
          {active === 'google' ? (
            <ActivityIndicator color="#000" />
          ) : (
            <>
              <AntDesign name="google" size={20} color="#000" />
              <Text style={styles.buttonText}>Continue with Google</Text>
            </>
          )}
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.button,
            styles.dark,
            (pressed || !!active) && styles.pressed,
          ]}
          onPress={() => handle('github')}
          disabled={!!active}
        >
          {active === 'github' ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <AntDesign name="github" size={20} color="#fff" />
              <Text style={[styles.buttonText, styles.darkText]}>Continue with GitHub</Text>
            </>
          )}
        </Pressable>

        {!!error && <Text style={styles.error}>{error}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 400,
  },
  logo: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#000',
    marginBottom: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#000',
  },
  subtitle: {
    fontSize: 15,
    color: '#666',
    marginTop: 4,
    marginBottom: 28,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ccc',
    backgroundColor: '#fff',
    marginBottom: 12,
  },
  dark: {
    backgroundColor: '#000',
    borderColor: '#000',
  },
  pressed: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  darkText: {
    color: '#fff',
  },
  error: {
    color: '#c0392b',
    fontSize: 14,
    marginTop: 4,
  },
});