import React, { useState, useContext, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Image, ScrollView } from 'react-native';
import { MoviesContext } from '../context/MoviesContext';
import Icon from 'react-native-vector-icons/FontAwesome';
import { useNavigation } from '@react-navigation/native';

const TMDB_API_KEY = '46de4e8d3c4e28a2a768923324c89503'; // Replace with your actual API key

const HomeScreen = ({ navigation: homeNavigation }) => {
    const { movies = [], recentlyWatched } = useContext(MoviesContext); // Consume recentlyWatched
    const navigation = useNavigation();
    const [newMovies, setNewMovies] = useState([]);
    const [topFriends, setTopFriends] = useState([]);
    const [suggestedMovies, setSuggestedMovies] = useState([]);
    const [newStreamingMovies, setNewStreamingMovies] = useState([]);
    const [inTheatersMovies, setInTheatersMovies] = useState([]); // Added state for In Theaters
    const [isLoadingInTheaters, setIsLoadingInTheaters] = useState(true);
    const [errorInTheaters, setErrorInTheaters] = useState(null);
    const [isLoadingStreaming, setIsLoadingStreaming] = useState(true);
    const [errorStreaming, setErrorStreaming] = useState(null);

    useEffect(() => {
        if (movies.length > 0) {
            setNewMovies(movies.filter(movie => movie.isNew).slice(0, 10));
            setTopFriends(Array(10).fill({}));
            setSuggestedMovies(movies.slice(0, 10));
        }

        const loadInTheatersMovies = async () => {
            setIsLoadingInTheaters(true);
            setErrorInTheaters(null);
            try {
                const response = await fetch(
                    `https://api.themoviedb.org/3/movie/now_playing?api_key=${TMDB_API_KEY}&language=en-US&page=1&region=US`
                );
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(`HTTP error! status: ${response.status}, message: ${errorData.message || 'Unknown error'}`);
                }
                const data = await response.json();
                setInTheatersMovies(data.results.slice(0, 5));
                setIsLoadingInTheaters(false);
            } catch (err) {
                setErrorInTheaters(err);
                setIsLoadingInTheaters(false);
                console.error("Error fetching now playing movies:", err);
            }
        };

        const loadNewStreamingMovies = async () => {
            setIsLoadingStreaming(true);
            setErrorStreaming(null);
            try {
                const today = new Date();
                const oneWeekAgo = new Date(today);
                oneWeekAgo.setDate(today.getDate() - 7);

                const formattedStartDate = oneWeekAgo.toISOString().split('T')[0];
                const formattedEndDate = today.toISOString().split('T')[0];
                const response = await fetch(
                    `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_API_KEY}&language=en-US&sort_by=primary_release_date.desc&release_date.gte=${formattedStartDate}&release_date.lte=${formattedEndDate}&watch_region=US`
                );
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(`HTTP error! status: ${response.status}, message: ${errorData.message || 'Unknown error'}`);
                }
                const data = await response.json();
                setNewStreamingMovies(data.results.slice(0, 5));
                setIsLoadingStreaming(false);
            } catch (error) {
                setErrorStreaming(error);
                setIsLoadingStreaming(false);
                console.error("Failed to fetch new streaming movies for home screen", error);
            }
        }

        loadInTheatersMovies();
        loadNewStreamingMovies();
    }, [movies]);

    const renderMovieItem = ({ item }) => (
        <TouchableOpacity
            style={styles.movieItem}
            onPress={() => navigation.navigate('MovieDetails', { movieId: item.id })}
        >
            {item.poster_path ? (
                <Image
                    source={{ uri: `https://image.tmdb.org/t/p/w500${item.poster_path}` }}
                    style={styles.moviePoster}
                />
            ) : item.poster ? (
                <Image source={{ uri: item.poster }} style={styles.moviePoster} />
            ) : (
                <Text>No Image</Text>
            )}
            {item.title && <Text style={styles.movieTitle}>{item.title}</Text>}
        </TouchableOpacity>
    );

    const renderPizza = (count) => '🍕'.repeat(Math.round(count || 0));

    const getColorByIndex = (index) => {
        const colors = ['#4285F4', '#EA4335', '#34A853', '#FBBC05', '#9C27B0', '#00BCD4'];
        return colors[index % colors.length];
    };

    const navigateToNowPlaying = () => {
        navigation.navigate('NowPlaying');
    };
    const navigateToNewStreaming = () => {
        navigation.navigate('NewStreaming');
    };

    return (
        <ScrollView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.homeText}>HOME</Text>
                <TouchableOpacity style={styles.profileButton} onPress={() => homeNavigation.navigate('Profile')}>
                    <Icon name="user" size={30} color="black" />
                </TouchableOpacity>
            </View>

            <Text style={styles.sectionTitle}>Recently Watched</Text>
            <FlatList
                horizontal
                data={recentlyWatched} // Use the recentlyWatched data here
                renderItem={renderMovieItem}
                keyExtractor={(item) => `recently-watched-${item.id}`} // Ensure a unique key
                showsHorizontalScrollIndicator={false}
            />

            <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>New Streaming</Text>
                <TouchableOpacity onPress={navigateToNewStreaming}>
                    <Text style={styles.seeAll}>See All</Text>
                </TouchableOpacity>
            </View>
            {isLoadingStreaming ? (
                <Text>Loading New Streaming Movies...</Text>
            ) : errorStreaming ? (
                <Text>Error loading New Streaming Movies: {errorStreaming.message}</Text>
            ) : (
                <FlatList
                    horizontal
                    data={newStreamingMovies}
                    renderItem={renderMovieItem}
                    keyExtractor={(item) => `new-streaming-${item.id}`}
                    showsHorizontalScrollIndicator={false}
                />
            )}

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scrollView}>
                {newMovies.map((movie, index) => (
                    <View key={`new-${index}`} style={[styles.card, { backgroundColor: getColorByIndex(index) }]}>
                        <Text style={styles.cardTitle}>{movie.title}</Text>
                        <View style={styles.cardFooter}>
                            <Text style={styles.movieTitle}>{movie.title}</Text>
                            <Text style={styles.pizza}>{renderPizza(movie.rating)}</Text>
                        </View>
                    </View>
                ))}
            </ScrollView>

            <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>In Theaters</Text>
                <TouchableOpacity onPress={navigateToNowPlaying}>
                    <Text style={styles.seeAll}>See All</Text>
                </TouchableOpacity>
            </View>
            {isLoadingInTheaters ? (
                <Text>Loading in theaters movies...</Text>
            ) : errorInTheaters ? (
                <Text>Error loading in theaters movies: {errorInTheaters.message}</Text>
            ) : inTheatersMovies.length > 0 ? (
                <FlatList
                    horizontal
                    data={inTheatersMovies}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={renderMovieItem}
                    showsHorizontalScrollIndicator={false}
                />
            ) : (
                <Text>No movies currently playing in theaters.</Text>
            )}

            <Text style={styles.sectionTitle}>Top 10 Friends</Text>
            <View style={styles.friendsGrid}>
                {topFriends.map((_, index) => (
                    <View key={`friend-${index}`} style={styles.friendItem}>
                        <Icon name="user-circle" size={50} color="gray" />
                    </View>
                ))}
            </View>

            <Text style={styles.sectionTitle}>Suggested</Text>
            <FlatList
                horizontal
                data={suggestedMovies}
                renderItem={renderMovieItem}
                keyExtractor={(item, index) => `suggested-${index}`}
                showsHorizontalScrollIndicator={false}
            />
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, paddingTop: 60, paddingHorizontal: 16, backgroundColor: '#fff' },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    homeText: { fontSize: 32, fontWeight: 'bold', fontFamily: 'Trebuchet MS' },
    profileButton: { padding: 10 },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginVertical: 10,
        fontFamily: 'Trebuchet MS',
        color: '#CC5500',
    },
    movieItem: { marginRight: 10 },
    moviePoster: { width: 100, height: 150, borderRadius: 10 },
    movieTitle: { marginTop: 5, fontSize: 12, textAlign: 'center' },
    friendsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    friendItem: { width: '20%', alignItems: 'center', marginVertical: 5 },
    rowHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 16,
    },
    seeAll: { color: '#4285F4', fontWeight: 'bold', fontSize: 14 },
    scrollView: { marginBottom: 20 },
    card: {
        width: 200,
        height: 280,
        borderRadius: 12,
        marginRight: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    cardTitle: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
        textAlign: 'center',
        paddingHorizontal: 8,
    },
    cardFooter: {
        marginTop: 12,
        padding: 10,
        backgroundColor: 'white',
        borderBottomLeftRadius: 12,
        borderBottomRightRadius: 12,
        width: '100%',
        alignItems: 'center',
    },
    pizza: { fontSize: 16 },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 10,
        marginBottom: 10,
    },
});

export default HomeScreen;




