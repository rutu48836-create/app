import { StyleSheet } from "react-native";
import { fonts } from "./fonts";

const INK = '#1a1a1a';
const MUTED = '#7a756d';
const LINE = '#dcd7cd';
const PAPER = '#f2efe9';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PAPER,
    paddingHorizontal: 24,
  },
  nav: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  btn: {
    paddingHorizontal: 20,
    height: 38,
    borderRadius: 19,
    backgroundColor: INK,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btn_disabled: {
    opacity: 0.3,
  },
  create: {
    color: PAPER,
    fontFamily: fonts.semibold,
    fontSize: 14,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 36,
    color: INK,
    marginTop: 8,
    letterSpacing: -0.5,
  },
  label: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    color: MUTED,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  name_block: {
    marginTop: 36,
  },
  input_field: {
    fontFamily: fonts.regular,
    fontSize: 20,
    color: INK,
    paddingVertical: 12,
    marginTop: 4,
    borderBottomWidth: 1.5,
    borderBottomColor: INK,
  },
  bots_header: {
    marginTop: 44,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  count: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: MUTED,
  },
  bots_wrapper: {
    flex: 1,
    marginTop: 8,
  },
  bots_content: {
    paddingBottom: 24,
  },
  bot_row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: LINE,
  },
  bot_info: {
    flex: 1,
    gap: 3,
  },
  bot_name: {
    fontFamily: fonts.semibold,
    fontSize: 17,
    color: INK,
  },
  bot_type: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: MUTED,
  },
  tick: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#b5afa4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tick_on: {
    backgroundColor: INK,
    borderColor: INK,
  },
});

export default styles;