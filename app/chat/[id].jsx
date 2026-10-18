import {
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Linking,
  StyleSheet,
  Modal
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import styles from '../../styles/chat.js';
import { fonts } from '../../styles/fonts';
import AntDesign from '@expo/vector-icons/AntDesign';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../libs/supabase.ts';
import Mascot from '../../components/Mascot.jsx';
import EmailConnect from '../../components/EmailConnect.jsx';
import EmailDrafts from '../../components/EmailDrafts.jsx';
import {
  pickFolder,
  saveFolder,
  getFolder,
  runFolderTool,
  listFileNames,
} from '../../components/folder.js';
import { DEFAULT_MASCOT } from '../../libs/mascot';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000';
const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const MAX_TOOL_ROUNDS = 5;

const card = StyleSheet.create({
  col: {
    maxWidth: '80%',
    flexShrink: 1,
    gap: 8,
  },
  wrap: {
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#eaeaea',
    backgroundColor: '#ffffff',
    gap: 4,
  },
  title: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: '#111111',
  },
  body: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: '#444444',
  },
  link: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: '#6f6f6f',
  },
});

const hostOf = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
};

function ResultCard({ item }) {
  const canOpen = typeof item.url === 'string' && /^https?:\/\//i.test(item.url);

  const open = () => {
    if (canOpen) Linking.openURL(item.url).catch((e) => console.log('open link error', e));
  };

  return (
    <Pressable onPress={open} disabled={!canOpen} style={card.wrap}>
      {!!item.title && (
        <Text style={card.title} numberOfLines={2}>
          {item.title}
        </Text>
      )}
      {!!item.content && (
        <Text style={card.body} numberOfLines={4}>
          {item.content}
        </Text>
      )}
      {canOpen && (
        <Text style={card.link} numberOfLines={1}>
          {hostOf(item.url)}
        </Text>
      )}
    </Pressable>
  );
}

