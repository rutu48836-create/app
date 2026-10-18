
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

})

export default styles