import axios from 'axios';
import { API_BASE_URL, TMDB_API_KEY, TMDB_BASE_URL } from '../utils/config';

export const searchMovies = async (query) => {
  if (!query || query.trim() === '') return []; // Prevent empty API calls

  try {
    const response = await axios.get(`${API_BASE_URL}/search`, {
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
    const response = await axios.get(`${API_BASE_URL}/movie/${movieId}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching movie details:', error);
    throw error;
  }
};

// ✅ Get movie genres
export const getGenres = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/genres`);
    return response.data; // Return genres data
  } catch (error) {
    console.error('Error fetching genres:', error);
    throw error;
  }
};

// ✅ Fetch movies by genre
export const getMoviesByGenre = async (genreId) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/discover`, {
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

// ✅ Fetch movies by streaming provider (US region default)
// Note: Bypassing backend proxy for this specific call to ensure provider parameters are passed correctly without requiring a server redeploy.
export const getMoviesByProvider = async (providerId) => {
  try {
    const response = await axios.get(`${TMDB_BASE_URL}/discover/movie`, {
      params: {
        api_key: TMDB_API_KEY,
        with_watch_providers: providerId,
        watch_region: 'US',
        sort_by: 'popularity.desc'
      }
    });
    return response.data.results || [];
  } catch (error) {
    console.error('Error fetching movies by provider:', error);
    return [];
  }
};

// ✅ Unified Search (Movies & People) - Direct TMDB
export const searchMulti = async (query) => {
  if (!query || query.trim() === '') return [];
  try {
    const response = await axios.get(`${TMDB_BASE_URL}/search/multi`, {
      params: {
        api_key: TMDB_API_KEY,
        query: query,
        include_adult: false,
        language: 'en-US',
        page: 1
      }
    });
    return response.data.results || [];
  } catch (error) {
    console.error('Error searching multi:', error);
    return [];
  }
};

// ✅ Get Person Details with Combined Credits - Direct TMDB
export const getPersonDetails = async (personId) => {
  try {
    const response = await axios.get(`${TMDB_BASE_URL}/person/${personId}`, {
      params: {
        api_key: TMDB_API_KEY,
        append_to_response: 'combined_credits'
      }
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching person details:', error);
    throw error;
  }
}; 