
import { View, Text, Pressable } from 'react-native';
import { useEffect, useState, useCallback } from 'react';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000';

export default function EmailDrafts({ userId, botId, refreshKey }) {
  const [drafts, setDrafts] = useState([]);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!userId || !botId) return;

    try {
      const response = await fetch(`${API_URL}/api/tool/email/drafts?user_id=${userId}&bot_id=${botId}`);
      const result = await response.json();
      if (response.ok) setDrafts(result.data || []);
    } catch (e) {
      console.log('drafts error', e);
    }
  }, [userId, botId]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const act = async (id, action) => {
    setBusyId(id);
    setError('');

    try {
      const response = await fetch(`${API_URL}/api/tool/email/drafts/${id}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Request failed');
      await load();
    } catch (e) {
      setError(e.message || 'Something went wrong');
    } finally {
      setBusyId(null);
    }
  };

  if (!drafts.length && !error) return null;

  return (
    <View style={{ gap: 10 }}>
      {drafts.map((d) => (
        <View
          key={d.id}
          style={{
            padding: 12,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: '#111111',
            backgroundColor: '#ffffff',
            gap: 6,
          }}
        >
          <Text style={{ fontSize: 11, color: '#6f6f6f' }}>Draft waiting for your approval</Text>
          <Text style={{ fontSize: 13, color: '#111111' }}>To: {d.to_address}</Text>
          <Text style={{ fontSize: 13, color: '#111111' }}>Subject: {d.subject}</Text>
          <Text style={{ fontSize: 13, color: '#444444' }}>{d.body}</Text>

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
            <Pressable
              onPress={() => act(d.id, 'send')}
              disabled={busyId === d.id}
              style={{
                height: 32,
                paddingHorizontal: 16,
                borderRadius: 8,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#111111',
                opacity: busyId === d.id ? 0.5 : 1,
              }}
            >
              <Text style={{ fontSize: 13, color: '#ffffff' }}>Send</Text>
            </Pressable>
            <Pressable
              onPress={() => act(d.id, 'discard')}
              disabled={busyId === d.id}
              style={{
                height: 32,
                paddingHorizontal: 16,
                borderRadius: 8,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#ffffff',
                borderWidth: 1,
                borderColor: '#eaeaea',
                opacity: busyId === d.id ? 0.5 : 1,
              }}
            >
              <Text style={{ fontSize: 13, color: '#111111' }}>Discard</Text>
            </Pressable>
          </View>
        </View>
      ))}

      {!!error && <Text style={{ fontSize: 12, color: '#e5484d' }}>{error}</Text>}
    </View>
  );
}