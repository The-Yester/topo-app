import React, { useState, useContext, useEffect } from 'react';
import {
    View,
    Text,
    Button,
    StyleSheet,
    Image,
    ScrollView,
    TouchableOpacity,
    Modal,
    TextInput,
    Alert,
    FlatList
} from 'react-native';
import { MoviesContext } from '../context/MoviesContext';
import { getMovieDetails } from '../api/MovieService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Picker } from '@react-native-picker/picker';
import Icon from 'react-native-vector-icons/FontAwesome';
import PizzaRating from '../context/PizzaRating';
import AwardsRating from '../context/AwardsRating';
import PercentageRating from '../context/PercentageRating';
import ClassicRating from '../context/ClassicRating';

const pizzaSliceFull = require('../assets/pizza_full.jpg');
const pizzaSliceHalf = require('../assets/pizza_half.jpg');
// const pizzaSliceEmpty = require('../assets/pizza_empty.jpg');

const MovieDetailScreen = ({ route }) => {
    const { ratingMethod, addMovieToList, updateOverallRatings, addToRecentlyWatched } = useContext(MoviesContext);
    const [userRating, setUserRating] = useState(0);
    const { movieId } = route.params;
    const [movie, setMovie] = useState(null);
    const [ratingModalVisible, setRatingModalVisible] = useState(false);
    const [reviewModalVisible, setReviewModalVisible] = useState(false);
    const [reviewText, setReviewText] = useState('');
    const [maxRating, setMaxRating] = useState(10);
    const [reviews, setReviews] = useState([]);
    const [currentUser, setCurrentUser] = useState(null);
    const [loading, setLoading] = useState(true);

    const [detailedAwardsRatings, setDetailedAwardsRatings] = useState({});
    const [currentAwardsOverallScore, setCurrentAwardsOverallScore] = useState(null);

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

    useEffect(() => {
        const loadAllRatings = async () => {
            if (!movieId) return;
            try {
                const genericRating = await AsyncStorage.getItem(`rating_${movieId}`);
                setUserRating(genericRating ? parseFloat(genericRating) : 0);

                const storedDetailedAwards = await AsyncStorage.getItem(`detailed_awards_${movieId}`);
                if (storedDetailedAwards) {
                    const parsedDetailedAwards = JSON.parse(storedDetailedAwards);
                    setDetailedAwardsRatings(parsedDetailedAwards);
                    const validValues = Object.values(parsedDetailedAwards)
                        .map(v => parseFloat(v))
                        .filter(v => !isNaN(v) && v >= 1.0 && v <= 10.0);
                    if (validValues.length > 0) {
                        const sum = validValues.reduce((acc, val) => acc + val, 0);
                        setCurrentAwardsOverallScore(parseFloat((sum / validValues.length).toFixed(1)));
                    } else {
                        setCurrentAwardsOverallScore(null);
                    }
                } else {
                    setDetailedAwardsRatings({});
                    setCurrentAwardsOverallScore(null);
                }
            } catch (error) {
                console.error("Error loading ratings from AsyncStorage:", error);
                setUserRating(0);
                setDetailedAwardsRatings({});
                setCurrentAwardsOverallScore(null);
            }
        };
        loadAllRatings();
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

    useEffect(() => {
        const loadCurrentUser = async () => {
            try {
                const userEmail = await AsyncStorage.getItem('currentUserEmail');
                const usersData = await AsyncStorage.getItem('users');
                const users = usersData ? JSON.parse(usersData) : [];
                const user = users.find(u => u.email === userEmail);
                setCurrentUser(user);
            } catch (error) {
                console.error("Error loading current user:", error);
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
            const newReview = { id: Date.now(), text: reviewText, user: currentUser ? currentUser.username : "Anonymous" };
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
        // Misplaced rating logic removed from here
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
                vote_average: movie.vote_average
            };
            console.log('[MovieDetailScreen] Calling updateOverallRatings (simple/percentage rating):');
            console.log('  Movie ID:', movieId);
            console.log('  Rating Value:', validatedRating);
            console.log('  Movie Info:', JSON.stringify(movieInfoForContext, null, 2));
            updateOverallRatings(movieId, validatedRating, movieInfoForContext);

            if (movie) addToRecentlyWatched({ id: movie.id, title: movie.title, poster_path: movie.poster_path });
            await AsyncStorage.setItem(`rating_${movieId}`, validatedRating.toString());
            Alert.alert("Success", "Rating saved!");
        } catch (error) {
            console.error("Error saving rating:", error);
            Alert.alert("Error", "Failed to save rating.");
        }
    };
    
    const handleAwardsDataChange = (averageScore, detailedRatingsFromAwardsComponent) => {
        setCurrentAwardsOverallScore(averageScore);
        setDetailedAwardsRatings(detailedRatingsFromAwardsComponent);
    };

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
                vote_average: movie.vote_average
            };
            console.log('[MovieDetailScreen] Calling updateOverallRatings (awards rating):'); // Corrected log placement
            console.log('  Movie ID:', movieId);
            console.log('  Overall Score:', overallAwardsScoreToSave);
            console.log('  Movie Info:', JSON.stringify(movieInfoForContext, null, 2));
            updateOverallRatings(movieId, overallAwardsScoreToSave, movieInfoForContext);
            
            if (movie) addToRecentlyWatched({ id: movie.id, title: movie.title, poster_path: movie.poster_path });
            
            await AsyncStorage.setItem(`rating_${movieId}`, overallAwardsScoreToSave.toString());
            await AsyncStorage.setItem(`detailed_awards_${movieId}`, JSON.stringify(detailedAwardsRatings));

            Alert.alert("Success", `Awards rating of ${overallAwardsScoreToSave.toFixed(1)} saved!`);
        } catch (error) {
            console.error("Error saving final awards rating:", error);
            Alert.alert("Error", "Failed to save final awards rating.");
        }
    };

    if (loading) return <View style={styles.loadingContainer}><Text>Loading...</Text></View>;
    if (!movie) return <View style={styles.errorContainer}><Text>Error: Movie not found or data is still loading.</Text></View>;

    const posterUrl = movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : 'https://via.placeholder.com/150';
    const voteAverage = movie.vote_average || 0;
    const percentageSliderInitialValue = ratingMethod === 'Percentage' ? userRating : 50;

    return (
        <View style={styles.container}>
            <ScrollView>
                <Image source={{ uri: posterUrl }} style={styles.poster} resizeMode="contain" />
                <View style={styles.detailsContainer}>
                    <Text style={styles.title}>{movie.title}</Text>
                    <Text style={styles.info}>{movie.release_date?.substring(0, 4)} | {movie.runtime} minutes</Text>
                    <Text style={styles.plot}>{movie.overview}</Text>

                    <View style={styles.ratingsSectionContainer}>
                        <View style={styles.yourRatingColumn}>
                            <Text style={styles.ratingHeader}>Your Rating</Text>
                            {userRating > 0 || (ratingMethod === 'Percentage' && userRating >=0) ? ( // Allow 0% to be shown
                                <>
                                    <Text style={styles.yourScoreText}>
                                        {`${parseFloat(userRating).toFixed(ratingMethod === 'Percentage' ? 0 : 1)}`}
                                        {ratingMethod === 'Percentage' ? '%' : `/${maxRating}`}
                                    </Text>
                                    <Text style={styles.yourMethodText}>({ratingMethod})</Text>
                                </>
                            ) : <Text style={styles.notRatedText}>Not Yet Rated</Text>}
                        </View>
                        <View style={styles.usersRatingsColumn}>
                            <Text style={styles.ratingHeader}>Users Ratings</Text>
                            <View style={styles.ratingDetailRow}>
                                <PizzaRating rating={voteAverage / 2} totalSlices={5} size={28} />
                                <Text style={styles.ratingDetailText}>{`${(voteAverage / 2).toFixed(1)}/5`}</Text>
                            </View>
                            <View style={styles.ratingDetailRow}>
                                <Icon name="star" size={16} color="#FFC107" style={styles.usersRatingIcon} />
                                <Text style={styles.ratingDetailText}>{`${voteAverage.toFixed(1)}/10 Classic`}</Text>
                            </View>
                            <View style={styles.ratingDetailRow}>
                                <Icon name="check-circle" size={16} color="#4CAF50" style={styles.usersRatingIcon} />
                                <Text style={styles.ratingDetailText}>{`${(voteAverage * 10).toFixed(0)}% Percent`}</Text>
                            </View>
                        </View>
                    </View>

                    <View style={styles.buttonContainer}>
                        <Button title="Rate Movie" onPress={() => setRatingModalVisible(true)} />
                        <Button title="Add to Favorite" onPress={() => { if(movie) addMovieToList(1, movie)}} />
                        <Button title="Add to Watchlist" onPress={() => { if(movie) addMovieToList(2, movie)}} />
                        <Button title="Write a Review" onPress={() => setReviewModalVisible(true)} />
                    </View>
                </View>

                <Text style={styles.reviewsTitle}>Reviews</Text>
                {reviews.length > 0 ? (
                    <FlatList data={reviews} keyExtractor={(item) => item.id.toString()} renderItem={({ item }) => (
                        <View style={styles.reviewItem}><View style={styles.reviewBubble}>
                            <Text style={styles.reviewUser}>{item.user}:</Text>
                            <Text style={styles.reviewTextContent}>{item.text}</Text>
                        </View></View>
                    )} style={{ flex: 1 }} nestedScrollEnabled />
                ) : <Text style={styles.noReviewsText}>No reviews yet.</Text>}
            </ScrollView>

            <Modal animationType="slide" transparent={true} visible={ratingModalVisible} onRequestClose={() => setRatingModalVisible(false)}>
                <View style={styles.modalContainer}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Rate {movie?.title}</Text>
                        
                        {ratingMethod === '1-5' && (
                            <View style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: 20 }}>
                                {[...Array(5)].map((_, i) => {
                                    const ratingValue = i + 1;
                                    let imageSource = pizzaSliceHalf; 
                                    if (userRating >= ratingValue) imageSource = pizzaSliceFull;
                                    else if (userRating >= ratingValue - 0.5) imageSource = pizzaSliceHalf;
                                    return (
                                        <TouchableOpacity key={ratingValue} onPress={() => handleRatingSubmit(ratingValue)}>
                                            <Image source={imageSource} style={{ width: 40, height: 40, margin: 5, opacity: userRating >= ratingValue - 0.9 ? 1 : 0.4 }}/>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        )}

                        {ratingMethod === '1-10' && (
                             <ClassicRating
                                userRating={userRating}
                                setUserRating={setUserRating}
                                onSubmit={() => handleRatingSubmit(userRating)}
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
                                <Button title="Submit Awards Rating" onPress={handleFinalAwardsSubmit} />
                            </View>
                        )}
                        
                        <View style={styles.modalButtonSeparator} />
                        <Button title="Cancel" onPress={() => setRatingModalVisible(false)} color="#FF6347" />
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
        </View>
    );
};

const styles = StyleSheet.create({
    awardsRatingContainerInModal: {
        width: '100%',
        height: 350, 
        marginBottom: 10, 
    },
    awardsOverallTextInModal: {
        marginVertical: 15,
        fontWeight: 'bold',
        fontSize: 18,
        color: '#333',
        textAlign: 'center',
    },
    percentageRatingModalContainer: {
        width: '100%',
        paddingHorizontal: 10, 
        marginBottom: 15,
    },
    container: {
        flex: 1,
        padding: 16,
        backgroundColor: '#f0f0f0',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f0f0f0',
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f0f0f0',
    },
    poster: {
        width: '80%',
        height: 350,
        marginBottom: 20,
        alignSelf: 'center',
        borderRadius: 10,
    },
    detailsContainer: {
        flex: 1,
        paddingHorizontal: 8,
    },
    title: {
        fontSize: 26,
        fontWeight: 'bold',
        marginBottom: 8,
        textAlign: 'center',
        color: '#333',
    },
    info: {
        fontSize: 15,
        color: '#555',
        marginBottom: 12,
        textAlign: 'center',
    },
    plot: {
        fontSize: 16,
        marginBottom: 20,
        lineHeight: 22,
        color: '#444',
        textAlign: 'justify',
    },
    ratingsSectionContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 20,
        paddingVertical: 10,
        backgroundColor: 'white',
        borderRadius: 8,
        paddingHorizontal: 10,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 1.41,
    },
    yourRatingColumn: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 10, 
        paddingHorizontal: 5, 
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        marginRight: 5,
        backgroundColor: '#f9f9f9'
    },
    usersRatingsColumn: {
        flex: 1.5,
        alignItems: 'flex-start',
        paddingVertical: 10, 
        paddingLeft: 10, 
        marginLeft: 5,
    },
    ratingHeader: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 8,
        color: '#333',
    },
    yourScoreText: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#FF8C00',
    },
    yourMethodText: {
        fontSize: 12,
        color: '#777',
        fontStyle: 'italic',
        marginTop: 2, 
    },
    notRatedText: {
        fontSize: 14,
        color: '#777',
        fontStyle: 'italic',
    },
    ratingDetailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6,
    },
    usersRatingIcon: {
        marginRight: 8,
    },
    ratingDetailText: {
        fontSize: 14,
        color: '#444',
        marginLeft: 8, 
    },
    buttonContainer: {
        marginTop: 20,
        marginBottom: 20,
    },
    modalContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
    },
    modalContent: {
        width: '90%',
        maxWidth: 350,
        padding: 20,
        backgroundColor: '#fff',
        borderRadius: 15,
        alignItems: 'center',
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
    },
    modalTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        marginBottom: 15,
        color: '#333',
        textAlign: 'center',
    },
    pickerContainer: { 
        width: '100%',
        height: 180,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#ccc',
        marginBottom: 15,
        overflow: 'hidden',
        justifyContent: 'center',
    },
    picker: { 
        width: '100%',
        height: '100%',
        backgroundColor: '#fff',
    },
    pickerItem: { 
        color: '#333',
    },
    modalButtonSeparator: {
        height: 10,
    },
    reviewsTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginTop: 20,
        marginBottom: 10,
        color: '#333',
        paddingLeft: 8,
    },
    noReviewsText: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
        paddingVertical: 20,
    },
    reviewItem: {
        marginBottom: 10,
        paddingHorizontal: 8,
    },
    reviewBubble: {
        backgroundColor: '#fff',
        borderRadius: 8,
        padding: 12,
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.18,
        shadowRadius: 1.00,
    },
    reviewUser: {
        fontWeight: 'bold',
        marginBottom: 4,
        color: '#007BFF',
    },
    reviewTextContent: {
        fontSize: 15,
        lineHeight: 20,
        color: '#444',
    },
    reviewInput: {
        borderWidth: 1,
        borderColor: '#ccc',
        padding: 12,
        marginBottom: 15,
        borderRadius: 10,
        backgroundColor: '#f9f9f9',
        minHeight: 100,
        width: '100%',
        textAlignVertical: 'top',
        fontSize: 16,
        color: '#333',
    },
});

export default MovieDetailScreen;
