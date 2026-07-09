/**
 * MessageBubble — displays a decrypted chat message with trust badge and bot indicator.
 */
import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet } from 'react-native';
import { TrustBadge } from './TrustBadge';
import type { DecryptedMessage } from '../types';

interface MessageBubbleProps {
  message: DecryptedMessage;
  isOwn: boolean;
  senderTier?: string;
  onShare?: () => void;
}

export function MessageBubble({ message, isOwn, senderTier, onShare }: MessageBubbleProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  const bubbleStyle = isOwn ? styles.ownBubble : styles.otherBubble;

  return (
    <Animated.View
      style={[styles.container, isOwn && styles.containerOwn, { opacity: fadeAnim }]}
      testID={`message-bubble-${message.msgId}`}
    >
      {!isOwn && (
        <View style={styles.header}>
          <Text style={styles.sender}>{message.from}</Text>
          {senderTier && <TrustBadge tier={senderTier} size="small" />}
        </View>
      )}
      <View style={[styles.bubble, bubbleStyle, message.decryptionFailed && styles.failedBubble]}>
        {message.decryptionFailed ? (
          <View style={styles.failedContainer}>
            <Text style={styles.failedIcon}>🔒</Text>
            <Text style={styles.failedText} numberOfLines={1}>
              {message.text}
            </Text>
          </View>
        ) : (
          <Text style={styles.text}>{message.text}</Text>
        )}
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
        {onShare && (
          <TouchableOpacity
            onPress={onShare}
            style={styles.shareButton}
            accessibilityLabel="Share message"
            testID={`message-share-${message.msgId}`}
          >
            <Text style={styles.shareIcon}>📤</Text>
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
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
    color: '#6d8cff',
  },
  bubble: {
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  ownBubble: {
    backgroundColor: '#1a2d4a',
    borderColor: '#2a4060',
    borderBottomRightRadius: 4,
  },
  otherBubble: {
    backgroundColor: '#1c2433',
    borderColor: '#283347',
    borderBottomLeftRadius: 4,
  },
  text: {
    fontSize: 16,
    lineHeight: 22,
    color: '#e8edf6',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  time: {
    fontSize: 10,
    color: '#566178',
  },
  botIndicator: {
    fontSize: 12,
  },
  aiIndicator: {
    fontSize: 10,
    color: '#FF5722',
    fontWeight: '700',
    backgroundColor: '#3a2215',
    paddingHorizontal: 4,
    borderRadius: 4,
    overflow: 'hidden',
  },
  shareButton: {
    marginLeft: 4,
    padding: 8,
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  shareIcon: {
    fontSize: 16,
  },
  failedBubble: {
    backgroundColor: '#121722',
    borderColor: '#1f2937',
    borderStyle: 'dashed',
  },
  failedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  failedIcon: {
    fontSize: 12,
  },
  failedText: {
    fontSize: 14,
    color: '#566178',
    fontStyle: 'italic',
    maxWidth: 150,
  },
});
