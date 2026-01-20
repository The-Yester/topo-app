import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, Dimensions, SafeAreaView, ActivityIndicator, Platform, StatusBar } from 'react-native';
import { getMoviesByProvider } from '../api/MovieService';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/FontAwesome';

const { width } = Dimensions.get('window');

// Top US Streaming Providers (Hardcoded IDs)
// Top US Streaming Providers (Stable Image URLs)
// Top US Streaming Providers (Confirmed TMDB Paths)
const PROVIDERS = [
    { id: 8, name: "Netflix", logo: "https://image.tmdb.org/t/p/w200/pbpMk2JmcoNnQwx5JGpXngfoWtp.jpg" },
    { id: 9, name: "Prime Video", logo: "https://image.tmdb.org/t/p/w200/pvske1MyAoymrs5bguRfVqYiM9a.jpg" },
    { id: 337, name: "Disney+", logo: "https://image.tmdb.org/t/p/w200/97yvRBw1GzX7fXprcF80er19ot.jpg" },
    { id: 15, name: "Hulu", logo: "https://image.tmdb.org/t/p/w200/bxBlRPEPpMVDc4jMhSrTf2339DW.jpg" },
    { id: 384, name: "Max", logo: "https://image.tmdb.org/t/p/w200/jbe4gVSfRlbPTdESXhEKpornsfu.jpg" }, // Logo from HBO Max (1899)
    { id: 350, name: "Apple TV+", logo: "https://image.tmdb.org/t/p/w200/mcbz1LgtErU9p4UdbZ0rG6RTWHX.jpg" },
    { id: 283, name: "Crunchyroll", logo: "https://image.tmdb.org/t/p/w200/fzN5Jok5Ig1eJ7gyNGoMhnLSCfh.jpg" },
    { id: 386, name: "Peacock", logo: "https://image.tmdb.org/t/p/w200/2aGrp1xw3qhwCYvNGAJZPdjfeeX.jpg" }
];

const StreamingServicesScreen = () => {
    const navigation = useNavigation();
    const [selectedProvider, setSelectedProvider] = useState(PROVIDERS[0]); // Default to Netflix
    const [movies, setMovies] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        loadMovies();
    }, [selectedProvider]);

    const loadMovies = async () => {
        setLoading(true);
        try {
            const results = await getMoviesByProvider(selectedProvider.id);
            setMovies(results);
        } catch (error) {
            console.error("Error loading streaming movies:", error);
        } finally {
            setLoading(false);
        }
    };

    const renderProviderItem = ({ item }) => {
        const isSelected = selectedProvider.id === item.id;
        return (
            <TouchableOpacity
                style={[styles.providerItem, isSelected && styles.selectedProviderItem]}
                onPress={() => setSelectedProvider(item)}
            >
                <Image source={{ uri: item.logo }} style={styles.providerLogo} />
                <Text style={[styles.providerName, isSelected && styles.selectedProviderName]}>{item.name}</Text>
            </TouchableOpacity>
        );
    };

    const renderMovieItem = ({ item }) => (
        <TouchableOpacity
            style={styles.movieCard}
            onPress={() => navigation.navigate('MovieDetails', { movieId: item.id })}
        >
            <Image
                source={{ uri: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : 'https://via.placeholder.com/150' }}
                style={styles.moviePoster}
            />
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Streaming Available</Text>
            </View>

            {/* Provider Selector */}
            <View style={styles.providerListContainer}>
                <FlatList
                    horizontal
                    data={PROVIDERS}
                    keyExtractor={item => item.id.toString()}
                    renderItem={renderProviderItem}
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.providerListContent}
                />
            </View>

            {/* Movies Grid */}
            <View style={styles.moviesContainer}>
                <Text style={styles.sectionTitle}>Popular on {selectedProvider.name}</Text>
                {loading ? (
                    <ActivityIndicator size="large" color="#FF8C00" style={{ marginTop: 50 }} />
                ) : (
                    <FlatList
                        data={movies}
                        keyExtractor={item => item.id.toString()}
                        renderItem={renderMovieItem}
                        numColumns={3}
                        contentContainerStyle={styles.moviesGrid}
                        showsVerticalScrollIndicator={false}
                    />
                )}
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0a0a1a', // Dark theme
        paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
    },
    header: {
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#333',
        alignItems: 'center'
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#fff',
    },
    providerListContainer: {
        paddingVertical: 15,
        backgroundColor: '#161625',
    },
    providerListContent: {
        paddingHorizontal: 10,
    },
    providerItem: {
        alignItems: 'center',
        marginHorizontal: 10,
        opacity: 0.6,
        transform: [{ scale: 0.9 }]
    },
    selectedProviderItem: {
        opacity: 1,
        transform: [{ scale: 1.1 }]
    },
    providerLogo: {
        width: 60,
        height: 60,
        borderRadius: 12,
        marginBottom: 5,
        borderWidth: 2,
        borderColor: 'transparent'
    },
    selectedProviderName: {
        color: '#ff8c00', // Highlight color
        fontWeight: 'bold',
    },
    providerName: {
        color: '#fff',
        fontSize: 12,
    },
    moviesContainer: {
        flex: 1,
        paddingHorizontal: 10,
    },
    sectionTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
        marginVertical: 15,
        marginLeft: 5,
    },
    moviesGrid: {
        paddingBottom: 20,
    },
    movieCard: {
        width: (width / 3) - 14, // 3 columns with margins
        margin: 5,
        borderRadius: 8,
        overflow: 'hidden',
    },
    moviePoster: {
        width: '100%',
        height: 160,
        resizeMode: 'cover',
    },
});

export default StreamingServicesScreen;
