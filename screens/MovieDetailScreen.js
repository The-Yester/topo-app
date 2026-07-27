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
    SafeAreaView,
    KeyboardAvoidingView,
    Animated, // Added for Toast
    Dimensions
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { MoviesContext } from '../context/MoviesContext';
import { getMovieDetails } from '../api/MovieService';
import { doc, onSnapshot, getDoc, setDoc, collection, addDoc, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebaseConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Picker } from '@react-native-picker/picker';
import Icon from 'react-native-vector-icons/FontAwesome';
import MaterialIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import PizzaRating from '../context/PizzaRating';
import AwardsRating from '../context/AwardsRating';
import PercentageRating from '../context/PercentageRating';
import ClassicRating from '../context/ClassicRating';
import ThumbsRating from '../components/ThumbsRating';
import { captureRef } from 'react-native-view-shot';
import { convertRating } from '../context/RatingLogic';
import * as Sharing from 'expo-sharing';
import TicketStubCard from '../components/TicketStubCard';
import { sendPushNotification, getUserPushToken } from '../services/NotificationService';

const pizzaSliceFull = require('../assets/pizza_full.jpg');
const pizzaSliceHalf = require('../assets/pizza_half.jpg');
const topoLogo = require('../assets/TOPO_Logo.jpg');
const appBackground = require('../assets/TOPO_Background_3.4.png');

