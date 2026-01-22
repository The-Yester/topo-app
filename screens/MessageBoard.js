import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    FlatList,
    StyleSheet,
    Image,
    ActivityIndicator,
    Alert,
    SafeAreaView,
    Platform,
    StatusBar,
    Share
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome'; // Or Ionicons
import moment from 'moment';
import { useNavigation, useRoute } from '@react-navigation/native';
import { db, auth } from '../firebaseConfig';
import {
    collection,
    addDoc,
    query,
    orderBy,
    onSnapshot,
    serverTimestamp,
    doc,
    getDoc,
    updateDoc,
    arrayUnion,
    arrayRemove,
    deleteDoc
} from 'firebase/firestore';
import { sendPushNotification, getUserPushToken } from '../services/NotificationService';

const MessageBoardScreen = () => {
    const navigation = useNavigation();
    const route = useRoute(); // Add useRoute
    const { initialText } = route.params || {};

    const [newMessage, setNewMessage] = useState(initialText || '');
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [userProfile, setUserProfile] = useState(null);
    const [replyMetadata, setReplyMetadata] = useState(null); // { type: 'reply'|'quote', post: postObject }

    // 1. Fetch Current User Profile for Posting (Avatar/Name)
    useEffect(() => {
        const fetchUserProfile = async () => {
            const user = auth.currentUser;
            if (user) {
                try {
                    const userDoc = await getDoc(doc(db, "users", user.uid));
                    if (userDoc.exists()) {
                        setUserProfile({ uid: user.uid, ...userDoc.data() });
                    }
                } catch (error) {
                    console.error("Error fetching user profile for message board:", error);
                }
            }
        };
        fetchUserProfile();
    }, []);

    // 2. Real-time Posts Listener
    useEffect(() => {
        const q = query(collection(db, "posts"), orderBy("timestamp", "desc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const posts = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setMessages(posts);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching posts:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    // 3. Handle Post Submission
    const handlePostMessage = async () => {
        if (newMessage.trim() === '') return;
        if (!auth.currentUser) {
            Alert.alert("Error", "You must be logged in to post.");
            return;
        }

        try {
            await addDoc(collection(db, "posts"), {
                text: newMessage,
                userId: auth.currentUser.uid,
                username: userProfile?.username || auth.currentUser.email.split('@')[0],
                name: userProfile?.name || "Topo User",
                userPhoto: userProfile?.profilePhoto || null,
                timestamp: serverTimestamp(),
                likes: 0,
                likedBy: [], // Track who liked
                comments: 0
            });

            // Check for Notification (Reply/Quote)
            if (replyMetadata && replyMetadata.post && replyMetadata.post.userId !== auth.currentUser.uid) {
                const targetPost = replyMetadata.post;
                const token = await getUserPushToken(targetPost.userId);

                if (token) {
                    const myName = userProfile?.username || "Someone";
                    let title = "New Notification 🔔";
                    let body = "";

                    if (replyMetadata.type === 'reply') {
                        title = "New Reply 💬";
                        body = `${myName} replied to you: "${newMessage.substring(0, 50)}..."`;
                    } else if (replyMetadata.type === 'quote') {
                        title = "New Quote 🔁";
                        body = `${myName} quoted your post.`;
                    }

                    await sendPushNotification(token, title, body, { type: 'post', postId: targetPost.id });
                }
            }

            setNewMessage('');
            setReplyMetadata(null); // Reset
        } catch (error) {
            console.error("Error adding post:", error);
            Alert.alert("Error", "Could not post message.");
        }
    };

    // Actions
    const handleLike = async (post) => {
        if (!auth.currentUser) return;
        const postRef = doc(db, "posts", post.id);
        const uid = auth.currentUser.uid;
        const likedBy = post.likedBy || [];
        const isLiked = likedBy.includes(uid);

        try {
            if (isLiked) {
                await updateDoc(postRef, {
                    likes: (post.likes || 1) - 1,
                    likedBy: arrayRemove(uid)
                });
            } else {
                await updateDoc(postRef, {
                    likes: (post.likes || 0) + 1,
                    likedBy: arrayUnion(uid)
                });

                // Notify Author (if not self)
                if (post.userId !== uid) {
                    const token = await getUserPushToken(post.userId);
                    if (token) {
                        const likerName = auth.currentUser.displayName || auth.currentUser.email.split('@')[0]; // simple fallback
                        // Ideally we have profile loaded, but auth object has some info or we can fetch.
                        // Assuming basic info for now. 
                        // Actually userProfile state exists in this component!
                        const myName = userProfile?.username || "Someone";

                        await sendPushNotification(
                            token,
                            "New Like ❤️",
                            `${myName} liked your post: "${post.text.substring(0, 30)}..."`,
                            { type: 'post', postId: post.id }
                        );
                    }
                }
            }
        } catch (e) {
            console.error("Like error:", e);
        }
    };

    const handleShare = async (post) => {
        try {
            await Share.share({
                message: `Check out this post from @${post.username} on Topo: "${post.text}"`,
            });
        } catch (error) {
            console.error(error);
        }
    };

    const handleQuote = (post) => {
        setNewMessage(`RT @${post.username}: "${post.text}" `);
        setReplyMetadata({ type: 'quote', post: post });
    };

    const handleReply = (post) => {
        setNewMessage(`@${post.username} `);
        setReplyMetadata({ type: 'reply', post: post });
    };

    const handleDeletePost = async (post) => {
        Alert.alert(
            "Delete Post",
            "Are you sure you want to delete this post?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await deleteDoc(doc(db, "posts", post.id));
                        } catch (error) {
                            console.error("Error deleting post:", error);
                            Alert.alert("Error", "Could not delete post.");
                        }
                    }
                }
            ]
        );
    };

    const renderPostItem = ({ item }) => {
        // Handle timestamp formatting (Firestore Timestamp vs placeholder string)
        let timeString = '';
        if (item.timestamp?.toDate) {
            timeString = moment(item.timestamp.toDate()).fromNow();
        } else if (item.timestamp) {
            timeString = moment(item.timestamp).fromNow();
        } else {
            timeString = 'Just now';
        }

        const isLiked = auth.currentUser && item.likedBy && item.likedBy.includes(auth.currentUser.uid);
        const isOwner = auth.currentUser && item.userId === auth.currentUser.uid;

        return (
            <View style={styles.postContainer}>
                <TouchableOpacity onPress={() => navigation.navigate('PublicProfile', { userId: item.userId })}>
                    <View style={styles.avatarColumn}>
                        {item.userPhoto ? (
                            <Image source={{ uri: item.userPhoto }} style={styles.avatar} />
                        ) : (
                            <View style={[styles.avatar, styles.placeholderAvatar]}>
                                <Icon name="user" size={20} color="#fff" />
                            </View>
                        )}
                    </View>
                </TouchableOpacity>
                <View style={styles.contentColumn}>
                    <View style={styles.postHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'baseline', flex: 1 }}>
                            <TouchableOpacity onPress={() => navigation.navigate('PublicProfile', { userId: item.userId })}>
                                <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                            </TouchableOpacity>
                            <Text style={styles.handle} numberOfLines={1}>@{item.username}</Text>
                            <Text style={styles.dot}>·</Text>
                            <Text style={styles.time}>{timeString}</Text>
                        </View>

                        {isOwner && (
                            <TouchableOpacity onPress={() => handleDeletePost(item)} style={{ padding: 5 }}>
                                <Icon name="trash-o" size={16} color="#657786" />
                            </TouchableOpacity>
                        )}
                    </View>

                    <Text style={styles.postText}>{item.text}</Text>

                    <View style={styles.actionsRow}>
                        {/* REPLY */}
                        <TouchableOpacity style={styles.actionButton} onPress={() => handleReply(item)}>
                            <Icon name="comment-o" size={16} color="#657786" />
                            <Text style={styles.actionText}>{item.comments || 0}</Text>
                        </TouchableOpacity>

                        {/* QUOTE / REPOST */}
                        <TouchableOpacity style={styles.actionButton} onPress={() => handleQuote(item)}>
                            <Icon name="retweet" size={16} color="#657786" />
                        </TouchableOpacity>

                        {/* LIKE */}
                        <TouchableOpacity style={styles.actionButton} onPress={() => handleLike(item)}>
                            <Icon name={isLiked ? "heart" : "heart-o"} size={16} color={isLiked ? "#E0245E" : "#657786"} />
                            <Text style={[styles.actionText, isLiked && { color: "#E0245E" }]}>{item.likes || 0}</Text>
                        </TouchableOpacity>

                        {/* SHARE */}
                        <TouchableOpacity style={styles.actionButton} onPress={() => handleShare(item)}>
                            <Icon name="share" size={16} color="#657786" />
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.headerContainer}>
                <Text style={styles.headerTitle}>Reelz</Text>
                <Icon name="star-o" size={20} color="#1DA1F2" />
            </View>

            {/* Input Area */}
            <View style={styles.inputSection}>
                <TouchableOpacity onPress={() => userProfile && navigation.navigate('PublicProfile', { userId: userProfile.uid })}>
                    <View style={styles.inputAvatarColumn}>
                        {userProfile?.profilePhoto ? (
                            <Image source={{ uri: userProfile.profilePhoto }} style={styles.inputAvatar} />
                        ) : (
                            <View style={[styles.inputAvatar, styles.placeholderAvatar]}>
                                <Icon name="user" size={20} color="#fff" />
                            </View>
                        )}
                    </View>
                </TouchableOpacity>
                <View style={styles.inputWrapper}>
                    <TextInput
                        style={styles.input}
                        placeholder="What's happening?"
                        placeholderTextColor="#657786"
                        multiline
                        value={newMessage}
                        onChangeText={(text) => {
                            setNewMessage(text);
                            if (text.length === 0) setReplyMetadata(null); // Clear context if cleared
                        }}
                        maxLength={280}
                    />
                    <View style={styles.inputActions}>
                        <TouchableOpacity
                            style={[styles.postButton, !newMessage.trim() && styles.postButtonDisabled]}
                            onPress={handlePostMessage}
                            disabled={!newMessage.trim()}
                        >
                            <Text style={styles.postButtonText}>Post</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>

            {/* Feed */}
            {loading ? (
                <ActivityIndicator size="large" color="#1DA1F2" style={{ marginTop: 20 }} />
            ) : (
                <FlatList
                    data={messages}
                    keyExtractor={(item) => item.id}
                    renderItem={renderPostItem}
                    ItemSeparatorComponent={() => <View style={styles.separator} />}
                />
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
        paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
    },
    headerContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 15,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#E1E8ED',
        backgroundColor: '#fff',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        fontFamily: 'Trebuchet MS', // Keeping consistent font
        color: 'black',
    },
    inputSection: {
        flexDirection: 'row',
        padding: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#E1E8ED',
    },
    inputAvatarColumn: {
        marginRight: 10,
    },
    inputAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
    },
    inputWrapper: {
        flex: 1,
        justifyContent: 'space-between',
    },
    input: {
        fontSize: 18,
        color: '#14171A',
        minHeight: 50,
        fontFamily: 'Trebuchet MS',
        textAlignVertical: 'top',
        marginBottom: 10,
    },
    inputActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
    },
    postButton: {
        backgroundColor: '#1DA1F2',
        paddingVertical: 8,
        paddingHorizontal: 20,
        borderRadius: 20,
    },
    postButtonDisabled: {
        backgroundColor: '#8ED0F9',
    },
    postButtonText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 15,
    },
    // Feed Styles
    postContainer: {
        flexDirection: 'row',
        padding: 15,
        backgroundColor: '#fff',
    },
    avatarColumn: {
        marginRight: 10,
    },
    avatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
    },
    placeholderAvatar: {
        backgroundColor: '#AAB8C2',
        justifyContent: 'center',
        alignItems: 'center',
    },
    contentColumn: {
        flex: 1,
    },
    postHeader: {
        flexDirection: 'row',
        alignItems: 'baseline',
        marginBottom: 2,
    },
    name: {
        fontWeight: 'bold',
        fontSize: 15,
        color: '#14171A',
        marginRight: 5,
        fontFamily: 'Trebuchet MS',
    },
    handle: {
        color: '#657786',
        fontSize: 14,
        marginRight: 5,
    },
    dot: {
        color: '#657786',
        fontSize: 14,
        marginRight: 5,
    },
    time: {
        color: '#657786',
        fontSize: 14,
    },
    postText: {
        fontSize: 15,
        color: '#14171A',
        lineHeight: 20,
        marginBottom: 10,
        fontFamily: 'Trebuchet MS',
    },
    actionsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        maxWidth: 300,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    actionText: {
        marginLeft: 5,
        color: '#657786',
        fontSize: 12,
    },
    separator: {
        height: 1,
        backgroundColor: '#E1E8ED',
    },
});

export default MessageBoardScreen;
