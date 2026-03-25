import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, FlatList, TextInput, SafeAreaView, KeyboardAvoidingView, Platform, ActivityIndicator, StatusBar, Alert } from 'react-native';
import { doc, onSnapshot, getDoc, updateDoc, collection, addDoc, query, orderBy, deleteDoc, arrayRemove } from 'firebase/firestore';
import { db, auth } from '../firebaseConfig';
import Icon from 'react-native-vector-icons/FontAwesome';
import MaterialIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';

const TheaterTripScreen = ({ route }) => {
    const { tripId } = route.params;
    const navigation = useNavigation();
    const [tripData, setTripData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState('');
    const [userRsvp, setUserRsvp] = useState('pending');

    useEffect(() => {
        if (!tripId) return;
        const tripRef = doc(db, 'theaterTrips', tripId);
        const unsub = onSnapshot(tripRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setTripData(data);
                if (auth.currentUser && data.rsvps?.[auth.currentUser.uid]) {
                    setUserRsvp(data.rsvps[auth.currentUser.uid]);
                }
            }
            setLoading(false);
        });
        return () => unsub();
    }, [tripId]);

    // Firestore listener for group chat messages. Only hooks up if the user RSVP'd 'in'.
    useEffect(() => {
        if (!tripId || userRsvp !== 'in') return;
        const msgsRef = collection(db, 'theaterTrips', tripId, 'messages');
        const q = query(msgsRef, orderBy('timestamp', 'asc'));
        const unsub = onSnapshot(q, (snapshot) => {
            const fetched = [];
            snapshot.forEach(d => fetched.push({ id: d.id, ...d.data() }));
            setMessages(fetched);
        });
        return () => unsub();
    }, [tripId, userRsvp]);

    const handleRsvp = async (status) => {
        if (!auth.currentUser || !tripId) return;
        try {
            const tripRef = doc(db, 'theaterTrips', tripId);
            const updates = { [`rsvps.${auth.currentUser.uid}`]: status };
            
            // If they pass, remove them from the invited array so it drops off their Message Board feed securely.
            if (status === 'out') {
                updates.invitedUids = arrayRemove(auth.currentUser.uid);
            }

            await updateDoc(tripRef, updates);
            setUserRsvp(status);
            
            if (status === 'out') {
                navigation.goBack(); // Auto-leave screen when passing
            }
        } catch(e) { console.error("RSVP error", e); }
    };

    const handleDeleteTrip = async () => {
        Alert.alert(
            "Cancel Trip",
            "Are you sure you want to completely cancel and delete this theater trip?",
            [
                { text: "No", style: 'cancel' },
                {
                    text: "Delete",
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await deleteDoc(doc(db, 'theaterTrips', tripId));
                            navigation.goBack();
                        } catch (e) {
                            console.error("Delete Error", e);
                        }
                    }
                }
            ]
        );
    };

    const sendMessage = async () => {
        if (!inputText.trim() || !auth.currentUser) return;
        try {
            const msgsRef = collection(db, 'theaterTrips', tripId, 'messages');
            const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
            const username = userDoc.exists() ? userDoc.data().username : "User";
            const profilePhoto = userDoc.exists() ? userDoc.data().profilePhoto : null;

            await addDoc(msgsRef, {
                uid: auth.currentUser.uid,
                username,
                profilePhoto,
                text: inputText.trim(),
                timestamp: new Date().toISOString()
            });
            setInputText('');
        } catch(e) { console.error("Message Error", e); }
    };

    if (loading) return <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#ff8c00" /></View>;
    if (!tripData) return <View style={styles.loadingContainer}><Text style={{color:'#fff'}}>Trip not found.</Text></View>;

    // Calculate RSVP counts
    const rsvpArray = Object.values(tripData.rsvps || {});
    const inCount = rsvpArray.filter(v => v === 'in').length;
    const outCount = rsvpArray.filter(v => v === 'out').length;

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.headerBar}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Icon name="arrow-left" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle} numberOfLines={1}>Theater Trip!</Text>
                
                {auth.currentUser && tripData.creatorUid === auth.currentUser.uid ? (
                    <TouchableOpacity onPress={handleDeleteTrip} style={{ padding: 5, zIndex: 10 }}>
                        <Icon name="trash" size={20} color="#ff6347" />
                    </TouchableOpacity>
                ) : (
                    <View style={{width: 24, zIndex: 10}}/>
                )}
            </View>

            <View style={styles.movieInfoContainer}>
                {tripData.poster_path ? (
                    <Image source={{ uri: `https://image.tmdb.org/t/p/w500${tripData.poster_path}` }} style={styles.poster} />
                ) : <View style={styles.posterPlaceholder} />}
                <View style={styles.movieDetails}>
                    <Text style={styles.movieTitle} numberOfLines={2}>{tripData.movieTitle}</Text>
                    <Text style={styles.creatorText}>Organized by {tripData.creatorUsername}</Text>
                    <View style={styles.statsRow}>
                        <View style={styles.statBadge}><Text style={styles.statText}>🍿 {inCount} In</Text></View>
                        <View style={styles.statBadge}><Text style={styles.statText}>🚫 {outCount} Out</Text></View>
                    </View>
                </View>
            </View>

            {userRsvp === 'pending' ? (
                <View style={styles.rsvpContainer}>
                    <Text style={styles.rsvpPrompt}>Are you in for this theater trip?</Text>
                    <View style={styles.rsvpButtonsRow}>
                        <TouchableOpacity style={[styles.rsvpButton, { backgroundColor: '#e50914' }]} onPress={() => handleRsvp('out')}>
                            <Text style={styles.rsvpButtonText}>PASS 🚫</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.rsvpButton, { backgroundColor: '#4CAF50' }]} onPress={() => handleRsvp('in')}>
                            <Text style={styles.rsvpButtonText}>I'M IN 🍿</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            ) : userRsvp === 'out' ? (
                <View style={styles.rsvpContainer}>
                    <Text style={styles.rsvpPrompt}>You passed on this trip.</Text>
                    <TouchableOpacity style={[styles.rsvpButton, { backgroundColor: '#4CAF50', marginTop: 15, paddingHorizontal: 20 }]} onPress={() => handleRsvp('in')}>
                        <Text style={styles.rsvpButtonText}>Changed my mind, I'm In!</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
                    <View style={styles.chatHeader}>
                        <Text style={{color:'#111', fontWeight:'900'}}>GROUP CHAT • PLAN SHOWTIMES</Text>
                    </View>
                    <FlatList
                        data={messages}
                        keyExtractor={item => item.id}
                        contentContainerStyle={{ padding: 15 }}
                        renderItem={({ item }) => {
                            const isMe = auth.currentUser && item.uid === auth.currentUser.uid;
                            return (
                                <View style={[styles.messageRow, isMe ? styles.messageRowMe : styles.messageRowThem]}>
                                    {!isMe && (
                                        <Image source={item.profilePhoto && item.profilePhoto !== "null" && item.profilePhoto !== "" ? { uri: item.profilePhoto } : require('../assets/profile_placeholder.jpg')} style={styles.chatAvatar} />
                                    )}
                                    <View style={[styles.messageBubble, isMe ? styles.messageBubbleMe : styles.messageBubbleThem]}>
                                        {!isMe && <Text style={styles.messageName}>{item.username}</Text>}
                                        <Text style={styles.messageText}>{item.text}</Text>
                                    </View>
                                </View>
                            );
                        }}
                    />
                    <View style={styles.inputContainer}>
                        <TextInput
                            style={styles.textInput}
                            placeholder="Type a message..."
                            placeholderTextColor="#888"
                            value={inputText}
                            onChangeText={setInputText}
                        />
                        <TouchableOpacity style={styles.sendButton} onPress={sendMessage}>
                            <Icon name="send" size={20} color="#000" />
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0a0a1a', paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 },
    loadingContainer: { flex: 1, backgroundColor: '#0a0a1a', justifyContent: 'center', alignItems: 'center' },
    headerBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 15, backgroundColor: '#111', borderBottomWidth: 1, borderBottomColor: '#333' },
    backButton: { padding: 5, zIndex: 10 },
    headerTitle: { flex: 1, fontSize: 18, fontWeight: 'bold', color: '#ff8c00', textAlign: 'center', position: 'absolute', width: '100%', left: 15 },
    movieInfoContainer: { flexDirection: 'row', padding: 15, backgroundColor: '#1a1a2e', borderBottomWidth: 1, borderBottomColor: '#333' },
    poster: { width: 80, height: 120, borderRadius: 8, marginRight: 15 },
    posterPlaceholder: { width: 80, height: 120, borderRadius: 8, marginRight: 15, backgroundColor: '#333' },
    movieDetails: { flex: 1, justifyContent: 'center' },
    movieTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff', marginBottom: 5 },
    creatorText: { fontSize: 14, color: '#aaa', marginBottom: 10 },
    statsRow: { flexDirection: 'row' },
    statBadge: { backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, marginRight: 10 },
    statText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
    rsvpContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    rsvpPrompt: { fontSize: 22, color: '#fff', fontWeight: 'bold', textAlign: 'center', marginBottom: 30 },
    rsvpButtonsRow: { flexDirection: 'row', width: '100%', justifyContent: 'space-around' },
    rsvpButton: { paddingVertical: 15, paddingHorizontal: 30, borderRadius: 30, elevation: 5, shadowColor: '#000', shadowOffset:{width:0, height:2}, shadowOpacity: 0.3 },
    rsvpButtonText: { color: '#fff', fontSize: 18, fontWeight: '900', textTransform: 'uppercase' },
    chatHeader: { backgroundColor: '#ff8c00', padding: 10, alignItems: 'center' },
    messageRow: { flexDirection: 'row', marginBottom: 15, alignItems: 'flex-end' },
    messageRowMe: { justifyContent: 'flex-end' },
    messageRowThem: { justifyContent: 'flex-start' },
    chatAvatar: { width: 30, height: 30, borderRadius: 15, marginRight: 10 },
    messageBubble: { maxWidth: '75%', padding: 12, borderRadius: 20 },
    messageBubbleMe: { backgroundColor: '#1E90FF', borderBottomRightRadius: 5 },
    messageBubbleThem: { backgroundColor: '#333', borderBottomLeftRadius: 5 },
    messageName: { color: '#bbb', fontSize: 11, marginBottom: 2, fontWeight: 'bold' },
    messageText: { color: '#fff', fontSize: 15 },
    inputContainer: { flexDirection: 'row', padding: 10, backgroundColor: '#111', borderTopWidth: 1, borderTopColor: '#333', alignItems: 'center' },
    textInput: { flex: 1, backgroundColor: '#222', color: '#fff', borderRadius: 25, paddingHorizontal: 15, paddingVertical: 10, marginRight: 10 },
    sendButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#ff8c00', justifyContent: 'center', alignItems: 'center' }
});

export default TheaterTripScreen;
