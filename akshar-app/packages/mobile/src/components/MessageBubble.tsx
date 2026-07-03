/**
 * MessageBubble — displays a decrypted chat message with trust badge and bot indicator.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { TrustBadge } from './TrustBadge';
import type { DecryptedMessage } from '../types';

interface MessageBubbleProps {
  message: DecryptedMessage;
  isOwn: boolean;
  senderTier?: string;
}

export function MessageBubble({ message, isOwn, senderTier }: MessageBubbleProps) {
  const bubbleStyle = isOwn ? styles.ownBubble : styles.otherBubble;
  const textColor = isOwn ? '#FFFFFF' : '#1A1A1A';

  return (
    <View
      style={[styles.container, isOwn && styles.containerOwn]}
      data-testid={`message-bubble-${message.msgId}`}
    >
      {!isOwn && (
        <View style={styles.header}>
          <Text style={styles.sender}>{message.from}</Text>
          {senderTier && <TrustBadge tier={senderTier} size="small" />}
        </View>
      )}
      <View style={[styles.bubble, bubbleStyle]}>
        <Text style={[styles.text, { color: textColor }]}>{message.text}</Text>
      </View>
      <View style={styles.footer}>
        <Text style={styles.time}>
          {new Date(message.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
        {message.classification?.verdict === 'Bot' && (
          <Text style={styles.botIndicator} accessibilityLabel="Bot detected">
            🤖
          </Text>
        )}
        {message.classification?.pAI && message.classification.pAI > 0.75 && (
          <Text style={styles.aiIndicator} accessibilityLabel="Possibly AI-generated">
            AI
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
    marginHorizontal: 12,
    maxWidth: '80%',
    alignSelf: 'flex-start',
  },
  containerOwn: {
    alignSelf: 'flex-end',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  sender: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  bubble: {
    padding: 12,
    borderRadius: 16,
  },
  ownBubble: {
    backgroundColor: '#6200EE',
    borderBottomRightRadius: 4,
  },
  otherBubble: {
    backgroundColor: '#F0F0F0',
    borderBottomLeftRadius: 4,
  },
  text: {
    fontSize: 16,
    lineHeight: 22,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  time: {
    fontSize: 10,
    color: '#999',
  },
  botIndicator: {
    fontSize: 12,
  },
  aiIndicator: {
    fontSize: 10,
    color: '#FF5722',
    fontWeight: '700',
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 4,
    borderRadius: 4,
  },
});
