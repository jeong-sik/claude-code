import { c as _c } from "react/compiler-runtime";
import * as React from 'react';
import { KeyboardShortcutHint } from '../../components/design-system/KeyboardShortcutHint.js';
import { Box, Text } from '../../ink.js';
import { useKeybinding } from '../../keybindings/useKeybinding.js';
import { useShortcutDisplay } from '../../keybindings/useShortcutDisplay.js';
import { useAppStateStore, useSetAppState } from '../../state/AppState.js';
import { env } from '../../utils/env.js';
import { isEnvTruthy } from '../../utils/envUtils.js';
import { backgroundAll } from '../../tasks/LocalShellTask/LocalShellTask.js';

// Simple component to show background hint and handle ctrl+b
// When ctrl+b is pressed, backgrounds ALL running foreground commands
export function BackgroundHint(t0) {
  const $ = _c(9);
  let t1;
  if ($[0] !== t0) {
    t1 = t0 === undefined ? {} : t0;
    $[0] = t0;
    $[1] = t1;
  } else {
    t1 = $[1];
  }
  const {
    onBackground
  } = t1;
  const store = useAppStateStore();
  const setAppState = useSetAppState();
  let t2;
  if ($[2] !== onBackground || $[3] !== setAppState || $[4] !== store) {
    t2 = () => {
      backgroundAll(() => store.getState(), setAppState);
      onBackground?.();
    };
    $[2] = onBackground;
    $[3] = setAppState;
    $[4] = store;
    $[5] = t2;
  } else {
    t2 = $[5];
  }
  const handleBackground = t2;
  let t3;
  if ($[6] === Symbol.for("react.memo_cache_sentinel")) {
    t3 = {
      context: "Task"
    };
    $[6] = t3;
  } else {
    t3 = $[6];
  }
  useKeybinding("task:background", handleBackground, t3);
  const baseShortcut = useShortcutDisplay("task:background", "Task", "ctrl+b");
  const shortcut = env.terminal === "tmux" && baseShortcut === "ctrl+b" ? "ctrl+b ctrl+b (twice)" : baseShortcut;
  if (isEnvTruthy(process.env.CLAUDE_CODE_DISABLE_BACKGROUND_TASKS)) {
    return null;
  }
  let t4;
  if ($[7] !== shortcut) {
    t4 = <Box paddingLeft={5}><Text dimColor={true}><KeyboardShortcutHint shortcut={shortcut} action="run in background" parens={true} /></Text></Box>;
    $[7] = shortcut;
    $[8] = t4;
  } else {
    t4 = $[8];
  }
  return t4;
}
