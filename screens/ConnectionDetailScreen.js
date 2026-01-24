import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, SafeAreaView, Platform, StatusBar, ActivityIndicator, FlatList, TouchableOpacity, Alert, Image, ScrollView, Modal, TextInput } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import MaterialIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { db, auth } from '../firebaseConfig';
import { doc, onSnapshot, updateDoc, getDoc, arrayUnion } from 'firebase/firestore';
import { sendPushNotification, getUserPushToken, broadcastToGroup } from '../services/NotificationService';
import { TMDB_API_KEY } from '../utils/config';

const ConnectionDetailScreen = ({ route, navigation }) => {
    const { connectionId } = route.params;
    const [connection, setConnection] = useState(null);
    const [loading, setLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState(auth.currentUser);

    // Matching State
    const [isMatching, setIsMatching] = useState(false);

    // Voting State
    const [votes, setVotes] = useState({});
    const [hasSubmitted, setHasSubmitted] = useState(false);

    // Single Card Logic State
    const [activeMovies, setActiveMovies] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const popularPage = useRef(1); // Pagination for refills

    const [showInstructions, setShowInstructions] = useState(false);

    // Show instructions on first load if user hasn't voted yet
    useEffect(() => {
        if (!loading && !hasSubmitted) {
            setShowInstructions(true);
        }
    }, [loading, hasSubmitted]);

    // ... (keep Timer state)

    // ... (Keep existing useEffects)

    // Helper to fetch more movies
    const fetchMoreMovies = async () => {
        try {
            popularPage.current += 1; // Increment page
            const API_KEY = TMDB_API_KEY;
            const response = await fetch(`https://api.themoviedb.org/3/movie/popular?api_key=${API_KEY}&language=en-US&page=${popularPage.current}`);
            const data = await response.json();

            if (data.results) {
                const existingIds = new Set(connection.matchedMovies.map(m => m.id));
                const newMovies = data.results
                    .filter(m => !existingIds.has(m.id))
                    .map(m => ({
                        id: m.id,
                        title: m.title,
                        poster_path: m.poster_path,
                        overview: m.overview,
                        release_date: m.release_date
                    }));

                if (newMovies.length > 0) {
                    await updateDoc(doc(db, "connections", connectionId), {
                        matchedMovies: arrayUnion(...newMovies)
                    });
                }
            }
        } catch (e) {
            console.error("Refill error", e);
        }
    };

    const updateVote = async (movieId, score) => {
        // Optimistic Update
        const newVotes = { ...votes, [movieId]: score };
        setVotes(newVotes);

        // Advance Card
        handleNextMovie();

        try {
            await updateDoc(doc(db, "connections", connectionId), {
                [`votes.${currentUser.uid}`]: newVotes
            });
        } catch (error) {
            console.error("Auto-save error:", error);
        }
    };

    const handleSkip = (movieId) => {
        // Mark as skipped (maybe store as 0 or special flag? User said "Already Watched", implying ignore)
        // We can treat it as a "Seen IT" which removes it from their pool.
        // Storing as 0 or -1 might be useful, or just local skip?
        // User said: "movies that you have already rated DO NOT SHOW BACK UP". 
        // So we should probably save this state so it persists. Using -1 for "Skipped/Watched".
        updateVote(movieId, -1);
    };

    const handleNextMovie = () => {
        // Just increment index? OR if we are filtering, we remove from array?
        // Since we filtered `activeMovies` to be ONLY unvoted ones, we can just slice?
        // Or just increment index.
        if (currentIndex < activeMovies.length - 1) {
            setCurrentIndex(prev => prev + 1);
        } else {
            // End of list, check refill?
            setCurrentIndex(prev => prev + 1); // Moves it out of bounds, triggering "Caught up" view
            checkRefill();
        }
    };

    const checkRefill = () => {
        // If we are near end, fetch more
        if (activeMovies.length - currentIndex < 3) {
            fetchMoreMovies();
        }
    };


    // Timer & Discovery State
    const [timeLeft, setTimeLeft] = useState('');
    const [isDiscoveryOpen, setIsDiscoveryOpen] = useState(false);
    const [discoveryMovies, setDiscoveryMovies] = useState([]);
    const [selectedGenre, setSelectedGenre] = useState(null);
    const [isTimeUp, setIsTimeUp] = useState(false);

    useEffect(() => {
        if (!connectionId) return;

        const docRef = doc(db, "connections", connectionId);
        const unsubscribe = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setConnection({ id: docSnap.id, ...data });

                if (data.votes && data.votes[currentUser.uid]) {
                    setHasSubmitted(true);
                    setVotes(data.votes[currentUser.uid]);
                }

                // Initialize Active Movies (Filter out what I've voted on)
                const myVotes = data.votes?.[currentUser.uid] || {};
                const mMovies = data.matchedMovies || [];
                const unvoted = mMovies.filter(m => !myVotes[m.id]);
                setActiveMovies(unvoted);
                setCurrentIndex(0);

                // Hydrate Participants (Fresh Data)
                if (data.participants && data.participants.length > 0) {
                    Promise.all(data.participants.map(async (uid) => {
                        try {
                            const userSnap = await getDoc(doc(db, "users", uid));
                            if (userSnap.exists()) {
                                return { uid, ...userSnap.data() };
                            }
                            return { uid, username: 'Unknown' };
                        } catch (e) {
                            console.error("Error fetching participant:", uid, e);
                            return { uid, username: 'Unknown' };
                        }
                    })).then(freshParticipants => {
                        setConnection(prev => ({ ...prev, participantDetails: freshParticipants }));
                    });
                }

            } else {
                Alert.alert("Error", "Connection not found.");
                navigation.goBack();
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, [connectionId]);

    // Timer Logic
    useEffect(() => {
        if (!connection?.deadline) return;

        const interval = setInterval(() => {
            const now = new Date();
            const end = connection.deadline.toDate ? connection.deadline.toDate() : new Date(connection.deadline);
            const diff = end - now;

            if (diff <= 0) {
                setTimeLeft('Time\'s Up!');
                setIsTimeUp(true);
                clearInterval(interval);
            } else {
                const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
                const minutes = Math.floor((diff / 1000 / 60) % 60);

                if (days > 0) setTimeLeft(`${days}d ${hours}h`);
                else setTimeLeft(`${hours}h ${minutes}m`);
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [connection?.deadline]);

    // --- Matching Logic ---
    // --- Matching Logic ---
    const startMatching = async () => {
        setIsMatching(true);
        try {
            // 1. Fetch Watch Lists for all participants
            const participants = connection.participants;
            const movieCounts = {}; // { movieId: { count: 0, movie: {} } }

            for (const uid of participants) {
                const userDoc = await getDoc(doc(db, "users", uid));
                if (userDoc.exists()) {
                    const data = userDoc.data();
                    const watchList = data.movieLists?.find(l => l.id === 2 || l.name === "Watch Later");

                    if (watchList && watchList.movies) {
                        watchList.movies.forEach(movie => {
                            if (!movieCounts[movie.id]) {
                                movieCounts[movie.id] = { count: 0, movie: movie };
                            }
                            movieCounts[movie.id].count++;
                        });
                    }
                }
            }

            // 2. Find Overlaps (Strict for < 3, Majority for >= 3, or just 1+ for relaxed matching)
            // Let's relax it to count >= 1 for now to capture ANY interest, then sort by overlap count?
            // Actually, let's stick to the "Shared Interest" goal.
            // If < 10 matches found, we Auto-Fill.

            let matchedMovies = Object.values(movieCounts)
                .filter(item => item.count >= (participants.length > 1 ? 2 : 1)) // At least 2 people if group > 1
                .map(item => item.movie);

            let message = `Found ${matchedMovies.length} shared movies.`;

            // AUTO-FILL Logic if matches are low
            if (matchedMovies.length < 10) {
                const API_KEY = TMDB_API_KEY;
                const response = await fetch(`https://api.themoviedb.org/3/movie/popular?api_key=${API_KEY}&language=en-US&page=1`);
                const data = await response.json();

                if (data.results) {
                    const existingIds = new Set(matchedMovies.map(m => m.id));
                    const popularToAdd = data.results.filter(m => !existingIds.has(m.id));

                    // Fill up to 20 total
                    const needed = 20 - matchedMovies.length;
                    const toAdd = popularToAdd.slice(0, needed).map(m => ({
                        id: m.id,
                        title: m.title,
                        poster_path: m.poster_path,
                        overview: m.overview,
                        release_date: m.release_date
                    }));

                    matchedMovies = [...matchedMovies, ...toAdd];
                    message += ` Added ${toAdd.length} popular movies to get you started!`;
                }
            }

            if (matchedMovies.length === 0) {
                Alert.alert("Error", "Could not find any movies to play with.");
                return;
            }

            Alert.alert("Ready!", message);

            // 3. Update Connection
            await updateDoc(doc(db, "connections", connectionId), {
                matchedMovies: matchedMovies,
                status: 'voting'
            });

        } catch (error) {
            console.error("Matching error:", error);
            Alert.alert("Error", "Failed to run matching algorithm.");
        } finally {
            setIsMatching(false);
        }
    };

    const handleNudge = async () => {
        if (!connection.participants) return;
        Alert.alert("Sent", "Nudged group members to vote!");
        await broadcastToGroup(
            connection.participants,
            "Vote Reminder ⏰",
            `Keep voting in "${connection.name}"! Time is ticking.`,
            { type: 'connection', connectionId }
        );
    };

    // --- Voting Logic ---
    const handleRecalculateMatches = () => {
        Alert.alert("Refresh", "Re-checking watchlists...");
        startMatching();
    };



    const handleReveal = async () => {
        // Broadcast "Time's Up / Results Ready" if creator or first revealer?
        // Let's just do it every time button is pressed? No, that's spammy.
        // Maybe check if status is already "revealed"? If in voting, switch to revealed (if we tracked that status strictly).
        // For prototype, sending it on tap is fine, user won't tap 100 times. Or we assume this is the "End" event.

        if (connection.participants) {
            // Fire and forget notifications so we don't block the UI
            broadcastToGroup(
                connection.participants,
                "Results Ready! 🏆",
                `The results for "${connection.name}" are in. See what won!`,
                { type: 'connection', connectionId }
            ).catch(err => console.error("Failed to broadcast results:", err));
        }

        navigation.navigate('RevealScreen', { connectionId });
    };



    // --- Discovery Logic ---
    const GENRES = [
        { id: 28, name: "Action" },
        { id: 35, name: "Comedy" },
        { id: 27, name: "Horror" },
        { id: 10749, name: "Romance" },
        { id: 878, name: "Sci-Fi" },
        { id: 53, name: "Thriller" },
        { id: 18, name: "Drama" },
        { id: 16, name: "Animation" }
    ];

    const fetchDiscoveryMovies = async (genreId) => {
        setSelectedGenre(genreId);
        setDiscoveryMovies([]);
        try {
            const API_KEY = TMDB_API_KEY;
            const response = await fetch(`https://api.themoviedb.org/3/discover/movie?api_key=${API_KEY}&with_genres=${genreId}&sort_by=popularity.desc`);
            const data = await response.json();
            if (data.results) {
                setDiscoveryMovies(data.results);
            }
        } catch (e) {
            console.error(e);
            Alert.alert("Error", "Could not fetch movies.");
        }
    };

    const [searchQuery, setSearchQuery] = useState('');

    const handleSearch = async (text) => {
        setSearchQuery(text);
        if (text.length > 2) {
            try {
                const API_KEY = TMDB_API_KEY;
                const response = await fetch(`https://api.themoviedb.org/3/search/movie?api_key=${API_KEY}&query=${encodeURIComponent(text)}&include_adult=false`);
                const data = await response.json();
                if (data.results) {
                    setDiscoveryMovies(data.results);
                }
            } catch (e) {
                console.error(e);
            }
        }
    };

    const handleAddMovie = async (movie) => {
        // Instant Add & Rate flow
        Alert.alert(
            "Rate " + movie.title,
            "How much do you want to watch this?",
            [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(score => ({
                text: String(score),
                onPress: async () => {
                    await finalizeAddAndRate(movie, score);
                }
            })),
            { cancelable: true }
        );
    };

    const finalizeAddAndRate = async (movie, score) => {
        try {
            // 1. Add to connection's matchedMovies if not exists
            const newMovie = {
                id: movie.id,
                title: movie.title,
                poster_path: movie.poster_path,
                overview: movie.overview,
                release_date: movie.release_date
            };

            // Check if exists
            const exists = connection.matchedMovies.find(m => m.id === movie.id);

            if (!exists) {
                await updateDoc(doc(db, "connections", connectionId), {
                    matchedMovies: arrayUnion(newMovie)
                });
            }

            // 2. Submit Vote
            await updateVote(movie.id, score);

            // 3. User feedback
            Alert.alert("Saved", `You rated "${movie.title}" a ${score}/10.`);
            setIsDiscoveryOpen(false);
            setSearchQuery('');
        } catch (error) {
            console.error(error);
            Alert.alert("Error", "Failed to save.");
        }
    };

    // --- Render ---

    if (loading || !connection) {
        return (
            <View style={[styles.container, styles.center]}>
                <ActivityIndicator size="large" color="#ff8c00" />
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Icon name="chevron-left" size={20} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{connection.name}</Text>
                {timeLeft ? <Text style={styles.timeWindow}>{timeLeft}</Text> : null}
                <TouchableOpacity onPress={handleNudge} style={{ marginLeft: 10 }}>
                    <MaterialIcon name="bell-ring" size={20} color="#ff8c00" />
                </TouchableOpacity>
            </View>

            {/* STATUS: MATCHING */}
            {connection.status === 'matching' && (
                <View style={styles.centerContent}>
                    <MaterialIcon name="transit-connection-variant" size={80} color="#333" />
                    <Text style={styles.statusTitle}>Finding Matches</Text>
                    {connection.timeWindow && <Text style={styles.statusSub}>{connection.timeWindow}</Text>}
                    <Text style={styles.statusText}>
                        Comparing "Watch Later" lists for {connection.participantDetails?.map(p => p.username).join(', ')}...
                    </Text>

                    <TouchableOpacity
                        style={styles.actionButton}
                        onPress={startMatching}
                        disabled={isMatching}
                    >
                        {isMatching ? <ActivityIndicator color="#fff" /> : <Text style={styles.actionButtonText}>Find Top Matches</Text>}
                    </TouchableOpacity>
                </View>
            )}

            {/* STATUS: VOTING */}
            {connection.status === 'voting' && (
                <View style={{ flex: 1 }}>
                    {/* Header Avatars */}
                    <View style={styles.cavatarsContainer}>
                        {connection.participantDetails?.map((p, index) => (
                            <View key={index} style={styles.cavatarWrapper}>
                                <Image
                                    source={p.profilePhoto ? { uri: p.profilePhoto } : require('../assets/profile_placeholder.jpg')}
                                    style={styles.cavatar}
                                />
                                <Text style={styles.cavatarName} numberOfLines={1}>{p.username}</Text>
                            </View>
                        ))}
                    </View>

                    <View style={styles.phaseHeader}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.phaseTitle}>Desire Rating</Text>
                            <Text style={styles.phaseSub}>Rate how much you want to watch this.</Text>
                        </View>
                        {!isTimeUp && (
                            <TouchableOpacity style={styles.discoveryBtn} onPress={() => setIsDiscoveryOpen(true)}>
                                <Icon name="search" size={14} color="#fff" />
                                <Text style={styles.discoveryBtnText}>Search</Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    <View style={{ flex: 1, justifyContent: 'center', padding: 20 }}>
                        {activeMovies.length > 0 && currentIndex < activeMovies.length ? (
                            <View style={styles.singleCard}>
                                <Image
                                    source={{ uri: `https://image.tmdb.org/t/p/w500${activeMovies[currentIndex].poster_path}` }}
                                    style={styles.singlePoster}
                                    resizeMode="cover"
                                />

                                <View style={styles.cardOverlay}>
                                    <Text style={styles.singleTitle}>{activeMovies[currentIndex].title}</Text>
                                    <Text style={styles.singleOverview} numberOfLines={3}>{activeMovies[currentIndex].overview}</Text>

                                    <TouchableOpacity onPress={() => handleSkip(activeMovies[currentIndex].id)} style={styles.singleWatchedBtn}>
                                        <Text style={styles.singleWatchedText}>Seen It / Skip</Text>
                                    </TouchableOpacity>

                                    {/* Rating Buttons */}
                                    <View style={styles.ratingRow}>
                                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                                            <TouchableOpacity
                                                key={num}
                                                style={styles.ratingCircle}
                                                onPress={() => updateVote(activeMovies[currentIndex].id, num)}
                                            >
                                                <Text style={styles.ratingNumber}>{num}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>
                            </View>
                        ) : (
                            <View style={styles.centerContent}>
                                {isTimeUp ? (
                                    <View>
                                        <Text style={styles.waitingText}>Voting Closed!</Text>
                                        <Text style={styles.votedStatus}>Time to see what you picked.</Text>
                                    </View>
                                ) : (
                                    <View>
                                        <Text style={styles.waitingText}>All caught up!</Text>
                                        <Text style={styles.votedStatus}>Waiting for others or more movies...</Text>
                                        <ActivityIndicator color="#e50914" style={{ marginTop: 20 }} />
                                    </View>
                                )}
                            </View>
                        )}
                    </View>

                    <View style={styles.footer}>
                        {!isTimeUp ? (
                            <Text style={{ color: '#666', textAlign: 'center', fontSize: 12 }}>
                                {activeMovies.length - currentIndex} movies left to rate
                            </Text>
                        ) : (
                            <View>
                                <TouchableOpacity style={styles.revealButton} onPress={handleReveal}>
                                    <Text style={styles.revealButtonText}>REVEAL WINNER</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                </View>
            )}

            {/* STATUS: REVEALED */}
            {/* Alternatively, if status is 'revealed' but we are on this screen, show button to go to reveal */}
            {/* But usually connection status doesn't change to 'revealed' until RevealScreen logic runs. */}

            {/* Discovery Modal */}
            <Modal visible={isDiscoveryOpen} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Add Movies</Text>
                            <TouchableOpacity onPress={() => setIsDiscoveryOpen(false)}>
                                <Icon name="times" size={20} color="#ccc" />
                            </TouchableOpacity>
                        </View>

                        <TextInput
                            style={{ backgroundColor: '#252535', padding: 12, borderRadius: 10, color: '#fff', marginBottom: 15 }}
                            placeholder="Type to search..."
                            placeholderTextColor="#666"
                            value={searchQuery}
                            onChangeText={handleSearch}
                        />

                        <Text style={styles.label}>Select Genre</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.genreScroll}>
                            {GENRES.map(genre => (
                                <TouchableOpacity
                                    key={genre.id}
                                    style={[styles.genreBtn, selectedGenre === genre.id && styles.genreBtnSelected]}
                                    onPress={() => fetchDiscoveryMovies(genre.id)}
                                >
                                    <Text style={[styles.genreBtnText, selectedGenre === genre.id && { color: '#000' }]}>{genre.name}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>

                        <FlatList
                            data={discoveryMovies}
                            keyExtractor={item => item.id.toString()}
                            numColumns={3}
                            contentContainerStyle={{ paddingBottom: 20 }}
                            renderItem={({ item }) => (
                                <TouchableOpacity style={styles.discoveryItem} onPress={() => handleAddMovie(item)}>
                                    <Image
                                        source={{ uri: item.poster_path ? `https://image.tmdb.org/t/p/w200${item.poster_path}` : 'https://via.placeholder.com/150' }}
                                        style={styles.discoveryPoster}
                                    />
                                    <Icon name="plus-circle" size={24} color="#e50914" style={styles.addIcon} />
                                </TouchableOpacity>
                            )}
                            ListEmptyComponent={
                                !selectedGenre ? <Text style={styles.emptyText}>Select a genre above.</Text> :
                                    <ActivityIndicator color="#e50914" style={{ marginTop: 20 }} />
                            }
                        />
                    </View>
                </View>
            </Modal>

            {/* Instructions Modal */}
            <Modal visible={showInstructions} animationType="fade" transparent>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { height: 'auto', padding: 30 }]}>
                        <Text style={[styles.modalTitle, { textAlign: 'center', marginBottom: 15 }]}>How to Play</Text>
                        <Text style={{ color: '#ccc', fontSize: 16, lineHeight: 24, marginBottom: 20 }}>
                            1. <Text style={{ fontWeight: 'bold', color: '#fff' }}>Rate</Text> each movie 1-10 based on how much you want to watch it right now.{'\n'}
                            2. <Text style={{ fontWeight: 'bold', color: '#fff' }}>Skip</Text> movies you've already seen.{'\n'}
                            3. <Text style={{ fontWeight: 'bold', color: '#fff' }}>Search</Text> to instantly add and rate a specific movie you have in mind.{'\n'}
                            4. Matches are found when everyone rates highly!
                        </Text>
                        <TouchableOpacity style={styles.submitButton} onPress={() => setShowInstructions(false)}>
                            <Text style={styles.submitButtonText}>Let's Go!</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0a0a1a', paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 },
    center: { justifyContent: 'center', alignItems: 'center' },
    header: { flexDirection: 'row', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#222' },
    backButton: { marginRight: 15 },
    headerTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
    timeWindow: { color: '#ff8c00', fontSize: 12, marginLeft: 10, fontStyle: 'italic' },

    centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30 },
    statusTitle: { color: '#fff', fontSize: 24, fontWeight: 'bold', marginTop: 20 },
    statusSub: { color: '#ff8c00', fontSize: 16, marginTop: 5, marginBottom: 10, textTransform: 'uppercase' },
    statusText: { color: '#888', textAlign: 'center', marginTop: 10, fontSize: 16 },
    actionButton: { backgroundColor: '#e50914', paddingHorizontal: 40, paddingVertical: 15, borderRadius: 30, marginTop: 40 },
    actionButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 18, textTransform: 'uppercase' },

    phaseHeader: { padding: 20, backgroundColor: '#111' },
    phaseTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
    phaseSub: { color: '#666', fontSize: 14 },

    voteCard: { flexDirection: 'row', backgroundColor: '#161625', marginBottom: 15, borderRadius: 10, overflow: 'hidden' },
    poster: { width: 80, height: 120 },
    voteContent: { flex: 1, padding: 10, justifyContent: 'center' },
    movieTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginBottom: 10 },
    sliderContainer: { marginTop: 15 },
    buttonGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 5 },
    gridBtn: { width: '18%', aspectRatio: 1, backgroundColor: '#333', justifyContent: 'center', alignItems: 'center', marginBottom: 5, borderRadius: 5, borderWidth: 1, borderColor: '#444' },
    gridBtnActive: { backgroundColor: '#ff8c00', borderColor: '#ff8c00' },
    gridBtnText: { color: '#ccc', fontWeight: 'bold', fontSize: 14 },

    alreadyWatchedBtn: { backgroundColor: '#333', paddingVertical: 8, paddingHorizontal: 15, borderRadius: 20, marginBottom: 15, borderWidth: 1, borderColor: '#555' },
    alreadyWatchedText: { color: '#aaa', fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase' },

    cavatarsContainer: { flexDirection: 'row', justifyContent: 'center', paddingVertical: 10, backgroundColor: '#0a0a1a' },
    cavatarWrapper: { alignItems: 'center', marginHorizontal: 8 },
    cavatar: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: '#333' },
    cavatarName: { color: '#666', fontSize: 10, marginTop: 4, width: 50, textAlign: 'center' },

    singleCard: {
        width: '100%',
        height: '100%',
        borderRadius: 20,
        overflow: 'hidden',
        backgroundColor: '#000',
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.5,
        shadowRadius: 10
    },
    singlePoster: { width: '100%', height: '100%' },
    cardOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(0,0,0,0.85)',
        padding: 20,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20
    },
    singleTitle: { color: '#fff', fontSize: 24, fontWeight: 'bold', marginBottom: 5 },
    singleOverview: { color: '#ccc', fontSize: 14, marginBottom: 15 },
    singleWatchedBtn: { alignSelf: 'center', marginBottom: 15, paddingVertical: 12, paddingHorizontal: 25, backgroundColor: 'rgba(255, 255, 255, 0.15)', borderRadius: 25, borderWidth: 1, borderColor: '#fff' },
    singleWatchedText: { color: '#fff', textTransform: 'uppercase', fontSize: 13, letterSpacing: 1, fontWeight: 'bold' },

    ratingRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10 },
    ratingCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#333', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#555' },
    ratingNumber: { color: '#fff', fontWeight: 'bold', fontSize: 14 },

    footer: { padding: 20, backgroundColor: '#0a0a1a' },
    submitButton: { backgroundColor: '#ff8c00', padding: 15, borderRadius: 10, alignItems: 'center' },
    submitButtonText: { color: '#000', fontWeight: 'bold', fontSize: 18 },

    waitingText: { color: '#fff', textAlign: 'center', fontSize: 18, fontWeight: 'bold' },
    votedStatus: { color: '#666', textAlign: 'center', marginTop: 5 },
    revealButton: { backgroundColor: '#e50914', padding: 15, borderRadius: 10, alignItems: 'center', marginTop: 15 },
    revealButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 18, letterSpacing: 1 },

    // Discovery Styles
    discoveryBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#333', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 15 },
    discoveryBtnText: { color: '#fff', marginLeft: 5, fontSize: 12, fontWeight: 'bold' },

    // Modal Styles (Reused similar pattern but specific here)
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: '#161625', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, height: '80%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
    label: { color: '#888', marginBottom: 10, textTransform: 'uppercase', fontSize: 12 },

    genreScroll: { maxHeight: 50, marginBottom: 15 },
    genreBtn: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, backgroundColor: '#252535', marginRight: 10, borderWidth: 1, borderColor: '#444' },
    genreBtnSelected: { backgroundColor: '#ff8c00', borderColor: '#ff8c00' },
    genreBtnText: { color: '#ccc', fontWeight: 'bold' },

    discoveryItem: { flex: 1 / 3, margin: 5, aspectRatio: 2 / 3, borderRadius: 8, overflow: 'hidden', position: 'relative' },
    discoveryPoster: { width: '100%', height: '100%' },
    addIcon: { position: 'absolute', bottom: 5, right: 5, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 12 },
    emptyText: { color: '#666', textAlign: 'center', marginTop: 30 }
});

export default ConnectionDetailScreen;
