import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Image, ActivityIndicator } from 'react-native';
import { doc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db, auth } from '../firebaseConfig';
import Icon from 'react-native-vector-icons/FontAwesome';
import { SafeAreaView } from 'react-native-safe-area-context';

const FollowListScreen = ({ route, navigation }) => {
    const { title, userList, currentUserId } = route.params;
    // userList should be array of { uid, username, profilePhoto }
    // OR we could fetch by ID if list is just IDs. 
    // based on previous ProfileSettings impl, we store full objects (uid, username, photo) in the array. matching that.

    const [listData, setListData] = useState(userList || []);
    const [loading, setLoading] = useState(false);

    // We might want to refresh this data or fetch 'isFollowing' status for each if viewing someone else's list.
    // For now, simple list view.

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Icon name="arrow-left" size={24} color="#ff8c00" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{title}</Text>
                <View style={{ width: 24 }} />
            </View>

            <FlatList
                data={listData}
                keyExtractor={(item) => item.uid}
                renderItem={({ item }) => (
                    <TouchableOpacity style={styles.userRow} onPress={() => navigation.navigate('PublicProfile', { userId: item.uid })}>
                        <Image
                            source={item.profilePhoto ? { uri: item.profilePhoto } : require('../assets/profile_placeholder.jpg')}
                            style={styles.avatar}
                        />
                        <Text style={styles.username}>{item.username}</Text>

                        {/* 
                           Future: "Follow" button if viewing someone else's followers 
                           and I don't follow this person.
                        */}
                    </TouchableOpacity>
                )}
                ListEmptyComponent={<Text style={styles.emptyText}>No users found.</Text>}
                contentContainerStyle={{ padding: 20 }}
            />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0a0a1a',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#222',
        backgroundColor: '#1a1a2e'
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#fff',
    },
    userRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#222'
    },
    avatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        marginRight: 15,
        borderWidth: 1,
        borderColor: '#333'
    },
    username: {
        fontSize: 16,
        color: '#fff',
        fontWeight: 'bold'
    },
    emptyText: {
        color: '#666',
        fontStyle: 'italic',
        textAlign: 'center',
        marginTop: 20
    }
});

export default FollowListScreen;
