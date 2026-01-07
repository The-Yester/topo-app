import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    TextInput,
    FlatList,
    TouchableOpacity,
    StyleSheet,
    Image
} from 'react-native';
import { searchMovies, getGenres } from '../api/MovieService';
import { debounce } from 'lodash';
import { useNavigation } from '@react-navigation/native';

const SearchScreen = () => {
    const navigation = useNavigation(); // Get navigation instance
    const [query, setQuery] = useState('');
    const [genres, setGenres] = useState([]);
    const [movies, setMovies] = useState([]); // Store search results

    useEffect(() => {
        const fetchGenres = async () => {
            try {
                const fetchedGenres = await getGenres();
                setGenres(fetchedGenres.genres);
            } catch (error) {
                console.error("Error fetching genres:", error);
            }
        };
        fetchGenres();
    }, []);

    // Search movies when typing in search bar
    const fetchMovies = async (searchQuery) => {
        if (!searchQuery.trim()) return; // Prevent empty searches
        try {
            const results = await searchMovies(searchQuery);
            setMovies(results);
        } catch (error) {
            console.error("Error searching movies:", error);
        }
    };

    // Debounce search input to avoid excessive API calls
    const handleInputChange = useCallback(debounce((text) => {
        fetchMovies(text);
    }, 250), []);

    // Handle genre selection and navigate to GenreMoviesScreen
    const handleGenrePress = (genre) => {
        navigation.navigate('GenreMoviesScreen', { genreId: genre.id, genreName: genre.name });
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.searchTitle}>Search</Text>
            </View>

            <View style={styles.searchBar}>
                <Image source={require('../assets/search_icon.jpg')} style={styles.searchIcon} />
                <TextInput
                    style={styles.textInput}
                    placeholder="Search Here! Or by Genre for the Latest Movie"
                    onChangeText={(text) => {
                        setQuery(text);   // Update state immediately
                        handleInputChange(text);  // Fetch movies after debounce
                    }}
                    value={query}
                />
            </View>

            <Text style={styles.browseTitle}>Browse Categories</Text>
            <FlatList
                data={genres}
                renderItem={({ item, index }) => (
                    <TouchableOpacity 
                        style={[
                            styles.genreItem, 
                            { backgroundColor: genreColors[index % genreColors.length] }
                        ]}
                        onPress={() => handleGenrePress(item)} // Navigate to GenreMovieScreen
                    >
                        <Text style={styles.genreText}>{item.name}</Text>
                    </TouchableOpacity>
                )}
                keyExtractor={(item) => item.id.toString()}
                numColumns={2}
                columnWrapperStyle={styles.columnWrapper}
            />

            {/* Movie Results List */}
            <FlatList
                data={movies}
                renderItem={({ item }) => (
                    <TouchableOpacity 
                        style={styles.movieItem} 
                        onPress={() => navigation.navigate('MovieDetailScreen', { movieId: item.id })}
                    >
                        <Image
                            source={{ uri: `https://image.tmdb.org/t/p/w500${item.poster_path}` }}
                            style={styles.moviePoster}
                        />
                        <Text style={styles.movieTitle}>{item.title}</Text>
                    </TouchableOpacity>
                )}
                keyExtractor={(item) => item.id.toString()}
            />
        </View>
    );
};

// Preset colors for genres to mimic Apple Music style
const genreColors = [
    '#FF9F1C', '#2EC4B6', '#E71D36', '#011627',
    '#8D99AE', '#D62828', '#F77F00', '#3D348B'
];

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 16,
        backgroundColor: '#D3D3D3',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    searchTitle: {
        fontSize: 32,
        fontWeight: 'bold',
        fontFamily: 'Trebuchet MS',
    },
    profileIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'white',
        borderRadius: 20,
        paddingHorizontal: 10,
        marginBottom: 20,
        height: 40,
    },
    searchIcon: {
        width: 20,
        height: 20,
        marginRight: 10,
    },
    textInput: {
        flex: 1,
        fontSize: 16,
        fontFamily: 'Trebuchet MS',
    },
    browseTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 10,
        fontFamily: 'Trebuchet MS',
    },
    genreItem: {
        flex: 1,
        borderRadius: 20,
        padding: 20,
        margin: 5,
        alignItems: 'center',
        justifyContent: 'center',
    },
    genreText: {
        fontSize: 20,
        fontWeight: 'bold',
        color: 'white',
        fontFamily: 'Trebuchet MS',
    },
    columnWrapper: {
        justifyContent: 'space-between',
    },
    movieItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#ddd',
    },
    moviePoster: {
        width: 50,
        height: 75,
        marginRight: 10,
    },
    movieTitle: {
        fontSize: 16,
    },
});

export default SearchScreen;


