import React, { useState, useEffect, useContext } from 'react';
import { View, Text, StyleSheet, Image, ScrollView, TouchableOpacity, FlatList, ActivityIndicator, ImageBackground, Alert } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db, auth } from '../firebaseConfig';
import Icon from 'react-native-vector-icons/FontAwesome';
import MaterialIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { sendPushNotification, getUserPushToken } from '../services/NotificationService';

import { SafeAreaView } from 'react-native-safe-area-context';
import { MoviesContext } from '../context/MoviesContext';

const PublicProfileScreen = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { userId } = route.params; // The user we want to view

    const [userData, setUserData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isFollowing, setIsFollowing] = useState(false);
    const [hydratedTopFriends, setHydratedTopFriends] = useState([]);
    const { addMovieToList } = useContext(MoviesContext);

    useEffect(() => {
        fetchProfile();
    }, [userId]);

    const fetchProfile = async () => {
        try {
            const userDoc = await getDoc(doc(db, "users", userId));
            if (userDoc.exists()) {
                const data = userDoc.data();
                setUserData(data);

                // Fetch fresh Top 4 data
                if (data.topFriends && data.topFriends.length > 0) {
                    const friendPromises = data.topFriends.map(async (f) => {
                        try {
                            const friendSnap = await getDoc(doc(db, "users", f.uid));
                            if (friendSnap.exists()) {
                                return { ...f, ...friendSnap.data(), uid: f.uid };
                            }
                            return f;
                        } catch (e) {
                            return f;
                        }
                    });
                    const freshFriends = await Promise.all(friendPromises);
                    setHydratedTopFriends(freshFriends);
                } else {
                    setHydratedTopFriends([]);
                }

                // Check if current user follows this user
                if (auth.currentUser) {
                    const currentUserDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
                    if (currentUserDoc.exists()) {
                        const currentUserData = currentUserDoc.data();
                        const following = currentUserData.following || [];
                        setIsFollowing(following.some(f => f.uid === userId));
                    }
                }
            } else {
                Alert.alert("Error", "User not found.");
                navigation.goBack();
            }
        } catch (error) {
            console.error("Error fetching public profile:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleFollowToggle = async () => {
        if (!auth.currentUser) return;

        try {
            const currentUserId = auth.currentUser.uid;
            const targetUserRef = doc(db, "users", userId);
            const currentUserRef = doc(db, "users", currentUserId);

            // Fetch latest data for both
            const [targetSnap, currentUserSnap] = await Promise.all([
                getDoc(targetUserRef),
                getDoc(currentUserRef)
            ]);

            if (!targetSnap.exists() || !currentUserSnap.exists()) return;

            const targetData = targetSnap.data();
            const currentUserData = currentUserSnap.data();

            // Prepare objects
            const targetUserInfo = {
                uid: userId,
                username: targetData.username || 'Unknown',
                profilePhoto: targetData.profilePhoto || null
            };

            const myselfInfo = {
                uid: currentUserId,
                username: currentUserData.username || 'Unknown',
                profilePhoto: currentUserData.profilePhoto || null
            };

            let newFollowing = currentUserData.following || [];
            let newFollowers = targetData.followers || [];
            let isNowFollowing = false;

            if (isFollowing) {
                // UNFOLLOW: Remove by UID to be safe (ignoring stale photo/name data)
                newFollowing = newFollowing.filter(f => f.uid !== userId);
                newFollowers = newFollowers.filter(f => f.uid !== currentUserId);
                isNowFollowing = false;
            } else {
                // FOLLOW: Remove any existing (duplicate cleanup) then add new
                newFollowing = newFollowing.filter(f => f.uid !== userId);
                newFollowing.push(targetUserInfo);

                newFollowers = newFollowers.filter(f => f.uid !== currentUserId);
                newFollowers.push(myselfInfo);
                isNowFollowing = true;
            }

            // Write updates
            await updateDoc(currentUserRef, { following: newFollowing });
            await updateDoc(targetUserRef, { followers: newFollowers });

            setIsFollowing(isNowFollowing);

            // Send Notification only on Follow
            if (isNowFollowing) {
                const token = await getUserPushToken(userId);
                if (token) {
                    await sendPushNotification(
                        token,
                        "New Follower! 🌟",
                        `${myselfInfo.username} started following you.`,
                        { type: 'profile', userId: currentUserId }
                    );
                }
            }
        } catch (error) {
            console.error("Error toggling follow:", error);
            Alert.alert("Error", "Action failed.");
        }
    };

    if (loading) {
        return (
            <View style={[styles.container, styles.center]}>
                <ActivityIndicator size="large" color="#ff8c00" />
            </View>
        );
    }

    if (!userData) return null;

    // Parse similar to HomeScreen
    let top8 = [];
    if (userData.topMovies) {
        if (Array.isArray(userData.topMovies)) top8 = userData.topMovies;
        else try { top8 = JSON.parse(userData.topMovies); } catch (e) { }
    }

    // Recently Watched
    const recentlyWatched = userData.recentlyWatched || [];

    // Watchlist (Find list 2 or Name "Watch Later")
    let watchlistMovies = [];
    if (userData.movieLists) {
        const watchList = userData.movieLists.find(l => l.id === 2 || l.name === "Watch Later");
        if (watchList && watchList.movies) watchlistMovies = watchList.movies;
    }



    const handleAddToWatchLater = (movie) => {
        if (!auth.currentUser) {
            Alert.alert("Login Required", "Please login.");
            return;
        }
        addMovieToList(2, movie);
        Alert.alert("Added", `Added ${movie.title} to Watch Later.`);
    };

    const handleLikeToggle = async (movie) => {
        if (!auth.currentUser) {
            Alert.alert("Login Required", "Please login.");
            return;
        }

        const currentUserId = auth.currentUser.uid;
        const targetUserRef = doc(db, "users", userId);

        try {
            // Transaction or simple update. Simple read-modify-write for now.
            const userSnap = await getDoc(targetUserRef);
            if (!userSnap.exists()) return;

            let data = userSnap.data();
            let currentTopMovies = [];

            if (data.topMovies) {
                if (Array.isArray(data.topMovies)) currentTopMovies = data.topMovies;
                else try { currentTopMovies = JSON.parse(data.topMovies); } catch (e) { }
            }

            // Find movie index
            const index = currentTopMovies.findIndex(m => m.id === movie.id);
            if (index === -1) return; // Should not happen since we clicked it

            let targetMovie = { ...currentTopMovies[index] };
            let likedBy = targetMovie.likedBy || [];

            if (likedBy.includes(currentUserId)) {
                // Unlike
                likedBy = likedBy.filter(uid => uid !== currentUserId);
            } else {
                // Like
                likedBy.push(currentUserId);
            }

            targetMovie.likedBy = likedBy;
            targetMovie.vote_count = likedBy.length; // store count for easy read

            currentTopMovies[index] = targetMovie;

            await updateDoc(targetUserRef, { topMovies: currentTopMovies });

            // Optimistic update local state if needed, but the real-time listener (if we add one) or simple local set would handle it.
            // Since we use fetchProfile() on mount, we might need to manually update local state or re-fetch.
            // Let's manually update local state to reflect change immediately.
            setUserData(prev => {
                let updatedTop = [...top8]; // top8 is derived from userData in render, but userData.topMovies is source
                // Actually top8 variable in render is derived. valid for rendering.
                // We need to update userData.topMovies
                return { ...prev, topMovies: currentTopMovies };
            });

        } catch (error) {
            console.error("Error toggling like:", error);
            Alert.alert("Error", "Could not update like.");
        }
    };

    const renderRatingBadge = (item) => {
        if (!item.userRating && item.userRating !== 0) return null;

        const rating = parseFloat(item.userRating);
        const method = item.ratingMethod; // May need normalization if inconsistent casing

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
        } else if (method === 'Thumbs') {
            displayValue = `${rating.toFixed(1)}`;
            iconName = "thumb-up";
            iconColor = "#4CAF50";
            Component = MaterialIcon;
        } else {
            // Classic 1-10
            displayValue = `${rating.toFixed(1)}`;
            // Custom badge for 10
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
                <Component name={iconName} size={10} color={iconColor} style={{ marginRight: 2 }} />
                <Text style={styles.ratingBadgeText}>{displayValue}</Text>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Icon name="chevron-left" size={24} color="#ff8c00" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{userData.username}'s Space</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                {/* Profile Header (Dashboard Style) */}
                <View style={styles.profileHeader}>
                    <View style={styles.profileImageContainer}>
                        <Image
                            source={userData.profilePhoto ? { uri: userData.profilePhoto } : require('../assets/profile_placeholder.jpg')}
                            style={styles.profileImage}
                        />
                    </View>
                    <View style={styles.profileInfo}>
                        <Text style={styles.name}>{userData.name}</Text>
                        <Text style={styles.location}>{userData.location || "Unknown Location"}</Text>

                        {/* Follow Button */}
                        {auth.currentUser && auth.currentUser.uid !== userId && (
                            <TouchableOpacity
                                style={[styles.followButton, isFollowing ? styles.followingBtn : styles.followBtn]}
                                onPress={handleFollowToggle}
                            >
                                <Icon name={isFollowing ? "check" : "user-plus"} size={14} color={isFollowing ? "black" : "white"} style={{ marginRight: 5 }} />
                                <Text style={[styles.followText, isFollowing && { color: 'black' }]}>
                                    {isFollowing ? "Following" : "Follow"}
                                </Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* Rating Method Badge (Moved Here) */}
                    <View style={styles.ratingBadgeContainerProfile}>
                        <Text style={styles.ratingBadgeTitle}>User Rating Style</Text>
                        {(!userData.ratingMethod || userData.ratingMethod === '1-5') && (
                            <>
                                <MaterialIcon name="pizza" size={40} color="#FF5722" />
                                <Text style={styles.ratingBadgeTextProfile}>(1-5)</Text>
                            </>
                        )}
                        {(userData.ratingMethod === '1-10' || userData.ratingMethod === 'Classic') && (
                            <>
                                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFC107', justifyContent: 'center', alignItems: 'center', marginBottom: 2 }}>
                                    <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#000' }}>10</Text>
                                </View>
                                <Text style={styles.ratingBadgeTextProfile}>(1-10)</Text>
                            </>
                        )}
                        {userData.ratingMethod === 'Percentage' && (
                            <>
                                <Icon name="percent" size={36} color="#4CAF50" />
                                <Text style={styles.ratingBadgeTextProfile}>(%)</Text>
                            </>
                        )}
                        {userData.ratingMethod === 'Awards' && (
                            <>
                                <Icon name="trophy" size={40} color="#FFD700" />
                                <Text style={styles.ratingBadgeTextProfile}>(Awards)</Text>
                            </>
                        )}
                        {userData.ratingMethod === 'Thumbs' && (
                            <>
                                <MaterialIcon name="thumb-up" size={40} color="#4CAF50" />
                                <Text style={styles.ratingBadgeTextProfile}>(E&R Variation)</Text>
                            </>
                        )}
                    </View>
                </View>

                <View style={styles.bioSection}>
                    <Text style={styles.bio}>{userData.bio || "No bio yet."}</Text>

                    {/* Stats Container */}
                    {/* Stats Container */}
                    <View style={styles.statsContainer}>
                        <TouchableOpacity
                            style={styles.statItem}
                            onPress={() => navigation.navigate('FollowList', {
                                title: `${userData.username}'s Following`,
                                userList: userData.following || [],
                                currentUserId: auth.currentUser?.uid,
                                isOwnFollowers: false
                            })}
                        >
                            <Text style={styles.statNumber}>{userData.following?.length || 0}</Text>
                            <Text style={styles.statLabel}>Following</Text>
                        </TouchableOpacity>
                        <View style={styles.statSeparator} />
                        <TouchableOpacity
                            style={styles.statItem}
                            onPress={() => navigation.navigate('FollowList', {
                                title: `${userData.username}'s Followers`,
                                userList: userData.followers || [],
                                currentUserId: auth.currentUser?.uid,
                                isOwnFollowers: false
                            })}
                        >
                            <Text style={styles.statNumber}>{userData.followers?.length || 0}</Text>
                            <Text style={styles.statLabel}>Followers</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={styles.separator} />

                {/* Top 4 Friends */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Top 4 Friends</Text>
                    {(hydratedTopFriends.length > 0 || (userData.topFriends && userData.topFriends.length > 0)) ? (
                        <View style={styles.topFriendsContainer}>
                            {(hydratedTopFriends.length > 0 ? hydratedTopFriends : userData.topFriends).map((friend) => (
                                <TouchableOpacity
                                    key={friend.uid}
                                    style={styles.topFriendItem}
                                    onPress={() => navigation.push('PublicProfile', { userId: friend.uid })}
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
                        <Text style={styles.emptyText}>No Top Friends selected.</Text>
                    )}
                </View>

                <View style={styles.separator} />

                {/* Top 8 Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>{userData.username}'s Top 8</Text>
                    {top8.length > 0 ? (
                        <View style={styles.top8Grid}>
                            {top8.map((item) => {
                                const likedBy = item.likedBy || [];
                                const isLiked = auth.currentUser && likedBy.includes(auth.currentUser.uid);
                                const likeCount = likedBy.length;

                                return (
                                    <View key={item.id} style={styles.top8ItemContainer}>
                                        <TouchableOpacity
                                            style={styles.top8Item}
                                            onPress={() => navigation.navigate('MovieDetails', { movieId: item.id })}
                                        >
                                            <Image
                                                source={{ uri: `https://image.tmdb.org/t/p/w200${item.poster_path}` }}
                                                style={styles.top8Image}
                                            />
                                        </TouchableOpacity>

                                        {/* Actions Row */}
                                        <View style={styles.actionButtonsRow}>
                                            <TouchableOpacity
                                                style={[styles.miniButton, isLiked && styles.miniButtonActive]}
                                                onPress={() => handleLikeToggle(item)}
                                            >
                                                <Icon name="heart" size={10} color={isLiked ? "white" : "#e50914"} />
                                                <Text style={[styles.miniButtonText, isLiked && { color: 'white' }]}>
                                                    {likeCount > 0 ? likeCount : ''}
                                                </Text>
                                            </TouchableOpacity>

                                            <TouchableOpacity
                                                style={[styles.miniButton, { backgroundColor: '#4682b4', marginLeft: 5 }]}
                                                onPress={() => handleAddToWatchLater(item)}
                                            >
                                                <Icon name="clock-o" size={10} color="white" />
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                );
                            })}
                        </View>
                    ) : (
                        <Text style={styles.emptyText}>No Top movies selected yet.</Text>
                    )}
                </View>

                <View style={styles.separator} />

                {/* Recent Activity Section (NEW) */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Recently Rated</Text>
                    {(userData.recentActivity && userData.recentActivity.length > 0) ? (
                        <FlatList
                            horizontal
                            data={userData.recentActivity}
                            keyExtractor={(item, index) => `activity-${item.id}-${index}`}
                            showsHorizontalScrollIndicator={false}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={styles.posterItem}
                                    onPress={() => navigation.navigate('MovieDetails', { movieId: item.id })}
                                >
                                    <Image
                                        source={{ uri: `https://image.tmdb.org/t/p/w200${item.poster_path}` }}
                                        style={styles.posterImage}
                                    />
                                    {renderRatingBadge(item)}
                                </TouchableOpacity>
                            )}
                        />
                    ) : (
                        <Text style={styles.emptyText}>No recent interactions.</Text>
                    )}
                </View>

                {/* Recently Watched */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Recently Watched</Text>
                    {recentlyWatched.length > 0 ? (
                        <FlatList
                            horizontal
                            data={recentlyWatched}
                            keyExtractor={(item, index) => `recent-${item.id}-${index}`}
                            showsHorizontalScrollIndicator={false}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={styles.posterItem}
                                    onPress={() => navigation.navigate('MovieDetails', { movieId: item.id })}
                                >
                                    <Image
                                        source={{ uri: `https://image.tmdb.org/t/p/w200${item.poster_path}` }}
                                        style={styles.posterImage}
                                    />
                                    {renderRatingBadge(item)}
                                </TouchableOpacity>
                            )}
                        />
                    ) : (
                        <Text style={styles.emptyText}>No recent activity.</Text>
                    )}
                </View>

                <View style={styles.separator} />

                {/* Watchlist */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Watchlist</Text>
                    {watchlistMovies.length > 0 ? (
                        <FlatList
                            horizontal
                            data={watchlistMovies}
                            keyExtractor={item => `watchlist-${item.id}`}
                            showsHorizontalScrollIndicator={false}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={styles.posterItem}
                                    onPress={() => navigation.navigate('MovieDetails', { movieId: item.id })}
                                >
                                    <Image
                                        source={{ uri: `https://image.tmdb.org/t/p/w200${item.poster_path}` }}
                                        style={styles.posterImage}
                                    />
                                </TouchableOpacity>
                            )}
                        />
                    ) : (
                        <Text style={styles.emptyText}>Empty Watchlist.</Text>
                    )}
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
        backgroundColor: '#0a0a1a', // Dark Theme
    },
    center: {
        justifyContent: 'center',
        alignItems: 'center'
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 15,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#333'
    },
    headerTitle: {
        color: '#ff8c00',
        fontSize: 18, // Slightly smaller to fit
        fontWeight: 'bold',
        fontFamily: 'Trebuchet MS',
    },
    ratingBadgeContainerProfile: {
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 90,
        marginLeft: 10
    },
    ratingBadgeTitle: {
        color: '#ff8c00',
        fontSize: 12,
        fontWeight: 'bold',
        marginBottom: 6,
        textAlign: 'center'
    },
    ratingBadgeTextProfile: {
        color: '#888',
        fontSize: 12,
        marginTop: 4,
        fontWeight: 'bold'
    },
    scrollContent: {
        padding: 0 // Reset padding for full width sections? No, let's keep sections padded individually or use container padding? 
        // Previously padding: 20
        // New design has separators and full width feels. Let's use padding in sections.
    },
    profileHeader: {
        flexDirection: 'row',
        padding: 20,
        alignItems: 'center',
    },
    profileImageContainer: {
        marginRight: 20
    },
    profileImage: {
        width: 90,
        height: 90,
        borderRadius: 45,
        borderWidth: 2,
        borderColor: '#ff8c00'
    },
    profileInfo: {
        flex: 1,
    },
    name: {
        color: 'white',
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 5
    },
    location: {
        color: '#888',
        fontSize: 14,
        marginBottom: 10
    },
    bioSection: {
        paddingHorizontal: 20,
        paddingBottom: 20
    },
    bio: {
        color: '#ccc',
        fontSize: 14,
        fontStyle: 'italic',
        lineHeight: 20,
        marginBottom: 20,
    },
    followButton: {
        flexDirection: 'row',
        alignSelf: 'flex-start',
        paddingHorizontal: 15,
        paddingVertical: 6,
        borderRadius: 20,
        alignItems: 'center',
        marginTop: 5
    },
    followBtn: {
        backgroundColor: '#ff8c00',
    },
    followingBtn: {
        backgroundColor: '#ccc',
    },
    followText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 14
    },
    statsContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        paddingVertical: 10,
        borderTopWidth: 1,
        borderTopColor: '#333',
        marginTop: 10
    },
    statItem: {
        alignItems: 'center',
        paddingHorizontal: 30
    },
    statNumber: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold'
    },
    statLabel: {
        color: '#888',
        fontSize: 12,
        textTransform: 'uppercase'
    },
    statSeparator: {
        width: 1,
        backgroundColor: '#333',
        height: '100%'
    },
    separator: {
        height: 8,
        backgroundColor: '#161625'
    },
    // Sections
    section: {
        padding: 20,
    },
    sectionTitle: {
        color: '#ff8c00',
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 15,
    },
    // Top 8
    top8Grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    top8ItemContainer: {
        width: '23%',
        marginBottom: 15,
        alignItems: 'center'
    },
    top8Item: {
        width: '100%',
        aspectRatio: 2 / 3,
        marginBottom: 5
    },
    top8Image: {
        width: '100%',
        height: '100%',
        borderRadius: 5,
        borderWidth: 1,
        borderColor: '#333'
    },
    actionButtonsRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%'
    },
    miniButton: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255,255,255,0.1)',
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#e50914'
    },
    miniButtonActive: {
        backgroundColor: '#e50914',
    },
    miniButtonText: {
        color: '#e50914',
        fontSize: 10,
        fontWeight: 'bold',
        marginLeft: 3
    },
    emptyText: {
        color: '#666',
        fontStyle: 'italic'
    },
    // Top Friends
    topFriendsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        flexWrap: 'nowrap',
    },
    topFriendItem: {
        alignItems: 'center',
        width: '23%', // Ensures 4 items fit perfectly (4x23 = 92% + gap)
        marginBottom: 10
    },
    topFriendImage: {
        width: 60,
        height: 60,
        borderRadius: 30,
        marginBottom: 5,
        borderWidth: 2,
        borderColor: '#ff8c00'
    },
    topFriendName: {
        color: '#ccc',
        fontSize: 12,
        textAlign: 'center'
    },
    // Horizontal Lists
    posterItem: {
        marginRight: 10,
        width: 100
    },
    posterImage: {
        width: 100,
        height: 150,
        borderRadius: 5,
        borderWidth: 1,
        borderColor: '#333'
    },
    attributionContainer: {
        padding: 20,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: 0.5,
        backgroundColor: '#0a0a1a'
    },
    attributionText: {
        color: '#888',
        fontSize: 12,
        fontStyle: 'italic',
        fontFamily: 'Trebuchet MS',
        textAlign: 'center'
    },
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
    }

});

export default PublicProfileScreen;
