import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, SafeAreaView, Platform, StatusBar, Modal, TextInput, Alert, Image, ActivityIndicator } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import MaterialIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { auth, db } from '../firebaseConfig';
import { collection, query, where, onSnapshot, doc, getDoc, addDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';

const MatchedMovieScreen = () => {
    const navigation = useNavigation();
    const [connections, setConnections] = useState([]);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState(null);

    // Create Modal State
    const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
    const [newConnectionName, setNewConnectionName] = useState('');
    const [timeWindow, setTimeWindow] = useState('');
    const [following, setFollowing] = useState([]); // User's friends
    const [selectedFriends, setSelectedFriends] = useState([]);
    const [isCreating, setIsCreating] = useState(false);
    const [duration, setDuration] = useState(3);

    useEffect(() => {
        const currentUser = auth.currentUser;
        if (!currentUser) {
            setLoading(false);
            return;
        }
        setUser(currentUser);

        // 1. Listen for Connections where user is a participant
        const q = query(collection(db, "connections"), where("participants", "array-contains", currentUser.uid));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list = [];
            snapshot.forEach((doc) => {
                list.push({ id: doc.id, ...doc.data() });
            });
            // Sort by newest
            list.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
            setConnections(list);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching connections:", error);
            setLoading(false);
        });

        // 2. Fetch User's Following list (for creating new connections)
        fetchFriends(currentUser.uid);

        return () => unsubscribe();
    }, []);

    const fetchFriends = async (uid) => {
        try {
            const userDoc = await getDoc(doc(db, "users", uid));
            if (userDoc.exists()) {
                const data = userDoc.data();
                setFollowing(data.following || []);
            }
        } catch (error) {
            console.error("Error fetching friends:", error);
        }
    };

    const toggleFriendSelection = (friend) => {
        if (selectedFriends.find(f => f.uid === friend.uid)) {
            setSelectedFriends(selectedFriends.filter(f => f.uid !== friend.uid));
        } else {
            setSelectedFriends([...selectedFriends, friend]);
        }
    };

    const handleCreateConnection = async () => {
        if (!newConnectionName.trim()) {
            Alert.alert("Missing Name", "Please give your group a name (e.g. 'Date Night')");
            return;
        }
        // Duration is always set by default state

        if (selectedFriends.length === 0) {
            Alert.alert("No Friends", "Please select at least one friend to match with.");
            return;
        }

        setIsCreating(true);
        try {
            // Prepare participants array (UIDs)
            const participantUIDs = [user.uid, ...selectedFriends.map(f => f.uid)];

            // Prepare participant details
            const myProfile = {
                uid: user.uid,
                username: user.email?.split('@')[0] || "Me",
                profilePhoto: null
            };
            const participantDetails = [myProfile, ...selectedFriends];

            // Calculate Deadline
            const deadlineDate = new Date();
            deadlineDate.setDate(deadlineDate.getDate() + duration);

            await addDoc(collection(db, "connections"), {
                name: newConnectionName.trim(),
                duration: duration,
                deadline: deadlineDate, // Firestore will convert Date to Timestamp
                participants: participantUIDs,
                participantDetails: participantDetails,
                status: 'matching',
                createdAt: serverTimestamp(),
                createdBy: user.uid
            });

            setIsCreateModalVisible(false);
            setNewConnectionName('');
            setDuration(3);
            setSelectedFriends([]);
            Alert.alert("Success", "Group started! You have " + duration + " days to vote.");

        } catch (error) {
            console.error("Error creating connection:", error);
            Alert.alert("Error", "Failed to create connection.");
        } finally {
            setIsCreating(false);
        }
    };

    const handleDeleteConnection = (connectionId, connectionName) => {
        Alert.alert(
            "Delete Group",
            `Are you sure you want to delete "${connectionName}"? This cannot be undone.`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await deleteDoc(doc(db, "connections", connectionId));
                        } catch (error) {
                            console.error("Error deleting connection:", error);
                            Alert.alert("Error", "Could not delete group.");
                        }
                    }
                }
            ]
        );
    };

    const renderConnectionItem = ({ item }) => (
        <TouchableOpacity
            style={styles.connectionCard}
            onPress={() => navigation.navigate('ConnectionDetail', { connectionId: item.id, name: item.name })}
        >
            <View style={styles.iconContainer}>
                <MaterialIcon name={item.participants.length > 2 ? "account-group" : "account-heart"} size={30} color="#fff" />
            </View>
            <View style={styles.connectionInfo}>
                <Text style={styles.connectionName}>{item.name}</Text>
                <Text style={styles.connectionStatus}>
                    {item.status === 'matching' ? 'Finding Matches...' :
                        item.status === 'voting' ? 'Voting in Progress' : 'Ready to Reveal!'}
                </Text>
                <Text style={styles.participantsText}>
                    with {item.participantDetails?.filter(p => p.uid !== user?.uid).map(p => p.username).join(', ') || ((item.participants?.length - 1) + " others")}
                </Text>
            </View>

            {/* Delete Button (Only if creator or just allow anyone for now? Assuming anyone can leave/delete for simplicity or check createdBy) */}
            {/* Let's allow deletion for everyone for now as per "I need to be able to delete groups" */}
            <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => handleDeleteConnection(item.id, item.name)}
            >
                <Icon name="trash-o" size={20} color="#666" />
            </TouchableOpacity>

            <Icon name="chevron-right" size={16} color="#444" style={{ marginLeft: 10 }} />
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Film Friendzy</Text>
            </View>

            <View style={styles.content}>
                {loading ? (
                    <ActivityIndicator size="large" color="#e50914" />
                ) : (
                    <FlatList
                        data={connections}
                        keyExtractor={item => item.id}
                        renderItem={renderConnectionItem}
                        ListHeaderComponent={connections.length > 0 ? <Text style={styles.sectionTitle}>Your Connections</Text> : null}
                        ListEmptyComponent={
                            <View style={styles.emptyContainer}>
                                <MaterialIcon name="movie-roll" size={60} color="#333" />
                                <Text style={styles.emptyText}>No matches started.</Text>
                                <Text style={styles.emptySubText}>Create a group to find movies to watch together!</Text>
                            </View>
                        }
                        contentContainerStyle={{ paddingBottom: 100 }}
                    />
                )}

                <TouchableOpacity style={styles.fab} onPress={() => setIsCreateModalVisible(true)}>
                    <Icon name="plus" size={24} color="#fff" />
                </TouchableOpacity>
            </View>

            {/* Create Connection Modal */}
            <Modal visible={isCreateModalVisible} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>New Match Group</Text>
                            <TouchableOpacity onPress={() => setIsCreateModalVisible(false)}>
                                <Icon name="times" size={20} color="#ccc" />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.label}>Group Name</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="e.g. Friday Night Watch Party"
                            placeholderTextColor="#666"
                            value={newConnectionName}
                            onChangeText={setNewConnectionName}
                        />

                        <Text style={styles.label}>Duration: {duration} Days</Text>
                        <View style={styles.durationContainer}>
                            {[1, 3, 7, 14].map(days => (
                                <TouchableOpacity
                                    key={days}
                                    style={[styles.durationBtn, duration === days && styles.durationBtnActive]}
                                    onPress={() => setDuration(days)}
                                >
                                    <Text style={[styles.durationText, duration === days && { color: '#000' }]}>{days}d</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <Text style={styles.label}>Select Friends ({selectedFriends.length})</Text>
                        <View style={styles.friendsListContainer}>
                            {following.length === 0 ? (
                                <Text style={{ color: '#666', fontStyle: 'italic', textAlign: 'center', marginTop: 20 }}>
                                    You aren't following anyone yet. Go to Profile Settings to find friends!
                                </Text>
                            ) : (
                                <FlatList
                                    data={following}
                                    keyExtractor={item => item.uid}
                                    renderItem={({ item }) => {
                                        const isSelected = selectedFriends.some(f => f.uid === item.uid);
                                        return (
                                            <TouchableOpacity
                                                style={[styles.friendItem, isSelected && styles.friendItemSelected]}
                                                onPress={() => toggleFriendSelection(item)}
                                            >
                                                <Image
                                                    source={item.profilePhoto ? { uri: item.profilePhoto } : require('../assets/profile_placeholder.jpg')}
                                                    style={styles.friendImg}
                                                />
                                                <Text style={[styles.friendName, isSelected && { color: '#fff', fontWeight: 'bold' }]}>
                                                    {item.username}
                                                </Text>
                                                {isSelected && <Icon name="check" size={16} color="#ff8c00" />}
                                            </TouchableOpacity>
                                        );
                                    }}
                                />
                            )}
                        </View>

                        <TouchableOpacity
                            style={[styles.createButton, (isCreating || selectedFriends.length === 0) && { opacity: 0.5 }]}
                            onPress={handleCreateConnection}
                            disabled={isCreating || selectedFriends.length === 0}
                        >
                            {isCreating ? <ActivityIndicator color="#fff" /> : <Text style={styles.createButtonText}>Start Matching</Text>}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0a0a1a',
        paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
    },
    header: {
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#222',
        alignItems: 'center'
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#fff',
        fontFamily: 'Trebuchet MS',
        textTransform: 'uppercase',
        letterSpacing: 2
    },
    content: {
        flex: 1,
        padding: 20
    },
    sectionTitle: {
        color: '#888',
        fontSize: 14,
        marginBottom: 15,
        textTransform: 'uppercase',
        letterSpacing: 1
    },
    connectionCard: {
        flexDirection: 'row',
        backgroundColor: '#161625',
        padding: 15,
        borderRadius: 12,
        marginBottom: 10,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#333'
    },
    iconContainer: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#8a2be2',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15
    },
    connectionInfo: {
        flex: 1
    },
    connectionName: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 4
    },
    connectionStatus: {
        color: '#ff8c00',
        fontSize: 14,
        marginBottom: 2
    },
    participantsText: {
        color: '#666',
        fontSize: 12
    },
    emptyContainer: {
        alignItems: 'center',
        marginTop: 50
    },
    emptyText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
        marginTop: 15
    },
    emptySubText: {
        color: '#666',
        marginTop: 5,
        textAlign: 'center',
        paddingHorizontal: 40
    },
    fab: {
        position: 'absolute',
        bottom: 20,
        right: 20,
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#e50914',
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.8,
        shadowRadius: 2
    },
    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'flex-end'
    },
    modalContent: {
        backgroundColor: '#161625',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 25,
        height: '80%',
        borderWidth: 1,
        borderColor: '#333'
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20
    },
    modalTitle: {
        color: '#fff',
        fontSize: 22,
        fontWeight: 'bold',
        fontFamily: 'Trebuchet MS'
    },
    label: {
        color: '#ccc',
        marginBottom: 10,
        fontSize: 14,
        textTransform: 'uppercase',
        letterSpacing: 1
    },
    input: {
        backgroundColor: '#252535',
        color: '#fff',
        padding: 15,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#444',
        marginBottom: 25,
        fontSize: 16
    },
    friendsListContainer: {
        flex: 1,
        marginBottom: 20,
        backgroundColor: '#1a1a2e',
        borderRadius: 10,
        padding: 10
    },
    friendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 10,
        marginBottom: 5,
        borderRadius: 8
    },
    friendItemSelected: {
        backgroundColor: '#333',
        borderWidth: 1,
        borderColor: '#ff8c00'
    },
    friendImg: {
        width: 40,
        height: 40,
        borderRadius: 20,
        marginRight: 12
    },
    friendName: {
        color: '#aaa',
        fontSize: 16,
        flex: 1
    },
    createButton: {
        backgroundColor: '#e50914',
        padding: 15,
        borderRadius: 10,
        alignItems: 'center',
        marginBottom: 10
    },
    createButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
        textTransform: 'uppercase'
    },
    deleteButton: {
        padding: 10,
        marginRight: 5
    },
    durationContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 25
    },
    durationBtn: {
        backgroundColor: '#252535',
        flex: 1,
        marginHorizontal: 5,
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#444'
    },
    durationBtnActive: {
        backgroundColor: '#ff8c00',
        borderColor: '#ff8c00'
    },
    durationText: {
        color: '#ccc',
        fontWeight: 'bold'
    }
});

export default MatchedMovieScreen;
