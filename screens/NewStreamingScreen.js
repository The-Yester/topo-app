import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { TMDB_API_KEY } from '../utils/config';



const NewStreamingScreen = ({ navigation }) => {
    const [newStreamingMovies, setNewStreamingMovies] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const loadNewStreamingMovies = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const url = `https://api.themoviedb.org/3/movie/popular?api_key=${TMDB_API_KEY}&language=en-US&page=1`;
                console.log("Fetching from:", url); // 1. Log the URL

                const response = await fetch(url);

                console.log("Response Status:", response.status); // 2. Log status

                if (!response.ok) {
                    const errorData = await response.json();
                    console.error("Error Data:", errorData); // 3. Log error data
                    throw new Error(`HTTP error! status: ${response.status}, message: ${errorData.message || 'Unknown error'}`);
                }

                const data = await response.json();
                console.log("Fetched Data:", data); // 4. Log the data
                setNewStreamingMovies(data.results);
                setIsLoading(false);
            } catch (err) {
                setError(err);
                setIsLoading(false);
                console.error("Error fetching new streaming movies:", err);
            }
        };

        loadNewStreamingMovies();
    }, []);

    if (isLoading) {
        return <View style={styles.container}><Text>Loading New Streaming Movies...</Text></View>;
    }

    if (error) {
        return <View style={styles.container}><Text>Error loading New Streaming Movies: {error.message}</Text></View>;
    }

    const renderMovieItem = ({ item }) => (
        <TouchableOpacity
            style={styles.movieItem}
            onPress={() => navigation.navigate('Details', { movieId: item.id })}
        >
            {item.poster_path ? (
                <Image
                    source={{ uri: `https://image.tmdb.org/t/p/w500${item.poster_path}` }}
                    style={styles.moviePoster}
                />
            ) : (
                <Text>No Image</Text>
            )}
            <Text style={styles.movieTitle}>{item.title}</Text>
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Top Streaming Movies</Text>
            <FlatList
                data={newStreamingMovies}
                renderItem={renderMovieItem}
                keyExtractor={(item) => item.id.toString()}
                numColumns={2}
                style={styles.list}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingTop: 20,
        paddingHorizontal: 10,
        backgroundColor: '#fff',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 20,
        textAlign: 'center',
    },
    list: {
        flex: 1,
    },
    movieItem: {
        flex: 1,
        margin: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    moviePoster: {
        width: '100%',
        height: 250,
        borderRadius: 10,
        aspectRatio: 2 / 3,
    },
    movieTitle: {
        marginTop: 5,
        fontSize: 16,
        textAlign: 'center',
    },
});

export default NewStreamingScreen;