export default function Chat_Page() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const botId = Array.isArray(params.id) ? params.id[0] : params.id;
  const listRef = useRef(null);

  const [bot, setBot] = useState(null);
  const [messages, setMessages] = useState([]);
  const [user, setUser] = useState(null);
  const [user_message, setUser_message] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [error, setError] = useState('');
  const [folderUri, setFolderUri] = useState(null);
  const [delete_bot, setDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    async function fetchUser() {
      const { data: { user }, error } = await supabase.auth.getUser();

      if (!error && user) {
        setUser(user);
      }

      if (!user) {
        router.replace('/auth');
      }
    }

    fetchUser();
  }, []);

  useEffect(() => {
    if (!user || !botId) return;

    const fetchBot = async () => {
      const { data, error: botError } = await supabase
        .from('bots')
        .select('id, name, system_prompt, bot_type, provider, avatar_config')
        .eq('id', botId)
        .eq('owner_id', user.id)
        .maybeSingle();

      if (botError) {
        console.log('bot fetch error', botError.message);
      } else if (!data) {
        console.log('no data');
      } else {
        setBot(data);
      }
    };

    fetchBot();
  }, [user, botId]);

  useEffect(() => {
    if (!botId) return;
    getFolder(botId).then(setFolderUri).catch(() => setFolderUri(null));
  }, [botId]);

  useEffect(() => {
    if (!user || !botId) return;

    const fetchHistory = async () => {
      setLoadingHistory(true);
      setMessages([]);

      try {
        const response = await fetch(`${API_URL}/api/db/history/${botId}?user_id=${user.id}`);
        const result = await response.json();

        if (response.ok) {
          setMessages(result.data || []);
        } else {
          console.log('history failed', response.status, result);
        }
      } catch (e) {
        console.log('history error', e);
      } finally {
        setLoadingHistory(false);
      }
    };

    fetchHistory();
  }, [user, botId]);

  const mascotConfig = { ...DEFAULT_MASCOT, ...(bot?.avatar_config || {}) };

  const isEmailBot = bot?.bot_type === 'email';
  const isFolderBot = bot?.bot_type === 'folder';
  const isSalesBot = bot?.bot_type === 'sales';

  const repickFolder = async () => {
    const uri = await pickFolder();
    if (uri) {
      await saveFolder(botId, uri);
      setFolderUri(uri);
    }
  };

  const callChat = async (history, trace, files) => {
    const response = await fetch(`${API_URL}/api/db/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: user.id,
        id: botId,
        messages: history.map(({ role, content }) => ({ role, content })),
        ...(trace && trace.length ? { tool_round: trace } : {}),
        ...(files ? { files } : {}),
      }),
    });

    const raw = await response.text();
    let result;
    try {
      result = JSON.parse(raw);
    } catch {
      throw new Error(`Server returned ${response.status}, not JSON`);
    }
    if (!response.ok) throw new Error(result.error || 'Request failed');
    return result;
  };

  const send = async () => {
    const text = user_message.trim();
    if (!text || sending || !user) return;

    if (isFolderBot && !folderUri) {
      setError('Select a folder for this agent first.');
      return;
    }

    const next = [...messages, { id: makeId(), role: 'human', content: text }];
    setMessages(next);
    setUser_message('');
    setSending(true);
    setError('');

    try {
      const files = isFolderBot ? await listFileNames(botId) : null;
      const trace = [];
      let result = await callChat(next, trace, files);

      let rounds = 0;
      while (
        isFolderBot &&
        Array.isArray(result.tool_calls) &&
        result.tool_calls.length > 0 &&
        rounds < MAX_TOOL_ROUNDS
      ) {
        rounds += 1;
        const uri = await getFolder(botId);
        const outputs = [];
        for (const call of result.tool_calls) {
          outputs.push({
            id: call.id,
            name: call.name,
            output: await runFolderTool(uri, call),
          });
        }
        trace.push({ calls: result.tool_calls, outputs });
        result = await callChat(next, trace, files);
      }

      setMessages([
        ...next,
        {
          id: makeId(),
          role: 'ai',
          content: String(result.reply || ''),
          results: Array.isArray(result.results) ? result.results : [],
        },
      ]);
    } catch (e) {
      console.log(e);
      setError(e.message || 'Could not send the message.');
    } finally {
      setSending(false);
    }
  };

  const deleteBot = async () => {
    if (deleting || !bot?.id || !user?.id) return;
    setDeleting(true);
    setDeleteError('');

    try {
      const response = await fetch(
        `${API_URL}/api/db/bot/${bot.id}?user_id=${encodeURIComponent(user.id)}`,
        { method: 'DELETE' }
      );

      const raw = await response.text();
      let result = {};
      try {
        result = JSON.parse(raw);
      } catch {}

      if (!response.ok) {
        throw new Error(result.error || `Delete failed (${response.status})`);
      }

      setDelete(false);
      router.replace('/');
    } catch (e) {
      console.log('delete error', e);
      setDeleteError(e.message || 'Could not delete the bot.');
    } finally {
      setDeleting(false);
    }
  };

  const closeDelete = () => {
    if (deleting) return;
    setDeleteError('');
    setDelete(false);
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.nav}>
        <View style={styles.left_side}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <AntDesign name="left" size={14} color="black" style={{ marginLeft: 10 }} />
          </Pressable>
          <View style={styles.mascot_box}>
            <Mascot config={mascotConfig} size={30} animated={false} />
          </View>
          <Text style={styles.bot_name}>{bot?.name}</Text>
        </View>
        <View style={styles.right_side}>
          <Pressable style={styles.btn} onPress={() => setDelete(true)}>
            <AntDesign name="delete" size={20} color="red" />
          </Pressable>
        </View>
      </View>

      {isEmailBot && user && <EmailConnect userId={user.id} />}
      {isSalesBot && user && <EmailConnect userId={user.id} />}

      {isFolderBot && !folderUri && (
        <Pressable onPress={repickFolder} style={card.wrap}>
          <Text style={card.title}>No folder selected</Text>
          <Text style={card.body}>Tap to choose the folder this agent can access.</Text>
        </Pressable>
      )}

      <ScrollView
        ref={listRef}
        style={styles.messages_wrapper}
        contentContainerStyle={styles.messages_content}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
      >
        {loadingHistory && <ActivityIndicator />}

        {!loadingHistory && messages.length === 0 && !sending && (
          <Text style={styles.empty}>Say hi to {bot?.name || 'your agent'}.</Text>
        )}

        {messages.map((m) => {
          const isAI = m.role === 'ai';
          const items = isAI && Array.isArray(m.results) ? m.results : [];

          return (
            <View key={m.id} style={[styles.msg_row, isAI ? styles.msg_row_ai : styles.msg_row_user]}>
              {isAI && (
                <View style={styles.msg_avatar}>
                  <Mascot config={mascotConfig} size={28} animated={false} />
                </View>
              )}

              {isAI ? (
                <View style={card.col}>
                  <View style={styles.AI_msg}>
                    <Text style={styles.AI_text}>{m.content}</Text>

                    {items.map((item, i) => (
                      <ResultCard key={`${m.id}-${i}`} item={item} />
                    ))}
                  </View>
                </View>
              ) : (
                <View style={styles.User_msg}>
                  <Text style={styles.User_text}>{m.content}</Text>
                </View>
              )}
            </View>
          );
        })}

        {sending && (
          <View style={[styles.msg_row, styles.msg_row_ai]}>
            <View style={styles.msg_avatar}>
              <Mascot config={mascotConfig} size={28} animated={false} />
            </View>
            <ActivityIndicator />
          </View>
        )}

        {isEmailBot && user && (
          <EmailDrafts userId={user.id} botId={botId} refreshKey={messages.length} />
        )}

        {isSalesBot && user && (
          <EmailDrafts userId={user.id} botId={botId} refreshKey={messages.length} />
        )}

        {!!error && <Text style={styles.error}>{error}</Text>}
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
        visible={delete_bot}
        transparent
        animationType="fade"
        onRequestClose={closeDelete}
      >
        <View style={styles.delete_bot_wrapper}>
          <View style={styles.delete_bot}>
            <View style={styles.d_header}>
              <Text style={styles.d_h1}>Delete Bot</Text>
            </View>

            <Text style={styles.content}>
              This will permanently delete the agent and related resources like API key stored in database, History.
            </Text>

            {!!deleteError && <Text style={styles.error}>{deleteError}</Text>}

            <View style={styles.btn_wrapper}>
              <Pressable
                style={[styles.delete_btn, deleting && styles.btn_disabled]}
                onPress={deleteBot}
                disabled={deleting}
              >
                {deleting ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.btn_text_d}>Delete</Text>
                )}
              </Pressable>
              <Pressable style={styles.cancel_btn} onPress={closeDelete} disabled={deleting}>
                <Text style={styles.btn_text_c}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}