import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { useApi } from '@/hooks/useApi';
import { useAuth } from '@/hooks/useAuth';
import * as Haptics from 'expo-haptics';
import { getPhotoSource } from '@/utils/photos';

interface Comment {
  _id: string;
  authorId: string;
  authorName: string;
  authorPhoto: any;
  text: string;
  createdAt: string;
}

interface ProfileCommentsProps {
  userId: string;
}

export default function ProfileComments({ userId }: ProfileCommentsProps) {
  const { theme } = useTheme();
  const { get, post } = useApi();
  const { token, user: currentUser } = useAuth();
  
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchComments = useCallback(async () => {
    try {
      const response = await get<{ success: boolean; comments: Comment[] }>(`/comments/profile/${userId}`, token || '');
      if (response.success && response.data?.comments) {
        setComments(response.data.comments.sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        ));
      }
    } catch (error) {
      console.error('Error fetching comments:', error);
    } finally {
      setLoading(false);
    }
  }, [userId, token, get]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const handleSendComment = async () => {
    if (!commentText.trim() || !token) return;
    
    setSubmitting(true);
    try {
      const response = await post<{ success: boolean; comments: Comment[] }>(
        `/comments/profile/${userId}`,
        { text: commentText.trim() },
        token
      );
      
      if (response.success) {
        setCommentText('');
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        fetchComments();
      } else {
        Alert.alert('Error', response.message || 'Failed to post comment');
      }
    } catch (error) {
      console.error('Post comment error:', error);
      Alert.alert('Error', 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  const renderCommentItem = ({ item }: { item: Comment }) => {
    const photoSource = getPhotoSource(item.authorPhoto);
    return (
      <View style={[styles.commentCard, { backgroundColor: theme.surface }]}>
        <View style={styles.commentHeader}>
          <Image 
            source={photoSource || require('../assets/images/placeholder-1.jpg')} 
            style={styles.authorPhoto} 
          />
          <View style={styles.authorInfo}>
            <Text style={[styles.authorName, { color: theme.text }]}>{item.authorName}</Text>
            <Text style={[styles.commentTime, { color: theme.textSecondary }]}>
              {new Date(item.createdAt).toLocaleDateString()}
            </Text>
          </View>
        </View>
        <Text style={[styles.commentText, { color: theme.text }]}>{item.text}</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.inputWrapper}>
        <TextInput
          style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
          placeholder="Add a comment..."
          placeholderTextColor={theme.textSecondary}
          value={commentText}
          onChangeText={setCommentText}
          multiline
        />
        <TouchableOpacity 
          style={[styles.sendButton, { backgroundColor: theme.primary }]}
          onPress={handleSendComment}
          disabled={submitting || !commentText.trim()}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="send" size={18} color="#fff" />
          )}
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="small" color={theme.primary} style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={comments.slice(0, 3)}
          renderItem={renderCommentItem}
          keyExtractor={(item) => item._id}
          scrollEnabled={false}
          ListEmptyComponent={
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              No comments yet. Be the first to say something!
            </Text>
          }
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 12 },
  inputWrapper: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    borderRadius: 12,
    padding: 12,
    paddingTop: 12,
    borderWidth: 1,
    minHeight: 44,
    maxHeight: 100,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentCard: {
    padding: 12,
    borderRadius: 12,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  authorPhoto: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  authorInfo: { flex: 1 },
  authorName: { fontWeight: '600', fontSize: 14 },
  commentTime: { fontSize: 11 },
  commentText: { fontSize: 14, lineHeight: 20 },
  emptyText: { textAlign: 'center', marginTop: 10, fontStyle: 'italic' },
});
