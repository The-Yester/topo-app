import React, { useState, useContext, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Image, ScrollView, Dimensions, SafeAreaView, Platform, StatusBar } from 'react-native';
import { MoviesContext } from '../context/MoviesContext';
import Icon from 'react-native-vector-icons/FontAwesome';
import { useNavigation } from '@react-navigation/native';
import { auth, db } from '../firebaseConfig';
import { doc, onSnapshot } from 'firebase/firestore';
import { getMovieDetails } from '../api/MovieService'; // Ensure we have this
import { TMDB_API_KEY } from '../utils/config';

const SCREEN_WIDTH = Dimensions.get('window').width;

const HomeScreen = () => {
    const { getMoviesInList, recentlyWatched } = useContext(MoviesContext);
    const navigation = useNavigation();

    const [userProfile, setUserProfile] = useState(null);
    const [inTheatersMovies, setInTheatersMovies] = useState([]);

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

    // Load Profile Data Real-time
    useEffect(() => {
        const user = auth.currentUser;
        if (!user) return;

        const unsub = onSnapshot(doc(db, "users", user.uid), (docSnap) => {
            if (docSnap.exists()) {
                setUserProfile(docSnap.data());
            }
        });
        return () => unsub();
    }, []);

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

    const renderMoviePoster = ({ item }) => {
        const imageUrl = item.poster_path
            ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
            : 'https://via.placeholder.com/150';

        return (
            <TouchableOpacity
                style={styles.posterItem}
                onPress={() => navigation.navigate('MovieDetails', { movieId: item.id })}
            >
                <Image source={{ uri: imageUrl }} style={styles.posterImage} />
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView>
                {/* --- DASHBOARD HEADER (Side-by-Side) --- */}
                <View style={styles.headerContainer}>
                    {/* LEFT: Profile Info */}
                    <View style={styles.profileSection}>
                        <View style={styles.avatarRow}>
                            {userProfile?.profilePhoto ? (
                                <Image source={{ uri: userProfile.profilePhoto }} style={styles.avatar} />
                            ) : (
                                <View style={[styles.avatar, styles.placeholderAvatar]}>
                                    <Icon name="user" size={30} color="#fff" />
                                </View>
                            )}
                            <View style={styles.userInfo}>
                                <Text style={styles.userName} numberOfLines={1}>{userProfile?.name || 'Topo User'}</Text>
                                <Text style={styles.userHandle}>@{userProfile?.username || 'username'}</Text>
                                <TouchableOpacity onPress={() => navigation.navigate('ProfileSettings')}>
                                    <Text style={styles.editLink}>Edit Profile</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                        <Text style={styles.userLocation}>{userProfile?.location || 'Unknown Location'}</Text>
                    </View>

                    {/* RIGHT: Awards Hub Banner (Mini) */}
                    <TouchableOpacity
                        style={styles.awardsMiniBanner}
                        onPress={() => navigation.navigate('AwardsHub')}
                    >
                        <View style={styles.awardsIconContainer}>
                            <Icon name="trophy" size={24} color="#FFD700" />
                        </View>
                        <Text style={styles.awardsTitle}>AWARDS</Text>
                        <Text style={styles.awardsSubtitle}>SEASON HUB</Text>
                    </TouchableOpacity>
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
                            <Text style={styles.statNumber}>{userProfile?.following?.length || 0}</Text>
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
                            <Text style={styles.statNumber}>{userProfile?.followers?.length || 0}</Text>
                            <Text style={styles.statLabel}>Followers</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={styles.separator} />

                {/* --- TOP 4 FRIENDS --- */}
                <View style={styles.sectionContainer}>
                    <Text style={styles.sectionTitle}>Top 4 Friends</Text>
                    {(userProfile?.topFriends && userProfile.topFriends.length > 0) ? (
                        <View style={styles.topFriendsContainer}>
                            {userProfile.topFriends.map((friend) => (
                                <TouchableOpacity
                                    key={friend.uid}
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
                    <Text style={styles.sectionTitle}>My Top 8</Text>
                    {top8.length > 0 ? (
                        <View style={styles.top8Grid}>
                            {top8.map((movie) => (
                                <TouchableOpacity
                                    key={movie.id}
                                    style={styles.top8Item}
                                    onPress={() => navigation.navigate('MovieDetails', { movieId: movie.id })}
                                >
                                    <Image
                                        source={{ uri: `https://image.tmdb.org/t/p/w500${movie.poster_path}` }}
                                        style={styles.top8Image}
                                    />
                                </TouchableOpacity>
                            ))}
                            {/* Fills empty spots if less than 8? Optional */}
                        </View>
                    ) : (
                        <Text style={styles.emptyText}>Add movies to your "Favorites" list to see them here!</Text>
                    )}
                </View>

                <View style={styles.separator} />

                {/* --- RECENT ACTIVITY --- */}
                <View style={styles.sectionContainer}>
                    <Text style={styles.sectionTitle}>Recent Activity</Text>
                    <FlatList
                        horizontal
                        data={recentlyWatched}
                        renderItem={renderMoviePoster}
                        keyExtractor={(item) => `recent-${item.id}`}
                        showsHorizontalScrollIndicator={false}
                        ListEmptyComponent={<Text style={styles.emptyText}>No recent activity.</Text>}
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
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
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
        width: 60,
        height: 60,
        borderRadius: 30,
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
        justifyContent: 'flex-start',
    },
    topFriendItem: {
        alignItems: 'center',
        marginRight: 20,
        width: 70,
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
    }
});

export default HomeScreen;




