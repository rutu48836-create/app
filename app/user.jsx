import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import styles from '../styles/profile.js';
import AntDesign from '@expo/vector-icons/AntDesign';
import { useState, useEffect } from 'react';
import { supabase } from '../libs/supabase';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000';

// Open this screen with:
// router.push({ pathname: '/profile', params: { id: user.id } });
export default function Profile() {
  const { id } = useLocalSearchParams();
  const userId = Array.isArray(id) ? id[0] : id;

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchEmail() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) setEmail(user.email);
    }

    fetchEmail();
  }, []);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!userId) return;

      try {
        const response = await fetch(`${API_URL}/api/db/fetch_history/${userId}`);
        const result = await response.json();

        if (response.ok) {
          setHistory(result.data || []);
        } else {
          console.log('fetch history failed', response.status, result);
        }
      } catch (e) {
        console.log('fetch history error', e);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [userId]);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.log('logout error', e);
    }
    router.replace('/auth');
  };

  const formatDate = (value) => {
    if (!value) return '';
    return new Date(value).toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <View style={[styles.container, { flex: 1, minHeight: 0 }]}>
      <View style={styles.nav}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <AntDesign name="arrow-left" size={22} color="#1a1a1a" />
        </Pressable>
      </View>

      <Text style={styles.title}>Profile</Text>
      {!!email && <Text style={styles.email}>{email}</Text>}

      <View style={styles.section_header}>
        <Text style={styles.section_title}>History</Text>
        <Text style={styles.count}>{history.length}</Text>
      </View>

      <ScrollView
        style={[styles.list, { minHeight: 0 }]}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list_content}
      >
        {loading ? (
          <ActivityIndicator style={styles.loader} color="#1a1a1a" />
        ) : history.length === 0 ? (
          <Text style={styles.empty}>Nothing here yet.</Text>
        ) : (
          history.map((h) => (
            <View style={styles.history_row} key={h.id}>
              <Text style={styles.history_title} numberOfLines={1}>
                {h.title || h.name || 'Untitled'}
              </Text>
              <Text style={styles.history_meta}>{formatDate(h.created_at)}</Text>
            </View>
          ))
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom }]}>
        <Pressable onPress={handleLogout} style={styles.logout_row}>
          <Text style={styles.logout_txt}>Log out</Text>
          <AntDesign name="logout" size={18} color="#a3362b" />
        </Pressable>
      </View>
    </View>
  );
}