import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    Image,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../firebaseConfig';
import TicketStubCard from '../components/TicketStubCard';
import { FlatList } from 'react-native';

const ProfileScreen = () => {
    const navigation = useNavigation();
    const [profilePhoto, setProfilePhoto] = useState(null);
    const [username, setUsername] = useState('');
    const [name, setName] = useState('');
    const [location, setLocation] = useState('');
    const [aboutMe, setAboutMe] = useState('');
    const [ratingMethod, setRatingMethod] = useState('');
    const [topFilms, setTopFilms] = useState([]);
    const [topFriends, setTopFriends] = useState([]);
    const [ticketWallet, setTicketWallet] = useState([]);
    const [theaterPoints, setTheaterPoints] = useState(0);
    const [isLoading, setIsLoading] = useState(true); // Add loading state

    useFocusEffect(
        useCallback(() => {
            loadProfileData();
        }, [])
    );


    const loadProfileData = async () => {
        try {
            const usersData = await AsyncStorage.getItem('users');
            const users = usersData ? JSON.parse(usersData) : [];
            const currentUserEmail = await AsyncStorage.getItem('currentUserEmail'); // Crucial!
            const currentUser = users.find(user => user.email === currentUserEmail);
    
            if (currentUser) { // Check if user exists
                setProfilePhoto(currentUser.profilePhoto || null);
                setUsername(currentUser.username || '');
                setName(currentUser.name || '');
                setLocation(currentUser.location || '');
                setAboutMe(currentUser.aboutMe || '');
                setRatingMethod(currentUser.ratingMethod || '');
                setTopFilms(currentUser.topFilms ? JSON.parse(currentUser.topFilms) : []); // Parse
                setTopFriends(currentUser.topFriends ? JSON.parse(currentUser.topFriends) : []); // Parse

                // Fetch Wallet from Firebase to ensure LIVE accuracy
                if (auth.currentUser) {
                    const uid = auth.currentUser.uid;
                    const userDoc = await getDoc(doc(db, "users", uid));
                    if (userDoc.exists()) {
                        setTheaterPoints(userDoc.data().theaterPoints || 0);
                    }
                    const stubsRef = collection(db, "users", uid, "ticketWallet");
                    const stubsSnap = await getDocs(stubsRef);
                    const stubs = [];
                    stubsSnap.forEach(sDoc => stubs.push(sDoc.data()));
                    stubs.sort((a,b) => new Date(b.mintDate) - new Date(a.mintDate));
                    setTicketWallet(stubs);
                }

            } else {
                console.warn("Current user data not found.");
                navigation.navigate('Login'); // Or handle appropriately
            }
          } catch (error) {
            console.error('Failed to load profile data:', error);
          } finally {
            setIsLoading(false); // Set loading to false after data is loaded
          }
        };

    return (
        <View style={outerStyles.container}> 
            <ScrollView style={styles.container}> 
                <View style={profileStyles.headerContainer}>
                    <View style={profileStyles.photoContainer}>
                        <View style={profileStyles.circularPhotoBackground}>
                            {profilePhoto ? (
                                <Image source={{ uri: profilePhoto }} style={profileStyles.profilePhoto} />
                            ) : (
                                <View style={profileStyles.placeholderPhoto}>
                                    <Text style={profileStyles.placeholderText}>No Photo</Text>
                                </View>
                            )}
                        </View>
                    </View>
                    <Text style={profileStyles.username}>{username || 'Username'}</Text>
                    <TouchableOpacity style={profileStyles.editProfileButton} onPress={() => navigation.navigate('ProfileSettings')}>
                        <Text style={profileStyles.editProfileText}>Edit Profile</Text>
                    </TouchableOpacity>
                </View>

                {/* Theater Points */}
                <View style={{ alignItems: 'center', marginBottom: 15 }}>
                    <Text style={{ fontSize: 18, fontWeight: '900', color: '#1976d2' }}>Theater Points: {theaterPoints}</Text>
                </View>

                {/* Ticket Wallet Section */}
                {ticketWallet.length > 0 && (
                    <View style={listSectionStyles.container}>
                        <Text style={listSectionStyles.title}>Digital Ticket Wallet</Text>
                        <FlatList
                            horizontal
                            data={ticketWallet}
                            keyExtractor={(item) => item.id}
                            showsHorizontalScrollIndicator={false}
                            renderItem={({ item }) => <TicketStubCard stubData={item} />}
                        />
                    </View>
                )}

                <View style={infoSectionStyles.container}>
                    <Text style={infoSectionStyles.title}>Name</Text>
                    <Text style={infoSectionStyles.text}>{name || 'N/A'}</Text>
                </View>

                <View style={infoSectionStyles.container}>
                    <Text style={infoSectionStyles.title}>Location</Text>
                    <Text style={infoSectionStyles.text}>{location || 'N/A'}</Text>
                </View>

                <View style={infoSectionStyles.container}>
                    <Text style={infoSectionStyles.title}>About Me</Text>
                    <Text style={infoSectionStyles.text}>{aboutMe || 'N/A'}</Text>
                </View>

                <View style={infoSectionStyles.container}>
                    <Text style={infoSectionStyles.title}>Rating Method</Text>
                    <Text style={infoSectionStyles.text}>{ratingMethod || 'N/A'}</Text>
                </View>

                <View style={listSectionStyles.container}>
                    <Text style={listSectionStyles.title}>Top 10 Films</Text>
                    {topFilms.length > 0 ? (
                        topFilms.map((film, index) => (
                            <Text key={index} style={listSectionStyles.listItem}>{index + 1}. {film}</Text>
                        ))
                    ) : (
                        <Text style={listSectionStyles.emptyText}>N/A</Text>
                    )}
                </View>

                <View style={friendsSectionStyles.container}>
                    <Text style={friendsSectionStyles.title}>Top 10 Friends</Text>
                    <View style={friendsSectionStyles.friendsGrid}>
                        {topFriends.length > 0 ? (
                            topFriends.map((friend, index) => (
                                <View key={index} style={friendsSectionStyles.avatar}>
                                    <Text style={friendsSectionStyles.avatarText}>{friend.charAt(0).toUpperCase()}</Text>
                                </View>
                            ))
                        ) : (
                            <Text style={listSectionStyles.emptyText}>N/A</Text>
                        )}
                    </View>
                </View>
            </ScrollView>
        </View>
    );
};

