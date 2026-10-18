import {
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import styles from '../styles/group_creation.js';
import AntDesign from '@expo/vector-icons/AntDesign';
import { useState, useEffect } from 'react';
import { supabase } from '../libs/supabase';
import Mascot from '../components/Mascot';
import { DEFAULT_MASCOT } from '../libs/mascot';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000';

export default function New_Group() {
  const [bots, setBots] = useState([]);
  const [user, setUser] = useState(null);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [checked, setChecked] = useState([]);
  const [name, setName] = useState('');

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

  useEffect(() => {
    const FetchBots = async () => {
      if (!user) return;

      try {
        const response = await fetch(`${API_URL}/api/db/fetch_bot/${user.id}`);
        const result = await response.json();

        if (response.ok) {
          setBots(result.data || []);
        } else {
          console.log('fetch bots failed', response.status, result);
        }
      } catch (e) {
        console.log('fetch bots error', e);
      }
    };

    FetchBots();
  }, [user]);

  const handleUpload = async () => {
       if(name.trim().length === 0){
return alert("pls enter a title")
   }

   if(checked.length === 0){
    return alert('pls select a bot')
   }


    try {
      const response = await fetch(`${API_URL}/api/db/create_group`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          title: name,
          bots: checked,
        }),
      });

      const result = await response.json();
      console.log('result handleupload', result);
    } catch (e) {
      console.log(e);
    }
  };

  const handleCheck = (botId) => {
    setChecked((prevChecked) => {
      if (prevChecked.includes(botId)) {
        return prevChecked.filter((id) => id !== botId);
      }
      return [...prevChecked, botId];
    });
  };

  const canCreate = name.trim().length > 0 && checked.length > 0;

  return (
    <View style={[styles.container, { flex: 1, minHeight: 0 }]}>
      <View style={styles.nav}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <AntDesign name="arrow-left" size={22} color="#1a1a1a" />
        </Pressable>
        <Pressable
          onPress={handleUpload}
          disabled={!canCreate}
          style={[styles.btn, !canCreate && styles.btn_disabled]}
        >
          <Text style={styles.create}>Create</Text>
        </Pressable>
      </View>

      <Text style={styles.title}>New group</Text>

      <View style={styles.name_block}>
        <Text style={styles.label}>Group name</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Name your group"
          placeholderTextColor="#b5afa4"
          style={styles.input_field}
        />
      </View>

      <View style={styles.bots_header}>
        <Text style={styles.label}>Bots</Text>
        <Text style={styles.count}>{checked.length} selected</Text>
      </View>

      <ScrollView
        style={[styles.bots_wrapper, { minHeight: 0 }]}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.bots_content,
          { paddingBottom: 24 + insets.bottom },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {bots.map((b) => {
          const on = checked.includes(b.id);
          return (
            <Pressable
              key={b.id}
              style={styles.bot_row}
              onPress={() => handleCheck(b.id)}
            >
              <Mascot
                config={{ ...DEFAULT_MASCOT, ...(b.avatar_config || {}) }}
                size={56}
                animated={false}
              />
              <View style={styles.bot_info}>
                <Text style={styles.bot_name}>{b.name}</Text>
                <Text style={styles.bot_type}>{b.bot_type}</Text>
              </View>
              <View style={[styles.tick, on && styles.tick_on]}>
                {on && <AntDesign name="check" size={15} color="#f2efe9" />}
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}