import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';

const API_KEY = '46de4e8d3c4e28a2a768923324c89503'; // Replace with your actual TMDB API key

const GenreMoviesScreen = () => {
    const route = useRoute();
    const navigation = useNavigation();
    const { genreId, genreName } = route.params;

    const [movies, setMovies] = useState([]);

    useEffect(() => {
        fetchMoviesByGenre();
    }, []);

    const fetchMoviesByGenre = async () => {
        try {
            const response = await fetch(
                `https://api.themoviedb.org/3/discover/movie?api_key=${API_KEY}&with_genres=${genreId}`
            );
            const data = await response.json();
            setMovies(data.results);
        } catch (error) {
            console.error('Error fetching movies:', error);
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.header}>{genreName} Movies</Text>
            <FlatList
                data={movies}
                keyExtractor={(item) => item.id.toString()}
                numColumns={2} // Sets two columns
                columnWrapperStyle={styles.row} // Ensures proper spacing
                renderItem={({ item }) => (
                    <TouchableOpacity 
                        style={styles.movieItem} 
                        onPress={() => navigation.navigate('MovieDetailScreen', { movieId: item.id })}
                    >
                        <Image
                            source={{ uri: `https://image.tmdb.org/t/p/w500${item.poster_path}` }}
                            style={styles.poster}
                        />
                        <Text style={styles.movieTitle}>{item.title}</Text>
                    </TouchableOpacity>
                )}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 16,
        backgroundColor: '#D3D3D3',
    },
    header: {
        fontSize: 42,
        fontWeight: 'bold',
        marginBottom: 10,
        fontFamily: 'Trebuchet MS',
        color: 'white',
        textAlign: 'center',
    },

    row: {
        justifyContent: 'space-between', // Ensures proper spacing between items
        marginBottom: 20, // Adds spacing between rows
    },

    movieItem: {
        flex: 1, // Makes sure items take up equal space
        margin: 5, // Adds spacing between items
        alignItems: 'center',
    },
    poster: {
        width: 150,
        height: 225,
        borderRadius: 15,
    },
    movieTitle: {
        marginTop: 5,
        fontSize: 18,
        fontWeight: 'bold',
        textAlign: 'center',
        fontFamily: 'Trebuchet MS',
    },
});

export default GenreMoviesScreen;
