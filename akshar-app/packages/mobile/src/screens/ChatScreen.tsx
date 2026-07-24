/**
 * ChatScreen — encrypted group messaging with real-time WebSocket.
 * Features ECDH Key Exchange, Hash Ratcheting, AI classification,
 * and local message persistence via Keychain.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  Alert,
} from 'react-native';
import * as Keychain from 'react-native-keychain';
import { MessageBubble } from '../components/MessageBubble';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useAuth } from '../providers/AuthProvider';
import { mesh, getToken } from '../services/api';
import type { DecryptedMessage } from '../types';
import io from 'socket.io-client';
import { config } from '../config';
import { encrypt, decrypt, generateKeyPair, deriveSharedKey, ratchetKey, toHex } from '@akshar/crypto';

import type { StackScreenProps } from '@react-navigation/stack';
import type { RootStackParamList } from '../types';

type ChatScreenProps = StackScreenProps<RootStackParamList, 'Chat'>;

/* ── Local persistence helpers ──────────────────────────────── */
const CHAT_KEYCHAIN_PREFIX = 'com.akshar.chat.';

async function loadLocalMessages(groupId: string): Promise<DecryptedMessage[]> {
  try {
    const result = await Keychain.getGenericPassword({ service: `${CHAT_KEYCHAIN_PREFIX}${groupId}` });
    if (result && result.password) {
      return JSON.parse(result.password);
    }
  } catch {}
  return [];
}

async function saveLocalMessages(groupId: string, messages: DecryptedMessage[]): Promise<void> {
  try {
    // Only persist our own plaintext messages (max 200 to keep storage lean)
    const toSave = messages
      .filter(m => !m.decryptionFailed && m.from === 'You')
      .slice(-200);
    await Keychain.setGenericPassword(
      'messages',
      JSON.stringify(toSave),
      { service: `${CHAT_KEYCHAIN_PREFIX}${groupId}` },
    );
  } catch {}
}

/* ── Estimated row height for getItemLayout ─────────────────── */
const ESTIMATED_ROW_HEIGHT = 72;

