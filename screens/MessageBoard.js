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
    Share,
    Modal
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
    deleteDoc,
    where
} from 'firebase/firestore';
import { sendPushNotification, getUserPushToken } from '../services/NotificationService';

const MessageBoardScreen = () => {
    const navigation = useNavigation();
    const route = useRoute(); // Add useRoute
    const { initialText, initialPosterUrl } = route.params || {};

    const [newMessage, setNewMessage] = useState(initialText || '');
    const [posterUrl, setPosterUrl] = useState(initialPosterUrl || null);
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [userProfile, setUserProfile] = useState(null);
    const [replyMetadata, setReplyMetadata] = useState(null); // { type: 'reply'|'quote', post: postObject }

    // Likes Modal State
    const [likesModalVisible, setLikesModalVisible] = useState(false);
    const [likedByUsers, setLikedByUsers] = useState([]);
    const [loadingLikes, setLoadingLikes] = useState(false);

    // Theater Trips State
    const [activeTrips, setActiveTrips] = useState([]);

    // Capture incoming share parameters when tab is focused/revisited
    useEffect(() => {
        if (route.params?.initialText || route.params?.initialPosterUrl) {
            if (route.params.initialText) setNewMessage(route.params.initialText);
            if (route.params.initialPosterUrl) setPosterUrl(route.params.initialPosterUrl);

            // Clear the params so they don't re-trigger if the user leaves and re-enters the tab
            navigation.setParams({ initialText: undefined, initialPosterUrl: undefined });
        }
    }, [route.params, navigation]);

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

    // 2.5 Real-time Theater Trips Listener
    useEffect(() => {
        const user = auth.currentUser;
        if (!user) return;
        const tripsRef = collection(db, "theaterTrips");
        
        // Remove orderBy to avoid requiring a composite index. Client-side sort instead.
        const filterQ = query(tripsRef, where("invitedUids", "array-contains", user.uid));
        
        const unsub = onSnapshot(filterQ, (snap) => {
            const trips = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            // Client-side sort by createdAt (descending)
            trips.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            setActiveTrips(trips);
        }, e => console.error("Trips fetch error", e));
        return () => unsub();
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
                posterUrl: posterUrl || null,
                userId: auth.currentUser.uid,
                username: userProfile?.username || auth.currentUser.email.split('@')[0],
                name: userProfile?.name || "Topo User",
                userPhoto: userProfile?.profilePhoto || null,
                timestamp: serverTimestamp(),
                likedBy: [], // Track who liked
                comments: 0,
                replyTo: replyMetadata?.type === 'reply' ? {
                    id: replyMetadata.post.id,
                    username: replyMetadata.post.username,
                    text: replyMetadata.post.text.substring(0, 50) + (replyMetadata.post.text.length > 50 ? '...' : ''),
                    userId: replyMetadata.post.userId
                } : null
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
            setPosterUrl(null);
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

    const handleViewLikes = async (post) => {
        if (!post.likedBy || post.likedBy.length === 0) return;

        setLikesModalVisible(true);
        setLoadingLikes(true);
        setLikedByUsers([]);

        try {
            // Fetch user details for each UID
            const promises = post.likedBy.map(uid => getDoc(doc(db, "users", uid)));
            const snapshots = await Promise.all(promises);

            const users = snapshots.map(snap => {
                if (snap.exists()) {
                    return { uid: snap.id, ...snap.data() };
                }
                return { uid: snap.id, username: 'Unknown User' };
            });

            setLikedByUsers(users);
        } catch (e) {
            console.error("Error fetching likes:", e);
        } finally {
            setLoadingLikes(false);
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
        // Don't pre-fill text with @Username, we'll show it in UI context
        // setNewMessage(`@${post.username} `); 
        setNewMessage('');
        setReplyMetadata({ type: 'reply', post: post });
        // Focus input? (Assuming TextInput ref would be better but this works for MVP)
    };

    const cancelReply = () => {
        setReplyMetadata(null);
        setNewMessage('');
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

                    {/* REPLY CONTEXT (Feed) */}
                    {/* REPLY CONTEXT (Feed) */}
                    {item.replyTo && (
                        <View style={styles.threadComposer}>
                            <View style={styles.threadLineContainer}>
                                <View style={styles.threadLineTop} />
                            </View>
                            <View style={styles.threadPreview}>
                                <Text style={styles.threadUser} numberOfLines={1}>@{item.replyTo.username}</Text>
                                {item.replyTo.text && (
                                    <Text style={styles.threadText} numberOfLines={2}>{item.replyTo.text}</Text>
                                )}
                            </View>
                        </View>
                    )}

                    <Text style={styles.postText}>{item.text}</Text>

                    {item.posterUrl && (
                        <Image source={{ uri: item.posterUrl }} style={styles.postImage} />
                    )}

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
                        <TouchableOpacity style={styles.actionButton} onPress={() => handleLike(item)} onLongPress={() => handleViewLikes(item)}>
                            <Icon name={isLiked ? "heart" : "heart-o"} size={16} color={isLiked ? "#E0245E" : "#657786"} />
                            <TouchableOpacity onPress={() => handleViewLikes(item)}>
                                <Text style={[styles.actionText, isLiked && { color: "#E0245E" }]}>{item.likes || 0}</Text>
                            </TouchableOpacity>
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

            {/* Active Theater Trips Banner */}
            {activeTrips.length > 0 && (
                <View style={{ padding: 10, backgroundColor: '#f5f8fa', borderBottomWidth: 1, borderBottomColor: '#E1E8ED' }}>
                    <Text style={{ color: '#14171A', fontWeight: 'bold', marginBottom: 10, marginLeft: 5 }}>🍿 Active Theater Trips</Text>
                    <FlatList
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        data={activeTrips}
                        keyExtractor={item => item.id}
                        renderItem={({ item }) => (
                            <TouchableOpacity 
                                style={{
                                    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', 
                                    paddingRight: 15, paddingLeft: 5, paddingVertical: 5, borderRadius: 20, 
                                    marginRight: 10, borderWidth: 1, borderColor: '#E1E8ED',
                                    elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1
                                }}
                                onPress={() => navigation.navigate('TheaterTrip', { tripId: item.tripId })}
                            >
                                <Image source={{ uri: `https://image.tmdb.org/t/p/w200${item.poster_path}` }} style={{ width: 30, height: 45, borderRadius: 15, marginRight: 10 }} />
                                <View>
                                    <Text style={{ color: '#14171A', fontWeight: 'bold', fontSize: 13, maxWidth: 120 }} numberOfLines={1}>{item.movieTitle}</Text>
                                    <Text style={{ color: '#657786', fontSize: 11 }}>Invited by @{item.creatorUsername}</Text>
                                </View>
                            </TouchableOpacity>
                        )}
                    />
                </View>
            )}

            {/* Likes List Modal */}
            <Modal visible={likesModalVisible} transparent animationType="fade" onRequestClose={() => setLikesModalVisible(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Liked By</Text>
                            <TouchableOpacity onPress={() => setLikesModalVisible(false)}>
                                <Icon name="times" size={20} color="#000" />
                            </TouchableOpacity>
                        </View>
                        {loadingLikes ? (
                            <ActivityIndicator color="#1DA1F2" style={{ marginTop: 20 }} />
                        ) : (
                            <FlatList
                                data={likedByUsers}
                                keyExtractor={item => item.uid}
                                renderItem={({ item }) => (
                                    <TouchableOpacity style={styles.likeRow} onPress={() => {
                                        setLikesModalVisible(false);
                                        navigation.navigate('PublicProfile', { userId: item.uid });
                                    }}>
                                        <Image source={item.profilePhoto ? { uri: item.profilePhoto } : require('../assets/profile_placeholder.jpg')} style={styles.likeAvatar} />
                                        <Text style={styles.likeName}>@{item.username}</Text>
                                    </TouchableOpacity>
                                )}
                                ListEmptyComponent={<Text style={{ padding: 20, textAlign: 'center', color: '#666' }}>No likes yet.</Text>}
                            />
                        )}
                    </View>
                </View>
            </Modal>

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
                    {/* THREAD COMPOSER UI (Input) */}
                    {replyMetadata && replyMetadata.type === 'reply' && (
                        <View style={styles.threadComposer}>
                            <View style={styles.threadLineContainer}>
                                <View style={styles.threadLineTop} />
                            </View>
                            <View style={styles.threadPreview}>
                                <Text style={styles.threadUser} numberOfLines={1}>@{replyMetadata.post.username}</Text>
                                <Text style={styles.threadText} numberOfLines={2}>{replyMetadata.post.text}</Text>
                            </View>
                            <TouchableOpacity onPress={cancelReply} style={styles.closeThreadBtn}>
                                <Icon name="times" size={14} color="#657786" />
                            </TouchableOpacity>
                        </View>
                    )}

                    <TextInput
                        style={[styles.input, replyMetadata && styles.inputReplying]}
                        placeholder={replyMetadata ? "Post your reply" : "What's happening?"}
                        placeholderTextColor="#657786"
                        multiline
                        value={newMessage}
                        onChangeText={(text) => {
                            setNewMessage(text);
                            // Don't auto-clear metadata here anymore
                        }}
                        maxLength={280}
                    />

                    {posterUrl && (
                        <View style={styles.previewImageContainer}>
                            <Image source={{ uri: posterUrl }} style={styles.postImagePreview} />
                            <TouchableOpacity style={styles.previewImageClose} onPress={() => setPosterUrl(null)}>
                                <Icon name="times" size={12} color="#fff" />
                            </TouchableOpacity>
                        </View>
                    )}

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
            {
                loading ? (
                    <ActivityIndicator size="large" color="#1DA1F2" style={{ marginTop: 20 }} />
                ) : (
                    <FlatList
                        data={messages}
                        keyExtractor={(item) => item.id}
                        renderItem={renderPostItem}
                        ItemSeparatorComponent={() => <View style={styles.separator} />}
                    />
                )
            }
        </SafeAreaView >
    );
};

// Add Modal to imports at top if missing - wait, React Native imports:
// import {...Modal ... } from 'react-native';
// It was already there in line 2? let me check. Yes, need to ensure Modal is imported.
// Assuming it is or I will add it.
// Checking file... Modal is NOT in imports on line 2-16. Adding it.

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
    postImage: {
        width: 150,
        height: 225,
        borderRadius: 8,
        marginBottom: 10,
        resizeMode: 'cover',
    },
    postImagePreview: {
        width: 100,
        height: 150,
        borderRadius: 8,
        resizeMode: 'cover',
    },
    previewImageContainer: {
        marginBottom: 10,
        alignSelf: 'flex-start',
    },
    previewImageClose: {
        position: 'absolute',
        top: 4,
        right: 4,
        backgroundColor: 'rgba(0,0,0,0.6)',
        borderRadius: 12,
        width: 24,
        height: 24,
        alignItems: 'center',
        justifyContent: 'center',
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
    // Reply Context Styles
    replyContext: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4
    },
    replyLineSmall: {
        width: 2,
        height: 12,
        backgroundColor: '#CFD9DE',
        marginRight: 8,
        borderRadius: 1
    },
    replyTextLabel: {
        color: '#657786',
        fontSize: 13
    },
    // Thread Composer Styles
    threadComposer: {
        flexDirection: 'row',
        padding: 8,
        backgroundColor: '#F7F9FA',
        borderRadius: 12,
        marginBottom: 8,
        alignItems: 'center'
    },
    threadLineContainer: {
        width: 20,
        alignItems: 'center',
        marginRight: 8,
        height: '100%'
    },
    threadLineTop: {
        width: 2,
        flex: 1,
        backgroundColor: '#CFD9DE',
        marginBottom: -10 // Connect to avatar below technically
    },
    threadPreview: {
        flex: 1
    },
    threadUser: {
        fontWeight: 'bold',
        fontSize: 12,
        color: '#14171A'
    },
    threadText: {
        fontSize: 12,
        color: '#657786'
    },
    closeThreadBtn: {
        padding: 5
    },
    inputReplying: {
        minHeight: 80 // More space when replying
    },
    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center'
    },
    modalContent: {
        width: '80%',
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 20,
        maxHeight: '60%',
        elevation: 5
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
        paddingBottom: 10
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#14171A'
    },
    likeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0'
    },
    likeAvatar: {
        width: 30,
        height: 30,
        borderRadius: 15,
        marginRight: 10
    },
    likeName: {
        fontSize: 16,
        color: '#14171A'
    }
});

export default MessageBoardScreen;
