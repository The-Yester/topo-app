import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    TextInput,
    FlatList,
    TouchableOpacity,
    StyleSheet,
    Image,
    Platform,
    StatusBar,
    ActivityIndicator,
    SafeAreaView
} from 'react-native';
import { searchMovies, searchMulti, getGenres } from '../api/MovieService';
import { debounce } from 'lodash';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/FontAwesome';

const SearchScreen = () => {
    const navigation = useNavigation();
    const [query, setQuery] = useState('');
    // Initialize with static genres immediately
    const [genres, setGenres] = useState(STATIC_GENRES);
    const [results, setResults] = useState([]); // Store search results (Movies + People)
    const [loading, setLoading] = useState(false);

    // Removed useEffect fetching genres to improve load time
    // useEffect(() => { ... }, []);

    // Helper to fetch results
    const fetchResults = async (searchQuery) => {
        if (!searchQuery.trim()) {
            setResults([]);
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const data = await searchMulti(searchQuery);
            // Filter out people without profile path or minimal info if desired, 
            // but for now let's show everything relevant (Movies, People). 
            // Filter out 'tv' if not supported yet or just let them show (but might crash on detail nav if not handled).
            // Let's filter for movie and person only.
            const filtered = data.filter(item => item.media_type === 'movie' || item.media_type === 'person');
            setResults(filtered);
        } catch (error) {
            console.error("Error searching:", error);
        } finally {
            setLoading(false);
        }
    };

    // Debounce the API call
    // Note: We keep the debounced function stable with useCallback
    const debouncedSearch = useCallback(
        debounce((text) => fetchResults(text), 400),
        []
    );

    const handleTextChange = (text) => {
        setQuery(text);
        if (text.length > 0) {
            setLoading(true); // Show loader immediately while waiting for debounce
        }
        debouncedSearch(text);
    };

    const handleGenrePress = (genre) => {
        navigation.navigate('GenreMoviesScreen', { genreId: genre.id, genreName: genre.name });
    };

    const renderResultItem = ({ item }) => {
        if (item.media_type === 'person') {
            return (
                <TouchableOpacity
                    style={styles.resultItem}
                    onPress={() => navigation.navigate('ActorDetail', { personId: item.id })}
                >
                    <Image
                        source={item.profile_path ? { uri: `https://image.tmdb.org/t/p/w200${item.profile_path}` } : require('../assets/profile_placeholder.jpg')}
                        style={styles.personImage}
                    />
                    <View style={styles.resultInfo}>
                        <Text style={styles.resultTitle}>{item.name}</Text>
                        <Text style={styles.resultSubtitle}>Actor • {item.known_for_department}</Text>
                    </View>
                    <Icon name="chevron-right" size={14} color="#666" />
                </TouchableOpacity>
            );
        } else {
            // Movie
            return (
                <TouchableOpacity
                    style={styles.resultItem}
                    onPress={() => navigation.navigate('MovieDetails', { movieId: item.id })}
                >
                    <Image
                        source={item.poster_path ? { uri: `https://image.tmdb.org/t/p/w200${item.poster_path}` } : require('../assets/TOPO_Logo.jpg')} // Fallback if needed
                        style={styles.moviePoster}
                    />
                    <View style={styles.resultInfo}>
                        <Text style={styles.resultTitle}>{item.title}</Text>
                        <Text style={styles.resultSubtitle}>{item.release_date ? item.release_date.split('-')[0] : 'N/A'}</Text>
                    </View>
                    <Icon name="chevron-right" size={14} color="#666" />
                </TouchableOpacity>
            );
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Search</Text>
            </View>

            <View style={styles.searchBarContainer}>
                <View style={styles.searchBar}>
                    <Icon name="search" size={18} color="#888" style={styles.searchIcon} />
                    <TextInput
                        style={styles.textInput}
                        placeholder="Search movies, people, genres..."
                        placeholderTextColor="#666"
                        onChangeText={handleTextChange}
                        value={query}
                        autoCapitalize="none"
                    />
                    {query.length > 0 && (
                        <TouchableOpacity onPress={() => handleTextChange('')}>
                            <Icon name="times-circle" size={18} color="#888" />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {loading ? (
                <View style={styles.centerContent}>
                    <ActivityIndicator size="large" color="#e50914" />
                </View>
            ) : query.length > 0 ? (
                <FlatList
                    data={results}
                    renderItem={renderResultItem}
                    keyExtractor={(item) => item.id.toString()}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={
                        <View style={styles.centerContent}>
                            <Text style={styles.emptyText}>No results found.</Text>
                        </View>
                    }
                />
            ) : (
                <View style={{ flex: 1 }}>
                    <Text style={styles.sectionTitle}>Browse Genres</Text>
                    <FlatList
                        data={genres}
                        renderItem={({ item, index }) => (
                            <TouchableOpacity
                                style={[
                                    styles.genreItem,
                                    { backgroundColor: genreColors[index % genreColors.length] }
                                ]}
                                onPress={() => handleGenrePress(item)}
                            >
                                <Text style={styles.genreText}>{item.name}</Text>
                            </TouchableOpacity>
                        )}
                        keyExtractor={(item) => item.id.toString()}
                        numColumns={2}
                        columnWrapperStyle={styles.columnWrapper}
                        contentContainerStyle={styles.listContent}
                    />

                    {/* Attribution Footer */}
                    <View style={styles.attributionContainer}>
                        <Text style={styles.attributionText}>This product uses the TMDB API but is not endorsed or certified by TMDB.</Text>
                    </View>
                </View>
            )}
        </SafeAreaView>
    );
};

// Vibrant dark theme colors for genres
const genreColors = [
    '#E50914', '#B81D24', '#221F1F', '#F5F5F1', // Using some brand colors + others
    '#8a2be2', '#4169e1', '#20b2aa', '#ff8c00',
    '#ff1493', '#00ced1', '#ffd700', '#dc143c'
];

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0a0a1a', // Dark Theme Background
        paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
    },
    header: {
        paddingHorizontal: 20,
        paddingBottom: 15,
        paddingTop: 10,
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#fff',
        fontFamily: 'Trebuchet MS',
    },
    searchBarContainer: {
        paddingHorizontal: 20,
        marginBottom: 20,
    },
    attributionContainer: {
        padding: 20,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: 0.5
    },
    attributionText: {
        color: '#fff',
        fontSize: 12,
        fontStyle: 'italic',
        fontFamily: 'Trebuchet MS',
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1a1a2e',
        borderRadius: 12,
        paddingHorizontal: 15,
        height: 50,
        borderWidth: 1,
        borderColor: '#333'
    },
    searchIcon: {
        marginRight: 10,
    },
    textInput: {
        flex: 1,
        fontSize: 16,
        color: '#fff',
        fontFamily: 'Trebuchet MS',
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#888',
        marginLeft: 20,
        marginBottom: 15,
        textTransform: 'uppercase',
        letterSpacing: 1
    },
    listContent: {
        paddingHorizontal: 20,
        paddingBottom: 20
    },
    // Genres
    columnWrapper: {
        justifyContent: 'space-between',
    },
    genreItem: {
        flex: 1,
        height: 80,
        borderRadius: 12,
        marginBottom: 15,
        marginHorizontal: 5,
        alignItems: 'center',
        justifyContent: 'center',
        // Add subtle shadow/overlay
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 3.84,
        elevation: 5,
    },
    genreText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: 'white',
        fontFamily: 'Trebuchet MS',
        textAlign: 'center',
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 3
    },
    // Results
    resultItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#161625',
        marginBottom: 10,
        borderRadius: 10,
        padding: 10,
        borderWidth: 1,
        borderColor: '#222'
    },
    moviePoster: {
        width: 50,
        height: 75,
        borderRadius: 5,
        marginRight: 15,
        backgroundColor: '#333'
    },
    personImage: {
        width: 50,
        height: 50,
        borderRadius: 25,
        marginRight: 15,
        backgroundColor: '#333',
        borderWidth: 1,
        borderColor: '#444'
    },
    resultInfo: {
        flex: 1
    },
    resultTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 4
    },
    resultSubtitle: {
        fontSize: 14,
        color: '#888'
    },
    // Utils
    centerContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center'
    },
    emptyText: {
        color: '#666',
        fontSize: 16
    }
});

export default SearchScreen;

const STATIC_GENRES = [
    { "id": 28, "name": "Action" },
    { "id": 12, "name": "Adventure" },
    { "id": 16, "name": "Animation" },
    { "id": 35, "name": "Comedy" },
    { "id": 80, "name": "Crime" },
    { "id": 99, "name": "Documentary" },
    { "id": 18, "name": "Drama" },
    { "id": 10751, "name": "Family" },
    { "id": 14, "name": "Fantasy" },
    { "id": 36, "name": "History" },
    { "id": 27, "name": "Horror" },
    { "id": 10402, "name": "Music" },
    { "id": 9648, "name": "Mystery" },
    { "id": 10749, "name": "Romance" },
    { "id": 878, "name": "Science Fiction" },
    { "id": 10770, "name": "TV Movie" },
    { "id": 53, "name": "Thriller" },
    { "id": 10752, "name": "War" },
    { "id": 37, "name": "Western" }
];


