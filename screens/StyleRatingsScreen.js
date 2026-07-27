import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Image, ActivityIndicator } from 'react-native';
import { collection, getDocs, getDoc, doc, query, where, documentId } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import Icon from 'react-native-vector-icons/FontAwesome';
import MaterialIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { SafeAreaView } from 'react-native-safe-area-context';

const StyleRatingsScreen = ({ route, navigation }) => {
    const { movieId, movieTitle, posterPath, ratingStyle, averageScore, ratingCount } = route.params;

    const [ratings, setRatings] = useState([]);
    const [loading, setLoading] = useState(true);

    const getStyleLabel = () => {
        switch (ratingStyle) {
            case 'classic': return 'Classic Ratings';
            case 'pizza': return 'Pizza Ratings';
            case 'percentage': return 'Percentage Ratings';
            case 'awards': return 'Awards Ratings';
            case 'thumbs': return 'Thumbs Ratings';
            default: return 'User Ratings';
        }
    };

    useEffect(() => {
        const fetchRatingsAndUsers = async () => {
            try {
                setLoading(true);
                // 1. Fetch ratings matching the style for the movie
                const ratingsRef = collection(db, "movies", movieId.toString(), "user_ratings");
                const q = query(ratingsRef, where("type", "==", ratingStyle));
                const querySnapshot = await getDocs(q);

                const rawRatings = [];
                querySnapshot.forEach(docSnap => {
                    rawRatings.push({ id: docSnap.id, ...docSnap.data() });
                });

                // Sort by score descending
                rawRatings.sort((a, b) => b.score - a.score);

                // 2. Identify user profiles to fetch (users whose info is not in the rating doc)
                const userMap = {};
                const userIdsToFetch = [];

                rawRatings.forEach(rating => {
                    if (rating.username && rating.profilePhoto !== undefined) {
                        // Profile is already cached in the rating doc
                        userMap[rating.userId] = {
                            username: rating.username,
                            profilePhoto: rating.profilePhoto
                        };
                    } else {
                        // Historical rating, need to fetch
                        userIdsToFetch.push(rating.userId);
                    }
                });

                // Filter unique UIDs
                const uniqueUserIdsToFetch = [...new Set(userIdsToFetch)];

                // Fetch in chunks of 30 to reduce network round-trips from N queries to ceil(N/30) queries
                if (uniqueUserIdsToFetch.length > 0) {
                    const chunks = [];
                    for (let i = 0; i < uniqueUserIdsToFetch.length; i += 30) {
                        chunks.push(uniqueUserIdsToFetch.slice(i, i + 30));
                    }

                    await Promise.all(chunks.map(async (chunk) => {
                        try {
                            const usersRef = collection(db, "users");
                            const usersQuery = query(usersRef, where(documentId(), "in", chunk));
                            const usersSnapshot = await getDocs(usersQuery);
                            usersSnapshot.forEach(userSnap => {
                                userMap[userSnap.id] = userSnap.data();
                            });
                        } catch (e) {
                            console.error("Error fetching user chunk:", e);
                        }
                    }));
                }

                // 3. Hydrate ratings list
                const hydratedRatings = rawRatings.map(rating => {
                    const uData = userMap[rating.userId];
                    return {
                        ...rating,
                        username: uData?.username || rating.username || 'Unknown User',
                        profilePhoto: uData?.profilePhoto || rating.profilePhoto || null
                    };
                });

                setRatings(hydratedRatings);
            } catch (error) {
                console.error("Error loading style ratings:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchRatingsAndUsers();
    }, [movieId, ratingStyle]);

    const renderRatingValue = (score) => {
        let displayValue = "";
        let iconName = "";
        let iconColor = "";
        let Component = null;

        if (ratingStyle === 'percentage') {
            displayValue = `${score.toFixed(0)}%`;
            iconName = "percent";
            iconColor = "#4CAF50";
            Component = Icon;
        } else if (ratingStyle === 'pizza') {
            displayValue = `${score.toFixed(1)}/5`;
            iconName = "pizza";
            iconColor = "#FF5722";
            Component = MaterialIcon;
        } else if (ratingStyle === 'awards') {
            displayValue = `${score.toFixed(1)}/10`;
            iconName = "trophy";
            iconColor = "#FFD700";
            Component = Icon;
        } else if (ratingStyle === 'thumbs') {
            displayValue = `${score.toFixed(1)}/4`;
            iconName = "thumb-up";
            iconColor = "#4CAF50";
            Component = MaterialIcon;
        } else {
            // Classic
            displayValue = `${score.toFixed(1)}/10`;
            return (
                <View style={styles.userRatingBadge}>
                    <View style={styles.classicBadge}>
                        <Text style={styles.classicBadgeText}>10</Text>
                    </View>
                    <Text style={styles.userRatingText}>{displayValue}</Text>
                </View>
            );
        }

        return (
            <View style={styles.userRatingBadge}>
                <Component name={iconName} size={16} color={iconColor} style={{ marginRight: 5 }} />
                <Text style={styles.userRatingText}>{displayValue}</Text>
            </View>
        );
    };

    const posterUrl = posterPath 
        ? `https://image.tmdb.org/t/p/w200${posterPath}` 
        : 'https://via.placeholder.com/150';

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Custom Header Bar with Poster & Title & Avg Score */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Icon name="arrow-left" size={24} color="#ff8c00" />
                </TouchableOpacity>

                <View style={styles.headerMovieInfo}>
                    <Image source={{ uri: posterUrl }} style={styles.headerPoster} resizeMode="cover" />
                    <View style={styles.headerTextContainer}>
                        <Text style={styles.headerTitle} numberOfLines={1}>{movieTitle}</Text>
                        <Text style={styles.headerSubtitle}>{getStyleLabel()}</Text>
                    </View>
                </View>

                <View style={styles.headerScoreContainer}>
                    <Text style={styles.avgLabel}>Avg Score</Text>
                    <Text style={styles.avgScoreText}>{averageScore}</Text>
                </View>
            </View>

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color="#ff8c00" />
                </View>
            ) : (
                <FlatList
                    data={ratings}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => (
                        <View style={styles.userRow}>
                            <TouchableOpacity
                                style={styles.userInfoBtn}
                                onPress={() => navigation.push('PublicProfile', { userId: item.userId })}
                            >
                                <Image
                                    source={item.profilePhoto ? { uri: item.profilePhoto } : require('../assets/profile_placeholder.jpg')}
                                    style={styles.avatar}
                                />
                                <Text style={styles.username}>{item.username}</Text>
                            </TouchableOpacity>

                            <View style={styles.ratingContainer}>
                                {renderRatingValue(item.score)}
                            </View>
                        </View>
                    )}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyText}>No users have rated this style yet.</Text>
                        </View>
                    }
                    contentContainerStyle={styles.listContent}
                />
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0a0a1a', // Sleek dark mode
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 15,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#222',
        backgroundColor: '#111122',
    },
    backButton: {
        padding: 5,
    },
    headerMovieInfo: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        marginLeft: 10,
        marginRight: 10,
    },
    headerPoster: {
        width: 36,
        height: 54,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: '#333',
    },
    headerTextContainer: {
        marginLeft: 10,
        flex: 1,
        justifyContent: 'center',
    },
    headerTitle: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
        fontFamily: 'Trebuchet MS',
    },
    headerSubtitle: {
        color: '#ff8c00',
        fontSize: 12,
        fontWeight: '600',
        marginTop: 2,
    },
    headerScoreContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#1b1b36',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#334',
        minWidth: 75,
    },
    avgLabel: {
        color: '#888',
        fontSize: 9,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    avgScoreText: {
        color: '#00FFFF', // High quality cyan for metric highlight
        fontSize: 13,
        fontWeight: 'bold',
        marginTop: 1,
    },
    listContent: {
        paddingHorizontal: 15,
        paddingTop: 10,
        paddingBottom: 30,
    },
    userRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#1e1e35',
    },
    userInfoBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        marginRight: 10,
    },
    avatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        borderWidth: 1.5,
        borderColor: '#ff8c00', // Gold/orange border for premium profile feel
    },
    username: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
        marginLeft: 12,
    },
    ratingContainer: {
        justifyContent: 'center',
        alignItems: 'flex-end',
    },
    userRatingBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#16162d',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#2e2e4f',
    },
    userRatingText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: 'bold',
    },
    classicBadge: {
        width: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: '#FFC107',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 5,
    },
    classicBadgeText: {
        fontSize: 9,
        fontWeight: 'bold',
        color: '#000',
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
    },
    emptyText: {
        color: '#555',
        fontSize: 15,
        fontStyle: 'italic',
    },
});

export default StyleRatingsScreen;
