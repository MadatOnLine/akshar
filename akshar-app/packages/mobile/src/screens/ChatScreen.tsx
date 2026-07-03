/**
 * ChatScreen — encrypted group messaging with real-time WebSocket.
 */
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import { MessageBubble } from '../components/MessageBubble';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useAuth } from '../providers/AuthProvider';
import type { DecryptedMessage } from '../types';

interface ChatScreenProps {
  route: { params: { groupId: string; groupName: string } };
}

export function ChatScreen({ route }: ChatScreenProps) {
  const { userId } = useAuth();
  const { groupId, groupName } = route.params;
  const [messages, setMessages] = useState<DecryptedMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [keysReady, setKeysReady] = useState(true); // MVP: assume ready
  const [typingStartTs, setTypingStartTs] = useState(0);
  const [shareDialog, setShareDialog] = useState<{ msgId: string; text: string } | null>(null);
  const flatListRef = useRef<FlatList>(null);

  // MVP: simulate receiving messages
  useEffect(() => {
    // In production: connect WebSocket, join room, receive backlog + real-time
  }, [groupId]);

  const handleSend = () => {
    if (!inputText.trim() || !keysReady) return;

    const typingMs = typingStartTs > 0 ? Date.now() - typingStartTs : 0;
    const msg: DecryptedMessage = {
      msgId: `msg-${Date.now()}`,
      from: 'You',
      fromId: userId || '',
      text: inputText.trim(),
      ts: Date.now(),
    };

    // In production:
    // 1. encrypt(sharedKey, plaintext) → ciphertext
    // 2. socket.emit('send-message', { groupId, ciphertext, typingMs, plaintext })
    setMessages(prev => [...prev, msg]);
    setInputText('');
    setTypingStartTs(0);
    flatListRef.current?.scrollToEnd();
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

  const confirmShare = () => {
    if (!shareDialog) return;
    // In production: POST /mesh/share
    setShareDialog(null);
  };

  return (
    <View style={styles.container} data-testid="chat-screen">
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{groupName}</Text>
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={item => item.msgId}
        renderItem={({ item }) => (
          <MessageBubble
            message={item}
            isOwn={item.fromId === userId}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  header: { paddingVertical: 12, paddingHorizontal: 16, backgroundColor: '#6200EE', elevation: 4 },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#FFF' },
  messageList: { flex: 1, paddingVertical: 8 },
  inputContainer: { flexDirection: 'row', padding: 8, backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: '#E0E0E0', alignItems: 'flex-end' },
  input: { flex: 1, borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 16, maxHeight: 100 },
  sendButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#6200EE', justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
  sendDisabled: { backgroundColor: '#CCC' },
  sendText: { color: '#FFF', fontSize: 20, fontWeight: '700' },
  keysOverlay: { position: 'absolute', top: 60, left: 0, right: 0, padding: 12, backgroundColor: '#FFF3E0', alignItems: 'center' },
  keysText: { color: '#E65100', fontSize: 14 },
});
