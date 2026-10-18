import {
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { pickFolder, saveFolder } from '../components/folder.js';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import styles from '../styles/create.js';
import AntDesign from '@expo/vector-icons/AntDesign';
import { useState, useEffect } from 'react';
import { supabase } from '../libs/supabase';
import Mascot from '../components/Mascot';
import { uploadMascot } from '../libs/mascotStorage';
import EmailConnect from '../components/EmailConnect.jsx';
import {
  COLORS,
  BODIES,
  EYES,
  LOOKS,
  FINISHES,
  DEFAULT_MASCOT,
} from '../libs/mascot';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000';


const BOT_TYPES = [
  { label: 'Search Engine', value: 'search' },
  { label: 'Email', value: 'email' },
  {label:'Sales',value:'sales'},
  {label:'Watcher',value:'watcher'},
  ...(Platform.OS === 'android' ? [{ label: 'Folder', value: 'folder' }] : []),
];

const PROVIDERS = [
  { label: 'Groq', value: 'groq', placeholder: 'gsk_...' },
  { label: 'Gemini', value: 'gemini', placeholder: 'AIza...' },
];

function Chips({ items = [], value, onSelect }) {
  return (
    <View style={styles.row}>
      {items.map((item) => (
        <Pressable
          key={item}
          onPress={() => onSelect(item)}
          style={[styles.chip, value === item && styles.chipActive]}
        >
          <Text style={[styles.chipText, value === item && styles.chipTextActive]}>{item}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function MascotPreview({ update, mascot, step, setStep }) {
  const insets = useSafeAreaInsets();

  return (
    <>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.preview}>
          <Mascot config={mascot} size={170} />
        </View>

        <Text style={styles.label}>Shape</Text>
        <View style={styles.row}>
          {BODIES.map((b) => (
            <Pressable
              key={b}
              onPress={() => update('body', b)}
              style={[styles.tile, mascot.body === b && styles.tileActive]}
            >
              <Mascot config={{ ...mascot, body: b }} size={40} animated={false} />
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Color</Text>
        <View style={styles.row}>
          {COLORS.map((c) => (
            <Pressable
              key={c}
              onPress={() => update('color', c)}
              style={[styles.swatch, { backgroundColor: c }, mascot.color === c && styles.swatchActive]}
            />
          ))}
        </View>

        <Text style={styles.label}>Eyes</Text>
        <Chips items={EYES} value={mascot.eyes} onSelect={(v) => update('eyes', v)} />

        <Text style={styles.label}>Look</Text>
        <Chips items={LOOKS} value={mascot.look} onSelect={(v) => update('look', v)} />

        <Text style={styles.label}>Finish</Text>
        <Chips items={FINISHES} value={mascot.finish} onSelect={(v) => update('finish', v)} />
      </ScrollView>

      <View style={[styles.button_wrappers, { paddingBottom: 12 + insets.bottom }]}>
        <Pressable style={styles.continue_button} onPress={() => setStep(step + 1)}>
          <Text style={[styles.continue_text, { color: '#ccc' }]}>Continue</Text>
        </Pressable>
      </View>
    </>
  );
}

function MascotDetails({
  mascot,
  step,
  setStep,
  botName,
  setBotName,
  botDescription,
  setBotDescription,
  botType,
  setBotType,
  provider,
  setProvider,
  apiKey,
  setApiKey,
  saving,
  error,
  onSave,
  user,
  folderUri,
  setFolderUri,
}) {
  const insets = useSafeAreaInsets();
  const [showKey, setShowKey] = useState(false);
  const activeProvider = PROVIDERS.find((p) => p.value === provider) || PROVIDERS[0];

  const folderName = folderUri
    ? decodeURIComponent(folderUri).split(':').pop()
    : '';

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.preview, styles.preview_small]}>
          <Mascot config={mascot} size={110} />
        </View>

        <Text style={styles.label}>Agent name</Text>
        <TextInput
          value={botName}
          onChangeText={setBotName}
          style={styles.input}
          placeholder="e.g. Support assistant"
          placeholderTextColor="#999"
          maxLength={60}
        />

        <Text style={styles.label}>Agent prompt</Text>
        <TextInput
          value={botDescription}
          onChangeText={setBotDescription}
          style={[styles.input, styles.textarea]}
          placeholder="Describe how this agent should behave"
          placeholderTextColor="#999"
          multiline
          numberOfLines={8}
        />

        <Text style={styles.label}>Type</Text>
        <View style={styles.row}>
          {BOT_TYPES.map((t) => (
            <Pressable
              key={t.value}
              onPress={() => setBotType(t.value)}
              style={[styles.chip, botType === t.value && styles.chipActive]}
            >
              <Text style={[styles.chipText, botType === t.value && styles.chipTextActive]}>
                {t.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {botType === 'email' && user && <EmailConnect userId={user.id} />}

          {botType === 'sales' && user && <EmailConnect userId={user.id} />}


        {botType === 'folder' && (
          <>
            <Text style={styles.label}>Folder</Text>
            <Pressable
              style={styles.chip}
              onPress={async () => {
                const uri = await pickFolder();
                if (uri) setFolderUri(uri);
              }}
            >
              <Text style={styles.chipText}>
                {folderUri ? 'Change folder' : 'Select folder'}
              </Text>
            </Pressable>
            {!!folderUri && <Text style={styles.hint}>Folder: {folderName}</Text>}
          </>
        )}

        <Text style={styles.label}>Provider</Text>
        <View style={styles.row}>
          {PROVIDERS.map((p) => (
            <Pressable
              key={p.value}
              onPress={() => setProvider(p.value)}
              style={[styles.chip, provider === p.value && styles.chipActive]}
            >
              <Text style={[styles.chipText, provider === p.value && styles.chipTextActive]}>
                {p.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>API key</Text>
        <View style={styles.key_wrap}>
          <TextInput
            value={apiKey}
            onChangeText={setApiKey}
            style={styles.key_input}
            placeholder={activeProvider.placeholder}
            placeholderTextColor="#999"
            secureTextEntry={!showKey}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Pressable onPress={() => setShowKey((s) => !s)} hitSlop={8}>
            <AntDesign name={showKey ? 'eye-invisible' : 'eye'} size={16} color="#6f6f6f" />
          </Pressable>
        </View>
        <Text style={styles.hint}>Paste your {activeProvider.label} API key. It is stored on your agent.</Text>

        {!!error && <Text style={styles.error}>{error}</Text>}
      </ScrollView>

      <View style={[styles.button_wrappers, styles.footer_row, { paddingBottom: 12 + insets.bottom }]}>
        <Pressable style={styles.back_button} onPress={() => setStep(step - 1)} disabled={saving}>
          <Text style={styles.back_text}>Back</Text>
        </Pressable>
        <Pressable
          style={[styles.continue_button, styles.grow, saving && styles.saveDisabled]}
          onPress={onSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.continue_text}>Create agent</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

export default function CreateBot() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [mascot, setMascot] = useState(DEFAULT_MASCOT);
  const [user, setUser] = useState(null);
  const [botName, setBotName] = useState('');
  const [botDescription, setBotDescription] = useState('');
  const [botType, setBotType] = useState('search');
  const [provider, setProvider] = useState('groq');
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState(0);
  const [folderUri, setFolderUri] = useState(null);

  const update = (key, value) => setMascot((m) => ({ ...m, [key]: value }));

  useEffect(() => {
    async function fetchUser() {
      const { data: { user }, error } = await supabase.auth.getUser();

      if (!error && user) {
        setUser(user);
      }

      if (!user) {
        router.push('/auth');
      }
    }

    fetchUser();
  }, []);

  const save = async () => {
    if (!user || saving) return;
    if (!botName.trim()) {
      setError('Give your agent a name.');
      return;
    }
    if (!apiKey.trim()) {
      setError('Paste an API key for the selected provider.');
      return;
    }
    if (botType === 'folder' && !folderUri) {
      setError('Select a folder for this agent.');
      return;
    }

    setError('');
    setSaving(true);
    try {
      const { blink, gaze, ...avatar } = mascot;

      const response = await fetch(`${API_URL}/api/db/bot_upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botName: botName.trim(),
          botDescription: botDescription.trim(),
          botType,
          provider,
          apiKey: apiKey.trim(),
          mascot: avatar,
          user_id: user.id,
        }),
      });

      const text = await response.text();
      console.log('response', response.status, text);
      const result = JSON.parse(text);
      if (!response.ok) throw new Error(result.error || 'Could not create the agent.');

      if (botType === 'folder') await saveFolder(result.id, folderUri);

      const url = await uploadMascot(user.id, result.id, avatar);
      const { error: updateError } = await supabase
        .from('bots')
        .update({ avatar_url: url })
        .eq('id', result.id);
      if (updateError) throw updateError;

      router.replace('/');
    } catch (e) {
      console.log('save error', e);
      setError(e.message || 'Could not create the agent.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={styles.header_left}>
          <Mascot config={mascot} size={30} animated={false} />
          <Text style={styles.header_text}>{botName || 'New Agent'}</Text>
        </View>

        <View style={styles.header_right}>
          <Pressable onPress={() => router.replace('/')} hitSlop={8}>
            <AntDesign name="close" size={16} color="black" />
          </Pressable>
        </View>
      </View>

      {step === 0 && (
        <MascotPreview mascot={mascot} update={update} step={step} setStep={setStep} />
      )}

      {step === 1 && (
        <MascotDetails
          mascot={mascot}
          step={step}
          setStep={setStep}
          botName={botName}
          setBotName={setBotName}
          botDescription={botDescription}
          setBotDescription={setBotDescription}
          botType={botType}
          setBotType={setBotType}
          provider={provider}
          setProvider={setProvider}
          apiKey={apiKey}
          setApiKey={setApiKey}
          saving={saving}
          error={error}
          onSave={save}
          user={user}
          folderUri={folderUri}
          setFolderUri={setFolderUri}
        />
      )}
    </View>
  );
}