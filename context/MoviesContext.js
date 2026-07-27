import React, { createContext, useState, useEffect, useMemo } from 'react';
import { convertRating } from './RatingLogic';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, arrayUnion, arrayRemove, runTransaction, collection, getDocs, increment, query, where } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import { verifyTheaterLocation } from '../services/LocationService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getMovieDetails } from '../api/MovieService';

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
    const [isDataLoaded, setIsDataLoaded] = useState(false);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            if (currentUser) {
                loadUserData(currentUser.uid);
            } else {
                setMovieLists([
                    { id: 1, name: 'Favorites', movies: [] },
                    { id: 2, name: 'Watch Later', movies: [] },
                ]);
                setOverallRatedMovies([]);
                setRecentlyWatched([]);
                setRecentActivity([]);
                setRatingMethod('1-10');
                setIsDataLoaded(false);
            }
        });
        return unsubscribe;
    }, []);

    const parseTimestamp = (item) => {
        if (!item) return 0;
        if (item.timestamp) {
            if (typeof item.timestamp.seconds === 'number') return item.timestamp.seconds * 1000;
            if (typeof item.timestamp.toMillis === 'function') return item.timestamp.toMillis();
            const parsed = new Date(item.timestamp).getTime();
            if (!isNaN(parsed) && parsed > 0) return parsed;
        }
        if (item.createdAt) {
            const parsed = new Date(item.createdAt).getTime();
            if (!isNaN(parsed) && parsed > 0) return parsed;
        }
        if (item.release_date) {
            const parsed = new Date(item.release_date).getTime();
            if (!isNaN(parsed) && parsed > 0) return parsed;
        }
        return 0;
    };

    // Helper to backfill overallRatedMovies from subcollection
    const fetchUserRatings = async (uid) => {
        try {
            const ratingsRef = collection(db, "users", uid, "ratings");
            const snapshot = await getDocs(ratingsRef);

            if (snapshot.empty) return [];

            const restoredMovies = [];

            for (const docSnap of snapshot.docs) {
                const ratingData = docSnap.data();
                const movieId = docSnap.id;

                let title = ratingData.title || ratingData.movieTitle;
                let poster_path = ratingData.poster_path || ratingData.posterPath;
                let release_date = ratingData.release_date;

                if (!title || !poster_path) {
                    const movieDocRef = doc(db, "movies", movieId);
                    const movieSnap = await getDoc(movieDocRef);
                    if (movieSnap.exists()) {
                        const movieMeta = movieSnap.data();
                        title = title || movieMeta.title;
                        poster_path = poster_path || movieMeta.poster_path;
                        release_date = release_date || movieMeta.release_date;
                    }
                }

                if (!title) {
                    try {
                        const tmdbMeta = await getMovieDetails(movieId);
                        if (tmdbMeta) {
                            title = tmdbMeta.title;
                            poster_path = poster_path || tmdbMeta.poster_path;
                            release_date = release_date || tmdbMeta.release_date;
                        }
                    } catch (e) {
                        console.error(`Error fetching TMDB details for movie ${movieId}:`, e);
                    }
                }

                restoredMovies.push({
                    id: isNaN(Number(movieId)) ? movieId : Number(movieId),
                    title: title || `Movie #${movieId}`,
                    poster_path: poster_path || null,
                    userOverallRating: ratingData.score,
                    userRating: ratingData.score,
                    ratingMethod: ratingData.type || ratingData.originalType || '1-10',
                    release_date: release_date || null,
                    timestamp: ratingData.timestamp || ratingData.createdAt || null
                });
            }

            // Sort restored movies by parseTimestamp descending (most recent rated first!)
            restoredMovies.sort((a, b) => parseTimestamp(b) - parseTimestamp(a));

            if (restoredMovies.length > 0) {
                setOverallRatedMovies(restoredMovies);
                // Save back to user doc to avoid re-fetching next time
                const userDocRef = doc(db, "users", uid);
                await updateDoc(userDocRef, { overallRatedMovies: restoredMovies });
            }
            return restoredMovies;
        } catch (error) {
            console.error("Error restoring user ratings:", error);
            return [];
        }
    };

    // Helper to backfill and restore custom lists from device storage, subcollections, or legacy keys
    const fetchUserCustomLists = async (uid, existingLists = []) => {
        const restoredMap = new Map();

        const addListToMap = (l) => {
            if (!l || !l.name) return;
            const key = l.id || l.name;
            const existing = restoredMap.get(key);
            if (!existing || (Array.isArray(l.movies) && l.movies.length > (existing.movies?.length || 0))) {
                restoredMap.set(key, {
                    id: isNaN(Number(l.id)) ? (l.id || key) : Number(l.id),
                    name: l.name,
                    movies: Array.isArray(l.movies) ? l.movies : []
                });
            }
        };

        // 1. Check existing lists from main user doc
        if (Array.isArray(existingLists)) {
            existingLists.forEach(addListToMap);
        }

        // 2. Check device AsyncStorage keys
        try {
            const keysToCheck = ['movieLists', `movieLists_${uid}`, 'userLists', 'customLists'];
            for (const k of keysToCheck) {
                const raw = await AsyncStorage.getItem(k);
                if (raw) {
                    const parsed = JSON.parse(raw);
                    if (Array.isArray(parsed)) parsed.forEach(addListToMap);
                }
            }
            const rawUsers = await AsyncStorage.getItem('users');
            if (rawUsers) {
                const parsedUsers = JSON.parse(rawUsers);
                if (Array.isArray(parsedUsers)) {
                    const match = parsedUsers.find(u => u.uid === uid || u.id === uid);
                    if (match) {
                        if (Array.isArray(match.movieLists)) match.movieLists.forEach(addListToMap);
                        if (Array.isArray(match.customLists)) match.customLists.forEach(addListToMap);
                    }
                }
            }
        } catch (e) {
            console.error("Error scanning AsyncStorage for lists:", e);
        }

        // 3. Check Firestore Subcollections
        const subcollections = ['movieLists', 'lists', 'customLists', 'userLists'];
        for (const sub of subcollections) {
            try {
                const subRef = collection(db, "users", uid, sub);
                const snap = await getDocs(subRef);
                if (!snap.empty) {
                    snap.forEach(docSnap => {
                        const data = docSnap.data();
                        addListToMap({
                            id: docSnap.id,
                            name: data.name || docSnap.id,
                            movies: data.movies || []
                        });
                    });
                }
            } catch (e) { }
        }

        return Array.from(restoredMap.values());
    };

    // Helper to auto-reconstruct year-based lists (e.g. "2026 MOVIES", "2025 MOVIES") from rated movies
    const autoGroupMoviesByYearLists = (ratedMovies, existingLists = []) => {
        if (!Array.isArray(ratedMovies) || ratedMovies.length === 0) return existingLists;

        const listsMap = new Map();
        existingLists.forEach(l => {
            if (l && l.name) listsMap.set(l.name, { ...l, movies: Array.isArray(l.movies) ? [...l.movies] : [] });
        });

        const yearGroups = {};
        ratedMovies.forEach(movie => {
            let year = null;
            if (movie.release_date) {
                const parts = movie.release_date.split('-');
                if (parts[0] && parts[0].length === 4) {
                    year = parts[0];
                }
            } else if (movie.timestamp) {
                const timeMs = parseTimestamp(movie);
                if (timeMs > 0) year = new Date(timeMs).getFullYear().toString();
            }

            if (year) {
                const listName = `${year} MOVIES`;
                if (!yearGroups[listName]) {
                    yearGroups[listName] = [];
                }
                yearGroups[listName].push({
                    id: movie.id,
                    title: movie.title || 'Unknown Title',
                    poster_path: movie.poster_path || null,
                    release_date: movie.release_date || null,
                    userOverallRating: movie.userOverallRating || movie.userRating,
                    userRating: movie.userRating || movie.userOverallRating,
                    ratingMethod: movie.ratingMethod || null
                });
            }
        });

        Object.keys(yearGroups).forEach(listName => {
            const moviesInYear = yearGroups[listName];
            if (!listsMap.has(listName)) {
                listsMap.set(listName, {
                    id: `year_${listName.replace(/\s+/g, '_')}`,
                    name: listName,
                    movies: moviesInYear
                });
            } else {
                const existingList = listsMap.get(listName);
                const existingMovieIds = new Set(existingList.movies.map(m => m.id));
                moviesInYear.forEach(m => {
                    if (!existingMovieIds.has(m.id)) {
                        existingList.movies.push(m);
                    }
                });
                listsMap.set(listName, existingList);
            }
        });

        return Array.from(listsMap.values());
    };

    const loadUserData = async (uid) => {
        try {
            setIsDataLoaded(false);
            const userDocRef = doc(db, "users", uid);
            const docSnap = await getDoc(userDocRef);

            let activeRatedMovies = [];

            if (docSnap.exists()) {
                const data = docSnap.data();
                const userRatingStyle = data.ratingMethod || data.ratingSystem || '1-10';
                setRatingMethod(userRatingStyle);

                // Always fetch full rating documents from subcollection to get exact Firestore timestamps
                const subcollRatings = await fetchUserRatings(uid);
                if (subcollRatings && subcollRatings.length > 0) {
                    activeRatedMovies = subcollRatings;
                } else if (data.overallRatedMovies && data.overallRatedMovies.length > 0) {
                    activeRatedMovies = data.overallRatedMovies;
                }

                // Hydrate every movie item with userRating and ratingMethod
                activeRatedMovies = activeRatedMovies.map(m => ({
                    ...m,
                    userRating: m.userRating !== undefined ? m.userRating : m.userOverallRating,
                    userOverallRating: m.userOverallRating !== undefined ? m.userOverallRating : m.userRating,
                    ratingMethod: m.ratingMethod || userRatingStyle
                }));

                // Sort activeRatedMovies by parseTimestamp descending (most recent rated first!)
                activeRatedMovies.sort((a, b) => parseTimestamp(b) - parseTimestamp(a));
                setOverallRatedMovies(activeRatedMovies);

                // Read Recently Watched strictly from Firebase (data.recentlyWatched)
                if (data.recentlyWatched && Array.isArray(data.recentlyWatched)) {
                    setRecentlyWatched(data.recentlyWatched);
                } else {
                    setRecentlyWatched([]);
                }

                // Read Recently Rated strictly from Firebase (data.recentActivity)
                if (data.recentActivity && Array.isArray(data.recentActivity)) {
                    setRecentActivity(data.recentActivity);
                } else {
                    setRecentActivity([]);
                }

                // Read Movie Lists strictly from Firebase (data.movieLists)
                let rawLists = data.movieLists || [];
                if (!rawLists.some(l => l.name === 'Favorites')) {
                    rawLists.unshift({ id: 1, name: 'Favorites', movies: [] });
                }
                if (!rawLists.some(l => l.name === 'Watch Later')) {
                    rawLists.splice(1, 0, { id: 2, name: 'Watch Later', movies: [] });
                }
                setMovieLists(rawLists);
            } else {
                // Initialize default doc if not exists
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
        } finally {
            setIsDataLoaded(true);
        }
    };

    const saveData = async (field, value) => {
        if (!user || !isDataLoaded) return;
        try {
            const userDocRef = doc(db, "users", user.uid);
            await updateDoc(userDocRef, {
                [field]: value
            });
        } catch (error) {
            console.error(`Error saving ${field}:`, error);
        }
    };

    const recalculateMovieStats = async (movieId) => {
        try {
            const ratingsCollection = collection(db, "movies", movieId.toString(), "user_ratings");
            const snapshot = await getDocs(ratingsCollection);

            const newStats = {
                classic: { count: 0, sum: 0, average: 0 },
                pizza: { count: 0, sum: 0, average: 0 },
                percentage: { count: 0, sum: 0, average: 0 },
                awards: { count: 0, sum: 0, average: 0 },
                thumbs: { count: 0, sum: 0, average: 0 }
            };

            snapshot.forEach(docSnap => {
                const r = docSnap.data();
                let t = r.type;
                if (t === 'Thumbs') t = 'thumbs';

                if (t && newStats[t]) {
                    newStats[t].count += 1;
                    newStats[t].sum += r.score;
                }
            });

            Object.keys(newStats).forEach(key => {
                if (newStats[key].count > 0) {
                    newStats[key].average = newStats[key].sum / newStats[key].count;
                }
            });

            const movieRef = doc(db, "movies", movieId.toString());
            await setDoc(movieRef, {
                stats: newStats
            }, { merge: true });
        } catch (error) {
            console.error(`Error recalculating stats for movie ${movieId}:`, error);
        }
    };

    const migrateUserRatings = async (newStyle) => {
        if (!user) return;

        try {
            let newDbType = newStyle;
            if (newStyle === '1-10') newDbType = 'classic';
            else if (newStyle === '1-5') newDbType = 'pizza';
            else if (newStyle === 'Percentage') newDbType = 'percentage';
            else if (newStyle === 'Awards') newDbType = 'awards';
            else if (newStyle === 'Thumbs') newDbType = 'thumbs';

            const ratingsRef = collection(db, "users", user.uid, "ratings");
            const snapshot = await getDocs(ratingsRef);

            if (snapshot.empty) return;

            for (const ratingDoc of snapshot.docs) {
                const movieId = ratingDoc.id;
                const ratingData = ratingDoc.data();
                
                const oldScore = ratingData.score;
                const oldType = ratingData.type || ratingData.originalType || '1-10';

                // Convert score to new style
                const newScore = convertRating(oldScore, oldType, newStyle);

                // Update private rating document
                const privateDocRef = doc(db, "users", user.uid, "ratings", movieId);
                await setDoc(privateDocRef, {
                    score: newScore,
                    type: newDbType,
                    originalType: newStyle
                }, { merge: true });

                // Update public rating document
                const publicDocRef = doc(db, "movies", movieId, "user_ratings", user.uid);
                await setDoc(publicDocRef, {
                    score: newScore,
                    type: newDbType
                }, { merge: true });

                // Recalculate stats for the movie
                await recalculateMovieStats(movieId);
            }

            // Reload user data to update current state in the app
            await loadUserData(user.uid);

        } catch (error) {
            console.error("Error migrating user ratings:", error);
        }
    };

    const updateRatingMethod = async (method) => {
        setRatingMethod(method);
        await saveData('ratingMethod', method);
        await saveData('ratingSystem', method);
        await migrateUserRatings(method);
    };

    const mintTicketStub = async (movie) => {
        if (!user) return { success: false, error: 'You must be logged in to collect a ticket stub.' };

        try {
            // 0. Check for Duplicates
            const walletRef = collection(db, "users", user.uid, "ticketWallet");
            const duplicateQuery = query(walletRef, where("movieId", "==", movie.id));
            const duplicateSnapshot = await getDocs(duplicateQuery);

            if (!duplicateSnapshot.empty) {
                return { success: false, error: 'You have already collected a ticket stub for this movie!' };
            }
        } catch (error) {
            console.error("Duplicate check failed:", error);
            return { success: false, error: 'Database check failed. Please try again.' };
        }

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

    const saveListToSubcollection = async (list) => {
        if (!user || !list || !list.id) return;
        try {
            const listDocRef = doc(db, "users", user.uid, "customLists", list.id.toString());
            await setDoc(listDocRef, {
                id: list.id,
                name: list.name,
                movies: list.movies || [],
                updatedAt: new Date()
            }, { merge: true });
        } catch (e) {
            console.error("Error saving custom list to subcollection:", e);
        }
    };

    const deleteListFromSubcollection = async (listId) => {
        if (!user || !listId) return;
        try {
            const listDocRef = doc(db, "users", user.uid, "customLists", listId.toString());
            await deleteDoc(listDocRef);
        } catch (e) {
            console.error("Error deleting custom list from subcollection:", e);
        }
    };

    const addList = async (newList) => {
        const updatedLists = [...movieLists, newList];
        setMovieLists(updatedLists);
        await saveData('movieLists', updatedLists);
        await saveListToSubcollection(newList);
    };

    const deleteList = async (listId) => {
        const updatedLists = movieLists.filter((list) => list.id !== listId);
        setMovieLists(updatedLists);
        await saveData('movieLists', updatedLists);
        await deleteListFromSubcollection(listId);
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

        const modifiedList = updatedLists.find(l => l.id === listId);
        if (modifiedList) {
            await saveListToSubcollection(modifiedList);
        }
    };

    const removeMovieFromList = async (listId, movieId) => {
        const updatedLists = movieLists.map(list =>
            list.id === listId ? { ...list, movies: list.movies.filter(movie => movie.id !== movieId) } : list
        );
        setMovieLists(updatedLists);
        await saveData('movieLists', updatedLists);

        const modifiedList = updatedLists.find(l => l.id === listId);
        if (modifiedList) {
            await saveListToSubcollection(modifiedList);
        }
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
                title: movieMetadata?.title || '',
                poster_path: movieMetadata?.poster_path || null,
                release_date: movieMetadata?.release_date || null,
                breakdown: breakdown || {},
                timestamp: new Date()
            }, { merge: true });

            // Fetch current user details to cache on the public rating (avoids user queries on StyleRatingsScreen)
            let currentUsername = 'Unknown';
            let currentProfilePhoto = null;
            try {
                const userDocSnap = await getDoc(doc(db, "users", user.uid));
                if (userDocSnap.exists()) {
                    const userData = userDocSnap.data();
                    currentUsername = userData.username || 'Unknown';
                    currentProfilePhoto = userData.profilePhoto || null;
                }
            } catch (e) {
                console.error("Error fetching user details in submitRating:", e);
            }

            // 3. Save to Public Movie Subcollection (for Aggregation)
            const publicRatingRef = doc(db, "movies", movieId.toString(), "user_ratings", user.uid);
            await setDoc(publicRatingRef, {
                type: dbType, // Save normalized type
                score: validScore,
                userId: user.uid,
                username: currentUsername,
                profilePhoto: currentProfilePhoto,
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
        isDataLoaded,
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
    }), [user, movieLists, overallRatedMovies, recentlyWatched, recentActivity, ratingMethod, isDataLoaded]);

    return (
        <MoviesContext.Provider value={value}>
            {children}
        </MoviesContext.Provider>
    );
};
