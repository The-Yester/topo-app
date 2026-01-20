import React, { createContext, useState, useEffect, useMemo } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, arrayUnion, arrayRemove, runTransaction, collection, getDocs } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';

// Define a constant for the special list ID
export const OVERALL_RATINGS_LIST_ID = 'overall_ratings_list_id';
export const OVERALL_RATINGS_LIST_NAME = 'Overall Ratings';

export const MoviesContext = createContext({
    movieLists: [],
    overallRatedMovies: [],
    recentlyWatched: [],
    ratingMethod: '1-10',
    setRatingMethod: () => { },
    addList: () => { },
    deleteList: () => { },
    getMoviesInList: () => [],
    addMovieToList: () => { },
    removeMovieFromList: () => { },
    addToRecentlyWatched: () => { },
    updateOverallRatings: () => { },
});

export const MoviesProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [movieLists, setMovieLists] = useState([
        { id: 1, name: 'Favorites', movies: [] },
        { id: 2, name: 'Watch Later', movies: [] },
    ]);
    const [overallRatedMovies, setOverallRatedMovies] = useState([]);
    const [recentlyWatched, setRecentlyWatched] = useState([]);
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
                if (data.recentlyWatched) setRecentlyWatched(data.recentlyWatched);
                if (data.ratingMethod) setRatingMethod(data.ratingMethod);
            } else {
                // Initialize default doc if not exists (migrating old users or fresh start)
                await setDoc(userDocRef, {
                    movieLists,
                    overallRatedMovies: [],
                    recentlyWatched: [],
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

    const addMovieToList = async (listId, movie) => {
        const updatedLists = movieLists.map(list =>
            list.id === listId ? { ...list, movies: [...list.movies.filter(m => m.id !== movie.id), movie] } : list
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
        setRecentlyWatched(prev => {
            const filteredList = prev.filter(m => m.id !== movie.id);
            const updatedList = [movie, ...filteredList].slice(0, 10);
            saveData('recentlyWatched', updatedList);
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
                awards: { count: 0, sum: 0, average: 0 }
            };

            // Tally up
            snapshot.forEach(doc => {
                const r = doc.data();
                if (r.type && newStats[r.type]) {
                    newStats[r.type].count += 1;
                    newStats[r.type].sum += r.score;
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

    const value = useMemo(() => ({
        movieLists,
        overallRatedMovies,
        recentlyWatched,
        ratingMethod,
        setRatingMethod: updateRatingMethod,
        submitRating,
        addList,
        deleteList,
        getMoviesInList,
        addMovieToList,
        removeMovieFromList,
        addToRecentlyWatched,
        updateOverallRatings,
    }), [movieLists, overallRatedMovies, recentlyWatched, ratingMethod]);

    return (
        <MoviesContext.Provider value={value}>
            {children}
        </MoviesContext.Provider>
    );
};
