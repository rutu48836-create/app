import {
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Modal
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import styles from '../../styles/chat.js';
import AntDesign from '@expo/vector-icons/AntDesign';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../libs/supabase';
import Mascot from '../../components/Mascot.jsx';
import { DEFAULT_MASCOT } from '../../libs/mascot';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000';

const TYPE_LABELS = { search: 'Search', email: 'Email', sales: 'Sales', folder: 'Folder' };

const formatDate = (iso) => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '';
  }
};

export default function Group_chat() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams();
  const listRef = useRef(null);

  const [user, setUser] = useState(null);
  const [user_message, setUser_message] = useState('');
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState([]);
  const [group, setGroup] = useState(null);
  const [group_details, setGroupDetails] = useState(false);

  useEffect(() => {
    async function fetchUser() {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (!error && user) setUser(user);
      if (!user) router.replace('/auth');
    }
    fetchUser();
  }, []);

  useEffect(() => {
    if (!user || !id) return;
    (async () => {
      try {
        const r = await fetch(`${API_URL}/api/db/group/${id}?user_id=${user.id}`);
        const j = await r.json();
        if (r.ok) {
          setGroup(j.data);
          setMessages(j.data.messages || []);
        } else {
          console.log('load group failed', j);
        }
      } catch (e) {
        console.log(e);
      }
    })();
  }, [user, id]);

  const botById = Object.fromEntries((group?.members || []).map((b) => [b.id, b]));

  const send = async () => {
    const content = user_message.trim();
    if (!content || sending || !user) return;
    setSending(true);
    setUser_message('');
    try {
      const r = await fetch(`${API_URL}/api/db/group/${id}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, content }),
      });
      const j = await r.json();
      if (r.ok) {
        setMessages((prev) => [...prev, ...j.data]);
      } else {
        console.log('send failed', j);
      }
    } catch (e) {
      console.log(e);
    } finally {
      setSending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.nav}>
        <View style={styles.left_side}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <AntDesign name="left" size={14} color="black" style={{ marginLeft: 10 }} />
          </Pressable>
          <View style={styles.mascot_box_1}>
            <Text style={styles.mascot_title}>{(group?.title?.[0] || '?').toUpperCase()}</Text>
          </View>
          <Text style={styles.bot_name}>{group?.title}</Text>
        </View>
        <View style={styles.right_side}>
          <Pressable style={styles.btn} onPress={() => setGroupDetails(true)}>
            <AntDesign name="ellipsis" size={24} color="black" />
          </Pressable>
        </View>
      </View>

      <ScrollView
        ref={listRef}
        style={styles.messages_wrapper}
        contentContainerStyle={[styles.messages_content, { gap: 12 }]}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
      >
        {messages.map((m) => {
          const bot = botById[m.sender_id];
          const isUser = m.sender_type === 'user';
          return (
            <View
              key={m.id}
              style={{
                flexDirection: 'row',
                gap: 8,
                justifyContent: isUser ? 'flex-end' : 'flex-start',
              }}
            >
              {!isUser && (
                <Mascot
                  config={{ ...DEFAULT_MASCOT, ...(bot?.avatar_config || {}) }}
                  size={32}
                  animated={false}
                />
              )}
              <View
                style={{
                  maxWidth: '75%',
                  backgroundColor: isUser ? '#4630EB' : '#fff',
                  padding: 10,
                  borderRadius: 12,
                }}
              >
                {!isUser && (
                  <Text style={{ fontSize: 11, color: '#666' }}>{bot?.name || 'Bot'}</Text>
                )}
                <Text style={{ color: isUser ? '#fff' : '#000' }}>{m.content}</Text>
              </View>
            </View>
          );
        })}
        {sending && <Text style={{ color: '#666' }}>Bots are replying...</Text>}
      </ScrollView>

      <View style={[styles.Input_wrapper, { paddingBottom: 10 + insets.bottom }]}>

        <TextInput
          placeholder="Type something...."
          placeholderTextColor="#999"
          value={user_message}
          onChangeText={setUser_message}
          multiline
          style={styles.input}
        />

        <Pressable
          onPress={send}
          disabled={sending}
          style={[styles.btn_send, sending && styles.btn_disabled]}
        >
          <AntDesign name="arrow-up" size={20} color="#ccc" />
        </Pressable>
      </View>

      <Modal
        visible={group_details}
        animationType="slide"
        onRequestClose={() => setGroupDetails(false)}
      >
        <View style={[styles.container, { paddingTop: insets.top }]}>
          <View style={styles.nav}>
            <View style={styles.left_side}>
              <Pressable onPress={() => setGroupDetails(false)} hitSlop={8}>
                <AntDesign name="close" size={18} color="black" style={{ marginLeft: 10 }} />
              </Pressable>
              <Text style={[styles.bot_name, { marginLeft: 14 }]}>Group info</Text>
            </View>
          </View>

          <ScrollView contentContainerStyle={styles.group_main_details}>
            <View style={styles.main_details}>
              <View style={styles.Group_icon}>
                <Text style={styles.group_name}>{(group?.title?.[0] || '?').toUpperCase()}</Text>
              </View>
              <Text style={styles.name}>{group?.title}</Text>
            </View>

            <View style={styles.stats_row}>
              <View style={styles.stat_box}>
                <Text style={styles.stat_value}>{(group?.members || []).length}</Text>
                <Text style={styles.stat_label}>Members</Text>
              </View>
              <View style={styles.stat_box}>
                <Text style={styles.stat_value}>{messages.length}</Text>
                <Text style={styles.stat_label}>Messages</Text>
              </View>
              <View style={styles.stat_box}>
                <Text style={styles.stat_value_small}>{formatDate(group?.created_at) || '-'}</Text>
                <Text style={styles.stat_label}>Created</Text>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.section_title}>Members</Text>
              {(group?.members || []).map((m) => (
                <View key={m.id} style={styles.member_row}>
                  <Mascot
                    config={{ ...DEFAULT_MASCOT, ...(m.avatar_config || {}) }}
                    size={40}
                    animated={false}
                  />
                  <View style={styles.member_info}>
                    <Text style={styles.member_name} numberOfLines={1}>{m.name}</Text>
                    {!!m.provider && <Text style={styles.member_sub}>{m.provider}</Text>}
                  </View>
                  <View style={styles.type_badge}>
                    <Text style={styles.type_badge_text}>{TYPE_LABELS[m.bot_type] || m.bot_type}</Text>
                  </View>
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}