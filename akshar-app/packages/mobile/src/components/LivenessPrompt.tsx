/**
 * LivenessPrompt — displays the random liveness challenge with countdown.
 */
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface LivenessPromptProps {
  action: 'blink' | 'turn_left' | 'turn_right' | 'smile';
  timeout: number;
  onTimeout: () => void;
}

const ACTION_TEXT: Record<string, string> = {
  blink: 'Please blink slowly',
  turn_left: 'Turn your head to the left',
  turn_right: 'Turn your head to the right',
  smile: 'Please smile',
};

const ACTION_EMOJI: Record<string, string> = {
  blink: '😌',
  turn_left: '👈',
  turn_right: '👉',
  smile: '😊',
};

export function LivenessPrompt({ action, timeout, onTimeout }: LivenessPromptProps) {
  const [remaining, setRemaining] = useState(timeout);

  useEffect(() => {
    setRemaining(timeout);
    const interval = setInterval(() => {
      setRemaining(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          onTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [action, timeout, onTimeout]);

  return (
    <View style={styles.container} data-testid="enrollment-liveness-prompt">
      <Text style={styles.emoji}>{ACTION_EMOJI[action]}</Text>
      <Text style={styles.instruction}>{ACTION_TEXT[action]}</Text>
      <View style={styles.timerContainer}>
        <Text style={styles.timer}>{remaining}s</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    padding: 24,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 16,
  },
  emoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  instruction: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 16,
  },
  timerContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  timer: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
