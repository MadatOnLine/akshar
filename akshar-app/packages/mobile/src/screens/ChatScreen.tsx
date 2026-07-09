/**
 * ChatScreen — encrypted group messaging with real-time WebSocket.
 */
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, KeyboardAvoidingView, Platform, SafeAreaView } from 'react-native';
import { MessageBubble } from '../components/MessageBubble';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useAuth } from '../providers/AuthProvider';
import { mesh, getToken } from '../services/api';
import type { DecryptedMessage } from '../types';
import io from 'socket.io-client';
import { config } from '../config';
import { encrypt, decrypt } from '@akshar/crypto';
import { sha256 } from '@noble/hashes/sha256';

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
  const [shareDialog, setShareDialog] = useState<{ msgId: string; text: string } | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const [socket, setSocket] = useState<any>(null);
  const sharedKeyRef = useRef<Uint8Array | null>(null);

  useEffect(() => {
    // Generate deterministic key for MVP based on groupId
    const encoder = new TextEncoder();
    sharedKeyRef.current = sha256(encoder.encode(groupId));
    setKeysReady(true);

    const token = getToken();
    const newSocket = io(config.meshWsUrl, {
      auth: { token }
    });

    if (newSocket.connected) {
      newSocket.emit('join-room', { groupId });
    }

    newSocket.on('connect', () => {
      newSocket.emit('join-room', { groupId });
    });

    newSocket.on('backlog', (data: { groupId: string; messages: any[] }) => {
      if (data.groupId !== groupId) return;
      
      const decryptedMessages: DecryptedMessage[] = data.messages.map(msg => {
        const text = decrypt(
          sharedKeyRef.current!,
          msg.ciphertext?.nonce || msg.nonce,
          msg.ciphertext?.tag || msg.tag,
          msg.ciphertext?.val || msg.val
        ) || '[Decryption Failed]';
        
        return {
          msgId: msg.msgId,
          from: msg.fromNode === userId ? 'You' : 'Peer',
          fromId: msg.fromNode,
          text,
          ts: msg.ts,
          classification: msg.classification,
        };
      });
      
      setMessages(decryptedMessages);
      setTimeout(() => flatListRef.current?.scrollToEnd(), 100);
    });

    newSocket.on('new-message', (msg: any) => {
      if (msg.toNode !== groupId) return;
      
      const text = decrypt(
        sharedKeyRef.current!,
        msg.ciphertext?.nonce || msg.nonce,
        msg.ciphertext?.tag || msg.tag,
        msg.ciphertext?.val || msg.val
      ) || '[Decryption Failed]';
      
      setMessages(prev => {
        if (prev.some(p => p.msgId === msg.msgId || p.text === text && p.fromId === userId && Math.abs(p.ts - msg.ts) < 5000)) return prev;
        
        const newMsg: DecryptedMessage = {
          msgId: msg.msgId,
          from: msg.fromNode === userId ? 'You' : 'Peer',
          fromId: msg.fromNode,
          text,
          ts: msg.ts,
          classification: msg.classification,
        };
        return [...prev, newMsg];
      });
      setTimeout(() => flatListRef.current?.scrollToEnd(), 100);
    });

    newSocket.on('message-classified', (data: { msgId: string; classification: any }) => {
      setMessages(prev =>
        prev.map(msg =>
          msg.msgId === data.msgId
            ? { ...msg, classification: data.classification }
            : msg
        )
      );
    });

    setSocket(newSocket);

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
      plaintext: textToSend,
    });

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
  };

  const handleShare = (msgId: string, text: string) => {
    setShareDialog({ msgId, text });
  };

  const confirmShare = async () => {
    if (!shareDialog) return;
    try {
      // Use the actual mesh API to share the post
      await mesh.shareToFeed(groupId, shareDialog.msgId, shareDialog.text, userId);
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
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backButtonText}>‹ Back</Text>
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
              onShare={() => handleShare(item.msgId, item.text)}
            />
          )}
          style={styles.messageList}
          data-testid="chat-message-list"
        />

        {!keysReady && (
          <View style={styles.keysOverlay}>
            <Text style={styles.keysText}>Establishing secure connection...</Text>
          </View>
        )}

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={handleTextChange}
            placeholder="Message"
            maxLength={5000}
            editable={keysReady}
            multiline
            data-testid="chat-input"
          />
          <TouchableOpacity
            style={[styles.sendButton, !inputText.trim() && styles.sendDisabled]}
            onPress={handleSend}
            disabled={!inputText.trim() || !keysReady}
            accessibilityLabel="Send message"
            data-testid="chat-send-button"
          >
            <Text style={styles.sendText}>↑</Text>
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
  safeArea: { flex: 1, backgroundColor: '#6200EE' },
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  header: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, backgroundColor: '#6200EE', elevation: 4 },
  backButton: { marginRight: 16, paddingVertical: 4 },
  backButtonText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '600', color: '#FFF', textAlign: 'center' },
  headerRight: { width: 50 }, // For balancing the title
  messageList: { flex: 1, paddingVertical: 8 },
  inputContainer: { flexDirection: 'row', padding: 12, paddingBottom: 16, backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: '#E0E0E0', alignItems: 'flex-end' },
  input: { flex: 1, borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 20, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, fontSize: 16, maxHeight: 100 },
  sendButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#6200EE', justifyContent: 'center', alignItems: 'center', marginLeft: 12, marginBottom: 2 },
  sendDisabled: { backgroundColor: '#CCC' },
  sendText: { color: '#FFF', fontSize: 20, fontWeight: '700' },
  keysOverlay: { position: 'absolute', top: 60, left: 0, right: 0, padding: 12, backgroundColor: '#FFF3E0', alignItems: 'center' },
  keysText: { color: '#E65100', fontSize: 14 },
});