const outerStyles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'white', // A light blue-ish color, adjust as needed
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        overflow: 'hidden', // To contain the rounded borders
        margin: 0, // Adjust margins if needed
    },
});

const styles = StyleSheet.create({
    container: { flex: 1, padding: 16 }, // Keep your existing container styles, adjust if needed
    // ... other existing styles ...
});

const profileStyles = StyleSheet.create({
    headerContainer: { alignItems: 'center', marginBottom: 20 },
    photoContainer: { position: 'relative' },
    circularPhotoBackground: {
        backgroundColor: 'lightgrey', // Light grey for the background
        width: 160,
        height: 160,
        borderRadius: 80,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 10,
    },
    profilePhoto: { width: 150, height: 150, borderRadius: 75 },
    placeholderPhoto: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#ccc', justifyContent: 'center', alignItems: 'center' },
    placeholderText: { fontSize: 16, color: 'white' },
    username: { fontSize: 24, fontWeight: 'bold', marginBottom: 10, color: 'black' },
    editProfileButton: { backgroundColor: '#fce4ec', paddingVertical: 8, paddingHorizontal: 15, borderRadius: 20 },
    editProfileText: { color: '#000', fontWeight: 'bold' },
    // cameraIcon: { /* Styles for the camera icon */ },
});

const infoSectionStyles = StyleSheet.create({
    container: {
        backgroundColor: '#bbdefb', // Light blue for the info boxes
        padding: 15,
        borderRadius: 10,
        marginBottom: 10,
    },
    title: { fontSize: 18, fontWeight: 'bold', marginBottom: 5, color: '#1976d2' },
    text: { fontSize: 16, color: '#37474f' },
});

const listSectionStyles = StyleSheet.create({
    container: {
        backgroundColor: '#bbdefb',
        padding: 15,
        borderRadius: 10,
        marginBottom: 10,
    },
    title: { fontSize: 18, fontWeight: 'bold', marginBottom: 10, color: '#1976d2' },
    listItem: { fontSize: 16, marginBottom: 5, color: '#37474f' },
    emptyText: { fontSize: 16, color: '#78909c' },
});

const friendsSectionStyles = StyleSheet.create({
    container: {
        backgroundColor: '#bbdefb',
        padding: 15,
        borderRadius: 10,
        marginBottom: 10,
    },
    title: { fontSize: 18, fontWeight: 'bold', marginBottom: 10, color: '#1976d2' },
    friendsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#90caf9', // A lighter blue for avatars
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
});

export default ProfileScreen;
 