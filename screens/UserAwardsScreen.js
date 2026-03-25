import React, { useState, useEffect, useContext } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, Image, TouchableOpacity, ActivityIndicator, Alert, Platform, StatusBar } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/FontAwesome';
import { fetchActiveAwardsEvents, fetchUserBallot } from '../api/AwardsService';
import { auth, db } from '../firebaseConfig';
import { collection, getDocs } from 'firebase/firestore';

const UserAwardsScreen = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { userId, username } = route.params;

    const [loading, setLoading] = useState(true);
    const [allEvents, setAllEvents] = useState([]);
    const [event, setEvent] = useState(null); // Currently selected event
    const [userRatings, setUserRatings] = useState({}); // { movieId: { score, breakdown: {} } }
    const [userBallot, setUserBallot] = useState({}); // { categoryId: nomineeTmdbId }
    const [pickingProgress, setPickingProgress] = useState({ picked: 0, total: 0, correct: 0, decided: 0 });

    useEffect(() => {
        loadData();
    }, []);

    // Reload ballot when event changes
    useEffect(() => {
        if (event && userId) {
            loadBallot(event.id);
        }
    }, [event, userId]);

    // Calculate picks progress natively instead of on locked arrays
    useEffect(() => {
        if (!event) return;
        let picked = Object.keys(userBallot).length;
        let total = event.categories.length;

        let correct = 0;
        let decided = 0;
        event.categories.forEach(cat => {
            const winnerTmdbIds = getWinnerTmdbIds(cat);
            if (winnerTmdbIds.length > 0) {
                decided++;
                const pickTmdbId = getActualTmdbId(cat, userBallot[cat.id]);
                if (winnerTmdbIds.includes(pickTmdbId)) correct++;
            }
        });

        setPickingProgress({ picked, total, correct, decided });
    }, [event, userBallot]);


    const loadData = async () => {
        setLoading(true);
        try {
            // 1. Fetch All Active Events
            const events = await fetchActiveAwardsEvents();
            if (events.length > 0) {
                setAllEvents(events);
                setEvent(events[0]);
            } else {
                setAllEvents([]);
                setEvent(null);
            }

            // 2. Fetch Target User's Ratings (All) to display on cards
            const ratingsRef = collection(db, "users", userId, "ratings");
            const snapshot = await getDocs(ratingsRef);
            const ratingsMap = {};
            snapshot.forEach(doc => {
                ratingsMap[doc.id] = doc.data();
            });
            setUserRatings(ratingsMap);

        } catch (error) {
            console.error("Awards Hub Load Error:", error);
            Alert.alert("Error", "Failed to load Awards Data");
        } finally {
            setLoading(false);
        }
    };

    const loadBallot = async (eventId) => {
        const ballot = await fetchUserBallot(userId, eventId);
        setUserBallot(ballot || {});
    };

    const getActualTmdbId = (category, anyId) => {
        if (!anyId) return null;
        const obj = category.nominees?.find(n => (n.id || n.tmdbId) === anyId);
        return obj ? obj.tmdbId : anyId;
    };

    const getWinnerTmdbIds = (category) => {
        let winners = category.winnerIds || [];
        if (!category.winnerIds && (category.winnerId || category.winnerTmdbId)) {
            winners = [category.winnerId || category.winnerTmdbId];
        }
        return winners.map(wId => getActualTmdbId(category, wId)).filter(Boolean);
    };

    if (loading) {
        return (
            <SafeAreaView style={[styles.container, styles.centered]}>
                <ActivityIndicator size="large" color="#FFD700" />
            </SafeAreaView>
        );
    }

    if (!event) {
        return (
            <SafeAreaView style={[styles.container, styles.centered]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Icon name="chevron-left" size={24} color="#ff8c00" />
                </TouchableOpacity>
                <Icon name="film" size={50} color="#555" />
                <Text style={styles.emptyText}>No Active Awards Events Found.</Text>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            {/* Dark Top Header Area */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Icon name="chevron-left" size={24} color="#ff8c00" />
                </TouchableOpacity>
                <View style={styles.headerTitleContainer}>
                    <Text style={styles.headerTitle}>{username}'s Picks</Text>
                    <Text style={styles.headerSubtitle}>Prediction Ballot</Text>
                </View>
                <View style={{ width: 40 }} />
            </View>

            {/* Event Tabs */}
            {allEvents.length > 1 && (
                <View style={styles.eventTabsContainer}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.eventTabsScroll}>
                        {allEvents.map(e => (
                            <TouchableOpacity
                                key={e.id}
                                style={[styles.eventTab, event.id === e.id && styles.eventTabActive]}
                                onPress={() => setEvent(e)}
                            >
                                <Text style={[styles.eventTabText, event.id === e.id && styles.eventTabTextActive]}>
                                    {e.name}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            )}

            <ScrollView contentContainerStyle={styles.scrollContent}>
                {/* Status Bar */}
                <View style={[styles.statusBar, { backgroundColor: '#333' }]}>
                    <View style={styles.statusRow}>
                        <View style={styles.statusStat}>
                            <Text style={styles.statusValue}>{pickingProgress.picked}/{pickingProgress.total}</Text>
                            <Text style={styles.statusLabel}>Picks Predicted</Text>
                        </View>
                        {pickingProgress.decided > 0 && (
                            <View style={styles.statusStat}>
                                <Text style={[styles.statusValue, { color: '#4CAF50' }]}>{pickingProgress.correct}/{pickingProgress.decided}</Text>
                                <Text style={styles.statusLabel}>Correct Picks</Text>
                            </View>
                        )}
                    </View>
                </View>

                {/* Categories */}
                {event.categories.map((category) => {
                    const myPickId = userBallot[category.id];
                    const winnerTmdbIds = getWinnerTmdbIds(category);
                    const hasWinner = winnerTmdbIds.length > 0;

                    let isPickCorrect = false;
                    if (myPickId && hasWinner) {
                        const myPickTmdbId = getActualTmdbId(category, myPickId);
                        isPickCorrect = winnerTmdbIds.includes(myPickTmdbId);
                    }

                    return (
                        <View key={category.id} style={styles.categoryCard}>
                            <View style={styles.categoryHeader}>
                                <Text style={styles.categoryTitle}>{category.name}</Text>
                                {hasWinner && myPickId && (
                                    <View style={[styles.resultBadge, isPickCorrect ? styles.resultBadgeCorrect : styles.resultBadgeWrong]}>
                                        <Text style={styles.resultText}>{isPickCorrect ? "CORRECT" : "MISSED"}</Text>
                                    </View>
                                )}
                            </View>

                            {/* Horizontal Scroll of Nominees */}
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.nomineeScroll}>
                                {category.nominees.map((nominee) => {
                                    const rating = userRatings[nominee.tmdbId.toString()];
                                    const specificScore = rating?.breakdown?.[category.awardsRatingKey];
                                    const identifier = nominee.id || nominee.tmdbId;
                                    const isMyLockedPick = myPickId === identifier || myPickId === nominee.tmdbId;
                                    
                                    let currentWinners = category.winnerIds || [];
                                    if (!category.winnerIds && (category.winnerId || category.winnerTmdbId)) {
                                        currentWinners = [category.winnerId || category.winnerTmdbId];
                                    }
                                    const isActualWinner = currentWinners.includes(identifier) || currentWinners.includes(nominee.tmdbId);

                                    return (
                                        <TouchableOpacity
                                            key={identifier}
                                            style={[
                                                styles.nomineeCard,
                                                isMyLockedPick && styles.lockedCard,
                                                isActualWinner && styles.actualWinnerBorder
                                            ]}
                                            activeOpacity={1}
                                        >
                                            <Image
                                                source={{ uri: nominee.poster_path ? `https://image.tmdb.org/t/p/w200${nominee.poster_path}` : 'https://via.placeholder.com/100' }}
                                                style={styles.poster}
                                            />
                                            <View style={styles.nomineeInfo}>
                                                <Text style={styles.nomineeName} numberOfLines={1}>{nominee.name}</Text>
                                                <Text style={styles.nomineeMovie} numberOfLines={1}>{nominee.title}</Text>

                                                {/* User Rating Badge */}
                                                {rating ? (
                                                    <View style={styles.userRatingBadge}>
                                                        <Icon name="star" size={10} color="#FFD700" style={{ marginRight: 3 }} />
                                                        <Text style={styles.userRatingText}>
                                                            {specificScore ? parseFloat(specificScore).toFixed(1) : (rating.score ? parseFloat(rating.score).toFixed(1) : "N/A")}
                                                        </Text>
                                                    </View>
                                                ) : null}
                                            </View>

                                            {/* Overlays */}
                                            {isMyLockedPick && (
                                                <View style={[styles.lockedLabel, { backgroundColor: '#555' }]}>
                                                    <Icon name="check" size={10} color="#fff" />
                                                    <Text style={styles.lockedText}> THIS PICK</Text>
                                                </View>
                                            )}

                                        </TouchableOpacity>
                                    );
                                })}
                            </ScrollView>
                        </View>
                    );
                })}
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
    centered: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        backgroundColor: '#1a1a2e',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 15,
        paddingHorizontal: 20,
        height: 80,
    },
    backButton: {
        padding: 5,
    },
    headerTitleContainer: {
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#FFD700', // Gold
        letterSpacing: 1,
    },
    headerSubtitle: {
        fontSize: 12,
        color: '#ccc',
        marginTop: 2,
    },
    eventTabsContainer: {
        backgroundColor: '#1a1a2e',
        borderBottomWidth: 1,
        borderColor: '#333',
    },
    eventTabsScroll: {
        paddingHorizontal: 15,
        paddingBottom: 10,
    },
    eventTab: {
        paddingHorizontal: 15,
        paddingVertical: 8,
        marginRight: 10,
        borderRadius: 20,
        backgroundColor: '#333',
    },
    eventTabActive: {
        backgroundColor: '#FFD700',
    },
    eventTabText: {
        color: '#ccc',
        fontSize: 14,
        fontWeight: '600'
    },
    eventTabTextActive: {
        color: '#1a1a2e',
    },
    scrollContent: {
        paddingBottom: 40,
    },
    emptyText: {
        color: '#666',
        fontSize: 16,
        marginTop: 15,
    },
    statusBar: {
        backgroundColor: '#1a1a2e',
        padding: 15,
        borderBottomLeftRadius: 15,
        borderBottomRightRadius: 15,
        marginBottom: 15,
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
        elevation: 4,
    },
    statusRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        width: '100%'
    },
    statusStat: {
        alignItems: 'center',
    },
    statusValue: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#FFD700',
    },
    statusLabel: {
        fontSize: 12,
        color: '#ccc',
        marginTop: 2,
        textTransform: 'uppercase'
    },
    categoryCard: {
        backgroundColor: '#fff',
        marginHorizontal: 10,
        marginBottom: 15,
        borderRadius: 12,
        padding: 15,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    categoryHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
        paddingBottom: 10,
    },
    categoryTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333',
        flex: 1,
    },
    resultBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        marginLeft: 10,
    },
    resultBadgeCorrect: {
        backgroundColor: '#E8F5E9',
        borderWidth: 1,
        borderColor: '#4CAF50'
    },
    resultBadgeWrong: {
        backgroundColor: '#FFEBEE',
        borderWidth: 1,
        borderColor: '#F44336'
    },
    resultText: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#333'
    },
    nomineeScroll: {
        flexDirection: 'row',
    },
    nomineeCard: {
        width: 120,
        marginRight: 15,
        backgroundColor: '#f9f9f9',
        borderRadius: 8,
        borderWidth: 2,
        borderColor: 'transparent',
        overflow: 'hidden',
    },
    actualWinnerBorder: {
        borderColor: '#FFD700', // Gold border for winners
    },
    lockedCard: {
        borderColor: '#4CAF50',
        backgroundColor: '#E8F5E9'
    },
    poster: {
        width: '100%',
        height: 180,
    },
    nomineeInfo: {
        padding: 8,
        alignItems: 'center',
    },
    nomineeName: {
        fontSize: 12,
        fontWeight: 'bold',
        textAlign: 'center',
        color: '#333',
        marginBottom: 2
    },
    nomineeMovie: {
        fontSize: 10,
        color: '#666',
        textAlign: 'center',
        fontStyle: 'italic',
        marginBottom: 5,
    },
    lockedLabel: {
        position: 'absolute',
        bottom: 0,
        width: '100%',
        backgroundColor: '#4CAF50',
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 5,
    },
    lockedText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: 'bold',
    },
    userRatingBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.7)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 10,
    },
    userRatingText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: 'bold',
    }
});

export default UserAwardsScreen;
