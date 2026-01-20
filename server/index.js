const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const API_KEY = process.env.TMDB_API_KEY;

app.use(cors());
app.use(express.json());

// Helper function for TMDB requests
const fetchFromTMDB = async (endpoint, params = {}) => {
    try {
        const response = await axios.get(`${TMDB_BASE_URL}${endpoint}`, {
            params: {
                api_key: API_KEY,
                language: 'en-US',
                ...params,
            },
        });
        return response.data;
    } catch (error) {
        console.error(`Error fetching ${endpoint}:`, error.message);
        throw error;
    }
};

// Search Movies
app.get('/api/search', async (req, res) => {
    try {
        const { query } = req.query;
        if (!query) {
            return res.status(400).json({ error: 'Query parameter is required' });
        }

        // Handle genre filtering logic mirroring the frontend
        let params = { page: 1 };
        if (query.includes('&with_genres=')) {
            const [actualQuery, genrePart] = query.split('&with_genres=');
            params.query = actualQuery;
            params.with_genres = genrePart;
        } else {
            params.query = query;
        }

        const data = await fetchFromTMDB('/search/movie', params);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Failed to search movies' });
    }
});

// Get Movie Details
app.get('/api/movie/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const data = await fetchFromTMDB(`/movie/${id}`);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Failed to get movie details' });
    }
});

// Get Genres
app.get('/api/genres', async (req, res) => {
    try {
        const data = await fetchFromTMDB('/genre/movie/list');
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Failed to get genres' });
    }
});

// Get Movies by Genre (Discover)
app.get('/api/discover', async (req, res) => {
    try {
        // Pass through all query params (allows with_watch_providers, watch_region, etc.)
        const data = await fetchFromTMDB('/discover/movie', {
            ...req.query,
            sort_by: req.query.sort_by || 'popularity.desc',
            page: req.query.page || 1
        });
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Failed to discover movies' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
