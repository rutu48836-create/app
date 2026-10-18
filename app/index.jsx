import { View, Text, Pressable, TextInput, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import styles from '../styles/home.js';
import AntDesign from '@expo/vector-icons/AntDesign';
import {useState,useEffect} from "react"
import { supabase } from "../libs/supabase" 
import Mascot from '../components/Mascot';
import {
  COLORS,
  BODIES,
  EYES,
  LOOKS,
  FINISHES,
  DEFAULT_MASCOT,
} from '../libs/mascot';

export default function Home() {

  const router = useRouter();
const insets = useSafeAreaInsets();
  const [user,setUser] = useState(null)
  const [bots,setBots] = useState([])
  const [search_value,setSearch_value] = useState("")
  const [groups,setGroups] = useState([])

   const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000';

   const filteredBots = bots.filter(bot => 
    bot.name?.toLowerCase().includes(search_value.toLowerCase())
  );

   useEffect(() => {
    async function fetchUser() {
      const { data: { user }, error } = await supabase.auth.getUser();
      
      if (!error && user) {
        setUser(user);
      }

       if(!user){
        router.push('/auth')
       }

    }

    fetchUser();
  }, []);

  useEffect(() => {
    const FetchBots = async () => {

      if (!user) return
      const userid = user.id


      try{
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

    }

    FetchBots()
  },[user])

useEffect(() => {

const fetch_groups = async () => {

if(!user) return

const response = await fetch(`${API_URL}/api/db/fetch_groups/${user.id}`)
const result = await response.json()

if(response.ok){
  setGroups(result.data)
}

else {
  console.log('error')
}

}

fetch_groups()

},[user])

  return (
<View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
       <Pressable onPress={() => {router.push({ pathname: '/user', params: { id: user.id } });}}>
       <View style={styles.headerUser} ><Text style={styles.user_name}>{user?.email[0].toUpperCase()}</Text></View>
        </Pressable> 
        <View style={styles.links}>
          <Pressable
            style={styles.link_btn}
            onPress={() => router.push('/new_group')}
          >
           <AntDesign name="folder-add" size={24} color="black" />
          </Pressable>
          <Pressable
            style={styles.link_btn}
            onPress={() => router.push('/new_bot')}
          >
            <AntDesign name="plus" size={22} color="black"/>
          </Pressable>
        </View>
      </View>

      <View style={styles.bot_row}>
       <TextInput placeholder="search name" style={styles.input} value={search_value} onChangeText={(text) => setSearch_value(text)}/>
        <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.bot_horizontal_wrappper}
          contentContainerStyle={styles.bot_horizontal_content}
      >

       { filteredBots.map((b) => {
        return(
<Pressable
  style={styles.bot_card_wrapper}
  key={b.id}
  onPress={() => router.push(`/chat/${b.id}`)}
>
  <View style={styles.bot_card}>
    <Mascot config={{ ...DEFAULT_MASCOT, ...(b.avatar_config || {}) }} size={50} animated={false} />
  </View>
  <Text style={styles.bot_name}>{b.name}</Text>
</Pressable>
       
        )
       }) }



      </ScrollView>
        </View>

<ScrollView
  style={styles.chats}
  contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
>        
        <Text style={styles.chat_h1}>
         Group Chats</Text>

          <View style={styles.recent_bot_chat_wrapper}>
  {groups.map((g) => (
    <Pressable
      style={styles.recent_bot_card_container}
      key={g.id}
      onPress={() => router.push(`/group/${g.id}`)}
    >
      <View style={styles.recent_bot_card}>
        <View style={styles.group_icon}>
          <Text style={styles.bot_name_1}>{(g.title?.[0] || '?').toUpperCase()}</Text>
        </View>
      </View>
      <View style={styles.recent_bot_card_details}>
        <Text style={styles.bot_name_2}>{g.title}</Text>
        <View style={{ flexDirection: 'row', gap: 0 }}>
          {(g.members || []).slice(0, 3).map((m) => (
            <Mascot
              key={m.id}
              config={{ ...DEFAULT_MASCOT, ...(m.avatar_config || {}) }}
              size={24}
            />
          ))}
        </View>
      </View>
    </Pressable>
  ))}
</View>

        </ScrollView>      



    </View>
  );
}