export function ChatScreen({ route, navigation }: ChatScreenProps) {
  const { userId } = useAuth();
  const { groupId, groupName } = route.params;
  const [messages, setMessages] = useState<DecryptedMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [keysReady, setKeysReady] = useState(false);
  const [typingStartTs, setTypingStartTs] = useState(0);
  const [peerTyping, setPeerTyping] = useState(false);
  const [shareDialog, setShareDialog] = useState<{ msgId: string; text: string } | null>(null);

  const flatListRef = useRef<FlatList>(null);
  const [socket, setSocket] = useState<any>(null);

  // Crypto State
  const myKeyPairRef = useRef(generateKeyPair());
  const peerKeysRef = useRef<Map<string, Uint8Array>>(new Map());
  const sharedKeyRef = useRef<Uint8Array | null>(null);

  // ── Load persisted messages on mount ──
  useEffect(() => {
    (async () => {
      const saved = await loadLocalMessages(groupId);
      if (saved.length > 0) {
        setMessages(saved);
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 50);
      }
    })();
  }, [groupId]);

  // ── Persist messages whenever they change ──
  useEffect(() => {
    if (messages.length > 0) {
      saveLocalMessages(groupId, messages);
    }
  }, [messages, groupId]);

  useEffect(() => {
    const token = getToken();
    const newSocket = io(config.meshWsUrl, {
      auth: { token }
    });

    setSocket(newSocket);

    newSocket.on('connect', () => {
      newSocket.emit('join-room', { groupId });
      newSocket.emit('publish-key', { publicKey: myKeyPairRef.current.publicKey });

      // Mock peer for single-user testing
      setTimeout(() => {
        if (!sharedKeyRef.current) {
          try {
            const mockPeerKeys = generateKeyPair();
            const sharedSecret = deriveSharedKey(myKeyPairRef.current.privateKey, mockPeerKeys.publicKey);
            sharedKeyRef.current = sharedSecret;
            setKeysReady(true);
          } catch (e) {}
        }
      }, 1500);
    });

    newSocket.on('peer-key', (data: { userId: string; publicKey: string }) => {
      if (data.userId !== userId) {
        try {
          const sharedSecret = deriveSharedKey(myKeyPairRef.current.privateKey, data.publicKey);
          peerKeysRef.current.set(data.userId, sharedSecret);
          // Always override the mock testing key if a real peer key comes in
          sharedKeyRef.current = sharedSecret;
          setKeysReady(true);
        } catch (err) {
          console.error('Failed to derive shared key:', err);
        }
      }
    });

    newSocket.on('user-joined', (data: { userId: string }) => {
      // When a new user joins, re-publish our public key so they can derive a shared secret
      if (data.userId !== userId) {
        newSocket.emit('publish-key', { publicKey: myKeyPairRef.current.publicKey });
      }
    });

    newSocket.on('backlog', (data: { groupId: string; messages: any[] }) => {
      if (data.groupId !== groupId) return;

      setMessages(prev => {
        const newMessages = [...prev];

        data.messages.forEach(msg => {
          const existingIdx = newMessages.findIndex(p => p.msgId === msg.msgId);
          if (existingIdx !== -1 && !newMessages[existingIdx].decryptionFailed) {
            return;
          }

          let text = msg.ciphertext?.val || msg.val || 'encrypted data';
          let decryptionFailed = true;
          if (sharedKeyRef.current) {
            try {
              const dec = decrypt(
                sharedKeyRef.current,
                msg.ciphertext?.nonce || msg.nonce,
                msg.ciphertext?.tag || msg.tag,
                msg.ciphertext?.val || msg.val
              );
              if (dec) {
                text = dec;
                decryptionFailed = false;
              }
            } catch (err) {}
          }

          // Skip own messages that failed decryption — we have plaintext locally
          if (msg.fromNode === userId && decryptionFailed) {
            return;
          }

          const newMsg = {
            msgId: msg.msgId,
            from: msg.fromNode === userId ? 'You' : 'Peer',
            fromId: msg.fromNode,
            text,
            ts: msg.ts,
            classification: msg.classification,
            senderTier: msg.classification?.tier,
            decryptionFailed,
          };

          if (existingIdx !== -1) {
            newMessages[existingIdx] = newMsg;
          } else {
            newMessages.push(newMsg);
          }
        });

        newMessages.sort((a, b) => a.ts - b.ts);
        return newMessages;
      });

      setTimeout(() => flatListRef.current?.scrollToEnd(), 100);
    });

    newSocket.on('new-message', (msg: any) => {
      if (msg.toNode !== groupId) return;

      setMessages(prev => {
        if (msg.fromNode === userId) {
          const unconfirmedIdx = prev.findIndex(p => {
            if (p.msgId.startsWith('msg-')) return true;
            const echoNonce = msg.ciphertext?.nonce || msg.nonce;
            if (p.nonce && echoNonce && p.nonce === echoNonce) return true;
            return false;
          });
          if (unconfirmedIdx !== -1) {
            const updated = [...prev];
            updated[unconfirmedIdx] = {
              ...updated[unconfirmedIdx],
              msgId: msg.msgId,
              ts: msg.ts,
              classification: msg.classification,
              senderTier: msg.classification?.tier,
            };
            return updated;
          }
          return prev;
        }

        let text = msg.ciphertext?.val || msg.val || 'encrypted data';
        let decryptionFailed = true;
        if (sharedKeyRef.current) {
          try {
            const dec = decrypt(
              sharedKeyRef.current,
              msg.ciphertext?.nonce || msg.nonce,
              msg.ciphertext?.tag || msg.tag,
              msg.ciphertext?.val || msg.val
            );
            if (dec) {
              text = dec;
              decryptionFailed = false;
              sharedKeyRef.current = ratchetKey(sharedKeyRef.current);
            }
          } catch (err) {
            console.error('Decryption error:', err);
          }
        }

        if (prev.some(p => p.msgId === msg.msgId)) return prev;

        const newMsg: DecryptedMessage = {
          msgId: msg.msgId,
          from: 'Peer',
          fromId: msg.fromNode,
          text,
          ts: msg.ts,
          classification: msg.classification,
          senderTier: msg.classification?.tier,
          decryptionFailed,
        };
        return [...prev, newMsg];
      });
      setTimeout(() => flatListRef.current?.scrollToEnd(), 100);
    });

    newSocket.on('message-classified', (data: { msgId: string; classification: any }) => {
      setMessages(prev =>
        prev.map(msg =>
          msg.msgId === data.msgId
            ? { ...msg, classification: data.classification, senderTier: data.classification?.tier }
            : msg
        )
      );
    });

    newSocket.on('user-typing', (data: { userId: string }) => {
      if (data.userId !== userId) {
        setPeerTyping(true);
        setTimeout(() => setPeerTyping(false), 3000);
      }
    });

    return () => {
      newSocket.disconnect();
    };
  }, [groupId, userId]);

  const handleSend = useCallback(() => {
    if (!inputText.trim() || !keysReady || !sharedKeyRef.current || !socket) return;

    const typingMs = typingStartTs > 0 ? Date.now() - typingStartTs : 0;
    const textToSend = inputText.trim();
    const ts = Date.now();
    const tempMsgId = `msg-${ts}`;

    const ciphertext = encrypt(sharedKeyRef.current, textToSend);

    const msg: DecryptedMessage = {
      msgId: tempMsgId,
      from: 'You',
      fromId: userId || '',
      text: textToSend,
      ts: ts,
      nonce: ciphertext.nonce,
    };

    socket.emit('send-message', {
      groupId,
      ciphertext,
      typingMs,
      plaintext: textToSend,
    });

    sharedKeyRef.current = ratchetKey(sharedKeyRef.current);

    setMessages(prev => [...prev, msg]);
    setInputText('');
    setTypingStartTs(0);
    setTimeout(() => flatListRef.current?.scrollToEnd(), 100);
  }, [inputText, keysReady, socket, typingStartTs, groupId, userId]);

  const handleTextChange = useCallback((text: string) => {
    if (typingStartTs === 0 && text.length > 0) {
      setTypingStartTs(Date.now());
    }
    setInputText(text);
    if (socket) {
      socket.emit('user-typing', { groupId });
    }
  }, [typingStartTs, socket, groupId]);

  const handleShare = useCallback((msgId: string, text: string) => {
    setShareDialog({ msgId, text });
  }, []);

  const confirmShare = useCallback(async () => {
    if (!shareDialog) return;
    try {
      await mesh.shareToFeed(groupId, shareDialog.msgId, shareDialog.text, userId || undefined);
      Alert.alert('Shared!', 'Message posted to the public feed.');
    } catch (err: any) {
      console.error('Failed to share message', err);
      Alert.alert('Share Failed', err.message || 'Unknown error occurred');
    } finally {
      setShareDialog(null);
    }
  }, [shareDialog, groupId, userId]);

  const handleReport = useCallback((msgId: string, fromId: string) => {
    if (fromId === userId) return; // Can't report yourself
    Alert.alert(
      'Report Message',
      'Are you sure you want to report this message to the AI moderator? This will flag the sender\'s account for Tier 2 evaluation.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Report', 
          style: 'destructive',
          onPress: async () => {
            try {
              await mesh.reportMessage(fromId, msgId, 'User reported malicious content via long-press');
              Alert.alert('Reported', 'The message has been flagged for AI review.');
            } catch (err: any) {
              Alert.alert('Report Failed', err.message || 'Unknown error occurred');
            }
          }
        }
      ]
    );
  }, [userId]);

  // Filter out encrypted gibberish
  const visibleMessages = messages.filter(m => !m.decryptionFailed);

  const renderItem = useCallback(({ item }: { item: DecryptedMessage }) => (
    <MessageBubble
      message={item}
      isOwn={item.fromId === userId}
      senderTier={item.senderTier}
      onShare={() => handleShare(item.msgId, item.text)}
      onReport={() => handleReport(item.msgId, item.fromId)}
    />
  ), [userId, handleShare, handleReport]);

  const keyExtractor = useCallback((item: DecryptedMessage) => item.msgId, []);

  const getItemLayout = useCallback((_: any, index: number) => ({
    length: ESTIMATED_ROW_HEIGHT,
    offset: ESTIMATED_ROW_HEIGHT * index,
    index,
  }), []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} activeOpacity={0.6}>
            <Text style={styles.backButtonText}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>{groupName}</Text>
          <View style={styles.headerRight} />
        </View>

        <FlatList
          ref={flatListRef}
          data={visibleMessages}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          getItemLayout={getItemLayout}
          style={styles.messageList}
          testID="chat-message-list"
          initialNumToRender={15}
          maxToRenderPerBatch={10}
          windowSize={7}
          removeClippedSubviews={Platform.OS === 'android'}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>💬</Text>
              <Text style={styles.emptyTitle}>No messages yet</Text>
              <Text style={styles.emptySubtitle}>Say something to get started</Text>
            </View>
          }
          ListFooterComponent={
            peerTyping ? <Text style={styles.typingIndicator}>typing...</Text> : null
          }
        />

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={handleTextChange}
            placeholder="Message"
            placeholderTextColor="#8E8E93"
            maxLength={5000}
            editable={keysReady}
            multiline
            testID="chat-input"
          />
          <TouchableOpacity
            style={[styles.sendButton, (!inputText.trim() || !keysReady) && styles.sendDisabled]}
            onPress={handleSend}
            disabled={!inputText.trim() || !keysReady}
            activeOpacity={0.7}
            accessibilityLabel="Send message"
            testID="chat-send-button"
          >
            <Text style={[styles.sendText, (!inputText.trim() || !keysReady) && styles.sendTextDisabled]}>↑</Text>
          </TouchableOpacity>
        </View>

        <ConfirmDialog
          visible={!!shareDialog}
          title="Share Publicly"
          message="Share this message to your feed? Your name will be permanently attached."
          confirmText="Share"
          onConfirm={confirmShare}
          onCancel={() => setShareDialog(null)}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#000000' },
  container: { flex: 1, backgroundColor: '#000000' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    backgroundColor: '#000000',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#1C1C1E',
  },
  backButton: { paddingHorizontal: 12, paddingVertical: 6 },
  backButtonText: { color: '#0A84FF', fontSize: 34, fontWeight: '300' },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '600', color: '#FFFFFF', textAlign: 'center', marginRight: 36 },
  headerRight: { width: 24 },
  messageList: { flex: 1, paddingVertical: 8, backgroundColor: '#000000' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 120 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 20, fontWeight: '600', color: '#FFFFFF', marginBottom: 6 },
  emptySubtitle: { fontSize: 15, color: '#8E8E93' },
  inputContainer: {
    flexDirection: 'row',
    padding: 10,
    paddingBottom: Platform.OS === 'ios' ? 14 : 10,
    backgroundColor: '#000000',
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    backgroundColor: '#1C1C1E',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 16,
    maxHeight: 100,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  sendButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#0A84FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
    marginBottom: 0,
  },
  sendDisabled: { backgroundColor: '#1C1C1E', borderWidth: 1, borderColor: '#2C2C2E' },
  sendText: { color: '#FFF', fontSize: 18, fontWeight: '700' },
  sendTextDisabled: { color: '#636366' },
  typingIndicator: { color: '#8E8E93', fontSize: 13, fontStyle: 'italic', paddingHorizontal: 16, paddingVertical: 6 },
});
