import React, { useState, useContext, useEffect, useRef } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Image, ScrollView, Dimensions, SafeAreaView, Platform, StatusBar, Modal, TextInput, Alert, PanResponder } from 'react-native';
import { MoviesContext } from '../context/MoviesContext';
import Icon from 'react-native-vector-icons/FontAwesome';
import MaterialIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { auth, db } from '../firebaseConfig';
import { doc, onSnapshot, getDoc, updateDoc, collection, query, where, getDocs, arrayUnion } from 'firebase/firestore';
import { getMovieDetails } from '../api/MovieService'; // Ensure we have this
import { TMDB_API_KEY } from '../utils/config';

const SCREEN_WIDTH = Dimensions.get('window').width;

const HomeScreen = () => {
    const { getMoviesInList, recentlyWatched, recentActivity, ratingMethod, setRatingMethod } = useContext(MoviesContext);
    const navigation = useNavigation();

    const [userProfile, setUserProfile] = useState(null);
    const [inTheatersMovies, setInTheatersMovies] = useState([]);
    const [showIntroModal, setShowIntroModal] = useState(false);
    const [isRatingModalVisible, setIsRatingModalVisible] = useState(false);

    const handleDismissIntro = async () => {
        setShowIntroModal(false);
        if (auth.currentUser) {
            try {
                await updateDoc(doc(db, "users", auth.currentUser.uid), {
                    hasSeenIntro: true
                });
            } catch (e) {
                console.error("Error updating intro flag:", e);
            }
        }
    };

    // Derived from Firestore profile data
    let top8 = [];
    if (userProfile?.topMovies) {
        if (Array.isArray(userProfile.topMovies)) {
            top8 = userProfile.topMovies;
        } else if (typeof userProfile.topMovies === 'string') {
            try {
                top8 = JSON.parse(userProfile.topMovies);
            } catch (e) {
                console.error("Error parsing top movies:", e);
            }
        }
    }

    // Hydrated Top Friends (Fresh Data)
    const [hydratedTopFriends, setHydratedTopFriends] = useState([]);

    // Friend Search & Top 4 State
    const [isFriendModalVisible, setIsFriendModalVisible] = useState(false);
    const [friendSearchQuery, setFriendSearchQuery] = useState('');
    const [friendSearchResults, setFriendSearchResults] = useState([]);

    const searchUsers = async (text) => {
        setFriendSearchQuery(text);
        if (text.length < 1) {
            setFriendSearchResults([]);
            return;
        }
        const searchTerm = text.toLowerCase();
        try {
            const usersRef = collection(db, "users");
            const q1 = query(
                usersRef,
                where("username_lowercase", ">=", searchTerm),
                where("username_lowercase", "<=", searchTerm + '\uf8ff')
            );
            const q2 = query(
                usersRef,
                where("name_lowercase", ">=", searchTerm),
                where("name_lowercase", "<=", searchTerm + '\uf8ff')
            );

            const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
            const usersMap = new Map();
            const currentUid = auth.currentUser?.uid;
            snap1.forEach((docSnap) => {
                if (docSnap.id !== currentUid) usersMap.set(docSnap.id, { uid: docSnap.id, ...docSnap.data() });
            });
            snap2.forEach((docSnap) => {
                if (docSnap.id !== currentUid) usersMap.set(docSnap.id, { uid: docSnap.id, ...docSnap.data() });
            });

            setFriendSearchResults(Array.from(usersMap.values()));
        } catch (e) {
            console.error(e);
        }
    };

    const followUser = async (targetUser) => {
        const user = auth.currentUser;
        if (!user) return;
        const following = userProfile?.following || [];
        if (following.find(u => u.uid === targetUser.uid)) return;

        const newFollowingItem = {
            uid: targetUser.uid,
            username: targetUser.username || 'User',
            profilePhoto: targetUser.profilePhoto || null
        };

        // DB - Current User
        await updateDoc(doc(db, "users", user.uid), {
            following: arrayUnion(newFollowingItem)
        });

        // DB - Target User (Followers)
        const myInfo = {
            uid: user.uid,
            username: userProfile?.username || 'User',
            profilePhoto: userProfile?.profilePhoto || null
        };
        await updateDoc(doc(db, "users", targetUser.uid), {
            followers: arrayUnion(myInfo)
        });
    };

    const toggleTopFriend = async (friend) => {
        const user = auth.currentUser;
        if (!user) return;
        const currentTopFriends = userProfile?.topFriends || [];
        let updatedTopFriends = [];

        if (currentTopFriends.find(f => f.uid === friend.uid)) {
            updatedTopFriends = currentTopFriends.filter(f => f.uid !== friend.uid);
        } else {
            if (currentTopFriends.length >= 4) {
                Alert.alert("Top 4 Full", "Remove someone first to add a new top friend.");
                return;
            }
            const friendInfo = {
                uid: friend.uid,
                username: friend.username || 'User',
                profilePhoto: friend.profilePhoto || null
            };
            updatedTopFriends = [...currentTopFriends, friendInfo];
        }

        try {
            await updateDoc(doc(db, "users", user.uid), {
                topFriends: updatedTopFriends
            });
        } catch (e) {
            console.error("Error toggling top friend:", e);
        }
    };

    // Edit Top 8 Favorites State & Logic
    const [isEditTop8ModalVisible, setIsEditTop8ModalVisible] = useState(false);
    const [movieSearchQuery, setMovieSearchQuery] = useState('');
    const [movieSearchResults, setMovieSearchResults] = useState([]);

    const searchMovies = async (queryText) => {
        setMovieSearchQuery(queryText);
        if (!queryText.trim()) {
            setMovieSearchResults([]);
            return;
        }
        try {
            const response = await fetch(
                `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(queryText)}`
            );
            const data = await response.json();
            setMovieSearchResults(data.results ? data.results.slice(0, 10) : []);
        } catch (error) {
            console.error("Error searching TMDB movies:", error);
        }
    };

    const addTopMovie = async (movie) => {
        const user = auth.currentUser;
        if (!user) return;
        let currentTop8 = [];
        if (userProfile?.topMovies) {
            if (Array.isArray(userProfile.topMovies)) {
                currentTop8 = [...userProfile.topMovies];
            } else if (typeof userProfile.topMovies === 'string') {
                try { currentTop8 = JSON.parse(userProfile.topMovies); } catch (e) {}
            }
        }
        if (currentTop8.length >= 8) {
            Alert.alert("Limit Reached", "You can only select up to 8 favorite movies.");
            return;
        }
        if (currentTop8.some(m => m.id === movie.id)) {
            Alert.alert("Duplicate", "This movie is already in your Top 8.");
            return;
        }

        const minimalMovie = {
            id: movie.id,
            title: movie.title,
            poster_path: movie.poster_path
        };

        const updatedTop8 = [...currentTop8, minimalMovie];
        try {
            await updateDoc(doc(db, "users", user.uid), {
                topMovies: updatedTop8
            });
            setMovieSearchQuery('');
            setMovieSearchResults([]);
        } catch (e) {
            console.error("Error updating top movies:", e);
        }
    };

    const removeTopMovie = async (movieId) => {
        const user = auth.currentUser;
        if (!user) return;
        let currentTop8 = [];
        if (userProfile?.topMovies) {
            if (Array.isArray(userProfile.topMovies)) {
                currentTop8 = [...userProfile.topMovies];
            } else if (typeof userProfile.topMovies === 'string') {
                try { currentTop8 = JSON.parse(userProfile.topMovies); } catch (e) {}
            }
        }
        const updatedTop8 = currentTop8.filter(m => m.id !== movieId);
        try {
            await updateDoc(doc(db, "users", user.uid), {
                topMovies: updatedTop8
            });
        } catch (e) {
            console.error("Error removing top movie:", e);
        }
    };

    const moveTopMovie = async (fromIndex, toIndex) => {
        if (toIndex < 0 || toIndex >= top8.length) return;
        const user = auth.currentUser;
        if (!user) return;

        const updatedTop8 = [...top8];
        const [movedItem] = updatedTop8.splice(fromIndex, 1);
        updatedTop8.splice(toIndex, 0, movedItem);

        try {
            await updateDoc(doc(db, "users", user.uid), {
                topMovies: updatedTop8
            });
        } catch (e) {
            console.error("Error reordering top movies:", e);
        }
    };

    const handleSelectRatingStyle = async (styleId) => {
        setRatingMethod(styleId);
        setIsRatingModalVisible(false);
        const user = auth.currentUser;
        if (user) {
            try {
                await updateDoc(doc(db, "users", user.uid), {
                    ratingMethod: styleId,
                    ratingSystem: styleId
                });
                Alert.alert("Rating Style Updated", "Your preferred rating style has been updated!");
            } catch (e) {
                console.error("Error updating rating style:", e);
            }
        }
    };

    // Grab & Drop Drag State & Logic
    const [draggingIndex, setDraggingIndex] = useState(null);
    const gridYRef = useRef(180);
    const top8Ref = useRef(top8);
    top8Ref.current = top8;

    const createPanResponder = (index) => {
        return PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderGrant: () => {
                setDraggingIndex(index);
            },
            onPanResponderMove: (evt, gestureState) => {
                const moveX = gestureState.moveX;
                const moveY = gestureState.moveY;

                const col = moveX > (SCREEN_WIDTH / 2) ? 1 : 0;
                const cardHeight = ((SCREEN_WIDTH - 55) / 2) * 1.48 + 45;
                const relativeY = moveY - gridYRef.current;
                const row = Math.max(0, Math.floor(relativeY / cardHeight));
                const targetIndex = Math.max(0, Math.min(top8Ref.current.length - 1, row * 2 + col));

                if (targetIndex !== index && targetIndex >= 0 && targetIndex < top8Ref.current.length) {
                    moveTopMovie(index, targetIndex);
                }
            },
            onPanResponderRelease: () => {
                setDraggingIndex(null);
            },
            onPanResponderTerminate: () => {
                setDraggingIndex(null);
            }
        });
    };

    // Load Profile Data Real-time
    useEffect(() => {
        const user = auth.currentUser;
        if (!user) return;

        const unsub = onSnapshot(doc(db, "users", user.uid), (docSnap) => {
            if (docSnap.exists()) {
                setUserProfile(docSnap.data());
                // Check if user has seen intro
                if (docSnap.data().hasSeenIntro === undefined || docSnap.data().hasSeenIntro === false) {
                    setShowIntroModal(true);
                }
            }
        });
        return () => unsub();
    }, []);

    // Hydrate Top Friends (Fetch latest photos)
    useEffect(() => {
        const fetchFriendsData = async () => {
            if (userProfile?.topFriends && userProfile.topFriends.length > 0) {
                const friendPromises = userProfile.topFriends.map(async (f) => {
                    try {
                        const friendSnap = await getDoc(doc(db, "users", f.uid));
                        if (friendSnap.exists()) {
                            return { ...f, ...friendSnap.data(), uid: f.uid }; // Merge fresh data
                        }
                        return f; // Fallback to stale if fetch fails
                    } catch (e) {
                        return f;
                    }
                });
                const freshFriends = await Promise.all(friendPromises);
                setHydratedTopFriends(freshFriends);
            } else {
                setHydratedTopFriends([]);
            }
        };
        fetchFriendsData();
    }, [userProfile?.topFriends]);

    // Load Explore Data (In Theaters)
    useEffect(() => {
        const loadInTheaters = async () => {
            try {
                // TODO: Move this to backend proxy
                const response = await fetch(
                    `https://api.themoviedb.org/3/movie/now_playing?api_key=${TMDB_API_KEY}&language=en-US&page=1&region=US`
                );
                const data = await response.json();
                setInTheatersMovies(data.results.slice(0, 10));
            } catch (err) {
                console.error("Error loading in theaters:", err);
            }
        };
        loadInTheaters();
    }, []);

    const renderRatingBadge = (item) => {
        const ratingVal = (item.userRating !== undefined && item.userRating !== null) 
            ? item.userRating 
            : (item.userOverallRating !== undefined && item.userOverallRating !== null ? item.userOverallRating : null);

        if (ratingVal === null || ratingVal === undefined) return null;

        const rating = parseFloat(ratingVal);
        const method = item.ratingMethod || ratingMethod || userProfile?.ratingMethod || userProfile?.ratingSystem || '1-10';

        let displayValue = "";
        let iconName = "";
        let iconColor = "";
        let Component = null;

        if (method === 'Percentage' || method === 'percentage') {
            displayValue = `${rating.toFixed(0)}%`;
            iconName = "percent";
            iconColor = "#4CAF50";
            Component = Icon;
        } else if (method === '1-5' || method === 'Pizza' || method === 'pizza') {
            displayValue = `${rating.toFixed(1)}`;
            iconName = "pizza";
            iconColor = "#FF5722";
            Component = MaterialIcon;
        } else if (method === 'Awards' || method === 'awards') {
            displayValue = `${rating.toFixed(1)}`;
            iconName = "trophy";
            iconColor = "#FFD700";
            Component = Icon;
        } else if (method === 'Thumbs' || method === 'thumbs') {
            displayValue = `${rating.toFixed(1)}`;
            iconName = "thumb-up";
            iconColor = "#4CAF50";
            Component = MaterialIcon;
        } else {
            // Classic 1-10
            displayValue = `${rating.toFixed(1)}`;
            return (
                <View style={styles.ratingBadge}>
                    <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: '#FFC107', justifyContent: 'center', alignItems: 'center', marginRight: 2 }}>
                        <Text style={{ fontSize: 8, fontWeight: 'bold', color: '#000' }}>10</Text>
                    </View>
                    <Text style={styles.ratingBadgeText}>{displayValue}</Text>
                </View>
            );
        }

        return (
            <View style={styles.ratingBadge}>
                {Component && <Component name={iconName} size={10} color={iconColor} style={{ marginRight: 2 }} />}
                <Text style={styles.ratingBadgeText}>{displayValue}</Text>
            </View>
        );
    };

    const renderMoviePoster = ({ item }) => {
        const imageUrl = item.poster_path
            ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
            : 'https://via.placeholder.com/150';

        return (
            <TouchableOpacity
                style={styles.posterItem}
                onPress={() => navigation.navigate('MovieDetails', { movieId: item.id, movie: item })}
            >
                <Image source={{ uri: imageUrl }} style={styles.posterImage} />
                {renderRatingBadge(item)}
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Onboarding Modal */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={showIntroModal}
                onRequestClose={handleDismissIntro}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <ScrollView contentContainerStyle={styles.modalScroll}>
                            <Text style={styles.modalTitle}>TOPO</Text>
                            <Text style={styles.modalSubtitle}>🎬 Get Started in 5 Easy Steps</Text>

                            <View style={styles.instructionStep}>
                                <Text style={styles.stepTitle}>1. STEP UP YOUR PROFILE</Text>
                                <Text style={styles.bulletText}>• Tap Edit Profile (top left corner)</Text>
                                <Text style={styles.bulletText}>• Update your profile photo</Text>
                                <Text style={styles.bulletText}>• Refresh your bio</Text>
                                <Text style={styles.bulletText}>• Tap "FIND FRIENDS" on Home to find friends and add them to your Top 4</Text>
                                <Text style={styles.bulletText}>• Turn on Push Notifications to stay updated on activity and interactions</Text>
                                <Text style={styles.bulletText}>• Set your rating preference (most important see below)</Text>
                            </View>

                            <View style={styles.instructionStep}>
                                <Text style={styles.stepTitle}>2. SET YOUR RATING PREFERENCE ⭐ (MOST IMPORTANT)</Text>
                                <Text style={styles.bulletText}>• Select your Preferred Rating System</Text>
                                <Text style={styles.bulletText}>• Choose one of the following five options:</Text>
                                <Text style={[styles.bulletText, { paddingLeft: 40 }]}>o 🔟 1–10 (Classic)</Text>
                                <Text style={[styles.bulletText, { paddingLeft: 40 }]}>o 🍕 1–5 Pizza Slices (half slices allowed)</Text>
                                <Text style={[styles.bulletText, { paddingLeft: 40 }]}>o 📊 Percentage (1–100%)</Text>
                                <Text style={[styles.bulletText, { paddingLeft: 40 }]}>o 🏆 Awards Rating (15 categories averaged into one score)</Text>
                                <Text style={[styles.bulletText, { paddingLeft: 40 }]}>o 👍 E&R Variation (Thumbs 1-4)</Text>
                                <Text style={[styles.bulletText, { fontStyle: 'italic', marginTop: 5 }]}>This choice controls how you rate movies across the app.</Text>
                            </View>

                            <View style={styles.instructionStep}>
                                <Text style={styles.stepTitle}>3. PICK YOUR TOP 8 FAVORITE FILMS</Text>
                                <Text style={styles.bulletText}>• Search for movies and add them to your Top 8</Text>
                                <Text style={styles.bulletText}>• Want to swap one out? Just tap the “X” in the top-right corner of a movie to remove it and choose another</Text>
                            </View>

                            <View style={styles.instructionStep}>
                                <Text style={styles.stepTitle}>4. SAVE YOUR CHANGES 💾</Text>
                                <Text style={styles.bulletText}>• When you’re done editing, don’t forget to tap SAVE in the top right corner</Text>
                            </View>

                            <View style={styles.instructionStep}>
                                <Text style={styles.stepTitle}>5. RATE, PLAY & ENJOY 🍿</Text>
                                <Text style={styles.bulletText}>• Start rating movies right away</Text>
                                <Text style={styles.bulletText}>• Use Search to find movies to rate</Text>
                                <Text style={styles.bulletText}>• Play Friendzy, the movie match game that helps you and your friends decide what to watch</Text>
                                <Text style={styles.bulletText}>• Explore What’s Streaming to see where movies are currently available</Text>
                                <Text style={[styles.bulletText, { fontSize: 11, fontStyle: 'italic' }]}>(Note: streaming happens on external apps — this feature helps you decide what to watch)</Text>
                                <Text style={styles.bulletText}>• Join the conversation on Reelz and share your thoughts on what you’re watching</Text>
                            </View>
                        </ScrollView>

                        <TouchableOpacity style={styles.dismissButton} onPress={handleDismissIntro}>
                            <Text style={styles.dismissButtonText}>Never see again</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            <ScrollView>
                {/* --- DASHBOARD HEADER (Split-Level Stack) --- */}
                <View style={{ backgroundColor: '#fff', paddingHorizontal: 15, paddingTop: 15, borderBottomWidth: 1, borderBottomColor: '#eee' }}>
                    
                    {/* ROW 1: PROFILE HERO */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 15 }}>
                            {/* Avatar */}
                            {userProfile?.profilePhoto ? (
                                <Image source={{ uri: userProfile.profilePhoto }} style={styles.avatar} />
                            ) : (
                                <View style={[styles.avatar, styles.placeholderAvatar]}>
                                    <Icon name="user" size={40} color="#fff" />
                                </View>
                            )}

                            {/* User Text Data (Expands natively without squeeze) */}
                            <View style={{ flex: 1, justifyContent: 'center' }}>
                                <Text style={styles.userName} numberOfLines={1}>{userProfile?.name || 'Topo User'}</Text>
                                <Text style={styles.userHandle} numberOfLines={1}>@{userProfile?.username || 'username'}</Text>
                                <Text style={[styles.userLocation, { marginLeft: 0, marginVertical: 3 }]} numberOfLines={1}>
                                    {userProfile?.location || 'Unknown Location'}
                                </Text>
                            </View>
                        </View>

                        {/* Action Buttons: Edit Profile & Rating Style */}
                        <View style={{ alignItems: 'flex-end', justifyContent: 'center', gap: 6 }}>
                            <TouchableOpacity 
                                onPress={() => navigation.navigate('ProfileSettings')}
                                style={{ backgroundColor: '#ff8c00', paddingVertical: 6, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: '#ff8c00' }}
                            >
                                <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 12 }}>Edit Profile</Text>
                            </TouchableOpacity>

                            <TouchableOpacity 
                                onPress={() => setIsRatingModalVisible(true)}
                                style={{ backgroundColor: '#111', paddingVertical: 5, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1.5, borderColor: '#ff8c00', flexDirection: 'row', alignItems: 'center' }}
                            >
                                <Icon name="star" size={11} color="#ff8c00" style={{ marginRight: 4 }} />
                                <Text style={{ color: '#ff8c00', fontWeight: 'bold', fontSize: 11 }}>PICK RATING STYLE</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* ROW 2: DASHBOARD TOOLS (Side-by-side 50/50 Banners) */}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 15, marginBottom: 15 }}>
                        {/* Ticket Wallet Banner */}
                        <TouchableOpacity
                            style={[styles.awardsMiniBanner, { flex: 1, marginRight: 6, borderColor: '#ff8c00', borderWidth: 1 }]}
                            onPress={() => navigation.navigate('TicketWallet')}
                        >
                            <View style={styles.awardsIconContainer}>
                                <Icon name="ticket" size={24} color="#ff8c00" />
                            </View>
                            <Text style={[styles.awardsTitle, { color: '#ff8c00', fontSize: 12 }]}>TICKET WALLET</Text>
                        </TouchableOpacity>

                        {/* Awards Hub Banner */}
                        <TouchableOpacity
                            style={[styles.awardsMiniBanner, { flex: 1, marginLeft: 6 }]}
                            onPress={() => navigation.navigate('AwardsHub')}
                        >
                            <View style={styles.awardsIconContainer}>
                                <Icon name="trophy" size={24} color="#FFD700" />
                            </View>
                            <Text style={[styles.awardsTitle, { fontSize: 12 }]}>AWARDS HUB</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={styles.bioSection}>
                    <Text style={styles.bioText}>{userProfile?.bio || "Welcome to my movie space!"}</Text>



                    {/* Social Stats */}
                    <View style={styles.statsContainer}>
                        <TouchableOpacity
                            style={styles.statItem}
                            onPress={() => navigation.navigate('FollowList', {
                                title: 'Following',
                                userList: userProfile?.following || [],
                                currentUserId: auth.currentUser?.uid
                            })}
                        >
                            <Text style={styles.statNumber}>
                                {userProfile?.following ? new Set(userProfile.following.map(u => u.uid)).size : 0}
                            </Text>
                            <Text style={styles.statLabel}>Following</Text>
                        </TouchableOpacity>

                        <View style={styles.statSeparator} />

                        <TouchableOpacity
                            style={styles.statItem}
                            onPress={() => navigation.navigate('FollowList', {
                                title: 'Followers',
                                userList: userProfile?.followers || [],
                                currentUserId: auth.currentUser?.uid
                            })}
                        >
                            <Text style={styles.statNumber}>
                                {userProfile?.followers ? new Set(userProfile.followers.map(u => u.uid)).size : 0}
                            </Text>
                            <Text style={styles.statLabel}>Followers</Text>
                        </TouchableOpacity>

                        <View style={styles.statSeparator} />

                        <View style={styles.statItem}>
                            <Text style={[styles.statNumber, { color: '#ff8c00' }]}>
                                {userProfile?.theaterPoints || 0}
                            </Text>
                            <Text style={[styles.statLabel, { color: '#ff8c00', fontWeight: 'bold' }]}>Theater Pts</Text>
                        </View>
                    </View>
                </View>

                <View style={styles.separator} />

                {/* --- TOP 4 FRIENDS --- */}
                <View style={styles.sectionContainer}>
                    <View style={styles.sectionHeaderRow}>
                        <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>Top 4 Friends</Text>
                        <TouchableOpacity
                            style={styles.findFriendsBtn}
                            onPress={() => setIsFriendModalVisible(true)}
                        >
                            <Text style={styles.findFriendsBtnText}>FIND FRIENDS</Text>
                        </TouchableOpacity>
                    </View>
                    {/* Use hydratedTopFriends if available, or fallback to userProfile (stale) momentarily */}
                    {(hydratedTopFriends.length > 0 || (userProfile?.topFriends && userProfile.topFriends.length > 0)) ? (
                        <View style={styles.topFriendsContainer}>
                            {(hydratedTopFriends.length > 0 ? hydratedTopFriends : userProfile?.topFriends || []).map((friend, index) => (
                                <TouchableOpacity
                                    key={friend.uid ? `${friend.uid}-${index}` : `tf-${index}`}
                                    style={styles.topFriendItem}
                                    onPress={() => navigation.navigate('PublicProfile', { userId: friend.uid })}
                                >
                                    <Image
                                        source={friend.profilePhoto ? { uri: friend.profilePhoto } : require('../assets/profile_placeholder.jpg')}
                                        style={styles.topFriendImage}
                                    />
                                    <Text style={styles.topFriendName} numberOfLines={1}>{friend.username}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    ) : (
                        <Text style={styles.emptyText}>No Top Friends selected yet.</Text>
                    )}
                </View>

                <View style={styles.separator} />

                {/* --- TOP 8 SECTION --- */}
                <View style={styles.sectionContainer}>
                    <View style={styles.sectionHeaderRow}>
                        <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>My Top 8</Text>
                        <TouchableOpacity
                            style={styles.findFriendsBtn}
                            onPress={() => setIsEditTop8ModalVisible(true)}
                        >
                            <Text style={styles.findFriendsBtnText}>EDIT TOP 8</Text>
                        </TouchableOpacity>
                    </View>
                    {top8.length > 0 ? (
                        <View style={styles.top8Grid}>
                            {top8.map((movie) => (
                                <TouchableOpacity
                                    key={movie.id}
                                    style={styles.top8Item}
                                    onPress={() => navigation.navigate('MovieDetails', { movieId: movie.id, movie: movie })}
                                >
                                    <Image
                                        source={{ uri: `https://image.tmdb.org/t/p/w500${movie.poster_path}` }}
                                        style={styles.top8Image}
                                    />
                                </TouchableOpacity>
                            ))}
                        </View>
                    ) : (
                        <Text style={styles.emptyText}>Add movies to your "Favorites" list to see them here!</Text>
                    )}
                </View>

                <View style={styles.separator} />

                {/* --- RECENT ACTIVITY --- */}
                <View style={styles.sectionContainer}>
                    <Text style={styles.sectionTitle}>Recently Rated</Text>
                    <FlatList
                        horizontal
                        data={recentActivity}
                        renderItem={renderMoviePoster}
                        keyExtractor={(item) => `activity-${item.id}`}
                        showsHorizontalScrollIndicator={false}
                        ListEmptyComponent={<Text style={styles.emptyText}>No recent activity.</Text>}
                    />
                </View>

                <View style={styles.separator} />

                {/* --- RECENTLY WATCHED --- */}
                <View style={styles.sectionContainer}>
                    <Text style={styles.sectionTitle}>Recently Watched</Text>
                    <FlatList
                        horizontal
                        data={recentlyWatched}
                        renderItem={renderMoviePoster}
                        keyExtractor={(item) => `watched-${item.id}`}
                        showsHorizontalScrollIndicator={false}
                        ListEmptyComponent={<Text style={styles.emptyText}>No movies marked as watched.</Text>}
                    />
                </View>

                <View style={styles.separator} />

                {/* --- DISCOVERY / EXPLORE --- */}
                <View style={styles.sectionContainer}>
                    <Text style={styles.sectionTitle}>In Theaters</Text>
                    <FlatList
                        horizontal
                        data={inTheatersMovies}
                        renderItem={renderMoviePoster}
                        keyExtractor={(item) => `theaters-${item.id}`}
                        showsHorizontalScrollIndicator={false}
                    />
                </View>

                {/* Attribution Footer */}
                <View style={styles.attributionContainer}>
                    <Text style={styles.attributionText}>This product uses the TMDB API but is not endorsed or certified by TMDB.</Text>
                </View>

                <View style={{ height: 40 }} />
            </ScrollView>

            {/* Friend Search Modal */}
            <Modal visible={isFriendModalVisible} animationType="slide">
                <SafeAreaView style={styles.searchModalContainer}>
                    <View style={styles.searchHeader}>
                        <TouchableOpacity onPress={() => setIsFriendModalVisible(false)} style={{ paddingRight: 5 }}>
                            <Icon name="arrow-left" size={24} color="#ff8c00" />
                        </TouchableOpacity>
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search users..."
                            placeholderTextColor="#999"
                            value={friendSearchQuery}
                            onChangeText={searchUsers}
                            autoFocus
                        />
                    </View>

                    <FlatList
                        data={friendSearchQuery.length > 0 ? friendSearchResults : Array.from(new Map((userProfile?.following || []).map(f => [f.uid, f])).values())}
                        keyExtractor={(item, index) => item?.uid ? `${item.uid}-${index}` : `user-${index}`}
                        ListHeaderComponent={() => (
                            friendSearchQuery.length === 0 ? (
                                <Text style={{ color: '#aaa', padding: 20, paddingBottom: 10 }}>People you follow:</Text>
                            ) : null
                        )}
                        renderItem={({ item }) => {
                            const following = userProfile?.following || [];
                            const topFriends = userProfile?.topFriends || [];
                            const isFollowing = following.some(f => f.uid === item.uid);
                            const isTop = topFriends.some(f => f.uid === item.uid);
                            return (
                                <View style={styles.friendRow}>
                                    <TouchableOpacity
                                        style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
                                        onPress={() => {
                                            setIsFriendModalVisible(false);
                                            navigation.navigate('PublicProfile', { userId: item.uid });
                                        }}
                                    >
                                        <Image
                                            source={item.profilePhoto ? { uri: item.profilePhoto } : require('../assets/profile_placeholder.jpg')}
                                            style={styles.friendListImg}
                                        />
                                        <Text style={styles.friendListname}>{item.name || item.username}</Text>
                                    </TouchableOpacity>

                                    {/* Follow Button */}
                                    {friendSearchQuery.length > 0 && !isFollowing && (
                                        <TouchableOpacity style={styles.followBtn} onPress={() => followUser(item)}>
                                            <Text style={{ color: '#000', fontWeight: 'bold', fontSize: 12 }}>Follow</Text>
                                        </TouchableOpacity>
                                    )}

                                    {/* Top 4 Button */}
                                    {isFollowing && (
                                        <TouchableOpacity
                                            style={[styles.topFriendBtn, isTop && { backgroundColor: '#ff8c00' }]}
                                            onPress={() => toggleTopFriend(item)}
                                        >
                                            <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>
                                                {isTop ? 'In Top 4' : 'Add Top 4'}
                                            </Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            );
                        }}
                        ListEmptyComponent={() => (
                            friendSearchQuery.length > 0 ? (
                                <Text style={{ color: '#999', padding: 20, textAlign: 'center' }}>No users found.</Text>
                            ) : (
                                <Text style={{ color: '#999', padding: 20, textAlign: 'center' }}>You aren't following anyone yet. Search for users above to follow them!</Text>
                            )
                        )}
                    />
                </SafeAreaView>
            </Modal>

            {/* Edit Top 8 Favorites Modal */}
            <Modal visible={isEditTop8ModalVisible} animationType="slide">
                <SafeAreaView style={styles.searchModalContainer}>
                    <View style={styles.searchHeader}>
                        <TouchableOpacity onPress={() => setIsEditTop8ModalVisible(false)} style={{ paddingRight: 5 }}>
                            <Icon name="arrow-left" size={24} color="#ff8c00" />
                        </TouchableOpacity>
                        <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold', flex: 1 }}>Edit My Top 8 Favorites ({top8.length}/8)</Text>
                    </View>

                    <ScrollView contentContainerStyle={{ padding: 20 }}>
                        <Text style={{ color: '#ff8c00', fontSize: 13, fontWeight: 'bold', marginBottom: 8, letterSpacing: 0.5 }}>SEARCH & ADD MOVIES</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1a2e', borderRadius: 8, paddingHorizontal: 12, marginBottom: 15, borderWidth: 1, borderColor: '#333' }}>
                            <Icon name="search" size={16} color="#888" style={{ marginRight: 10 }} />
                            <TextInput
                                style={{ flex: 1, color: '#fff', height: 44, fontSize: 15 }}
                                placeholder="Search movies to add..."
                                placeholderTextColor="#888"
                                value={movieSearchQuery}
                                onChangeText={searchMovies}
                            />
                            {movieSearchQuery.length > 0 && (
                                <TouchableOpacity onPress={() => searchMovies('')}>
                                    <Icon name="times-circle" size={18} color="#888" />
                                </TouchableOpacity>
                            )}
                        </View>

                        {/* Search Results */}
                        {movieSearchResults.length > 0 && (
                            <View style={{ backgroundColor: '#161625', borderRadius: 8, marginBottom: 20, borderWidth: 1, borderColor: '#333' }}>
                                {movieSearchResults.map(movie => (
                                    <TouchableOpacity
                                        key={movie.id}
                                        style={{ flexDirection: 'row', alignItems: 'center', padding: 10, borderBottomWidth: 1, borderBottomColor: '#222' }}
                                        onPress={() => addTopMovie(movie)}
                                    >
                                        <Image
                                            source={movie.poster_path ? { uri: `https://image.tmdb.org/t/p/w92${movie.poster_path}` } : require('../assets/TOPO_Logo.jpg')}
                                            style={{ width: 35, height: 50, borderRadius: 4, marginRight: 12 }}
                                        />
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 14 }}>{movie.title}</Text>
                                            <Text style={{ color: '#888', fontSize: 12 }}>{movie.release_date ? movie.release_date.split('-')[0] : 'N/A'}</Text>
                                        </View>
                                        <Icon name="plus-circle" size={20} color="#ff8c00" />
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}

                        <Text style={{ color: '#ff8c00', fontSize: 13, fontWeight: 'bold', marginBottom: 5, letterSpacing: 0.5, marginTop: 10 }}>CURRENT TOP 8 FAVORITES</Text>
                        <Text style={{ color: '#aaa', fontSize: 12, marginBottom: 15, fontStyle: 'italic' }}>
                            Tap "X" to remove a movie, or touch & drag any card below to reorder them into your preferred rank.
                        </Text>

                        {top8.length > 0 ? (
                            <View
                                style={styles.top8Grid}
                                onLayout={(e) => {
                                    gridYRef.current = e.nativeEvent.layout.y + 120;
                                }}
                            >
                                {top8.map((movie, index) => (
                                    <View
                                        key={movie.id}
                                        style={[
                                            styles.editTop8Card,
                                            draggingIndex === index && styles.editTop8CardDragging
                                        ]}
                                    >
                                        <View style={styles.editTop8PosterWrapper}>
                                            <Image
                                                source={{ uri: `https://image.tmdb.org/t/p/w500${movie.poster_path}` }}
                                                style={styles.editTop8PosterImage}
                                            />
                                            <View style={styles.rankBadge}>
                                                <Text style={styles.rankBadgeText}>#{index + 1}</Text>
                                            </View>
                                            <TouchableOpacity
                                                style={styles.removeMovieBadgeFixed}
                                                onPress={() => removeTopMovie(movie.id)}
                                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                            >
                                                <Icon name="times" size={12} color="#fff" />
                                            </TouchableOpacity>
                                        </View>

                                        <Text style={styles.editMovieTitle} numberOfLines={1}>{movie.title}</Text>

                                        {/* Grab & Drop Handle Bar */}
                                        <View
                                            style={[styles.grabHandleBar, draggingIndex === index && styles.grabHandleBarActive]}
                                            {...createPanResponder(index).panHandlers}
                                        >
                                            <Icon name="bars" size={12} color={draggingIndex === index ? "#fff" : "#ff8c00"} />
                                            <Text style={[styles.grabHandleText, draggingIndex === index && { color: '#fff' }]}>
                                                {draggingIndex === index ? "HOLD & DRAG" : "GRAB & DROP"}
                                            </Text>
                                        </View>
                                    </View>
                                ))}
                            </View>
                        ) : (
                            <Text style={{ color: '#666', fontStyle: 'italic', textAlign: 'center', marginVertical: 30 }}>
                                No favorite movies selected yet. Search above to add your Top 8!
                            </Text>
                        )}
                    </ScrollView>
                </SafeAreaView>
            </Modal>

            {/* Pick Rating Style Modal */}
            <Modal visible={isRatingModalVisible} animationType="slide" transparent={true}>
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 15 }}>
                    <View style={{ width: '100%', maxHeight: '88%', backgroundColor: '#0a0a1a', borderRadius: 20, padding: 20, borderWidth: 1.5, borderColor: '#ff8c00' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 15, borderBottomWidth: 1, borderBottomColor: '#222', paddingBottom: 12 }}>
                            <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold', fontFamily: 'Trebuchet MS' }}>Pick Your Rating Style 🍿</Text>
                            <TouchableOpacity onPress={() => setIsRatingModalVisible(false)} style={{ padding: 5 }}>
                                <Icon name="times" size={20} color="#888" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView contentContainerStyle={{ paddingBottom: 10 }} showsVerticalScrollIndicator={false}>
                            <Text style={{ color: '#ccc', fontSize: 14, marginBottom: 20, lineHeight: 22, textAlign: 'center', fontStyle: 'italic' }}>
                                TOPO offers multiple ways to rate movies so you can express your opinion exactly how you want. Tap your preferred style below!
                            </Text>

                            {[
                                {
                                    id: '1-10',
                                    title: '1-10 (Classic)',
                                    desc: 'The standard decimal rating. Rate movies on a scale of 1.0 to 10.0 for maximum precision.',
                                    customIcon: (
                                        <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: '#FFC107', justifyContent: 'center', alignItems: 'center' }}>
                                            <Text style={{ color: '#000', fontWeight: 'bold', fontSize: 14 }}>10</Text>
                                        </View>
                                    )
                                },
                                {
                                    id: '1-5',
                                    title: 'Pizza Rating',
                                    desc: 'A fun, casual scale from 1 to 5 slices. Because some movies are just "cheesy" good!',
                                    customIcon: <MaterialIcon name="pizza" size={32} color="#FF5722" />
                                },
                                {
                                    id: 'Percentage',
                                    title: 'Percentage',
                                    desc: 'Rate from 0% to 100%. Perfect if you prefer a Rotten Tomatoes style metric.',
                                    customIcon: <Icon name="percent" size={28} color="#4CAF50" />
                                },
                                {
                                    id: 'Thumbs',
                                    title: 'E&R Variation',
                                    desc: 'A tribute to the legendary Ebert & Roeper. Rate with 0.5 to 4.0 Thumbs Up.',
                                    customIcon: <MaterialIcon name="thumb-up" size={32} color="#4CAF50" />
                                },
                                {
                                    id: 'Awards',
                                    title: 'Awards (Detailed)',
                                    desc: 'For the critics! Rate specific categories like Acting, Directing, and Writing. The overall score is calculated automatically.',
                                    customIcon: <Icon name="trophy" size={30} color="#FFD700" />
                                },
                            ].map((style) => {
                                const isSelected = (ratingMethod === style.id || userProfile?.ratingMethod === style.id || userProfile?.ratingSystem === style.id);
                                return (
                                    <TouchableOpacity
                                        key={style.id}
                                        style={{
                                            flexDirection: 'row',
                                            alignItems: 'flex-start',
                                            backgroundColor: isSelected ? '#1c1c38' : '#121226',
                                            borderRadius: 12,
                                            padding: 15,
                                            marginBottom: 15,
                                            borderWidth: 1.5,
                                            borderColor: isSelected ? '#ff8c00' : '#252545'
                                        }}
                                        onPress={() => handleSelectRatingStyle(style.id)}
                                    >
                                        <View style={{ width: 40, alignItems: 'center', marginRight: 12, paddingTop: 2 }}>
                                            {style.customIcon}
                                        </View>

                                        <View style={{ flex: 1 }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                                                <Text style={{ color: '#ff8c00', fontSize: 17, fontWeight: 'bold' }}>{style.title}</Text>
                                                {isSelected && (
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#ff8c00', paddingVertical: 2, paddingHorizontal: 8, borderRadius: 10 }}>
                                                        <Icon name="check" size={10} color="#fff" style={{ marginRight: 4 }} />
                                                        <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>ACTIVE</Text>
                                                    </View>
                                                )}
                                            </View>
                                            <Text style={{ color: '#ddd', fontSize: 13, lineHeight: 19 }}>{style.desc}</Text>
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>

                        <TouchableOpacity
                            style={{ marginTop: 10, paddingVertical: 12, borderRadius: 10, backgroundColor: '#222', alignItems: 'center', borderWidth: 1, borderColor: '#444' }}
                            onPress={() => setIsRatingModalVisible(false)}
                        >
                            <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 14 }}>Close</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    ratingBadge: {
        position: 'absolute',
        top: 5,
        right: 5,
        backgroundColor: 'rgba(0,0,0,0.8)',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)'
    },
    ratingBadgeText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: 'bold'
    },
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
        paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
    },
    headerContainer: {
        flexDirection: 'row',
        padding: 15,
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottomWidth: 1,
        borderBottomColor: '#eee'
    },
    profileSection: {
        flex: 1,
        marginRight: 10
    },
    avatarRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 5
    },
    avatar: {
        width: 80,
        height: 80,
        borderRadius: 40,
        marginRight: 12
    },
    placeholderAvatar: {
        backgroundColor: '#ccc',
        justifyContent: 'center',
        alignItems: 'center',
    },
    userInfo: {
        flex: 1,
    },
    userName: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
    },
    userHandle: {
        fontSize: 14,
        color: '#666',
        marginBottom: 2,
    },
    userLocation: {
        fontSize: 12,
        color: '#888',
        marginLeft: 4
    },
    editLink: {
        color: '#007AFF',
        fontSize: 12,
        fontWeight: '600',
    },
    awardsMiniBanner: {
        backgroundColor: '#1a1a2e',
        padding: 10,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        width: 90,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
        elevation: 3
    },
    awardsIconContainer: {
        marginBottom: 5
    },
    awardsTitle: {
        color: '#FFD700',
        fontSize: 10,
        fontWeight: 'bold',
        letterSpacing: 1
    },
    awardsSubtitle: {
        color: '#fff',
        fontSize: 8,
        fontWeight: 'bold'
    },
    bioSection: {
        backgroundColor: '#fff',
        paddingHorizontal: 20,
        paddingBottom: 20,
    },
    bioText: {
        fontSize: 15,
        color: '#444',
        fontStyle: 'italic',
    },
    separator: {
        height: 10,
        backgroundColor: '#e0e0e0', // Separator color
    },
    sectionContainer: {
        padding: 20,
        backgroundColor: '#fff',
        borderRadius: 20,
        marginHorizontal: 10,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#C6A87C',
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.15,
        shadowRadius: 4.65,
        elevation: 8,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 15,
        color: '#CC5500', // Brand color?
    },
    // Top 8 Grid Styles
    top8Grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    top8Item: {
        width: (SCREEN_WIDTH - 40 - 24) / 4, // 4 items per row, minus padding and gap
        height: ((SCREEN_WIDTH - 40 - 24) / 4) * 1.5, // Aspect ratio
        marginBottom: 8,
        borderRadius: 4,
        overflow: 'hidden',
    },
    top8Image: {
        width: '100%',
        height: '100%',
    },
    // Horizontal List Styles
    posterItem: {
        marginRight: 12,
    },
    posterImage: {
        width: 100,
        height: 150,
        borderRadius: 8,
    },
    emptyText: {
        color: '#999',
        fontStyle: 'italic',
    },
    // Social Stats
    statsContainer: {
        flexDirection: 'row',
        marginTop: 15,
        paddingTop: 15,
        borderTopWidth: 1,
        borderTopColor: '#eee',
        justifyContent: 'center',
    },
    statItem: {
        marginRight: 20,
        alignItems: 'center',
        flexDirection: 'row',
    },
    statNumber: {
        fontWeight: 'bold',
        fontSize: 16,
        color: '#333',
        marginRight: 5,
    },
    statLabel: {
        color: '#666',
        fontSize: 14,
    },
    statSeparator: {
        width: 1,
        backgroundColor: '#ccc',
        marginRight: 20,
        height: '80%',
    },
    // Top 4 Friends
    topFriendsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between', // Spread evenly
        flexWrap: 'nowrap', // Force one line
    },
    topFriendItem: {
        alignItems: 'center',
        width: '23%', // Fit 4 items perfectly
        marginBottom: 10
    },
    topFriendImage: {
        width: 70,
        height: 70,
        borderRadius: 35,
        marginBottom: 5,
        borderWidth: 2,
        borderColor: '#CC5500', // Brand color border
    },
    topFriendName: {
        fontSize: 12,
        color: '#333',
        fontWeight: '600',
        textAlign: 'center',
    },
    attributionContainer: {
        padding: 20,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: 0.5,
        backgroundColor: '#f5f5f5' // Match container bg
    },
    attributionText: {
        color: '#888',
        fontSize: 12,
        fontStyle: 'italic',
        fontFamily: 'Trebuchet MS', // Consistent font
        textAlign: 'center'
    },
    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'center',
        padding: 20
    },
    modalContent: {
        backgroundColor: '#1a1a2e',
        borderRadius: 20,
        maxHeight: '90%',
        padding: 20,
        borderWidth: 1,
        borderColor: '#ff8c00'
    },
    modalScroll: {
        paddingBottom: 20
    },
    modalTitle: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#ff8c00',
        textAlign: 'center',
        marginBottom: 5
    },
    modalSubtitle: {
        fontSize: 14,
        color: '#ccc',
        textAlign: 'center',
        marginBottom: 20,
        fontStyle: 'italic'
    },
    instructionStep: {
        marginBottom: 20
    },
    stepTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 8,
        textTransform: 'uppercase'
    },
    stepText: {
        fontSize: 14,
        color: '#aaa',
        marginBottom: 4,
        paddingLeft: 10
    },
    bulletText: {
        fontSize: 13,
        color: '#888',
        paddingLeft: 25,
        marginBottom: 2
    },
    dismissButton: {
        backgroundColor: '#ff8c00',
        padding: 15,
        borderRadius: 10,
        alignItems: 'center',
        marginTop: 10
    },
    dismissButtonText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16
    },
    sectionHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 15,
    },
    findFriendsBtn: {
        backgroundColor: '#ff8c00',
        paddingVertical: 6,
        paddingHorizontal: 14,
        borderRadius: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 1.5,
        elevation: 2,
    },
    findFriendsBtnText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 12,
        letterSpacing: 0.5,
    },
    searchModalContainer: {
        flex: 1,
        backgroundColor: '#0a0a1a',
    },
    searchHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#222',
        gap: 15,
    },
    searchInput: {
        flex: 1,
        backgroundColor: '#1a1a2e',
        color: '#fff',
        paddingHorizontal: 15,
        paddingVertical: 10,
        borderRadius: 8,
        fontSize: 16,
    },
    friendRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#1a1a2e',
    },
    friendListImg: {
        width: 44,
        height: 44,
        borderRadius: 22,
        marginRight: 15,
        backgroundColor: '#333',
    },
    friendListname: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '500',
    },
    followBtn: {
        backgroundColor: '#fff',
        paddingVertical: 6,
        paddingHorizontal: 16,
        borderRadius: 15,
    },
    topFriendBtn: {
        backgroundColor: '#444',
        paddingVertical: 6,
        paddingHorizontal: 14,
        borderRadius: 15,
    },
    removeMovieBadge: {
        position: 'absolute',
        top: -6,
        right: -6,
        backgroundColor: '#e50914',
        width: 22,
        height: 22,
        borderRadius: 11,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: '#fff',
    },
    // 2-Column Top 8 Layout (Bigger Posters)
    top8Item2Col: {
        width: '48%',
        height: ((SCREEN_WIDTH - 60) / 2) * 1.48,
        marginBottom: 15,
        borderRadius: 10,
        overflow: 'hidden',
        position: 'relative',
        backgroundColor: '#111',
    },
    top8Image2Col: {
        width: '100%',
        height: '100%',
    },
    rankBadgeHome: {
        position: 'absolute',
        top: 8,
        left: 8,
        backgroundColor: 'rgba(0,0,0,0.75)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#ff8c00',
    },
    rankBadgeHomeText: {
        color: '#ff8c00',
        fontSize: 11,
        fontWeight: 'bold',
    },
    // Edit Modal Top 8 Card & Reorder Controls
    editTop8Card: {
        width: '48%',
        marginBottom: 20,
    },
    editTop8PosterWrapper: {
        width: '100%',
        height: ((SCREEN_WIDTH - 55) / 2) * 1.48,
        borderRadius: 10,
        position: 'relative',
        marginBottom: 6,
    },
    editTop8PosterImage: {
        width: '100%',
        height: '100%',
        borderRadius: 10,
    },
    removeMovieBadgeFixed: {
        position: 'absolute',
        top: -8,
        right: -8,
        backgroundColor: '#e50914',
        width: 24,
        height: 24,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#fff',
        zIndex: 20,
        elevation: 6,
    },
    rankBadge: {
        position: 'absolute',
        top: 8,
        left: 8,
        backgroundColor: 'rgba(0,0,0,0.75)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#ff8c00',
        zIndex: 15,
    },
    rankBadgeText: {
        color: '#ff8c00',
        fontSize: 11,
        fontWeight: 'bold',
    },
    editMovieTitle: {
        color: '#fff',
        fontSize: 13,
        fontWeight: 'bold',
        marginBottom: 6,
        textAlign: 'center',
    },
    editTop8CardDragging: {
        transform: [{ scale: 1.04 }],
        opacity: 0.9,
        zIndex: 50,
        elevation: 8,
    },
    grabHandleBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#1a1a2e',
        borderRadius: 8,
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderWidth: 1,
        borderColor: '#ff8c00',
        gap: 6,
    },
    grabHandleBarActive: {
        backgroundColor: '#ff8c00',
        borderColor: '#fff',
    },
    grabHandleText: {
        color: '#ff8c00',
        fontSize: 11,
        fontWeight: 'bold',
        letterSpacing: 0.5,
    },
});

export default HomeScreen;


