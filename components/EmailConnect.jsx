import { View, Text, Pressable, Linking, AppState } from 'react-native';
import { useEffect, useState, useCallback } from 'react';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000';

export default function EmailConnect({ userId }) {
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/tool/email/status?user_id=${userId}`);
      const result = await response.json();
      if (response.ok) setStatus(result);
    } catch (e) {
      console.log('email status error', e);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) load();
  }, [userId, load]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') load();
    });
    return () => sub.remove();
  }, [load]);

  const connect = async () => {
    setBusy(true);
    try {
      const response = await fetch(`${API_URL}/api/tool/email/connect?user_id=${userId}`);
      const result = await response.json();
      if (response.ok) await Linking.openURL(result.url);
    } catch (e) {
      console.log('email connect error', e);
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    setBusy(true);
    try {
      await fetch(`${API_URL}/api/tool/email/disconnect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      });
      await load();
    } catch (e) {
      console.log('email disconnect error', e);
    } finally {
      setBusy(false);
    }
  };

  if (!status) return null;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: '#ffffff',
        borderBottomWidth: 1,
        borderBottomColor: '#eaeaea',
      }}
    >
      <Text style={{ fontSize: 12, color: '#444444' }}>
        {status.connected ? `Gmail connected: ${status.email || ''}` : 'Gmail not connected'}
      </Text>
      <Pressable
        onPress={status.connected ? disconnect : connect}
        disabled={busy}
        style={{
          height: 28,
          paddingHorizontal: 12,
          borderRadius: 8,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: status.connected ? '#ffffff' : '#111111',
          borderWidth: 1,
          borderColor: status.connected ? '#eaeaea' : '#111111',
          opacity: busy ? 0.5 : 1,
        }}
      >
        <Text style={{ fontSize: 12, color: status.connected ? '#111111' : '#ffffff' }}>
          {status.connected ? 'Disconnect' : 'Connect Gmail'}
        </Text>
      </Pressable>
    </View>
  );
}