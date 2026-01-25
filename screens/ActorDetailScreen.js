import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, ScrollView, TouchableOpacity, ActivityIndicator, FlatList } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/FontAwesome';
import { getPersonDetails } from '../api/MovieService';
import { SafeAreaView } from 'react-native-safe-area-context';

const ActorDetailScreen = () => {
    const route = useRoute();
    const navigation = useNavigation();
    const { personId } = route.params;

    const [details, setDetails] = useState(null);
    const [loading, setLoading] = useState(true);
    const [bioExpanded, setBioExpanded] = useState(false);

    useEffect(() => {
        fetchDetails();
    }, [personId]);

    const fetchDetails = async () => {
        try {
            const data = await getPersonDetails(personId);
            setDetails(data);
        } catch (error) {
            console.error("Error fetching person details:", error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color="#e50914" />
            </View>
        );
    }

    if (!details) return null;

    // Process Filmography (Sorted by Year Descending)
    // Filter for movies only? Or include TV? Let's assume movies primarily or combined but labeled.
    // The request was "film list", implies "Filmography".
    const credits = details.combined_credits?.cast || [];
    const sortedCredits = credits
        .filter(c => (c.release_date || c.first_air_date) && c.media_type === 'movie') // Must have date AND be a movie
        .sort((a, b) => {
            const dateA = new Date(a.release_date || a.first_air_date);
            const dateB = new Date(b.release_date || b.first_air_date);
            return dateB - dateA;
        });

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Icon name="arrow-left" size={20} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle} numberOfLines={1}>{details.name}</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                {/* Profile Section */}
                <View style={styles.profileSection}>
                    <Image
                        source={details.profile_path ? { uri: `https://image.tmdb.org/t/p/w500${details.profile_path}` } : require('../assets/profile_placeholder.jpg')}
                        style={styles.profileImage}
                    />
                    <View style={styles.profileInfo}>
                        <Text style={styles.name}>{details.name}</Text>
                        <Text style={styles.knownFor}>Known for: {details.known_for_department}</Text>
                        <Text style={styles.birthInfo}>
                            {details.birthday ? `Born: ${details.birthday}` : ''}
                            {details.place_of_birth ? ` in ${details.place_of_birth}` : ''}
                        </Text>
                    </View>
                </View>

                {/* Biography */}
                {details.biography ? (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Biography</Text>
                        <Text style={styles.bioText} numberOfLines={bioExpanded ? undefined : 6}>
                            {details.biography}
                        </Text>
                        <TouchableOpacity onPress={() => setBioExpanded(!bioExpanded)}>
                            <Text style={styles.readMore}>{bioExpanded ? "Read Less" : "Read More"}</Text>
                        </TouchableOpacity>
                    </View>
                ) : null}

                {/* Filmography Table */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Filmography</Text>
                    <View style={styles.tableHeader}>
                        <Text style={[styles.tableHeadText, { flex: 0.2 }]}>Year</Text>
                        <Text style={[styles.tableHeadText, { flex: 0.4 }]}>Title</Text>
                        <Text style={[styles.tableHeadText, { flex: 0.4 }]}>Role</Text>
                    </View>

                    {sortedCredits.map((item, index) => {
                        const year = (item.release_date || item.first_air_date || "").split('-')[0];
                        const title = item.title || item.name;
                        const role = item.character || "";
                        const isMovie = item.media_type === 'movie';

                        return (
                            <TouchableOpacity
                                key={`${item.id}-${index}`}
                                style={[styles.tableRow, index % 2 === 0 ? styles.rowEven : styles.rowOdd]}
                                onPress={() => {
                                    if (isMovie) {
                                        navigation.push('MovieDetails', { movieId: item.id });
                                    } else {
                                        // Handle TV Show navigation if/when implemented
                                        // For now, maybe an alert or no-op?
                                        // Or just let it go for now.
                                        console.log("TV Show clicked", item.id);
                                    }
                                }}
                                disabled={!isMovie} // Disable if not movie for now to prevent crash
                            >
                                <Text style={[styles.cellText, { flex: 0.2 }]}>{year}</Text>
                                <Text style={[styles.cellText, { flex: 0.4, fontWeight: 'bold', color: isMovie ? '#ADD8E6' : '#ccc' }]} numberOfLines={2}>
                                    {title}
                                </Text>
                                <Text style={[styles.cellText, { flex: 0.4, fontStyle: 'italic' }]} numberOfLines={2}>
                                    {role}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                <View style={{ height: 40 }} />
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff', // White background Wikipedia style? Or Dark Theme? 
        // User screenshot showed white/light theme. But app is Dark Theme.
        // Let's stick to Dark Theme consistency BUT structure it Wikipedia style. 
        // Or if user specifically said "look to wikipedia", should I use white?
        // "Wikipedia style look" usually refers to the table layout.
        // Let's keep App's dark theme for consistency, but table layout.
        backgroundColor: '#0a0a1a'
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#0a0a1a'
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 15,
        backgroundColor: '#161625',
        borderBottomWidth: 1,
        borderBottomColor: '#333'
    },
    headerTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
        flex: 1,
        textAlign: 'center'
    },
    scrollContent: {
        padding: 20
    },
    profileSection: {
        flexDirection: 'row',
        marginBottom: 20,
    },
    profileImage: {
        width: 120,
        height: 180,
        borderRadius: 5,
        borderWidth: 1,
        borderColor: '#333',
        backgroundColor: '#ccc'
    },
    profileInfo: {
        flex: 1,
        marginLeft: 20,
        justifyContent: 'flex-start'
    },
    name: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 5,
        fontFamily: 'Trebuchet MS'
    },
    knownFor: {
        fontSize: 14,
        color: '#aaa',
        marginBottom: 5
    },
    birthInfo: {
        fontSize: 14,
        color: '#888',
        fontStyle: 'italic'
    },
    section: {
        marginBottom: 25
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#ff8c00', // TOPO Orange
        marginBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#333',
        paddingBottom: 5
    },
    bioText: {
        color: '#ddd',
        fontSize: 15,
        lineHeight: 22,
        fontFamily: 'Arial' // Readable font
    },
    readMore: {
        color: '#ff8c00',
        marginTop: 5,
        fontWeight: 'bold'
    },
    // Table Styles
    tableHeader: {
        flexDirection: 'row',
        backgroundColor: '#333',
        paddingVertical: 10,
        paddingHorizontal: 5,
        borderTopLeftRadius: 5,
        borderTopRightRadius: 5
    },
    tableHeadText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 14
    },
    tableRow: {
        flexDirection: 'row',
        paddingVertical: 12,
        paddingHorizontal: 5,
        borderBottomWidth: 1,
        borderBottomColor: '#222'
    },
    rowEven: {
        backgroundColor: '#161625'
    },
    rowOdd: {
        backgroundColor: '#0a0a1a'
    },
    cellText: {
        color: '#ccc',
        fontSize: 14,
        paddingRight: 5
    }
});

export default ActorDetailScreen;
