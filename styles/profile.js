
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
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 36,
    color: INK,
    marginTop: 8,
    letterSpacing: -0.5,
  },
  email: {
    fontFamily: fonts.regular,
    fontSize: 15,
    color: MUTED,
    marginTop: 6,
  },
  section_header: {
    marginTop: 40,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingBottom: 8,
    borderBottomWidth: 1.5,
    borderBottomColor: INK,
  },
  section_title: {
    fontFamily: fonts.semibold,
    fontSize: 18,
    color: INK,
  },
  count: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: MUTED,
  },
  list: {
    flex: 1,
  },
  list_content: {
    paddingBottom: 24,
  },
  history_row: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: LINE,
    gap: 3,
  },
  history_title: {
    fontFamily: fonts.semibold,
    fontSize: 16,
    color: INK,
  },
  history_meta: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: MUTED,
  },
  empty: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: MUTED,
    paddingVertical: 24,
  },
  loader: {
    paddingVertical: 24,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: LINE,
  },
  logout_row: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logout_txt: {
    fontFamily: fonts.semibold,
    fontSize: 16,
    color: '#a3362b',
  },
});

export default styles;