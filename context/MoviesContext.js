import React, { createContext, useState, useEffect, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Define a constant for the special list ID
export const OVERALL_RATINGS_LIST_ID = 'overall_ratings_list_id';
export const OVERALL_RATINGS_LIST_NAME = 'Overall Ratings'; // Consistent name

export const MoviesContext = createContext({
    movieLists: [],
    overallRatedMovies: [], // For the special "Overall Ratings" list
    recentlyWatched: [],
    ratingMethod: '1-10',
    setRatingMethod: () => {},
    addList: () => {},
    deleteList: () => {},
    getMoviesInList: () => [],
    addMovieToList: () => {},
    removeMovieFromList: () => {},
    addToRecentlyWatched: () => {},
    updateOverallRatings: () => {},
    // addToOverallRatings: () => {}, // This was extra and not defined
});

export const MoviesProvider = ({ children }) => {
    const [movieLists, setMovieLists] = useState([
        { id: 1, name: 'Favorites', movies: [] },
        { id: 2, name: 'Watch Later', movies: [] },
    ]);
    const [overallRatedMovies, setOverallRatedMovies] = useState([]);
    const [recentlyWatched, setRecentlyWatched] = useState([]);
    const [ratingMethod, setRatingMethod] = useState('1-10');

    useEffect(() => {
        const loadInitialData = async () => {
            try {
                const storedMethod = await AsyncStorage.getItem('ratingMethod');
                if (storedMethod !== null) setRatingMethod(storedMethod);

                const storedRecentlyWatched = await AsyncStorage.getItem('recentlyWatched');
                if (storedRecentlyWatched !== null) setRecentlyWatched(JSON.parse(storedRecentlyWatched));
                
                const storedMovieLists = await AsyncStorage.getItem('movieLists');
                if (storedMovieLists !== null) {
                    setMovieLists(JSON.parse(storedMovieLists));
                } else {
                    await AsyncStorage.setItem('movieLists', JSON.stringify(movieLists));
                }

                // Corrected AsyncStorage key and setter for overallRatedMovies
                const storedOverallRatedMovies = await AsyncStorage.getItem('overallRatedMovies');
                if (storedOverallRatedMovies !== null) {
                    setOverallRatedMovies(JSON.parse(storedOverallRatedMovies));
                }

            } catch (e) {
                console.error('Failed to load data from AsyncStorage.', e);
            }
        };
        loadInitialData();
    }, []);

    const updateRatingMethod = async (method) => {
        setRatingMethod(method);
        try {
            await AsyncStorage.setItem('ratingMethod', method);
        } catch (error) {
            console.error("Error saving rating method:", error);
        }
    };

    const addList = async (newList) => {
        const updatedLists = [...movieLists, newList];
        setMovieLists(updatedLists);
        try {
            await AsyncStorage.setItem('movieLists', JSON.stringify(updatedLists));
        } catch (error) {
            console.error("Error saving movie lists after add:", error);
        }
    };

    const deleteList = async (listId) => {
        const updatedLists = movieLists.filter((list) => list.id !== listId);
        setMovieLists(updatedLists);
        try {
            await AsyncStorage.setItem('movieLists', JSON.stringify(updatedLists));
        } catch (error) {
            console.error("Error saving movie lists after delete:", error);
        }
    };

    const getMoviesInList = (listId) => {
        // console.log('[MoviesContext] getMoviesInList called with listId:', listId); // For debugging
        if (listId === OVERALL_RATINGS_LIST_ID) {
            // console.log('[MoviesContext] Returning overallRatedMovies for special list:', JSON.stringify(overallRatedMovies, null, 2)); // For debugging
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
        try {
            await AsyncStorage.setItem('movieLists', JSON.stringify(updatedLists));
        } catch (error) {
            console.error("Error saving movie lists after adding movie:", error);
        }
    };
    
    const removeMovieFromList = async (listId, movieId) => {
        const updatedLists = movieLists.map(list =>
            list.id === listId ? { ...list, movies: list.movies.filter(movie => movie.id !== movieId) } : list
        );
        setMovieLists(updatedLists);
        try {
            await AsyncStorage.setItem('movieLists', JSON.stringify(updatedLists));
        } catch (error) {
            console.error("Error saving movie lists after removing movie:", error);
        }
    };

    const addToRecentlyWatched = async (movie) => {
        setRecentlyWatched(prev => {
            const filteredList = prev.filter(m => m.id !== movie.id);
            const updatedList = [movie, ...filteredList].slice(0, 10);
            AsyncStorage.setItem('recentlyWatched', JSON.stringify(updatedList)).catch(e => console.error("Failed to save recently watched", e));
            return updatedList;
        });
    };

    const updateOverallRatings = async (movieId, newRating, movieInfo) => {
        console.log('[MoviesContext] updateOverallRatings received:');
        console.log('  Movie ID:', movieId);
        console.log('  New Rating:', newRating);
        console.log('  Movie Info:', JSON.stringify(movieInfo, null, 2));
        
        if (!movieInfo || !movieInfo.title) {
            console.warn("[MoviesContext] updateOverallRatings called without sufficient movieInfo for movieId:", movieId);
        }

        setOverallRatedMovies(prevRatedMovies => {
            const movieIndex = prevRatedMovies.findIndex(m => m.id === movieId);
            let updatedRatedMovies;

            if (movieIndex > -1) {
                updatedRatedMovies = prevRatedMovies.map((movie, index) =>
                    index === movieIndex ? { 
                        ...movie, 
                        userOverallRating: newRating, 
                        title: movieInfo?.title || movie.title, 
                        poster_path: movieInfo?.poster_path || movie.poster_path,
                        vote_average: movieInfo?.vote_average !== undefined ? movieInfo.vote_average : movie.vote_average,
                    } : movie
                );
            } else {
                const newMovieEntry = {
                    id: movieId,
                    title: movieInfo?.title || 'Unknown Title',
                    poster_path: movieInfo?.poster_path || null,
                    userOverallRating: newRating,
                    vote_average: movieInfo?.vote_average,
                };
                updatedRatedMovies = [newMovieEntry, ...prevRatedMovies];
            }
            
            console.log('[MoviesContext] Updated overallRatedMovies (before save):', JSON.stringify(updatedRatedMovies, null, 2));
            AsyncStorage.setItem('overallRatedMovies', JSON.stringify(updatedRatedMovies))
                .catch(e => console.error("[MoviesContext] Failed to save overall rated movies", e));
            return updatedRatedMovies;
        });
    };

    const value = useMemo(() => ({
        movieLists,
        overallRatedMovies,
        recentlyWatched,
        ratingMethod,
        setRatingMethod: updateRatingMethod,
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
