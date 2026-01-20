import React, { useEffect, useState, useLayoutEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, Image, StyleSheet, SafeAreaView, Platform, StatusBar, ActivityIndicator } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/FontAwesome';
import { TMDB_API_KEY } from '../utils/config';

const API_KEY = TMDB_API_KEY;

const GenreMoviesScreen = () => {
    const route = useRoute();
    const navigation = useNavigation();
    const { genreId, genreName } = route.params;

    const [movies, setMovies] = useState([]);
    const [loading, setLoading] = useState(true);

    useLayoutEffect(() => {
        navigation.setOptions({
            headerShown: false,
        });
    }, [navigation]);

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
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.headerContainer}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Icon name="chevron-left" size={24} color="#ff8c00" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{genreName} Movies</Text>
            </View>

            {loading ? (
                <View style={styles.centerContent}>
                    <ActivityIndicator size="large" color="#e50914" />
                </View>
            ) : (
                <FlatList
                    data={movies}
                    keyExtractor={(item) => item.id.toString()}
                    numColumns={2}
                    columnWrapperStyle={styles.row}
                    contentContainerStyle={styles.listContent}
                    renderItem={({ item }) => (
                        <TouchableOpacity
                            style={styles.movieItem}
                            onPress={() => navigation.navigate('MovieDetails', { movieId: item.id })}
                        >
                            <Image
                                source={{ uri: `https://image.tmdb.org/t/p/w500${item.poster_path}` }}
                                style={styles.poster}
                            />
                            <Text style={styles.movieTitle} numberOfLines={2}>{item.title}</Text>
                        </TouchableOpacity>
                    )}
                />
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0a0a1a', // Dark Theme
        paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
    },
    headerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 15,
        // borderBottomWidth: 1,
        // borderBottomColor: '#222'
    },
    backButton: {
        marginRight: 15,
        padding: 5
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        fontFamily: 'Trebuchet MS',
        color: 'white',
    },
    centerContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center'
    },
    listContent: {
        padding: 10,
        paddingBottom: 20
    },
    row: {
        justifyContent: 'space-between',
        marginBottom: 20,
    },
    movieItem: {
        flex: 1,
        margin: 5,
        alignItems: 'center',
        backgroundColor: '#161625',
        borderRadius: 15,
        paddingBottom: 10,
        overflow: 'hidden'
    },
    poster: {
        width: '100%',
        aspectRatio: 2 / 3,
        borderTopLeftRadius: 15,
        borderTopRightRadius: 15,
    },
    movieTitle: {
        marginTop: 8,
        fontSize: 14,
        fontWeight: 'bold',
        textAlign: 'center',
        fontFamily: 'Trebuchet MS',
        color: '#fff',
        paddingHorizontal: 5
    },
});

export default GenreMoviesScreen;
