import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, Image, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';

const TMDB_API_KEY = '46de4e8d3c4e28a2a768923324c89503'; // Replace with your actual API key

const NowPlayingScreen = () => {
    const [nowPlayingMovies, setNowPlayingMovies] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const loadNowPlayingMovies = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const response = await fetch(
                    `https://api.themoviedb.org/3/movie/now_playing?api_key=${TMDB_API_KEY}&language=en-US&page=1&region=US` // Adjust as needed
                );
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const data = await response.json();
                setNowPlayingMovies(data.results);
                setIsLoading(false);
            } catch (err) {
                setError(err);
                setIsLoading(false);
                console.error("Error fetching now playing movies:", err);
            }
        };

        loadNowPlayingMovies();
    }, []);

    if (isLoading) {
        return <View style={styles.container}><Text>Loading Now Playing Movies...</Text></View>;
    }

    if (error) {
        return <View style={styles.container}><Text>Error loading Now Playing Movies: {error.message}</Text></View>;
    }

    return (
        <ScrollView style={styles.container}>
            <Text style={styles.title}>Now Playing in Theaters</Text>
            <FlatList
                data={nowPlayingMovies}
                keyExtractor={(item) => item.id.toString()}
                numColumns={2} // Display movies in a 2-column grid
                renderItem={({ item }) => (
                    <TouchableOpacity style={styles.movieItem}>
                        {item.poster_path && (
                            <Image
                                source={{ uri: `https://image.tmdb.org/t/p/w500${item.poster_path}` }}
                                style={styles.poster}
                            />
                        )}
                        <Text style={styles.movieTitle}>{item.title}</Text>
                    </TouchableOpacity>
                )}
            />
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 16,
        backgroundColor: '#f0f0f0',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 20,
        textAlign: 'center',
        color: '#CC5500',
        fontFamily: 'Trebuchet MS',
    },
    movieItem: {
        flex: 0.5, // Take up half of the row
        margin: 8,
        alignItems: 'center',
    },
    poster: {
        width: '100%',
        height: 200,
        borderRadius: 10,
        marginBottom: 5,
    },
    movieTitle: {
        fontSize: 16,
        textAlign: 'center',
    },
});

export default NowPlayingScreen;