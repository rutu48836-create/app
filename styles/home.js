import { StyleSheet } from 'react-native';
import { fonts } from './fonts';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'column',
    paddingTop: 10,
    fontFamily: fonts.bold,
  },
  header: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop:20
  },
  headerUser: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#000',
    marginLeft: 10,
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: fonts.bold,
  },
  links: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginRight: 10,
  },
  link_btn: {
    backgroundColor: 'transparent',
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  link_text: {
    color: '#000',
    fontSize: 16,
  },

  bot_row:{
    width:'100%',
    height:'auto',
    display:'flex',
    justifyContent:'center',
    marginTop:20,
    alignItems:'center'
  },

  input:{
    width:'90%',
    padding:10,
    backgroundColor:'#f0e9e9',
    borderRadius:10,
    borderWidth:1,
    borderColor:'#ccc',
    outlineStyle:'none',
    fontFamily: fonts.regular,
    fontSize:14
  },

  bot_horizontal_wrappper:{
  width:'100%',
  height:100,
  display:'flex',
  paddingTop:20,
  },

bot_horizontal_content: {
  alignItems: 'center',
  justifyContent: 'flex-start',
  gap: 20,
  paddingHorizontal: 12,
  flexGrow: 1,
},

bot_card_wrapper:{
  width:'auto',
  height:'auto',
  display:'flex',
  flexDirection:'column',
  alignItems:'center',
  justifyContent:'center',
},
user_name:{
color:'#ccc',
fontFamily:fonts.semibold
},
  bot_card:{
    width:'auto',
    height:'auto',
    borderRadius:'50%',
    display:'flex',
    alignItems:'center',
    justifyContent:'center',
    cursor:'pointer'
  },

  bot_name:{
    fontFamily:fonts.regular,
    marginTop:4,
    fontSize:12.2,
    color:'#6e6b6b'
  },
  bot_last_msg:{
    fontFamily:fonts.regular,
    marginTop:4,
    fontSize:12.2,
    color:'#888484'
  },

  chats:{
    width:'100%',
    height:'auto',
    display:'flex',
    marginTop:20,
    paddingHorizontal: 12,
  },

  chat_h1:{
      fontFamily:fonts.regular,
      fontSize:14,
      color:'#494646'
  },

  recent_bot_chat_wrapper:{
    width:'100%',
    height:'auto',
    display:'flex',
    gap:14,
    marginTop:20
  },

  recent_bot_card_container:{
    width:'100%',
    height:'auto',
    display:'flex',
    flexDirection:'row',
    alignItems:'center',
    gap:12
  },

  recent_bot_card:{
    width:44,
    height:44,
    alignItems:'center',
    justifyContent:'center'
  },

  recent_bot_card_details:{
    flex:1,
    height:44,
    display:'flex',
    alignItems:'flex-start',
    justifyContent:'center',
    marginLeft:0,
    gap:4
  },
  bot_name_1:{
    color:'#ccc',
    fontFamily:fonts.semibold,
  },
  group_icon:{
    width:44,
    height:44,
    backgroundColor:'#000',
    display:'flex',
    alignItems:'center',
    justifyContent:'center',
    borderRadius:90
  },
  bot_name_2:{
    color:'#242222',
    fontFamily:fonts.semibold,
    lineHeight:18
  }

});

export default styles ;