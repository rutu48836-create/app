import { StyleSheet } from "react-native";
import { fonts } from "./fonts";

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'column',
    paddingTop: 0,
    backgroundColor: '#ebe8e8',
  },
  flex: {
    flex: 1,
  },
  grow: {
    flex: 1,
  },
  nav: {
    paddingTop:2,
    width: '100%',
    height: 44,
    padding: 0.4,
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 0,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
  },
  left_side: {
    width: '60%',
    height: '100%',
    flexDirection: 'row',
    alignItems: 'center',
  },
  mascot_box: {
    marginLeft: 20,
    marginRight: 8,
  },
  bot_name: {
    fontSize: 12.2,
    fontFamily: fonts.semibold,
    color: '#3f3d3d',
  },
  right_side: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingRight: 5,
  },
  btn: {
    width: 38,
    height: 38,
    borderRadius: 999,
    backgroundColor: '#ccc9c90c',
    borderWidth: 1,
    borderColor: '#e2dcdc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  messages_wrapper: {
    flex: 1,
    width: '100%',
    marginTop: 10,
  },
  messages_content: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
  },
  bubble: {
    maxWidth: '85%',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  bubble_user: {
    alignSelf: 'flex-end',
    backgroundColor: '#111111',
    borderColor: '#111111',
  },
  bubble_bot: {
    alignSelf: 'flex-start',
    backgroundColor: '#fafafa',
    borderColor: '#eaeaea',
  },
  bubble_text_user: {
    color: '#ffffff',
    fontFamily: fonts.regular,
    fontSize: 14,
  },
  bubble_text_bot: {
    color: '#111111',
    fontFamily: fonts.regular,
    fontSize: 14,
  },
  error: {
    color: '#e5484d',
    fontFamily: fonts.regular,
    fontSize: 13,
  },
  Input_wrapper: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingTop: 10,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#ccc',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    overflow: 'hidden',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.12)',
  },
  plus_btn: {
    width: 38,
    height: 38,
    borderRadius: 999,
    backgroundColor: '#f1efef',
    borderWidth: 1,
    borderColor: '#e2dcdc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    minHeight: 38,
    maxHeight: 100,
    paddingVertical: 9,
    paddingHorizontal: 14,
    backgroundColor: '#f6f5f5',
    borderRadius: 20,
    fontFamily: fonts.regular,
    fontSize: 14,
    color: '#111111',
    outlineStyle: 'none',
  },
  btn_send: {
    width: 38,
    height: 38,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
  },
  btn_disabled: {
    opacity: 0.5,
  },
  btn_text: {
    color: '#ffffff',
    fontFamily: fonts.semibold,
    fontSize: 14,
  },
  msg_row_ai:{
    width:'100%',
    height:'auto',
    display:'flex',
    flexDirection:'column-reverse',
    alignSelf:'flex-start',
    alignItems:'flex-start',
    textAlign:'flex-start',
  },
  msg_row_user:{
    width:'100%',
    height:'auto',
    display:'flex',
    alignSelf:'flex-end',
    alignItems:'flex-end',
    paddingLeft:8
  },
  msg_avatar:{
    display:'flex',
    width:'auto',
    height:40,
    alignSelf:'flex-start',
    marginLeft:-10,
  },
  AI_msg:{
    width:'auto',
    height:'auto',
    backgroundColor:'#dad5d5',
    padding:6,
    borderRadius:20,
    gap:10
  },
  User_msg:{
    width:'auto',
    height:'auto',
    padding:6,
    backgroundColor:"#000",
    borderRadius:4,
    alignItems:"center",
    justifyContent:'center'
  },
  User_text:{
    fontFamily:fonts.regular,
    color:'#ccc',
    fontSize:12
  },
  AI_text:{
    fontFamily:fonts.regular,
    fontSize:12.6
  },
  mascot_box_1:{
    width:34,
    height:34,
    alignItems:"center",
    justifyContent:'center',
    backgroundColor:'#000',
    marginLeft: 10,
    marginRight: 8,
    borderRadius:9999
  },
  mascot_title:{
    color:'#ccc',
    fontFamily:fonts.semibold
  },
  group_details_pop_up_container:{
    width:'100%',
    height:'100vh',
    position:'absolute',
    zIndex:9999,
    borderWidth:1,
    borderColor:'red'
  },
  group_main_details: {
    width: '100%',
    paddingHorizontal: 16,
    paddingBottom: 40,
    alignItems: 'center',
  },
  stats_row: {
    width: '100%',
    flexDirection: 'row',
    gap: 10,
    marginTop: 24,
  },
  stat_box: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#eaeaea',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  stat_value: {
    fontFamily: fonts.semibold,
    fontSize: 20,
    color: '#111111',
  },
  stat_value_small: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: '#111111',
    textAlign: 'center',
  },
  stat_label: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: '#6f6f6f',
  },
  section: {
    width: '100%',
    marginTop: 28,
    gap: 10,
  },
  section_title: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: '#3f3d3d',
  },
  member_row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#eaeaea',
    borderRadius: 14,
    padding: 10,
  },
  member_info: {
    flex: 1,
    gap: 2,
  },
  member_name: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: '#111111',
  },
  member_sub: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: '#6f6f6f',
  },
  type_badge: {
    backgroundColor: '#000000',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  type_badge_text: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: '#cccccc',
  },
  main_details:{
    width:'100%',
    height:'auto',
    alignItems:'center',
    justifyContent:'center',
    marginTop:50,
    gap:10
  },
  Group_icon:{
    width:70,
    height:70,
    alignItems:'center',
    justifyContent:'center',
    borderRadius:90,
    backgroundColor:'#000',
    borderWidth:1,
    borderColor:'#ccc'
  },
  group_name:{
    color:'#ccc',
    fontFamily:fonts.semibold,
    fontSize:30
  },
  name:{
    fontFamily:fonts.regular,
    marginTop:10
  },
  delete_bot_wrapper:{
    width:'100%',
    height:'100%',
    alignItems:'center',
    justifyContent:'center',
    backgroundColor:'#ccc'
  },
  delete_bot:{
    width:'80vw',
    height:210,
    borderRadius:10,
    borderColor:'#ccc',
    backgroundColor:'#fff',
    borderWidth:1,
    padding:10,
    gap:20
  },
  d_header:{
    width:'100%',
    height:'auto',
    display:'flex',
  },
  d_h1:{
    fontFamily:fonts.semibold,
    color:'red'
  },
  content:{
    fontFamily:fonts.regular,
    fontSize:13.4,
    lineHeight:20,
    color:'#3a3838'
  },
  btn_wrapper:{
    width:'100%',
    height:50,
    flexDirection:'row',
    alignItems:'center',
    justifyContent:'center',
    gap:10,
    marginTop:10
  },
  delete_btn:{
    width:110,
    height:34,
    borderColor:'#f80d0d',
    borderWidth:1,
    borderRadius:12,
    backgroundColor:'#fa5151',
    alignItems:'center',
    justifyContent:'center'
  },
  btn_text_d:{
    fontFamily:fonts.regular,
    color:'#ccc'
  },
  cancel_btn:{
    width:110,
    height:34,
    borderColor:'#b8b7b7',
    borderWidth:1,
    borderRadius:12,
    backgroundColor:'#ffffff',
    alignItems:'center',
    justifyContent:'center'
  },
  btn_text_c:{
    fontFamily:fonts.regular,
    color:'#242424'
  }
});

export default styles;