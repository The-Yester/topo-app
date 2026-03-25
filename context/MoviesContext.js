import React, { createContext, useState, useEffect, useMemo } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, arrayUnion, arrayRemove, runTransaction, collection, getDocs, increment } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import { verifyTheaterLocation } from '../services/LocationService';

// Define a constant for the special list ID
export const OVERALL_RATINGS_LIST_ID = 'overall_ratings_list_id';
export const OVERALL_RATINGS_LIST_NAME = 'Overall Ratings';

export const MoviesContext = createContext({
    movieLists: [],
    overallRatedMovies: [],
    recentlyWatched: [],
    recentActivity: [],
    ratingMethod: '1-10',
    setRatingMethod: () => { },
    addList: () => { },
    deleteList: () => { },
    getMoviesInList: () => [],
    addMovieToList: () => { },
    removeMovieFromList: () => { },
    addToRecentlyWatched: () => { },
    addToRecentActivity: () => { },
    updateOverallRatings: () => { },
    mintTicketStub: async () => { },
});

export const MoviesProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [movieLists, setMovieLists] = useState([
        { id: 1, name: 'Favorites', movies: [] },
        { id: 2, name: 'Watch Later', movies: [] },
    ]);
    const [overallRatedMovies, setOverallRatedMovies] = useState([]);
    const [recentlyWatched, setRecentlyWatched] = useState([]);
    const [recentActivity, setRecentActivity] = useState([]);
    const [ratingMethod, setRatingMethod] = useState('1-10');

    // Listen for Auth Changes to load data
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            setUser(currentUser);
            if (currentUser) {
                await loadUserData(currentUser.uid);
            } else {
                // Reset state on logout
                setMovieLists([
                    { id: 1, name: 'Favorites', movies: [] },
                    { id: 2, name: 'Watch Later', movies: [] },
                ]);
                setOverallRatedMovies([]);
                setRecentlyWatched([]);
                setRatingMethod('1-10');
            }
        });
        return unsubscribe;
    }, []);

    // Helper to backfill overallRatedMovies from subcollection
    const fetchUserRatings = async (uid) => {
        try {
            const ratingsRef = collection(db, "users", uid, "ratings");
            const snapshot = await getDocs(ratingsRef);

            if (snapshot.empty) return;

            const restoredMovies = [];

            for (const docSnap of snapshot.docs) {
                const ratingData = docSnap.data();
                const movieId = docSnap.id;

                // Fetch Movie Metadata for display
                const movieDocRef = doc(db, "movies", movieId);
                const movieSnap = await getDoc(movieDocRef);

                if (movieSnap.exists()) {
                    const movieMeta = movieSnap.data();
                    restoredMovies.push({
                        id: movieId,
                        title: movieMeta.title || "Unknown",
                        poster_path: movieMeta.poster_path || null,
                        userOverallRating: ratingData.score,
                        release_date: movieMeta.release_date || null
                    });
                }
            }

            if (restoredMovies.length > 0) {
                setOverallRatedMovies(restoredMovies);
                // Save back to user doc to avoid re-fetching next time
                const userDocRef = doc(db, "users", uid);
                await updateDoc(userDocRef, { overallRatedMovies: restoredMovies });
            }
        } catch (error) {
            console.error("Error restoring user ratings:", error);
        }
    };

    const loadUserData = async (uid) => {
        try {
            const userDocRef = doc(db, "users", uid);
            const docSnap = await getDoc(userDocRef);

            if (docSnap.exists()) {
                const data = docSnap.data();
                if (data.movieLists) setMovieLists(data.movieLists);
                if (data.overallRatedMovies && data.overallRatedMovies.length > 0) {
                    setOverallRatedMovies(data.overallRatedMovies);
                } else {
                    // If array is empty/missing, attempt to backfill from subcollection
                    await fetchUserRatings(uid);
                }
                if (data.recentlyWatched) {
                    setRecentlyWatched(data.recentlyWatched.slice(0, 10)); // Force constraint safely
                }
                if (data.recentActivity) {
                    setRecentActivity(data.recentActivity.slice(0, 20)); // Force constraint safely
                }
                if (data.ratingMethod) setRatingMethod(data.ratingMethod);
            } else {
                // Initialize default doc if not exists (migrating old users or fresh start)
                await setDoc(userDocRef, {
                    movieLists,
                    overallRatedMovies: [],
                    recentlyWatched: [],
                    recentActivity: [],
                    ratingMethod: '1-10'
                }, { merge: true });
            }
        } catch (e) {
            console.error('Failed to load data from Firestore.', e);
        }
    };

    const saveData = async (field, value) => {
        if (!user) return;
        try {
            const userDocRef = doc(db, "users", user.uid);
            await updateDoc(userDocRef, {
                [field]: value
            });
        } catch (error) {
            console.error(`Error saving ${field}:`, error);
        }
    };

    const updateRatingMethod = async (method) => {
        setRatingMethod(method);
        await saveData('ratingMethod', method);
    };

    const mintTicketStub = async (movie) => {
        if (!user) return { success: false, error: 'You must be logged in to collect a ticket stub.' };

        // 1. Verify Location using Geofencing
        const locationResult = await verifyTheaterLocation();
        if (!locationResult.success) {
            return locationResult; // Propagates the exact security error back to the UI
        }

        const theaterName = locationResult.theaterName;

        // 2. Determine Rarity Tier
        let rarityTier = 'Silver'; // Classic standard stub
        let pointsEarned = 10;
        
        if (movie.release_date) {
            const releaseDate = new Date(movie.release_date);
            const todayDate = new Date();
            
            // Normalize time mathematically for day comparison
            releaseDate.setHours(0, 0, 0, 0);
            todayDate.setHours(0, 0, 0, 0);

            const diffTime = todayDate.getTime() - releaseDate.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 

            // Allow slightly negative diffDays for Thursday previews
            if (diffDays >= -2 && diffDays <= 1) {
                // Opening Night / Previews
                rarityTier = 'Holographic';
                pointsEarned = 50;
            } else if (diffDays > 1 && diffDays <= 4) {
                // Opening Weekend
                rarityTier = 'Gold';
                pointsEarned = 30;
            }
        }

        try {
            // 3. Mint the Stub in Firestore 'ticketWallet'
            const stubId = `stub_${movie.id}_${Date.now()}`;
            const stubRef = doc(db, "users", user.uid, "ticketWallet", stubId);
            
            const stubData = {
                id: stubId,
                movieId: movie.id,
                movieTitle: movie.title || 'Unknown Title',
                poster_path: movie.poster_path || null,
                theaterName: theaterName,
                mintDate: new Date().toISOString(),
                rarityTier: rarityTier,
                pointsEarned: pointsEarned
            };

            await setDoc(stubRef, stubData);

            // 4. Safely increment the user's Total Theater Points for the Leaderboard
            const userDocRef = doc(db, "users", user.uid);
            await updateDoc(userDocRef, {
                theaterPoints: increment(pointsEarned)
            });

            return { success: true, stubData };
        } catch (error) {
            console.error("Error minting stub:", error);
            return { success: false, error: 'Database minting failed. Please try again.' };
        }
    };

    const addList = async (newList) => {
        const updatedLists = [...movieLists, newList];
        setMovieLists(updatedLists);
        await saveData('movieLists', updatedLists);
    };

    const deleteList = async (listId) => {
        const updatedLists = movieLists.filter((list) => list.id !== listId);
        setMovieLists(updatedLists);
        await saveData('movieLists', updatedLists);
    };

    const getMoviesInList = (listId) => {
        if (listId === OVERALL_RATINGS_LIST_ID) {
            return overallRatedMovies;
        }
        const list = movieLists.find((l) => l.id === listId);
        return list ? list.movies : [];
    };

    // Strip heavy payload data (e.g. cast/crew/videos) to avoid hitting 1MB Firebase document limit
    const sanitizeMovieData = (m) => ({
        id: m.id,
        title: m.title || 'Unknown Title',
        poster_path: m.poster_path || null,
        release_date: m.release_date || null,
        vote_average: m.vote_average || 0,
        userOverallRating: m.userOverallRating || null,
        userRating: m.userRating || null,
        ratingMethod: m.ratingMethod || null,
        awardsFilter: m.awardsFilter || null
    });

    const addMovieToList = async (listId, movie) => {
        const cleanMovie = sanitizeMovieData(movie);
        
        // Enforce 100 movie limit per list to prevent Firestore 1MB document limit exhaustion
        const targetList = movieLists.find(l => l.id === listId);
        if (targetList && targetList.movies.length >= 100 && !targetList.movies.some(m => m.id === movie.id)) {
            Alert.alert("List Full", `The list "${targetList.name}" has reached its maximum capacity of 100 movies. Please remove some movies before adding more.`);
            return;
        }

        const updatedLists = movieLists.map(list =>
            list.id === listId ? { ...list, movies: [...list.movies.filter(m => m.id !== movie.id), cleanMovie] } : list
        );
        setMovieLists(updatedLists);
        await saveData('movieLists', updatedLists);
    };

    const removeMovieFromList = async (listId, movieId) => {
        const updatedLists = movieLists.map(list =>
            list.id === listId ? { ...list, movies: list.movies.filter(movie => movie.id !== movieId) } : list
        );
        setMovieLists(updatedLists);
        await saveData('movieLists', updatedLists);
    };

    const addToRecentlyWatched = async (movie) => {
        const cleanMovie = sanitizeMovieData(movie);
        setRecentlyWatched(prev => {
            const filteredList = prev.filter(m => m.id !== movie.id);
            const updatedList = [cleanMovie, ...filteredList].slice(0, 10);
            saveData('recentlyWatched', updatedList);
            return updatedList;
        });
    };

    const addToRecentActivity = async (movie) => {
        const cleanMovie = sanitizeMovieData(movie);
        setRecentActivity(prev => {
            const filteredList = prev.filter(m => m.id !== movie.id);
            const updatedList = [cleanMovie, ...filteredList].slice(0, 20); // Keep last 20 activities
            saveData('recentActivity', updatedList);
            return updatedList;
        });
    };

    const submitRating = async (movieId, ratingType, score, breakdown = null, movieMetadata = {}) => {
        if (!user) return;

        const validScore = parseFloat(score);
        if (isNaN(validScore)) return;

        // Normalize Type
        let dbType = ratingType;
        if (ratingType === '1-10') dbType = 'classic';
        else if (ratingType === '1-5') dbType = 'pizza';
        else if (ratingType === 'Percentage') dbType = 'percentage';
        else if (ratingType === 'Awards') dbType = 'awards';
        else if (ratingType === 'Thumbs') dbType = 'thumbs'; // Add Thumbs normalization

        // 1. Optimistic UI Update (Local)
        updateOverallRatings(movieId, validScore, movieMetadata);

        try {
            // 2. Save User's Individual Rating (Private Profile)
            const userRatingRef = doc(db, "users", user.uid, "ratings", movieId.toString());
            await setDoc(userRatingRef, {
                type: dbType, // Save normalized type
                originalType: ratingType, // Keep original for reference if needed
                score: validScore,
                breakdown: breakdown || {},
                timestamp: new Date()
            });

            // 3. Save to Public Movie Subcollection (for Aggregation)
            const publicRatingRef = doc(db, "movies", movieId.toString(), "user_ratings", user.uid);
            await setDoc(publicRatingRef, {
                type: dbType, // Save normalized type
                score: validScore,
                userId: user.uid,
                timestamp: new Date()
            });

            // 4. Recalculate Global Stats (Read-All approach for accuracy)
            // Fetch all ratings for this movie
            const ratingsCollection = collection(db, "movies", movieId.toString(), "user_ratings");
            const snapshot = await getDocs(ratingsCollection);

            const newStats = {
                classic: { count: 0, sum: 0, average: 0 },
                pizza: { count: 0, sum: 0, average: 0 },
                percentage: { count: 0, sum: 0, average: 0 },
                awards: { count: 0, sum: 0, average: 0 },
                thumbs: { count: 0, sum: 0, average: 0 } // Add thumbs stats
            };

            // Tally up
            snapshot.forEach(doc => {
                const r = doc.data();
                // Normalize legacy/mixed types for counting
                let t = r.type;
                if (t === 'Thumbs') t = 'thumbs';

                if (t && newStats[t]) {
                    newStats[t].count += 1;
                    newStats[t].sum += r.score;
                }
            });

            // Calculate Averages
            Object.keys(newStats).forEach(key => {
                if (newStats[key].count > 0) {
                    newStats[key].average = newStats[key].sum / newStats[key].count;
                }
            });

            // Write back to movie doc
            const movieRef = doc(db, "movies", movieId.toString());
            await setDoc(movieRef, {
                title: movieMetadata.title || "Unknown",
                poster_path: movieMetadata.poster_path || null,
                stats: newStats
            }, { merge: true });

            // 5. Auto-Remove from Watch Later (ID: 2) if present
            const watchLaterList = movieLists.find(l => l.id === 2);
            if (watchLaterList && watchLaterList.movies.some(m => m.id === movieId)) {
                await removeMovieFromList(2, movieId);
                console.log(`Auto-removed movie ${movieId} from Watch Later`);
            }

        } catch (error) {
            console.error("Error submitting rating using submitRating:", error);
        }
    };

    const updateOverallRatings = async (movieId, newRating, movieInfo) => {
        // Optimistic update
        setOverallRatedMovies(prevRatedMovies => {
            const movieIndex = prevRatedMovies.findIndex(m => m.id === movieId);
            let updatedRatedMovies;

            const movieData = {
                id: movieId,
                title: movieInfo?.title || 'Unknown Title',
                poster_path: movieInfo?.poster_path || null,
                userOverallRating: newRating,
                release_date: movieInfo?.release_date,
                vote_average: movieInfo?.vote_average,
            };

            if (movieIndex > -1) {
                updatedRatedMovies = prevRatedMovies.map((movie, index) =>
                    index === movieIndex ? { ...movie, ...movieData } : movie
                );
            } else {
                updatedRatedMovies = [movieData, ...prevRatedMovies];
            }

            saveData('overallRatedMovies', updatedRatedMovies);
            return updatedRatedMovies;
        });
    };

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            if (!currentUser) {
                // User logged out, clear all state
                setMovieLists([]);
                setOverallRatedMovies([]);
                setRecentlyWatched([]);
                setRecentActivity([]);
                setRatingMethod('1-10');
            }
        });
        return unsubscribe;
    }, []);

    const value = useMemo(() => ({
        movieLists,
        overallRatedMovies,
        recentlyWatched,
        recentActivity,
        ratingMethod,
        setRatingMethod: updateRatingMethod,
        submitRating,
        addList,
        deleteList,
        getMoviesInList,
        addMovieToList,
        removeMovieFromList,
        addToRecentlyWatched,
        addToRecentActivity,
        updateOverallRatings,
        mintTicketStub
    }), [user, movieLists, overallRatedMovies, recentlyWatched, recentActivity, ratingMethod]);

    return (
        <MoviesContext.Provider value={value}>
            {children}
        </MoviesContext.Provider>
    );
};
