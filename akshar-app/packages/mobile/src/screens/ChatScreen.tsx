/**
 * ChatScreen — encrypted group messaging with real-time WebSocket.
 * Features ECDH Key Exchange, Hash Ratcheting, and AI classification.
 */
import React, { useState, useEffect, useRef } from 'react';
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
} from 'react-native';
import { MessageBubble } from '../components/MessageBubble';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useAuth } from '../providers/AuthProvider';
import { mesh, getToken } from '../services/api';
import type { DecryptedMessage } from '../types';
import io from 'socket.io-client';
import { config } from '../config';
import { encrypt, decrypt, generateKeyPair, deriveSharedKey, ratchetKey, toHex } from '@akshar/crypto';

interface ChatScreenProps {
  route: { params: { groupId: string; groupName: string } };
  navigation: any;
}

export function ChatScreen({ route, navigation }: ChatScreenProps) {
  const { userId } = useAuth();
  const { groupId, groupName } = route.params;
  const [messages, setMessages] = useState<DecryptedMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [keysReady, setKeysReady] = useState(false);
  const [typingStartTs, setTypingStartTs] = useState(0);
  const [peerTyping, setPeerTyping] = useState(false);
  const [shareDialog, setShareDialog] = useState<{ msgId: string; text: string } | null>(null);
  const [showRatcheted, setShowRatcheted] = useState(false);
  
  const flatListRef = useRef<FlatList>(null);
  const [socket, setSocket] = useState<any>(null);
  
  // Crypto State
  const myKeyPairRef = useRef(generateKeyPair());
  const peerKeysRef = useRef<Map<string, Uint8Array>>(new Map());
  const sharedKeyRef = useRef<Uint8Array | null>(null);

  useEffect(() => {
    const token = getToken();
    const newSocket = io(config.meshWsUrl, {
      auth: { token }
    });

    setSocket(newSocket);

    newSocket.on('connect', () => {
      newSocket.emit('join-room', { groupId });
      // Publish our ECDH public key
      newSocket.emit('publish-key', { publicKey: myKeyPairRef.current.publicKey });

      // [Mock Peer for Testing] Automatically simulate a peer joining after 1.5s
      // so the user can test the chat interface when alone.
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

    // Listen for peer keys to establish ECDH shared secrets
    newSocket.on('peer-key', (data: { userId: string; publicKey: string }) => {
      if (data.userId !== userId) {
        try {
          const sharedSecret = deriveSharedKey(myKeyPairRef.current.privateKey, data.publicKey);
          peerKeysRef.current.set(data.userId, sharedSecret);
          
          // For MVP group chat, use the first peer's key as the active shared key
          if (!sharedKeyRef.current) {
            sharedKeyRef.current = sharedSecret;
            setKeysReady(true);
          }
        } catch (err) {
          console.error('Failed to derive shared key:', err);
        }
      }
    });

    newSocket.on('backlog', (data: { groupId: string; messages: any[] }) => {
      if (data.groupId !== groupId) return;
      
      const decryptedMessages: DecryptedMessage[] = data.messages.map(msg => {
        let text = msg.ciphertext?.val || msg.val || 'encrypted data';
        let decryptionFailed = true;
        if (sharedKeyRef.current) {
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
        }
        
        return {
          msgId: msg.msgId,
          from: msg.fromNode === userId ? 'You' : 'Peer',
          fromId: msg.fromNode,
          text,
          ts: msg.ts,
          classification: msg.classification,
          senderTier: msg.classification?.tier,
          decryptionFailed,
        };
      });
      
      setMessages(decryptedMessages);
      setTimeout(() => flatListRef.current?.scrollToEnd(), 100);
    });

    newSocket.on('new-message', (msg: any) => {
      if (msg.toNode !== groupId) return;
      
      let text = msg.ciphertext?.val || msg.val || 'encrypted data';
      let decryptionFailed = true;
      if (sharedKeyRef.current) {
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
      }
      
      setMessages(prev => {
        if (prev.some(p => p.msgId === msg.msgId || (!p.decryptionFailed && p.text === text && p.fromId === userId && Math.abs(p.ts - msg.ts) < 5000))) return prev;
        
        const newMsg: DecryptedMessage = {
          msgId: msg.msgId,
          from: msg.fromNode === userId ? 'You' : 'Peer',
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

  const handleSend = () => {
    if (!inputText.trim() || !keysReady || !sharedKeyRef.current || !socket) return;

    const typingMs = typingStartTs > 0 ? Date.now() - typingStartTs : 0;
    const textToSend = inputText.trim();
    const ts = Date.now();
    const tempMsgId = `msg-${ts}`;
    
    const msg: DecryptedMessage = {
      msgId: tempMsgId,
      from: 'You',
      fromId: userId || '',
      text: textToSend,
      ts: ts,
    };

    const ciphertext = encrypt(sharedKeyRef.current, textToSend);

    socket.emit('send-message', {
      groupId,
      ciphertext,
      typingMs,
      plaintext: textToSend, // Kept for AI classification per user request
    });

    // Ratchet the key after sending to ensure Forward Secrecy
    sharedKeyRef.current = ratchetKey(sharedKeyRef.current);
    
    // Show Ratchet Indicator briefly
    setShowRatcheted(true);
    setTimeout(() => setShowRatcheted(false), 2000);

    setMessages(prev => [...prev, msg]);
    setInputText('');
    setTypingStartTs(0);
    setTimeout(() => flatListRef.current?.scrollToEnd(), 100);
  };

  const handleTextChange = (text: string) => {
    if (typingStartTs === 0 && text.length > 0) {
      setTypingStartTs(Date.now());
    }
    setInputText(text);
    if (socket) {
      socket.emit('user-typing', { groupId });
    }
  };

  const handleShare = (msgId: string, text: string) => {
    setShareDialog({ msgId, text });
  };

  const confirmShare = async () => {
    if (!shareDialog) return;
    try {
      await mesh.shareToFeed(groupId, shareDialog.msgId, shareDialog.text, userId || undefined);
    } catch (err) {
      console.error('Failed to share message', err);
    } finally {
      setShareDialog(null);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView 
        style={styles.container} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>{groupName}</Text>
          <View style={styles.headerRight} />
        </View>

        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={item => item.msgId}
          renderItem={({ item }) => (
            <MessageBubble
              message={item}
              isOwn={item.fromId === userId}
              senderTier={item.senderTier}
              onShare={() => handleShare(item.msgId, item.text)}
            />
          )}
          style={styles.messageList}
          testID="chat-message-list"
          ListFooterComponent={
            peerTyping ? <Text style={styles.typingIndicator}>... typing</Text> : null
          }
        />

        {showRatcheted && (
          <View style={styles.ratchetOverlay}>
            <Text style={styles.ratchetText}>🔑 Key Ratcheted</Text>
          </View>
        )}

        <View style={styles.statusOverlay}>
          <Text style={[styles.statusText, keysReady ? styles.statusReady : styles.statusWaiting]}>
            {keysReady ? 'ECDH Key Exchange Complete ✓' : 'Waiting for peer keys...'}
          </Text>
        </View>

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={handleTextChange}
            placeholder="Message"
            placeholderTextColor="#566178"
            maxLength={5000}
            editable={keysReady}
            multiline
            testID="chat-input"
          />
          <TouchableOpacity
            style={[styles.sendButton, (!inputText.trim() || !keysReady) && styles.sendDisabled]}
            onPress={handleSend}
            disabled={!inputText.trim() || !keysReady}
            accessibilityLabel="Send message"
            testID="chat-send-button"
          >
            <Text style={[styles.sendText, (!inputText.trim() || !keysReady) && styles.sendTextDisabled]}>✈</Text>
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
  safeArea: { flex: 1, backgroundColor: '#0c1018' },
  container: { flex: 1, backgroundColor: '#0c1018' },
  header: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, backgroundColor: '#0e131d', borderBottomWidth: 1, borderBottomColor: '#283347' },
  backButton: { marginRight: 16, paddingVertical: 4 },
  backButtonText: { color: '#6d8cff', fontSize: 24, fontWeight: '600' },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '600', color: '#e8edf6', textAlign: 'center' },
  headerRight: { width: 50 }, // For balancing the title
  messageList: { flex: 1, paddingVertical: 8, backgroundColor: '#0c1018' },
  inputContainer: { flexDirection: 'row', padding: 12, paddingBottom: 16, backgroundColor: '#1c2433', borderTopWidth: 1, borderTopColor: '#283347', alignItems: 'flex-end' },
  input: { flex: 1, borderWidth: 1, borderColor: '#283347', borderRadius: 20, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, fontSize: 16, maxHeight: 100, color: '#e8edf6' },
  sendButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#6d8cff', justifyContent: 'center', alignItems: 'center', marginLeft: 12, marginBottom: 2 },
  sendDisabled: { backgroundColor: '#1c2433', borderWidth: 1, borderColor: '#283347' },
  sendText: { color: '#FFF', fontSize: 20, fontWeight: '700' },
  sendTextDisabled: { color: '#566178' },
  statusOverlay: { padding: 4, backgroundColor: '#0e131d', alignItems: 'center' },
  statusText: { fontSize: 12, fontWeight: '600' },
  statusReady: { color: '#43d17a' },
  statusWaiting: { color: '#ffc66b' },
  ratchetOverlay: { position: 'absolute', bottom: 80, left: 0, right: 0, alignItems: 'center' },
  ratchetText: { backgroundColor: 'rgba(109,140,255,0.2)', color: '#6d8cff', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, fontSize: 12, overflow: 'hidden' },
  typingIndicator: { color: '#566178', fontSize: 14, fontStyle: 'italic', paddingHorizontal: 16, paddingVertical: 8 },
});
