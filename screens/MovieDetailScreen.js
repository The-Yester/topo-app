import React, { useState, useContext, useEffect, useRef } from 'react';
import {
    View,
    Text,
    Button,
    StyleSheet,
    Image,
    TouchableOpacity,
    Modal,
    TextInput,
    Alert,
    FlatList,
    ScrollView,
    Platform,
    StatusBar,
    SafeAreaView
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { MoviesContext } from '../context/MoviesContext';
import { getMovieDetails } from '../api/MovieService';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import { db, auth } from '../firebaseConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Picker } from '@react-native-picker/picker';
import Icon from 'react-native-vector-icons/FontAwesome';
import MaterialIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import PizzaRating from '../context/PizzaRating';
import AwardsRating from '../context/AwardsRating';
import PercentageRating from '../context/PercentageRating';
import ClassicRating from '../context/ClassicRating';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';

const pizzaSliceFull = require('../assets/pizza_full.jpg');
const pizzaSliceHalf = require('../assets/pizza_half.jpg');
const topoLogo = require('../assets/TOPO_Logo.jpg');
const appBackground = require('../assets/TOPO_Background_3.4.png');

const MovieDetailScreen = ({ route }) => {
    const navigation = useNavigation();
    const { ratingMethod, addMovieToList, addToRecentlyWatched, submitRating, movieLists, overallRatedMovies } = useContext(MoviesContext);
    const [userRating, setUserRating] = useState(0);
    const { movieId } = route.params;
    const [movie, setMovie] = useState(null);
    const [ratingModalVisible, setRatingModalVisible] = useState(false);
    const [reviewModalVisible, setReviewModalVisible] = useState(false);
    const [listModalVisible, setListModalVisible] = useState(false);

    // Share Feature State
    const [shareModalVisible, setShareModalVisible] = useState(false);
    const viewShotRef = useRef();

    const [reviewText, setReviewText] = useState('');
    const [maxRating, setMaxRating] = useState(10);
    const [reviews, setReviews] = useState([]);
    const [currentUser, setCurrentUser] = useState(null);
    const [loading, setLoading] = useState(true);

    const [globalStats, setGlobalStats] = useState(null);

    // Rating State
    const [detailedAwardsRatings, setDetailedAwardsRatings] = useState({});
    const [currentAwardsOverallScore, setCurrentAwardsOverallScore] = useState(null);

    // Unified Share Handler
    const handleShareOptions = () => {
        Alert.alert(
            "Share Movie",
            `How would you like to share "${movie?.title}"?`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Post to Reelz",
                    onPress: () => {
                        const text = `Just watched ${movie?.title}! 🎬 My Rating: ${userRating > 0 ? (ratingMethod === 'Percentage' ? `${userRating}%` : `${userRating}/${maxRating}`) : 'N/A'} #TOPO`;
                        navigation.navigate('MessageBoard', { initialText: text });
                    }
                },
                {
                    text: "Create Social Card",
                    onPress: () => setShareModalVisible(true) // Opens the existing image share flow
                }
            ]
        );
    };

    // Share Handler
    const handleShare = async () => {
        try {
            const uri = await captureRef(viewShotRef, {
                format: 'jpg',
                quality: 0.9,
                result: 'tmpfile'
            });

            await Sharing.shareAsync(uri, {
                mimeType: 'image/jpeg',
                dialogTitle: `Share your rating for ${movie?.title}`,
                UTI: 'public.jpeg'
            });
        } catch (error) {
            console.error("Sharing failed", error);
            Alert.alert("Error", "Could not share image.");
        }
    };

    useEffect(() => {
        const fetchMovieDetails = async () => {
            if (!movieId) {
                setLoading(false);
                setMovie(null);
                return;
            }
            try {
                setLoading(true);
                const movieData = await getMovieDetails(movieId);
                setMovie(movieData);
            } catch (error) {
                console.error("Error fetching movie details:", error);
                setMovie(null);
            } finally {
                setLoading(false);
            }
        };
        fetchMovieDetails();
    }, [movieId]);

    // Real-time Global Stats Listener
    useEffect(() => {
        if (!movieId) return;
        const sub = onSnapshot(doc(db, "movies", movieId.toString()), (docSnap) => {
            if (docSnap.exists() && docSnap.data().stats) {
                setGlobalStats(docSnap.data().stats);
            }
        });
        return () => sub();
    }, [movieId]);

    // Helper for Rating Conversion
    const convertRating = (score, fromType, toType) => {
        // Normalize types to internal keys
        const normalize = (t) => {
            if (t === '1-5' || t === 'pizza') return 'pizza';
            if (t === '1-10' || t === 'classic') return 'classic';
            if (t === 'Percentage' || t === 'percentage') return 'percentage';
            if (t === 'Awards' || t === 'awards') return 'awards';
            return t;
        };

        const nFrom = normalize(fromType);
        const nTo = normalize(toType);

        if (!score && score !== 0) return 0;
        if (nFrom === nTo) return score;

        // 1. Normalize to 0-10 Scale
        let base10 = score;
        if (nFrom === 'pizza') base10 = score * 2;
        else if (nFrom === 'percentage') base10 = score / 10;
        // 'classic' ('1-10') and 'awards' are already base 10

        // 2. Convert to Target Scale
        if (nTo === 'pizza') return base10 / 2;
        if (nTo === 'percentage') return base10 * 10;
        return base10;
    };

    // Load User's Rating for this Movie from Firestore
    useEffect(() => {
        const loadUserRating = async () => {
            if (!movieId) return;
            const user = auth.currentUser;
            if (!user) return;

            try {
                const ratingDocRef = doc(db, "users", user.uid, "ratings", movieId.toString());
                const unsub = onSnapshot(ratingDocRef, (docSnap) => {
                    if (docSnap.exists()) {
                        const data = docSnap.data();

                        // Detect mismatch and convert
                        const convertedScore = convertRating(data.score, data.type, ratingMethod);
                        setUserRating(convertedScore || 0);

                        if (data.type === 'Awards' && data.breakdown) {
                            setDetailedAwardsRatings(data.breakdown);
                            // If we are currently in Awards mode, the convertRating returns the score as is, which is correct.
                            if (ratingMethod === 'Awards') {
                                setCurrentAwardsOverallScore(convertedScore);
                            }
                        } else {
                            // If converting FROM another type TO Awards, we don't have a breakdown.
                            setDetailedAwardsRatings({});
                            setCurrentAwardsOverallScore(ratingMethod === 'Awards' ? convertedScore : null);
                        }
                    } else {
                        setUserRating(0);
                        setDetailedAwardsRatings({});
                        setCurrentAwardsOverallScore(null);
                    }
                });
                return () => unsub();
            } catch (error) {
                console.error("Error loading user rating:", error);
            }
        };

        loadUserRating();
    }, [movieId, ratingMethod]);

    useEffect(() => {
        const calculateMaxRatingSystem = () => {
            let currentMax = 10;
            switch (ratingMethod) {
                case '1-5': currentMax = 5; break;
                case '1-10': currentMax = 10; break;
                case 'Percentage': currentMax = 100; break;
                case 'Awards': currentMax = 10; break;
            }
            setMaxRating(currentMax);
        };
        calculateMaxRatingSystem();
    }, [ratingMethod, userRating]);

    // Load Reviews
    useEffect(() => {
        if (!movieId) return;
        const loadReviews = async () => {
            try {
                const storedReviews = await AsyncStorage.getItem(`reviews_${movieId}`);
                if (storedReviews) setReviews(JSON.parse(storedReviews));
            } catch (error) {
                console.error("Error loading reviews:", error);
            }
        };
        loadReviews();
    }, [movieId]);

    // Load Current User (FIXED: From Firestore)
    useEffect(() => {
        const loadCurrentUser = async () => {
            const user = auth.currentUser;
            if (user) {
                try {
                    const userDoc = await getDoc(doc(db, "users", user.uid));
                    if (userDoc.exists()) {
                        setCurrentUser({ ...userDoc.data(), uid: user.uid });
                    } else {
                        setCurrentUser({ username: user.email?.split('@')[0] || "User" });
                    }
                } catch (error) {
                    console.error("Error loading user profile:", error);
                    setCurrentUser({ username: "User" });
                }
            }
        };
        loadCurrentUser();
    }, []);

    const handleReviewSubmit = async () => {
        if (!reviewText.trim()) {
            Alert.alert("Error", "Please write a review.");
            return;
        }
        try {
            const newReview = {
                id: Date.now(),
                text: reviewText,
                user: currentUser?.username || "Anonymous", // Uses Firestore username
                userId: currentUser?.uid
            };
            const updatedReviews = [...reviews, newReview];
            await AsyncStorage.setItem(`reviews_${movieId}`, JSON.stringify(updatedReviews));
            setReviews(updatedReviews);
            setReviewModalVisible(false);
            setReviewText('');
            Alert.alert("Success", "Your review has been saved.");
        } catch (error) {
            console.error("Error saving review:", error);
            Alert.alert("Error", "Failed to save review.");
        }
    };

    const handleRatingSubmit = async (selectedRating) => {
        if (!movie) {
            Alert.alert("Error", "Movie data not loaded yet. Cannot save rating.");
            return;
        }
        try {
            const ratingValue = parseFloat(selectedRating);
            let validatedRating = ratingValue;
            if (ratingMethod === 'Percentage') {
                validatedRating = Math.max(1, Math.min(100, ratingValue));
            } else if (ratingMethod === '1-5') {
                validatedRating = Math.max(1, Math.min(5, ratingValue));
            } else if (ratingMethod === '1-10') {
                validatedRating = Math.max(1, Math.min(10, ratingValue));
            }

            setUserRating(validatedRating);
            setRatingModalVisible(false);

            const movieInfoForContext = {
                title: movie.title,
                poster_path: movie.poster_path,
                vote_average: movie.vote_average,
                release_date: movie.release_date // Critical for sorting!
            };

            await submitRating(movieId, ratingMethod, validatedRating, null, movieInfoForContext);

            if (movie) addToRecentlyWatched({ id: movie.id, title: movie.title, poster_path: movie.poster_path });

            Alert.alert("Success", "Rating saved!");
        } catch (error) {
            console.error("Error saving rating:", error);
            Alert.alert("Error", "Failed to save rating.");
        }
    };

    const handleAwardsDataChange = React.useCallback((averageScore, detailedRatingsFromAwardsComponent) => {
        setCurrentAwardsOverallScore(averageScore);
        setDetailedAwardsRatings(detailedRatingsFromAwardsComponent);
    }, []);

    const handleFinalAwardsSubmit = async () => {
        if (!movie) {
            Alert.alert("Error", "Movie data not loaded yet. Cannot save awards rating.");
            return;
        }
        if (currentAwardsOverallScore === null || isNaN(currentAwardsOverallScore)) {
            Alert.alert("Error", "Please rate some categories to submit an awards rating.");
            return;
        }
        try {
            const overallAwardsScoreToSave = parseFloat(currentAwardsOverallScore);
            setUserRating(overallAwardsScoreToSave);
            setRatingModalVisible(false);

            const movieInfoForContext = {
                title: movie.title,
                poster_path: movie.poster_path,
                vote_average: movie.vote_average,
                release_date: movie.release_date // Critical for sorting!
            };

            await submitRating(movieId, 'Awards', overallAwardsScoreToSave, detailedAwardsRatings, movieInfoForContext);

            if (movie) addToRecentlyWatched({ id: movie.id, title: movie.title, poster_path: movie.poster_path });

            Alert.alert("Success", `Awards rating of ${overallAwardsScoreToSave.toFixed(1)} saved!`);
        } catch (error) {
            console.error("Error saving final awards rating:", error);
            Alert.alert("Error", "Failed to save final awards rating.");
        }
    };

    if (loading) return <View style={styles.loadingContainer}><Text style={styles.loadingText}>Loading...</Text></View>;
    if (!movie) return <View style={styles.errorContainer}><Text style={styles.errorText}>Error: Movie not found or data is still loading.</Text></View>;

    const posterUrl = movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : 'https://via.placeholder.com/150';
    const percentageSliderInitialValue = ratingMethod === 'Percentage' ? userRating : 50;

    // Header Content for FlatList
    const renderHeader = () => (
        <View style={styles.headerContentContainer}>
            <Image source={{ uri: posterUrl }} style={styles.poster} resizeMode="contain" />
            <View style={styles.detailsContainer}>
                <Text style={styles.title}>{movie.title}</Text>
                <Text style={styles.info}>{movie.release_date?.substring(0, 4)} | {movie.runtime} minutes</Text>
                <Text style={styles.plot}>{movie.overview}</Text>

                <View style={styles.ratingsSectionContainer}>
                    {/* ... (Ratings columns remain same) ... */}
                    <View style={styles.yourRatingColumn}>
                        <Text style={styles.ratingHeader}>Your Rating</Text>
                        {userRating > 0 || (ratingMethod === 'Percentage' && userRating >= 0) ? (
                            <>
                                {ratingMethod === '1-5' ? (
                                    <View style={{ marginBottom: 5 }}>
                                        <PizzaRating initialRating={userRating} readonly={true} size={60} />
                                    </View>
                                ) : null}

                                <Text style={styles.yourScoreText}>
                                    {`${parseFloat(userRating).toFixed(ratingMethod === 'Percentage' ? 0 : 1)}`}
                                    {ratingMethod === 'Percentage' ? '%' : `/${maxRating}`}
                                </Text>
                                <Text style={styles.yourMethodText}>({ratingMethod})</Text>
                            </>
                        ) : <Text style={styles.notRatedText}>Not Yet Rated</Text>}
                    </View>
                    <View style={styles.usersRatingsColumn}>
                        <Text style={styles.ratingHeader}>TOPO Users</Text>

                        {/* Classic (Badge 10) */}
                        <View style={styles.ratingDetailRow}>
                            <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFC107', justifyContent: 'center', alignItems: 'center', marginRight: 10 }}>
                                <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#000' }}>10</Text>
                            </View>
                            <Text style={styles.ratingDetailText}>
                                {globalStats?.classic?.count > 0 ? `${globalStats.classic.average.toFixed(1)}/10` : 'N/A'}
                            </Text>
                        </View>

                        {/* Pizza (Vector Icon) */}
                        <View style={styles.ratingDetailRow}>
                            <MaterialIcon name="pizza" size={18} color="#FF5722" style={styles.usersRatingIcon} />
                            <Text style={styles.ratingDetailText}>
                                {globalStats?.pizza?.count > 0 ? `${globalStats.pizza.average.toFixed(1)}/5` : 'N/A'}
                            </Text>
                        </View>

                        {/* Percentage */}
                        <View style={styles.ratingDetailRow}>
                            <Icon name="percent" size={14} color="#4CAF50" style={styles.usersRatingIcon} />
                            <Text style={styles.ratingDetailText}>
                                {globalStats?.percentage?.count > 0 ? `${globalStats.percentage.average.toFixed(0)}%` : 'N/A'}
                            </Text>
                        </View>

                        {/* Awards */}
                        <View style={styles.ratingDetailRow}>
                            <Icon name="trophy" size={16} color="#FFD700" style={styles.usersRatingIcon} />
                            <Text style={styles.ratingDetailText}>
                                {globalStats?.awards?.count > 0 ? `${globalStats.awards.average.toFixed(1)}/10` : 'N/A'}
                            </Text>
                        </View>
                    </View>
                </View>

                <View style={styles.buttonGrid}>
                    {/* Row 1 */}
                    <TouchableOpacity style={[styles.gridButton, { backgroundColor: '#e50914' }]} onPress={() => setRatingModalVisible(true)}>
                        <Icon name="star" size={16} color="white" style={{ marginRight: 8 }} />
                        <Text style={styles.gridButtonText}>Rate</Text>
                    </TouchableOpacity>



                    <TouchableOpacity style={[styles.gridButton, { backgroundColor: '#8a2be2' }]} onPress={handleShareOptions}>
                        <Icon name="share-alt" size={16} color="white" style={{ marginRight: 8 }} />
                        <Text style={styles.gridButtonText}>Share</Text>
                    </TouchableOpacity>

                    {/* Row 2 */}
                    <TouchableOpacity style={[styles.gridButton, { backgroundColor: '#ff8c00' }]} onPress={() => { if (movie) addMovieToList(1, movie) }}>
                        <Icon name="heart" size={16} color="white" style={{ marginRight: 8 }} />
                        <Text style={styles.gridButtonText}>Favorites</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={[styles.gridButton, { backgroundColor: '#4682b4' }]} onPress={() => { if (movie) addMovieToList(2, movie) }}>
                        <Icon name="bookmark" size={16} color="white" style={{ marginRight: 8 }} />
                        <Text style={styles.gridButtonText}>Watchlist</Text>
                    </TouchableOpacity>

                    {/* Row 3 */}
                    <TouchableOpacity style={[styles.gridButton, { backgroundColor: '#333' }]} onPress={() => setListModalVisible(true)}>
                        <Icon name="list" size={16} color="white" style={{ marginRight: 8 }} />
                        <Text style={styles.gridButtonText}>Add to List</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={[styles.gridButton, { backgroundColor: '#555' }]} onPress={() => setReviewModalVisible(true)}>
                        <Icon name="pencil" size={16} color="white" style={{ marginRight: 8 }} />
                        <Text style={styles.gridButtonText}>Review</Text>
                    </TouchableOpacity>
                </View>
            </View>
            <Text style={styles.reviewsTitle}>Reviews</Text>
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            {/* Custom Back Button */}
            <View style={styles.headerBar}>
                <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                    <Icon name="arrow-left" size={24} color="#FFF" />
                </TouchableOpacity>
                <Text style={styles.headerBarTitle} numberOfLines={1}>{movie?.title}</Text>
                <View style={{ width: 40 }} />
            </View>

            <FlatList
                data={reviews}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }) => (
                    <View style={styles.reviewItem}>
                        <View style={styles.reviewBubble}>
                            {item.userId ? (
                                <TouchableOpacity onPress={() => navigation.push('PublicProfile', { userId: item.userId })}>
                                    <Text style={[styles.reviewUser, { color: '#ff8c00', textDecorationLine: 'underline' }]}>{item.user}:</Text>
                                </TouchableOpacity>
                            ) : (
                                <Text style={styles.reviewUser}>{item.user}:</Text>
                            )}
                            <Text style={styles.reviewTextContent}>{item.text}</Text>
                        </View>
                    </View>
                )}
                ListHeaderComponent={renderHeader}
                ListEmptyComponent={<Text style={styles.noReviewsText}>No reviews yet.</Text>}
                contentContainerStyle={{ paddingBottom: 20 }}
            />

            {/* List Selection Modal */}
            <Modal animationType="slide" transparent={true} visible={listModalVisible} onRequestClose={() => setListModalVisible(false)}>
                <View style={styles.modalContainer}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Select a List</Text>
                        <View style={{ width: '100%', maxHeight: 300 }}>
                            <FlatList
                                data={movieLists}
                                keyExtractor={item => item.id.toString()}
                                renderItem={({ item }) => (
                                    <TouchableOpacity
                                        style={styles.listOptionitem}
                                        onPress={() => {
                                            if (movie) {
                                                addMovieToList(item.id, movie);
                                                setListModalVisible(false);
                                                Alert.alert("Success", "Movie added to list!");
                                            }
                                        }}
                                    >
                                        <Text style={styles.listOptionText}>{item.name}</Text>
                                        <Text style={styles.listOptionCount}>{item.movies?.length || 0} movies</Text>
                                    </TouchableOpacity>
                                )}
                            />
                        </View>
                        <View style={styles.modalButtonSeparator} />
                        <Button title="Cancel" onPress={() => setListModalVisible(false)} color="#FF6347" />
                    </View>
                </View>
            </Modal>

            <Modal animationType="slide" transparent={true} visible={ratingModalVisible} onRequestClose={() => setRatingModalVisible(false)}>
                <View style={styles.modalContainer}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Rate {movie?.title}</Text>

                        {ratingMethod === '1-5' && (
                            <PizzaRating
                                initialRating={userRating}
                                onSubmitRating={(rating) => handleRatingSubmit(rating)}
                            />
                        )}

                        {ratingMethod === '1-10' && (
                            <ClassicRating
                                initialRating={userRating}
                                onSubmitRating={(rating) => handleRatingSubmit(rating)}
                            />
                        )}

                        {ratingMethod === 'Percentage' && (
                            <View style={styles.percentageRatingModalContainer}>
                                <PercentageRating
                                    value={percentageSliderInitialValue}
                                    onChange={(newPercentage) => handleRatingSubmit(newPercentage)}
                                />
                            </View>
                        )}

                        {ratingMethod === 'Awards' && (
                            <View style={styles.awardsRatingContainerInModal}>
                                <AwardsRating
                                    initialRatings={detailedAwardsRatings}
                                    onChange={handleAwardsDataChange}
                                />
                                <Text style={styles.awardsOverallTextInModal}>
                                    Overall Calculated: {currentAwardsOverallScore !== null ? `${currentAwardsOverallScore.toFixed(1)}/10` : 'N/A'}
                                </Text>
                                <View style={styles.modalButtonSeparator} />
                                <TouchableOpacity style={styles.modalSubmitButton} onPress={handleFinalAwardsSubmit}>
                                    <Text style={styles.modalSubmitButtonText}>Submit Awards Rating</Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        <View style={styles.modalButtonSeparator} />
                        <Button title="Cancel" onPress={() => setRatingModalVisible(false)} color="#d32f2f" />
                    </View>
                </View>
            </Modal>

            <Modal animationType="slide" transparent={true} visible={reviewModalVisible} onRequestClose={() => setReviewModalVisible(false)}>
                <View style={styles.modalContainer}><View style={styles.modalContent}>
                    <Text style={styles.modalTitle}>Write a Review for {movie?.title}</Text>
                    <TextInput style={styles.reviewInput} multiline placeholder="Your review..." placeholderTextColor="#888" value={reviewText} onChangeText={setReviewText} textAlignVertical="top" />
                    <View style={styles.modalButtonSeparator} />
                    <Button title="Submit Review" onPress={handleReviewSubmit} />
                    <View style={styles.modalButtonSeparator} />
                    <Button title="Cancel" onPress={() => setReviewModalVisible(false)} color="#FF6347" />
                </View></View>
            </Modal>

            {/* Share Preview Modal */}
            <Modal animationType="slide" transparent={true} visible={shareModalVisible} onRequestClose={() => setShareModalVisible(false)}>
                <View style={styles.modalContainer}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Share Output Preview</Text>
                        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', marginBottom: 20 }}>
                            {/* The Capture Container */}
                            <View ref={viewShotRef} collapsable={false} style={styles.shareCard}>
                                <Image source={{ uri: posterUrl }} style={styles.shareBackground} resizeMode="cover" blurRadius={20} />
                                <View style={styles.shareOverlay} />

                                <View style={styles.shareHeader}>
                                    <Image source={topoLogo} style={styles.shareLogo} resizeMode="contain" />
                                </View>

                                <View style={styles.shareBody}>
                                    <Image source={{ uri: posterUrl }} style={styles.sharePoster} resizeMode="cover" />
                                    <View style={styles.shareTextContainer}>
                                        <Text style={styles.shareUserText}>I just rated</Text>
                                        <Text style={styles.shareMovieTitle}>{movie?.title}</Text>
                                        <Text style={styles.shareUserRating}>
                                            {userRating > 0 ? (ratingMethod === 'Percentage' ? `${userRating}%` : `${userRating}/${maxRating}`) : "Highly Rated"}
                                        </Text>
                                        <Text style={styles.shareOnText}>on TOPO</Text>
                                    </View>
                                </View>
                                <Text style={styles.shareFooterText}>Download TOPO today!</Text>
                            </View>
                        </View>

                        <View style={{ flexDirection: 'row', justifyContent: 'space-around', width: '100%' }}>
                            <Button title="Share Now" onPress={handleShare} color="#8a2be2" />
                            <Button title="Close" onPress={() => setShareModalVisible(false)} color="#FF6347" />
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0a0a1a', // Dark theme background
        paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
    },
    headerBar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 15,
        paddingVertical: 10,
        backgroundColor: '#0a0a1a',
        borderBottomWidth: 1,
        borderBottomColor: '#222',
        justifyContent: 'space-between',
        zIndex: 100
    },
    backButton: {
        padding: 5,
    },
    headerBarTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#fff',
        flex: 1,
        textAlign: 'center',
        fontFamily: 'Trebuchet MS',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#0a0a1a',
    },
    loadingText: {
        color: '#fff',
        marginTop: 10,
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#0a0a1a',
    },
    errorText: {
        color: '#ff6347',
        fontSize: 16,
    },
    headerContentContainer: {
        paddingTop: 10,
    },
    poster: {
        width: '100%',
        height: 450,
        marginBottom: 20,
        resizeMode: 'contain',
    },
    detailsContainer: {
        flex: 1,
        paddingHorizontal: 15,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        marginBottom: 8,
        textAlign: 'center',
        color: '#fff',
        fontFamily: 'Trebuchet MS',
    },
    info: {
        fontSize: 16,
        color: '#aaa',
        marginBottom: 20,
        textAlign: 'center',
        fontFamily: 'Trebuchet MS',
    },
    plot: {
        fontSize: 16,
        marginBottom: 25,
        lineHeight: 24,
        color: '#ddd',
        textAlign: 'justify',
        fontFamily: 'Trebuchet MS',
    },
    ratingsSectionContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 25,
        padding: 15,
        backgroundColor: '#161625',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#333',
    },
    yourRatingColumn: {
        flex: 1,
        alignItems: 'center',
        padding: 10,
        borderRadius: 8,
        marginRight: 10,
        backgroundColor: '#1e1e2d',
    },
    usersRatingsColumn: {
        flex: 1.2,
        alignItems: 'center',
        padding: 10,
        justifyContent: 'center'
    },
    ratingHeader: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 10,
        color: '#ccc',
        textAlign: 'center',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    yourScoreText: {
        fontSize: 26,
        fontWeight: 'bold',
        color: '#FF8C00',
    },
    yourMethodText: {
        fontSize: 12,
        color: '#888',
        marginTop: 4,
    },
    notRatedText: {
        fontSize: 14,
        color: '#666',
        fontStyle: 'italic',
        marginTop: 10,
    },
    ratingDetailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    usersRatingIcon: {
        marginRight: 10,
        width: 18,
        textAlign: 'center'
    },
    ratingDetailText: {
        fontSize: 15,
        color: '#eee',
        marginLeft: 5,
        fontWeight: '500',
    },
    buttonGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        marginTop: 15,
        marginBottom: 20
    },
    gridButton: {
        width: '48%', // 2 columns with spacing
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 12,
        borderRadius: 8,
        marginBottom: 10,
    },
    gridButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        letterSpacing: 0.5
    },
    // Retaining secondaryButton for potential other uses, but PrimaryButton is likely obsolete in this view layout
    primaryButton: {
        backgroundColor: '#e50914',
        paddingVertical: 15,
        borderRadius: 8,
        alignItems: 'center',
        marginBottom: 15,
    },
    primaryButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    secondaryButton: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 12,
        borderRadius: 8,
    },
    secondaryButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: 'bold',
    },
    reviewsTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        marginTop: 10,
        marginBottom: 15,
        color: '#fff',
        paddingLeft: 15,
        fontFamily: 'Trebuchet MS',
    },
    noReviewsText: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
        paddingVertical: 30,
        fontStyle: 'italic',
    },
    reviewItem: {
        marginBottom: 15,
        paddingHorizontal: 15,
    },
    reviewBubble: {
        backgroundColor: '#161625',
        borderRadius: 12,
        padding: 15,
        borderWidth: 1,
        borderColor: '#333',
    },
    reviewUser: {
        fontWeight: 'bold',
        marginBottom: 6,
        color: '#FF8C00',
        fontSize: 16,
    },
    reviewTextContent: {
        fontSize: 15,
        lineHeight: 22,
        color: '#ddd',
    },
    reviewInput: {
        borderWidth: 1,
        borderColor: '#444',
        padding: 15,
        marginBottom: 20,
        borderRadius: 10,
        backgroundColor: '#252535',
        minHeight: 120,
        width: '100%',
        textAlignVertical: 'top',
        fontSize: 16,
        color: '#fff',
    },
    // Modal Styles Update
    modalContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.85)',
    },
    modalContent: {
        width: '90%',
        padding: 25,
        backgroundColor: '#161625',
        borderRadius: 15,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#333',
    },
    modalTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        marginBottom: 20,
        color: '#fff',
        textAlign: 'center',
    },
    listOptionitem: {
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#222',
        backgroundColor: '#1e1e2d',
        marginBottom: 8,
        borderRadius: 8,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    listOptionText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#fff'
    },
    listOptionCount: {
        fontSize: 12,
        color: '#888'
    },
    modalButtonSeparator: {
        height: 15,
    },
    awardsRatingContainerInModal: {
        width: '100%',
        height: 500, // Fixed height to allow scrolling
        marginBottom: 10,
    },
    awardsOverallTextInModal: {
        marginVertical: 15,
        fontWeight: 'bold',
        fontSize: 18,
        color: '#FFFFFF',
        textAlign: 'center',
    },
    percentageRatingModalContainer: {
        width: '100%',
        paddingHorizontal: 10,
        marginBottom: 15,
    },
    modalSubmitButton: {
        backgroundColor: '#ff8c00',
        paddingVertical: 12,
        paddingHorizontal: 30,
        borderRadius: 25,
        alignItems: 'center',
        marginTop: 10,
        width: '80%',
        alignSelf: 'center',
    },
    modalSubmitButtonText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: 'bold',
    },
    // Share Feature Styles
    shareCard: {
        width: 300,
        height: 500,
        borderRadius: 20,
        overflow: 'hidden',
        backgroundColor: '#000',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 30
    },
    shareBackground: {
        position: 'absolute',
        width: '100%',
        height: '100%',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        opacity: 0.8
    },
    shareOverlay: {
        position: 'absolute',
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(0,0,0,0.5)'
    },
    shareHeader: {
        alignItems: 'center',
        marginTop: 10
    },
    shareLogo: {
        width: 100,
        height: 50,
        borderRadius: 15,
        opacity: 0.8,
        // tintColor removed to show original logo colors
    },
    shareBody: {
        alignItems: 'center',
        width: '100%',
        paddingHorizontal: 20
    },
    sharePoster: {
        width: 160,
        height: 240,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: '#fff',
        marginBottom: 20,
        elevation: 10
    },
    shareTextContainer: {
        alignItems: 'center',
    },
    shareUserText: {
        color: '#ccc',
        fontSize: 14,
        fontFamily: 'Trebuchet MS',
        textTransform: 'uppercase',
        letterSpacing: 2
    },
    shareMovieTitle: {
        color: '#fff',
        fontSize: 24,
        fontWeight: 'bold',
        textAlign: 'center',
        marginVertical: 5,
        fontFamily: 'Trebuchet MS',
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: -1, height: 1 },
        textShadowRadius: 10
    },
    shareUserRating: {
        color: '#FF8C00', // Dark Orange / "Oranges Yellow" to match app theme
        fontSize: 48,
        fontWeight: '900',
        textShadowColor: 'rgba(0, 0, 0, 0.9)',
        textShadowOffset: { width: 2, height: 2 },
        textShadowRadius: 5
    },
    shareOnText: {
        color: '#fff',
        fontSize: 12,
        marginTop: 5,
        opacity: 0.8
    },
    shareFooterText: {
        color: '#fff',
        fontSize: 8,
        opacity: 0.6,
        letterSpacing: 1
    }
});

export default MovieDetailScreen;
