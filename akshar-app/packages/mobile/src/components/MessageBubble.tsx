/**
 * MessageBubble — displays a decrypted chat message with trust badge and bot indicator.
 * Only renders plaintext messages (encrypted ones are filtered at the ChatScreen level).
 */
import React, { useEffect, useRef, memo } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet } from 'react-native';
import { TrustBadge } from './TrustBadge';
import type { DecryptedMessage } from '../types';

interface MessageBubbleProps {
  message: DecryptedMessage;
  isOwn: boolean;
  senderTier?: string;
  onShare?: () => void;
  onReport?: () => void;
}

export const MessageBubble = memo(function MessageBubble({ message, isOwn, senderTier, onShare, onReport }: MessageBubbleProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 60,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, scaleAnim]);

  const bubbleStyle = isOwn ? styles.ownBubble : styles.otherBubble;

  return (
    <Animated.View
      style={[
        styles.container,
        isOwn && styles.containerOwn,
        { opacity: fadeAnim, transform: [{ scale: scaleAnim }] },
      ]}
      testID={`message-bubble-${message.msgId}`}
    >
      {!isOwn && (
        <View style={styles.header}>
          <Text style={styles.sender}>{message.from}</Text>
          {senderTier && <TrustBadge tier={senderTier} size="small" />}
        </View>
      )}
      <TouchableOpacity activeOpacity={0.8} onLongPress={onReport} delayLongPress={500}>
        <View style={[styles.bubble, bubbleStyle]}>
          <Text style={styles.text}>{message.text}</Text>
        </View>
      </TouchableOpacity>
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
});

const styles = StyleSheet.create({
  container: {
    marginVertical: 5,
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
    marginBottom: 3,
  },
  sender: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6d8cff',
  },
  bubble: {
    paddingTop: 10,
    paddingBottom: 12,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
  },
  ownBubble: {
    backgroundColor: '#1a2d55',
    borderColor: '#2a4a78',
    borderBottomRightRadius: 6,
    shadowColor: '#1a6dff',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  otherBubble: {
    backgroundColor: '#1e2736',
    borderColor: '#2a3548',
    borderBottomLeftRadius: 6,
  },
  text: {
    fontSize: 17,
    lineHeight: 23,
    color: '#e8edf6',
    letterSpacing: 0.1,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
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
});