const MovieDetailScreen = ({ route }) => {
    const navigation = useNavigation();
    const { ratingMethod, addMovieToList, addToRecentlyWatched, addToRecentActivity, submitRating, movieLists, overallRatedMovies, mintTicketStub } = useContext(MoviesContext);
    const [userRating, setUserRating] = useState(0);
    const [collectiveAverage, setCollectiveAverage] = useState(null);
    const [totalRatingsCount, setTotalRatingsCount] = useState(0);
    const [activePage, setActivePage] = useState(0);
    const [scrollWidth, setScrollWidth] = useState(180);
    const { movieId, movie: initialMovie } = route.params;
    const [movie, setMovie] = useState(initialMovie || null);
    const [ratingModalVisible, setRatingModalVisible] = useState(false);
    const [reviewModalVisible, setReviewModalVisible] = useState(false);
    const [listModalVisible, setListModalVisible] = useState(false);
    const [isWatched, setIsWatched] = useState(false);
    const [listsSortOrder, setListsSortOrder] = useState('asc'); // Default to A-Z / numeric asc

    // Load persisted list sort order when list modal is shown
    useEffect(() => {
        if (!listModalVisible) return;
        const loadListSortOrder = async () => {
            try {
                let savedOrder = await AsyncStorage.getItem('sortOrderLists');
                if (!savedOrder) {
                    const user = auth.currentUser;
                    if (user) {
                        const userSnap = await getDoc(doc(db, "users", user.uid));
                        if (userSnap.exists() && userSnap.data().movieListsSortOrder) {
                            savedOrder = userSnap.data().movieListsSortOrder;
                        }
                    }
                }
                if (savedOrder) {
                    setListsSortOrder(savedOrder);
                }
            } catch (e) {
                console.error("Error loading list sort order in MovieDetailScreen:", e);
            }
        };
        loadListSortOrder();
    }, [listModalVisible]);

    const sortedMovieLists = React.useMemo(() => {
        if (!movieLists) return [];
        const LOCKED_ORDER = ["Favorites", "Watch Later"];
        const locked = [];
        const custom = [];

        movieLists.forEach(list => {
            if (LOCKED_ORDER.includes(list.name)) {
                locked.push(list);
            } else {
                custom.push(list);
            }
        });

        locked.sort((a, b) => LOCKED_ORDER.indexOf(a.name) - LOCKED_ORDER.indexOf(b.name));

        custom.sort((a, b) => {
            const compare = a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
            return listsSortOrder === 'desc' ? -compare : compare;
        });

        return [...locked, ...custom];
    }, [movieLists, listsSortOrder]);

    // Ticket Stub Minting State
    const [isMinting, setIsMinting] = useState(false);
    const [mintedStub, setMintedStub] = useState(null);

    const isTheaterEligible = () => {
        if (!movie || !movie.release_date) return false;
        const releaseDate = new Date(movie.release_date);
        const today = new Date();
        const diffTime = today.getTime() - releaseDate.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays >= -2 && diffDays <= 60; // 60 day theatrical run
    };

    const handleMintTicket = async () => {
        setIsMinting(true);
        const result = await mintTicketStub(movie);
        setIsMinting(false);

        if (result.success) {
            setMintedStub(result.stubData);
            showToast("Successfully checked in!");
        } else {
            Alert.alert("Check-In Failed", result.error);
        }
    };

    // Theater Trip Feature State
    const [tripModalVisible, setTripModalVisible] = useState(false);
    const [tripFriends, setTripFriends] = useState([]);
    const [selectedFriendIds, setSelectedFriendIds] = useState([]);

    const openTripModal = async () => {
        if (!auth.currentUser) return Alert.alert("Login Required", "Please log in to plan a theater trip.");
        setTripModalVisible(true);
        try {
            const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
            if (userDoc.exists()) {
                const data = userDoc.data();
                const friendMap = new Map();
                (data.following || []).forEach(f => friendMap.set(f.uid, f));
                (data.topFriends || []).forEach(f => friendMap.set(f.uid, f)); // Merge deduplicated

                const friendList = Array.from(friendMap.values());
                const fetchPromises = friendList.map(async (friend) => {
                    try {
                        const fDoc = await getDoc(doc(db, "users", friend.uid));
                        if (fDoc.exists()) {
                            return {
                                uid: friend.uid,
                                username: fDoc.data().username || friend.username,
                                profilePhoto: fDoc.data().profilePhoto || null,
                            };
                        }
                    } catch (e) { console.error(e); }
                    return friend; // fallback to cached data if read fails
                });

                const liveFriends = await Promise.all(fetchPromises);
                setTripFriends(liveFriends);
            }
        } catch (e) {
            console.error("Error fetching friends for trip", e);
        }
    };

    const toggleFriendSelection = (uid) => {
        setSelectedFriendIds(prev =>
            prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]
        );
    };

    const handleSendTripInvites = async () => {
        if (selectedFriendIds.length === 0) return Alert.alert("Wait!", "Select at least one friend to ping.");
        if (!auth.currentUser) return;

        try {
            const tripId = `trip_${movieId}_${Date.now()}`;
            const tripRef = doc(db, "theaterTrips", tripId);
            const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
            const username = userDoc.exists() ? userDoc.data().username : "Someone";

            const rsvps = { [auth.currentUser.uid]: 'in' };
            selectedFriendIds.forEach(id => rsvps[id] = 'pending');

            const allMembers = [auth.currentUser.uid, ...selectedFriendIds];

            await setDoc(tripRef, {
                tripId,
                movieId: movieId.toString(),
                movieTitle: movie?.title || "Unknown Movie",
                poster_path: movie?.poster_path || null,
                creatorUid: auth.currentUser.uid,
                creatorUsername: username,
                invitedUids: allMembers,
                rsvps: rsvps,
                createdAt: new Date().toISOString()
            });

            // Trigger Push Notifications
            const title = "🍿 Theater Trip Alert!";
            const body = `${username} wants to see ${movie?.title || 'a movie'} in theaters. Are you in?`;

            for (const friendUid of selectedFriendIds) {
                const token = await getUserPushToken(friendUid);
                if (token) {
                    await sendPushNotification(token, title, body, { screen: 'TheaterTrip', tripId });
                }
            }

            setTripModalVisible(false);
            setSelectedFriendIds([]);
            showToast("Theater Trip invites sent! 🍿");

            // Navigate the creator into the newly minted Group Chat
            navigation.navigate("TheaterTrip", { tripId });

        } catch (e) {
            console.error("Error minting trip:", e);
            Alert.alert("Error", "Could not create the Theater Trip.");
        }
    };

    // Share Feature State
    const [shareModalVisible, setShareModalVisible] = useState(false);
    const viewShotRef = useRef();

    const [reviewText, setReviewText] = useState('');
    const [maxRating, setMaxRating] = useState(10);
    const [reviews, setReviews] = useState([]);
    const [currentUser, setCurrentUser] = useState(null);
    const [loading, setLoading] = useState(true);

    const [globalStats, setGlobalStats] = useState(null);

    // Toast State
    const [toastMessage, setToastMessage] = useState('');
    const toastOpacity = useRef(new Animated.Value(0)).current;

    const showToast = (message) => {
        setToastMessage(message);
        Animated.sequence([
            Animated.timing(toastOpacity, {
                toValue: 1,
                duration: 300,
                useNativeDriver: true,
            }),
            Animated.delay(2000),
            Animated.timing(toastOpacity, {
                toValue: 0,
                duration: 300,
                useNativeDriver: true,
            })
        ]).start();
    };

    // Rating State
    const [detailedAwardsRatings, setDetailedAwardsRatings] = useState({});
    const [currentAwardsOverallScore, setCurrentAwardsOverallScore] = useState(null);
    const [activeAwardsFilter, setActiveAwardsFilter] = useState('Movie');
    const [instructionsModalVisible, setInstructionsModalVisible] = useState(false);

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
                        const posterUrl = movie?.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null;
                        navigation.navigate('MainTabs', {
                            screen: 'Message Board',
                            params: { initialText: text, initialPosterUrl: posterUrl }
                        });
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
                // Only show full loading if we have NO data. 
                // If we have initial data, we settle for that while fetching fresh details silently (or with minor indicator)
                if (!movie) {
                    setLoading(true);
                }

                const movieData = await getMovieDetails(movieId);
                // Merge initial data with fresh data to prevent flicker if fields are missing in fresh fetch temporarily
                setMovie(prev => ({ ...prev, ...movieData }));
            } catch (error) {
                console.error("Error fetching movie details:", error);
                // If we have initial data, don't clear it on error, just log.
                if (!movie) setMovie(null);
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

                        if (data.type && data.type.toLowerCase() === 'awards' && data.breakdown) {
                            const breakdownData = { ...data.breakdown };
                            const savedFilter = breakdownData._filter || 'Movie';
                            delete breakdownData._filter;

                            setDetailedAwardsRatings(breakdownData);
                            setActiveAwardsFilter(savedFilter);

                            // If we are currently in Awards mode, the convertRating returns the score as is, which is correct.
                            if (ratingMethod && ratingMethod.toLowerCase() === 'awards') {
                                setCurrentAwardsOverallScore(convertedScore);
                            }
                        } else {
                            // If converting FROM another type TO Awards, we don't have a breakdown.
                            setDetailedAwardsRatings({});
                            setActiveAwardsFilter('Movie');
                            setCurrentAwardsOverallScore(ratingMethod && ratingMethod.toLowerCase() === 'awards' ? convertedScore : null);
                        }
                    } else {
                        setUserRating(0);
                        setDetailedAwardsRatings({});
                        setActiveAwardsFilter('Movie');
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
                case 'Thumbs': currentMax = 4; break;
            }
            setMaxRating(currentMax);
        };
        calculateMaxRatingSystem();
    }, [ratingMethod, userRating]);

    // Real-time listener to calculate the unified Collective Average of all user ratings converted to viewer's style
    useEffect(() => {
        if (!movieId) return;
        const ratingsRef = collection(db, "movies", movieId.toString(), "user_ratings");
        const unsub = onSnapshot(ratingsRef, (snapshot) => {
            let totalConvertedScore = 0;
            let count = 0;
            snapshot.forEach((docSnap) => {
                const data = docSnap.data();
                if (data.score !== undefined && data.type) {
                    const converted = convertRating(data.score, data.type, ratingMethod);
                    totalConvertedScore += converted;
                    count++;
                }
            });
            if (count > 0) {
                setCollectiveAverage(totalConvertedScore / count);
                setTotalRatingsCount(count);
            } else {
                setCollectiveAverage(null);
                setTotalRatingsCount(0);
            }
        });
        return () => unsub();
    }, [movieId, ratingMethod]);

    const formatCollectiveAverage = (avg) => {
        const formattedScore = parseFloat(avg).toFixed(ratingMethod === 'Percentage' ? 0 : 1);
        if (ratingMethod === 'Percentage') {
            return `${formattedScore}%`;
        }
        return `${formattedScore}/${maxRating}`;
    };

    const renderCollectiveRatingIcon = () => {
        const iconSize = 28;
        switch (ratingMethod) {
            case '1-5':
            case 'Pizza':
                return <MaterialIcon name="pizza" size={iconSize} color="#FF5722" style={{ marginTop: 5 }} />;
            case '1-10':
            case 'Classic':
                return (
                    <View style={{ width: iconSize, height: iconSize, borderRadius: iconSize / 2, backgroundColor: '#FFC107', justifyContent: 'center', alignItems: 'center', marginTop: 5 }}>
                        <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#000' }}>10</Text>
                    </View>
                );
            case 'Percentage':
                return <Icon name="percent" size={iconSize - 4} color="#4CAF50" style={{ marginTop: 5 }} />;
            case 'Awards':
                return <Icon name="trophy" size={iconSize} color="#FFD700" style={{ marginTop: 5 }} />;
            case 'Thumbs':
                return <MaterialIcon name="thumb-up" size={iconSize} color="#4CAF50" style={{ marginTop: 5 }} />;
            default:
                return null;
        }
    };

    const onScrollViewLayout = (event) => {
        const { width } = event.nativeEvent.layout;
        if (width > 0) {
            setScrollWidth(width);
        }
    };

    const handleScroll = (event) => {
        const contentOffsetX = event.nativeEvent.contentOffset.x;
        const width = event.nativeEvent.layoutMeasurement.width;
        if (width > 0) {
            const page = Math.round(contentOffsetX / width);
            setActivePage(page);
        }
    };

    // Load Reviews (Live from Firestore)
    useEffect(() => {
        if (!movieId) return;
        const reviewsRef = collection(db, "movies", String(movieId), "reviews");
        const q = query(reviewsRef, orderBy("createdAt", "asc"));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedReviews = [];
            snapshot.forEach((docSnap) => {
                fetchedReviews.push({ id: docSnap.id, ...docSnap.data() });
            });
            setReviews(fetchedReviews);
        }, (error) => {
            console.error("Error loading live reviews:", error);
        });

        return () => unsubscribe();
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
        if (!auth.currentUser) {
            Alert.alert("Login Required", "You must be logged in to leave a review.");
            return;
        }
        try {
            const reviewsRef = collection(db, "movies", String(movieId), "reviews");
            await addDoc(reviewsRef, {
                text: reviewText,
                user: currentUser?.username || "Anonymous",
                userId: auth.currentUser.uid,
                profilePhoto: currentUser?.profilePhoto || null,
                createdAt: serverTimestamp()
            });

            // setReviews is automatically handled by the onSnapshot listener!
            setReviewModalVisible(false);
            setReviewText('');
            Alert.alert("Success", "Your review has been published!");
        } catch (error) {
            console.error("Error publishing review:", error);
            Alert.alert("Error", "Failed to publish review.");
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
            } else if (ratingMethod === 'Thumbs') {
                validatedRating = Math.max(0.5, Math.min(4, ratingValue));
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

            if (movie) {
                const activityItem = {
                    id: movie.id,
                    title: movie.title,
                    poster_path: movie.poster_path,
                    userRating: validatedRating,
                    ratingMethod: ratingMethod
                };

                if (isWatched) {
                    // If marked as Watched -> Go to Recenty Watched ONLY
                    addToRecentlyWatched(activityItem);
                } else {
                    // If NOT marked as Watched -> Go to Recent Activity
                    addToRecentActivity(activityItem);
                }
            }

            Alert.alert("Success", "Rating saved!");
        } catch (error) {
            console.error("Error saving rating:", error);
            Alert.alert("Error", "Failed to save rating.");
        }
    };

    const handleAwardsDataChange = React.useCallback((averageScore, detailedRatingsFromAwardsComponent, activeFilterValue) => {
        setCurrentAwardsOverallScore(averageScore);
        setDetailedAwardsRatings(detailedRatingsFromAwardsComponent);
        if (activeFilterValue) setActiveAwardsFilter(activeFilterValue);
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

            const breakdownToSave = { ...detailedAwardsRatings, _filter: activeAwardsFilter };
            await submitRating(movieId, 'Awards', overallAwardsScoreToSave, breakdownToSave, movieInfoForContext);

            if (movie) {
                const activityItem = {
                    id: movie.id,
                    title: movie.title,
                    poster_path: movie.poster_path,
                    userRating: overallAwardsScoreToSave,
                    ratingMethod: 'Awards',
                    awardsFilter: activeAwardsFilter
                };

                if (isWatched) {
                    // If marked as Watched -> Go to Recenty Watched ONLY
                    addToRecentlyWatched(activityItem);
                } else {
                    // If NOT marked as Watched -> Go to Recent Activity
                    addToRecentActivity(activityItem);
                }
            }

            Alert.alert("Success", `Awards rating of ${overallAwardsScoreToSave.toFixed(1)} saved!`);
        } catch (error) {
            console.error("Error saving final awards rating:", error);
            Alert.alert("Error", "Failed to save final awards rating.");
        }
    };

    if (loading && !movie) return <View style={styles.loadingContainer}><Text style={styles.loadingText}>Loading...</Text></View>;
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

                {/* Director & Cast Info */}
                {movie.credits && (
                    <View style={styles.creditsContainer}>
                        {movie.credits.crew?.find(c => c.job === 'Director') && (
                            <View style={styles.creditRow}>
                                <Text style={styles.creditLabel}>Director: </Text>
                                <TouchableOpacity onPress={() => navigation.push('ActorDetail', { personId: movie.credits.crew.find(c => c.job === 'Director').id })}>
                                    <Text style={styles.creditName}>{movie.credits.crew.find(c => c.job === 'Director').name}</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                        {movie.credits.cast?.length > 0 && (
                            <View style={styles.creditRow}>
                                <Text style={styles.creditLabel}>Starring: </Text>
                                <View style={styles.castList}>
                                    {movie.credits.cast.slice(0, 4).map((person, index) => (
                                        <TouchableOpacity key={person.id} onPress={() => navigation.push('ActorDetail', { personId: person.id })}>
                                            <Text style={styles.creditName}>
                                                {person.name}{index < Math.min(movie.credits.cast.length, 4) - 1 ? ', ' : ''}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>
                        )}
                    </View>
                )}
                <Text style={styles.plot}>{movie.overview}</Text>

                <View style={styles.ratingsSectionContainer}>
                    {/* ... (Ratings columns remain same) ... */}
                    <View style={styles.yourRatingColumn}>
                        <Text style={styles.ratingHeader}>Your Rating</Text>
                        <View style={styles.ratingContentContainer}>
                            {userRating > 0 || (ratingMethod === 'Percentage' && userRating >= 0) ? (
                                <>
                                    <Text style={styles.yourScoreText}>
                                        {`${parseFloat(userRating).toFixed(ratingMethod === 'Percentage' ? 0 : 1)}`}
                                        {ratingMethod === 'Percentage' ? '%' : `/${maxRating}`}
                                    </Text>

                                    <View style={{ marginTop: 8 }}>
                                        {(ratingMethod === '1-5' || ratingMethod === 'Pizza') && (
                                            <MaterialIcon name="pizza" size={24} color="#FF5722" />
                                        )}
                                        {(ratingMethod === '1-10' || ratingMethod === 'Classic') && (
                                            <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: '#FFC107', justifyContent: 'center', alignItems: 'center' }}>
                                                <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#000' }}>10</Text>
                                            </View>
                                        )}
                                        {ratingMethod === 'Percentage' && (
                                            <Icon name="percent" size={20} color="#4CAF50" />
                                        )}
                                        {ratingMethod === 'Awards' && (
                                            <Icon name="trophy" size={24} color="#FFD700" />
                                        )}
                                        {ratingMethod === 'Thumbs' && (
                                            <MaterialIcon name="thumb-up" size={24} color="#4CAF50" />
                                        )}
                                    </View>
                                </>
                            ) : <Text style={styles.notRatedText}>Not Yet Rated</Text>}
                        </View>
                    </View>
                    <View style={styles.usersRatingsColumn}>
                        <Text style={styles.ratingHeader}>TOPO Users</Text>

                        <ScrollView
                            horizontal
                            pagingEnabled
                            showsHorizontalScrollIndicator={false}
                            onMomentumScrollEnd={handleScroll}
                            onLayout={onScrollViewLayout}
                            style={styles.topoUsersScrollView}
                            contentContainerStyle={styles.topoUsersScrollContent}
                            nestedScrollEnabled={true}
                            decelerationRate="fast"
                        >
                            {/* Page 0: Direct Averages List */}
                            <View style={[styles.scrollPage, { width: scrollWidth, alignItems: 'stretch' }]}>
                                {/* Classic (Badge 10) */}
                                <TouchableOpacity
                                    style={styles.ratingDetailRow}
                                    onPress={() => navigation.navigate('StyleRatings', {
                                        movieId: movie.id,
                                        movieTitle: movie.title,
                                        posterPath: movie.poster_path,
                                        ratingStyle: 'classic',
                                        averageScore: globalStats?.classic?.count > 0 ? `${globalStats.classic.average.toFixed(1)}/10` : 'N/A',
                                        ratingCount: globalStats?.classic?.count || 0
                                    })}
                                    activeOpacity={0.7}
                                >
                                    <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFC107', justifyContent: 'center', alignItems: 'center', marginRight: 10 }}>
                                        <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#000' }}>10</Text>
                                    </View>
                                    <Text style={styles.ratingDetailText}>
                                        {globalStats?.classic?.count > 0 ? `${globalStats.classic.average.toFixed(1)}/10` : 'N/A'}
                                    </Text>
                                </TouchableOpacity>

                                {/* Pizza (Vector Icon) */}
                                <TouchableOpacity
                                    style={styles.ratingDetailRow}
                                    onPress={() => navigation.navigate('StyleRatings', {
                                        movieId: movie.id,
                                        movieTitle: movie.title,
                                        posterPath: movie.poster_path,
                                        ratingStyle: 'pizza',
                                        averageScore: globalStats?.pizza?.count > 0 ? `${globalStats.pizza.average.toFixed(1)}/5` : 'N/A',
                                        ratingCount: globalStats?.pizza?.count || 0
                                    })}
                                    activeOpacity={0.7}
                                >
                                    <MaterialIcon name="pizza" size={18} color="#FF5722" style={styles.usersRatingIcon} />
                                    <Text style={styles.ratingDetailText}>
                                        {globalStats?.pizza?.count > 0 ? `${globalStats.pizza.average.toFixed(1)}/5` : 'N/A'}
                                    </Text>
                                </TouchableOpacity>

                                {/* Percentage */}
                                <TouchableOpacity
                                    style={styles.ratingDetailRow}
                                    onPress={() => navigation.navigate('StyleRatings', {
                                        movieId: movie.id,
                                        movieTitle: movie.title,
                                        posterPath: movie.poster_path,
                                        ratingStyle: 'percentage',
                                        averageScore: globalStats?.percentage?.count > 0 ? `${globalStats.percentage.average.toFixed(0)}%` : 'N/A',
                                        ratingCount: globalStats?.percentage?.count || 0
                                    })}
                                    activeOpacity={0.7}
                                >
                                    <Icon name="percent" size={14} color="#4CAF50" style={styles.usersRatingIcon} />
                                    <Text style={styles.ratingDetailText}>
                                        {globalStats?.percentage?.count > 0 ? `${globalStats.percentage.average.toFixed(0)}%` : 'N/A'}
                                    </Text>
                                </TouchableOpacity>

                                {/* Awards */}
                                <TouchableOpacity
                                    style={styles.ratingDetailRow}
                                    onPress={() => navigation.navigate('StyleRatings', {
                                        movieId: movie.id,
                                        movieTitle: movie.title,
                                        posterPath: movie.poster_path,
                                        ratingStyle: 'awards',
                                        averageScore: globalStats?.awards?.count > 0 ? `${globalStats.awards.average.toFixed(1)}/10` : 'N/A',
                                        ratingCount: globalStats?.awards?.count || 0
                                    })}
                                    activeOpacity={0.7}
                                >
                                    <Icon name="trophy" size={16} color="#FFD700" style={styles.usersRatingIcon} />
                                    <Text style={styles.ratingDetailText}>
                                        {globalStats?.awards?.count > 0 ? `${globalStats.awards.average.toFixed(1)}/10` : 'N/A'}
                                    </Text>
                                </TouchableOpacity>

                                {/* Thumbs - Thumbs Up Variation */}
                                <TouchableOpacity
                                    style={styles.ratingDetailRow}
                                    onPress={() => navigation.navigate('StyleRatings', {
                                        movieId: movie.id,
                                        movieTitle: movie.title,
                                        posterPath: movie.poster_path,
                                        ratingStyle: 'thumbs',
                                        averageScore: globalStats?.thumbs?.count > 0 ? `${globalStats.thumbs.average.toFixed(1)}/4` : 'N/A',
                                        ratingCount: globalStats?.thumbs?.count || 0
                                    })}
                                    activeOpacity={0.7}
                                >
                                    <MaterialIcon name="thumb-up" size={16} color="#4CAF50" style={styles.usersRatingIcon} />
                                    <Text style={styles.ratingDetailText}>
                                        {globalStats?.thumbs?.count > 0 ? `${globalStats.thumbs.average.toFixed(1)}/4` : 'N/A'}
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            {/* Page 1: Collective Average */}
                            <View style={[styles.scrollPage, { width: scrollWidth }]}>
                                <View style={styles.collectiveCard}>
                                    <Text style={styles.collectiveScoreText}>
                                        {collectiveAverage !== null ? formatCollectiveAverage(collectiveAverage) : 'N/A'}
                                    </Text>
                                    {renderCollectiveRatingIcon()}
                                    <Text style={styles.collectiveFootnote}>
                                        (The overall community rating, normalized across all users.)
                                    </Text>
                                </View>
                            </View>
                        </ScrollView>

                        {/* Page dots indicator */}
                        <View style={styles.dotsContainer}>
                            <View style={[styles.dot, activePage === 0 ? styles.activeDot : styles.inactiveDot]} />
                            <View style={[styles.dot, activePage === 1 ? styles.activeDot : styles.inactiveDot]} />
                        </View>
                    </View>
                </View>

                <View style={styles.buttonGrid}>
                    {/* Theatrical Check-In & Plan Trip Buttons (Dynamic) */}
                    {isTheaterEligible() && (
                        <>
                            <TouchableOpacity
                                style={[styles.gridButton, { backgroundColor: '#1E90FF', width: '100%', marginBottom: 10 }]}
                                onPress={handleMintTicket}
                                disabled={isMinting}
                            >
                                <Icon name="ticket" size={16} color="white" style={{ marginRight: 8 }} />
                                <Text style={styles.gridButtonText}>{isMinting ? "Verifying GPS..." : "I'm at the Theater"}</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.gridButton, { backgroundColor: '#FFD700', width: '100%', marginBottom: 10 }]}
                                onPress={openTripModal}
                            >
                                <Icon name="users" size={16} color="#000" style={{ marginRight: 8 }} />
                                <Text style={[styles.gridButtonText, { color: '#000' }]}>Plan a Theater Trip</Text>
                            </TouchableOpacity>
                        </>
                    )}

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
                    <TouchableOpacity
                        style={[styles.gridButton, { backgroundColor: '#ff8c00' }]}
                        onPress={() => {
                            if (movie) {
                                addMovieToList(1, movie);
                                showToast("Added to Favorites");
                            }
                        }}
                    >
                        <Icon name="heart" size={16} color="white" style={{ marginRight: 8 }} />
                        <Text style={styles.gridButtonText}>Favorites</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.gridButton, { backgroundColor: '#4682b4' }]}
                        onPress={() => {
                            if (movie) {
                                addMovieToList(2, movie);
                                showToast("Added to Watchlist");
                            }
                        }}
                    >
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
                                data={sortedMovieLists}
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

            {/* Instructions Modal */}
            <Modal animationType="fade" transparent={true} visible={instructionsModalVisible} onRequestClose={() => setInstructionsModalVisible(false)}>
                <View style={styles.modalContainer}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>How to Rate & Log 🍿</Text>

                        <View style={{ marginVertical: 10, paddingHorizontal: 5 }}>
                            <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold', marginBottom: 5 }}>1. Quick Rate ⭐️</Text>
                            <Text style={{ color: '#ccc', fontSize: 14, marginBottom: 15 }}>
                                If you just want to Rate a movie, select your score and tap <Text style={{ fontWeight: 'bold', color: '#ff8c00' }}>Submit</Text>. It will automatically be added to your Recently Rated list.
                            </Text>

                            <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold', marginBottom: 5 }}>2. Log as Watched 🎬</Text>
                            <Text style={{ color: '#ccc', fontSize: 14 }}>
                                If you recently watched the movie, tap the <Text style={{ fontWeight: 'bold', color: '#00FFFF' }}>Press to add to Recently Watched</Text> button first (do not hit Cancel), and THEN tap <Text style={{ fontWeight: 'bold', color: '#ff8c00' }}>Submit</Text>.
                                {"\n\n"}This separates your movies on your home screen, showing what you've just rated vs what you just watched and rated!
                            </Text>
                        </View>

                        <View style={styles.modalButtonSeparator} />
                        <TouchableOpacity style={styles.modalSubmitButton} onPress={() => setInstructionsModalVisible(false)}>
                            <Text style={styles.modalSubmitButtonText}>Got it!</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            <Modal animationType="slide" transparent={true} visible={ratingModalVisible} onRequestClose={() => setRatingModalVisible(false)}>
                <View style={styles.modalContainer}>
                    <View style={[styles.modalContent, { maxHeight: Dimensions.get('window').height * 0.85 }]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                            <Text style={[styles.modalTitle, { marginBottom: 0 }]}>Rate {movie?.title}</Text>
                            <TouchableOpacity onPress={() => setInstructionsModalVisible(true)} style={{ marginLeft: 10 }}>
                                <Icon name="info-circle" size={20} color="#ff8c00" />
                            </TouchableOpacity>
                        </View>

                        {ratingMethod === '1-5' && (
                            <PizzaRating
                                initialRating={userRating}
                                onSubmitRating={(rating) => handleRatingSubmit(rating)}
                            />
                        )}

                        {ratingMethod === '1-10' && (
                            <View style={{ maxHeight: Dimensions.get('window').height * 0.65, width: '100%' }}>
                                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1, paddingBottom: 10 }}>
                                    <ClassicRating
                                        initialRating={userRating}
                                        onSubmitRating={(rating) => handleRatingSubmit(rating)}
                                    />
                                </ScrollView>
                            </View>
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
                            <View style={[styles.awardsRatingContainerInModal, { height: Dimensions.get('window').height * 0.65 }]}>
                                <AwardsRating
                                    initialRatings={detailedAwardsRatings}
                                    initialFilter={activeAwardsFilter}
                                    onChange={handleAwardsDataChange}
                                >
                                    <View style={styles.awardsBottomSection}>
                                        <Text style={styles.awardsOverallTextInModal}>
                                            Overall Calculated: {currentAwardsOverallScore !== null ? `${currentAwardsOverallScore.toFixed(1)}/10` : 'N/A'}
                                        </Text>
                                        <TouchableOpacity style={styles.modalSubmitButton} onPress={handleFinalAwardsSubmit}>
                                            <Text style={styles.modalSubmitButtonText}>Submit</Text>
                                        </TouchableOpacity>
                                    </View>
                                    {/* Action Buttons Row passed as children so it scrolls cleanly inside Awards module */}
                                    <View style={{ flexDirection: 'row', width: '100%', justifyContent: 'space-between', marginTop: 15 }}>
                                        <TouchableOpacity
                                            style={{
                                                flex: 1,
                                                marginRight: 5,
                                                height: 50,
                                                borderRadius: 25,
                                                backgroundColor: isWatched ? '#333' : '#00FFFF',
                                                flexDirection: 'row',
                                                justifyContent: 'center',
                                                alignItems: 'center',
                                            }}
                                            onPress={() => setIsWatched(!isWatched)}
                                        >
                                            <Text style={{ fontSize: 16, marginRight: 6 }}>{isWatched ? "✅" : "🎥"}</Text>
                                            <Text
                                                style={{
                                                    fontSize: 12,
                                                    color: isWatched ? '#FFF' : '#000',
                                                    textAlign: 'center',
                                                    fontWeight: 'bold',
                                                    flexShrink: 1
                                                }}
                                                numberOfLines={2}
                                                adjustsFontSizeToFit
                                            >
                                                {isWatched ? "Watched" : "Press to add to\nRecently Watched"}
                                            </Text>
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            style={{
                                                flex: 1,
                                                marginLeft: 5,
                                                height: 50,
                                                borderRadius: 25,
                                                backgroundColor: '#ff6347',
                                                justifyContent: 'center',
                                                alignItems: 'center',
                                            }}
                                            onPress={() => setRatingModalVisible(false)}
                                        >
                                            <Text style={{ fontSize: 16, color: '#fff', fontWeight: 'bold' }}>Cancel</Text>
                                        </TouchableOpacity>
                                    </View>
                                </AwardsRating>
                            </View>
                        )}

                        {ratingMethod === 'Thumbs' && (
                            <View style={{ marginVertical: 20, alignItems: 'center' }}>
                                <ThumbsRating rating={userRating} onRate={(r) => setUserRating(r)} size={50} />
                                <View style={styles.modalButtonSeparator} />
                                <View style={{ flexDirection: 'row', width: '90%', justifyContent: 'space-between' }}>
                                    <TouchableOpacity style={[styles.modalSubmitButton, { flex: 0.6, marginRight: 5, width: 'auto', backgroundColor: '#ff6b6b' }]} onPress={() => setUserRating(0)}>
                                        <Text style={styles.modalSubmitButtonText}>Reset</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={[styles.modalSubmitButton, { flex: 1, marginLeft: 5, width: 'auto' }]} onPress={() => handleRatingSubmit(userRating)}>
                                        <Text style={styles.modalSubmitButtonText}>Submit</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}

                        {/* Action Buttons Row (Only render OUTSIDE if we are NOT using Awards, since Awards renders them inside its scrolling module) */}
                        {ratingMethod !== 'Awards' && (
                            <View style={{ flexDirection: 'row', width: '100%', justifyContent: 'space-between', marginTop: 15 }}>
                                {/* Watched Toggle (Left) */}
                                <TouchableOpacity
                                    style={{
                                        flex: 1,
                                        marginRight: 5,
                                        height: 50,
                                        borderRadius: 25,
                                        backgroundColor: isWatched ? '#333' : '#00FFFF',
                                        flexDirection: 'row',
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                    }}
                                    onPress={() => setIsWatched(!isWatched)}
                                >
                                    <Text style={{ fontSize: 16, marginRight: 6 }}>{isWatched ? "✅" : "🎥"}</Text>
                                    <Text
                                        style={{
                                            fontSize: 12,
                                            color: isWatched ? '#FFF' : '#000',
                                            textAlign: 'center',
                                            fontWeight: 'bold',
                                            flexShrink: 1
                                        }}
                                        numberOfLines={2}
                                        adjustsFontSizeToFit
                                    >
                                        {isWatched ? "Watched" : "Press to add to\nRecently Watched"}
                                    </Text>
                                </TouchableOpacity>

                                {/* Cancel Button (Right) */}
                                <TouchableOpacity
                                    style={{
                                        flex: 1,
                                        marginLeft: 5,
                                        height: 50,
                                        borderRadius: 25,
                                        backgroundColor: '#ff6347',
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                    }}
                                    onPress={() => setRatingModalVisible(false)}
                                >
                                    <Text style={{ fontSize: 16, color: '#fff', fontWeight: 'bold' }}>Cancel</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                </View>
            </Modal>

            <Modal animationType="slide" transparent={true} visible={reviewModalVisible} onRequestClose={() => setReviewModalVisible(false)}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                    style={styles.modalContainer}
                >
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Write a Review for {movie?.title}</Text>
                        <TextInput style={styles.reviewInput} multiline placeholder="Your review..." placeholderTextColor="#888" value={reviewText} onChangeText={setReviewText} textAlignVertical="top" />
                        <View style={styles.modalButtonSeparator} />
                        <TouchableOpacity style={styles.modalSubmitButton} onPress={handleReviewSubmit}>
                            <Text style={styles.modalSubmitButtonText}>Submit Review</Text>
                        </TouchableOpacity>
                        <View style={styles.modalButtonSeparator} />
                        <TouchableOpacity style={styles.modalSecondaryButton} onPress={() => setReviewModalVisible(false)}>
                            <Text style={styles.modalSecondaryButtonText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* Share Preview Modal */}
            <Modal animationType="slide" transparent={true} visible={shareModalVisible} onRequestClose={() => setShareModalVisible(false)}>
                <View style={styles.modalContainer}>
                    <View style={[styles.modalContent, { maxHeight: '90%' }]}>
                        <ScrollView contentContainerStyle={{ alignItems: 'center' }} showsVerticalScrollIndicator={false}>
                            <Text style={styles.modalTitle}>Share Output Preview</Text>
                            <View style={{ justifyContent: 'center', alignItems: 'center', marginBottom: 20 }}>
                                {/* The Capture Container */}
                                <View ref={viewShotRef} collapsable={false} style={styles.shareCard}>
                                    <Image source={{ uri: posterUrl }} style={styles.shareBackground} resizeMode="cover" blurRadius={30} />
                                    <View style={styles.shareOverlayDarken} />

                                    <View style={styles.shareCentralContent}>
                                        <Text style={styles.shareMovieTitleTop} numberOfLines={2}>
                                            {movie?.title}
                                        </Text>

                                        <Image source={{ uri: posterUrl }} style={styles.sharePosterCentered} resizeMode="cover" />

                                        <Text style={styles.shareDirectorText}>
                                            Directed by: {movie?.credits?.crew?.find(c => c.job === 'Director')?.name || 'Unknown'} • {movie?.release_date ? movie.release_date.substring(0, 4) : ''}
                                        </Text>

                                        <View style={styles.shareRatingRow}>
                                            {userRating > 0 && (
                                                <View style={styles.shareEmojiIcon}>
                                                    {ratingMethod === 'Percentage' && <Icon name="percent" size={24} color="#4CAF50" />}
                                                    {(ratingMethod === '1-10' || ratingMethod === 'Classic') && <Icon name="star" size={24} color="#FFC107" />}
                                                    {(ratingMethod === '1-5' || ratingMethod === 'Pizza') && <MaterialIcon name="pizza" size={24} color="#FF5722" />}
                                                    {ratingMethod === 'Awards' && <Icon name="trophy" size={24} color="#FFD700" />}
                                                    {ratingMethod === 'Thumbs' && <MaterialIcon name="thumb-up" size={24} color="#4CAF50" />}
                                                </View>
                                            )}

                                            <View style={styles.shareBadgePillGlass}>
                                                <Text style={styles.shareBadgeTextOrange}>
                                                    {userRating > 0 ? (ratingMethod === 'Percentage' ? `${userRating}%` : `${userRating}/${maxRating}`) : "Highly Rated"}
                                                </Text>
                                            </View>
                                        </View>
                                    </View>

                                    <View style={styles.shareLogoContainer}>
                                        <View style={styles.shareSeparatorRow}>
                                            <View style={styles.shareSeparatorLine} />
                                            <Text style={styles.shareSeparatorText}>on</Text>
                                            <View style={styles.shareSeparatorLine} />
                                        </View>
                                        <Image source={topoLogo} style={styles.shareLogoBottomCentered} resizeMode="contain" />
                                    </View>
                                </View>
                            </View>

                            <View style={{ flexDirection: 'row', justifyContent: 'space-around', width: '100%' }}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-around', width: '100%', marginBottom: 20 }}>
                                    <TouchableOpacity style={styles.modalPrimaryButton} onPress={handleShare}>
                                        <Text style={styles.modalPrimaryButtonText}>Share Now</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.modalSecondaryButton} onPress={() => setShareModalVisible(false)}>
                                        <Text style={styles.modalSecondaryButtonText}>Close</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* Ticket Minting Success Modal */}
            <Modal
                animationType="fade"
                transparent={true}
                visible={!!mintedStub}
                onRequestClose={() => setMintedStub(null)}
            >
                <SafeAreaView style={styles.modalOverlay}>
                    <View style={[styles.ratingModalContent, { alignItems: 'center', backgroundColor: '#111', padding: 25, maxHeight: '85%' }]}>
                        <Text style={[styles.modalTitle, { color: '#FFD700', fontSize: 24, marginBottom: 5 }]}>Check-In Verified!</Text>
                        <Text style={{ color: '#aaa', fontSize: 13, marginBottom: 20, textAlign: 'center' }}>
                            You secured a {mintedStub?.rarityTier} stub at {mintedStub?.theaterName} (+{mintedStub?.pointsEarned || 10} PTS).
                        </Text>

                        {mintedStub && <TicketStubCard stubData={mintedStub} />}

                        <TouchableOpacity
                            style={[styles.modalButton, { backgroundColor: '#ff8c00', marginTop: 30, width: '80%', borderRadius: 25, paddingVertical: 15, elevation: 5, alignItems: 'center', justifyContent: 'center' }]}
                            onPress={() => setMintedStub(null)}
                        >
                            <Text style={[styles.modalButtonText, { fontWeight: '900', fontSize: 16, color: '#fff', textTransform: 'uppercase', letterSpacing: 1, textAlign: 'center' }]}>Collect Stub</Text>
                        </TouchableOpacity>
                    </View>
                </SafeAreaView>
            </Modal>

            {/* Friendzy Theater Trip Invite Modal */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={tripModalVisible}
                onRequestClose={() => setTripModalVisible(false)}
            >
                <SafeAreaView style={styles.modalOverlay}>
                    <View style={[styles.ratingModalContent, { backgroundColor: '#222', maxHeight: '80%', padding: 20 }]}>
                        <Text style={[styles.modalTitle, { color: '#FFD700', fontSize: 24, marginBottom: 5 }]}>Plan a Theater Trip</Text>
                        <Text style={{ color: '#aaa', fontSize: 13, marginBottom: 15, textAlign: 'center' }}>
                            Select friends to push a Theater Notification to.
                        </Text>

                        <ScrollView style={{ width: '100%', marginBottom: 20 }}>
                            {tripFriends.map(friend => {
                                const isSelected = selectedFriendIds.includes(friend.uid);
                                return (
                                    <TouchableOpacity
                                        key={friend.uid}
                                        style={{
                                            flexDirection: 'row', alignItems: 'center', padding: 12,
                                            borderRadius: 8, backgroundColor: isSelected ? 'rgba(255,215,0,0.2)' : '#333',
                                            marginBottom: 10, borderWidth: 1, borderColor: isSelected ? '#FFD700' : 'transparent'
                                        }}
                                        onPress={() => toggleFriendSelection(friend.uid)}
                                    >
                                        <Image
                                            source={friend.profilePhoto && friend.profilePhoto !== "null" && friend.profilePhoto !== "" ? { uri: friend.profilePhoto } : require('../assets/profile_placeholder.jpg')}
                                            style={{ width: 40, height: 40, borderRadius: 20, marginRight: 15 }}
                                        />
                                        <Text style={{ flex: 1, color: '#fff', fontSize: 16, fontWeight: 'bold' }}>{friend.username}</Text>
                                        {isSelected && <Icon name="check-circle" size={24} color="#FFD700" />}
                                    </TouchableOpacity>
                                );
                            })}
                            {tripFriends.length === 0 && (
                                <Text style={{ color: '#aaa', textAlign: 'center', marginTop: 20 }}>No friends found. Follow some users first!</Text>
                            )}
                        </ScrollView>

                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%' }}>
                            <TouchableOpacity
                                style={[styles.modalSecondaryButton, { flex: 1, marginRight: 10, backgroundColor: '#555' }]}
                                onPress={() => setTripModalVisible(false)}
                            >
                                <Text style={styles.modalSecondaryButtonText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalPrimaryButton, { flex: 1, marginLeft: 10, backgroundColor: '#FFD700' }]}
                                onPress={handleSendTripInvites}
                            >
                                <Text style={[styles.modalPrimaryButtonText, { color: '#000' }]}>Send Invites</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </SafeAreaView>
            </Modal>

            {/* Toast Notification */}
            <Animated.View style={[styles.toastContainer, { opacity: toastOpacity, transform: [{ translateY: toastOpacity.interpolate({ inputRange: [0, 1], outputRange: [50, 0] }) }] }]}>
                <Text style={styles.toastText}>{toastMessage}</Text>
            </Animated.View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0a0a1a', // Dark theme background
        paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    ratingModalContent: {
        width: '90%',
        borderRadius: 15,
        overflow: 'hidden',
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
        // justifyContent: 'center', // Removed to keep header at top
        padding: 10,
        borderRadius: 8,
        marginRight: 10,
        backgroundColor: '#1e1e2d',
    },
    ratingContentContainer: {
        flex: 1,
        justifyContent: 'flex-start', // Moved to top as requested
        alignItems: 'center',
        width: '100%',
        paddingTop: 10,
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
        textAlign: 'center', // Added for horizontal text alignment
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
        alignItems: 'stretch', // ensures inner views take full width easily
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
        // Height injected inline dynamically
    },
    awardsBottomSection: {
        paddingTop: 10,
        paddingBottom: 5,
        borderTopWidth: 1,
        borderTopColor: '#333',
        marginTop: 5,
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
        width: 320,
        height: 568, // Approximate 9:16 aspect ratio base size
        borderRadius: 16,
        overflow: 'hidden',
        backgroundColor: '#111',
    },
    shareBackground: {
        position: 'absolute',
        width: '100%',
        height: '100%',
        opacity: 0.6,
    },
    shareOverlayDarken: {
        position: 'absolute',
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    shareCentralContent: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 10,
        paddingHorizontal: 20,
    },
    shareMovieTitleTop: {
        color: '#FF5722',
        fontSize: 16, // Reduced font size by 2 more
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 8, // Brought it down slightly (closer to poster)
        marginTop: 35, // Added more top margin to push it lower from top edge
        fontFamily: 'Arial', // Changed to Arial
        textTransform: 'uppercase',
        letterSpacing: 1,
        textShadowColor: 'rgba(0, 0, 0, 0.8)',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 3
    },
    sharePosterCentered: {
        width: 220,
        height: 330,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
        marginBottom: 15, // Reduced to fit more text
        elevation: 10,
    },
    shareDirectorText: {
        color: '#ccc',
        fontSize: 12,
        fontFamily: 'Arial', // Changed to Arial
        textAlign: 'center',
        marginBottom: 12,
        opacity: 0.9,
    },
    shareRatingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 10, // Added bottom margin to push the separator down
    },
    shareEmojiIcon: {
        marginRight: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    shareBadgePillGlass: {
        backgroundColor: 'rgba(0,0,0,0.85)',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
    },
    shareBadgeTextOrange: {
        color: '#FF5722',
        fontWeight: '900',
        fontSize: 22,
        fontFamily: 'Arial', // Changed to Arial
        letterSpacing: 1,
    },
    shareLogoContainer: {
        alignItems: 'center',
        paddingBottom: 25,
        width: '100%',
        paddingHorizontal: 40,
        marginTop: 25, // Increased top margin to push it further from rating pill
    },
    shareSeparatorRow: {
        flexDirection: 'row',
        alignItems: 'center',
        width: '100%',
        marginBottom: 10,
    },
    shareSeparatorLine: {
        flex: 1,
        height: 2,
        backgroundColor: '#FF5722',
        borderRadius: 1,
    },
    shareSeparatorText: {
        color: '#FF5722',
        marginHorizontal: 10,
        fontWeight: 'bold',
        fontFamily: 'Arial', // Changed to Arial
        textTransform: 'uppercase',
        fontSize: 14,
    },
    shareLogoBottomCentered: {
        width: 100,
        height: 40,
        opacity: 0.9,
    },
    // Toast Styles
    toastContainer: {
        position: 'absolute',
        bottom: 50,
        left: '20%', // approximate centering
        right: '20%',
        backgroundColor: 'rgba(50, 50, 50, 0.9)',
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 25,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
    },
    toastText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: 'bold',
        textAlign: 'center'
    },
    // Custom Modal Buttons
    modalPrimaryButton: {
        backgroundColor: '#8a2be2',
        paddingVertical: 12,
        paddingHorizontal: 25,
        borderRadius: 25, // Bubbly
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#8a2be2',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 5,
        minWidth: 120
    },
    modalPrimaryButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    modalSecondaryButton: {
        backgroundColor: '#ff6347',
        paddingVertical: 12,
        paddingHorizontal: 25,
        borderRadius: 25, // Bubbly
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 120
        // No shadow to differentiate hierarchy, or add if desired
    },
    modalSecondaryButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    // Credits Styles
    creditsContainer: {
        marginTop: 15,
        marginBottom: 5,
        width: '100%',
        paddingHorizontal: 5
    },
    creditRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginBottom: 6,
        alignItems: 'center'
    },
    creditLabel: {
        color: '#aaa',
        fontWeight: 'bold',
        fontSize: 14,
        marginRight: 5
    },
    creditName: {
        color: '#ff8c00',
        fontSize: 14,
        fontWeight: 'bold',
        marginRight: 4
    },
    castList: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        flex: 1
    },
    topoUsersScrollView: {
        width: '100%',
        height: 165,
        marginTop: 5,
    },
    topoUsersScrollContent: {
        alignItems: 'stretch',
    },
    scrollPage: {
        alignSelf: 'stretch',
        justifyContent: 'center',
        paddingHorizontal: 5,
    },
    collectiveCard: {
        backgroundColor: '#ffffff',
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 18,
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    collectiveScoreText: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#111111',
        fontFamily: 'Trebuchet MS',
    },
    collectiveFootnote: {
        fontSize: 9,
        color: '#666666',
        textAlign: 'center',
        marginTop: 10,
        lineHeight: 12,
        fontFamily: 'Trebuchet MS',
    },
    dotsContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 6,
        paddingVertical: 4,
    },
    dot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        marginHorizontal: 4,
    },
    activeDot: {
        backgroundColor: '#ff8c00',
    },
    inactiveDot: {
        backgroundColor: '#555555',
    }
});

export default MovieDetailScreen;
