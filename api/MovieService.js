import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Replace this with your actual TMDb API key
// Replace with your backend server URL.
// For Android Emulator use 'http://10.0.2.2:3000/api'
// For iOS Simulator use 'http://localhost:3000/api'
// For Physical Device use your computer's IP address e.g. 'http://192.168.1.5:3000/api'
const BASE_URL = 'http://10.0.2.2:3000/api';

export const searchMovies = async (query) => {
  if (!query || query.trim() === '') return []; // Prevent empty API calls

  try {
    const response = await axios.get(`${BASE_URL}/search`, {
      params: {
        query: query,
        // No API key needed here anymore!
      },
    });
    // The backend now returns { results: [...] } or just the data depending on implementation.
    // My backend implementation returns response.data which IS the TMDB response object (containing page, results, etc).
    // So response.data.results is correct.
    return response.data.results;
  } catch (error) {
    console.error('Error fetching movies:', error);
    throw error;
  }
};

export const getMovieDetails = async (movieId) => {
  try {
    const response = await axios.get(`${BASE_URL}/movie/${movieId}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching movie details:', error);
    throw error;
  }
};

// ✅ Get movie genres
export const getGenres = async () => {
  try {
    const response = await axios.get(`${BASE_URL}/genres`);
    return response.data; // Return genres data
  } catch (error) {
    console.error('Error fetching genres:', error);
    throw error;
  }
};

// ✅ Fetch movies by genre
export const getMoviesByGenre = async (genreId) => {
  try {
    const response = await axios.get(`${BASE_URL}/discover`, {
      params: {
        with_genres: genreId,
      },
      // Backend handles sorting and page
    });
    return response.data.results;
  } catch (error) {
    console.error('Error fetching movies by genre:', error);
    return [];
  }
};

// Save user ratings to local storage (AsyncStorage in React Native)
export const saveRating = async (movieId, rating) => {
  try {
    await AsyncStorage.setItem(`rating_${movieId}`, rating.toString());
    console.log(`Rating for movie ${movieId} saved as ${rating}`);
  } catch (error) {
    console.error('Error saving rating:', error);
  }
};

// Load saved user ratings from local storage
export const loadRating = async (movieId) => {
  try {
    const rating = await AsyncStorage.getItem(`rating_${movieId}`);
    return rating ? parseInt(rating, 10) : null; // Return the rating if it exists
  } catch (error) {
    console.error('Error loading rating:', error);
    return null;
  }
};

export const saveReview = async (movieId, reviewText) => {
  try {
    // Replace this with your actual API call to save the review.
    // You'll likely need to send a POST request to your server.
    // Example using AsyncStorage (for demonstration - replace with your backend):
    const reviews = await AsyncStorage.getItem(`reviews_${movieId}`) || '[]';
    const parsedReviews = JSON.parse(reviews);
    parsedReviews.push({ text: reviewText, timestamp: Date.now() }); // Add timestamp
    await AsyncStorage.setItem(`reviews_${movieId}`, JSON.stringify(parsedReviews));
    return Promise.resolve(); // Indicate success
  } catch (error) {
    console.error("Error saving review:", error);
    return Promise.reject(error); // Indicate failure
  }
}; 