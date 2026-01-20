import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, SafeAreaView, Platform, StatusBar, Image, TouchableOpacity, Animated, Alert } from 'react-native';
import { db } from '../firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';
import Icon from 'react-native-vector-icons/FontAwesome';

const RevealScreen = ({ route, navigation }) => {
    const { connectionId } = route.params;
    const [results, setResults] = useState([]);
    const [winner, setWinner] = useState(null);
    const [loading, setLoading] = useState(true);
    const [revealStep, setRevealStep] = useState(0); // 0: loading, 1: countdown 3, 2: countdown 2, 3: countdown 1, 4: WINNER

    useEffect(() => {
        calculateResults();
    }, []);

    const calculateResults = async () => {
        try {
            const docRef = doc(db, "connections", connectionId);
            const snap = await getDoc(docRef);

            if (snap.exists()) {
                const data = snap.data();
                const matchedMovies = data.matchedMovies || [];
                const allVotes = data.votes || {}; // { uid: { movieId: score } }

                // Calculate Averages
                const scores = matchedMovies.map(movie => {
                    let totalScore = 0;
                    let voteCount = 0;

                    Object.values(allVotes).forEach(userVotes => {
                        if (userVotes[movie.id]) {
                            totalScore += userVotes[movie.id];
                            voteCount++;
                        }
                    });

                    return {
                        ...movie,
                        averageScore: voteCount > 0 ? (totalScore / voteCount).toFixed(1) : 0,
                        totalScore
                    };
                });

                // Sort by Average Score Descending
                scores.sort((a, b) => b.averageScore - a.averageScore);

                setResults(scores);
                setWinner(scores[0]);
                startRevealSequence();
            }
        } catch (error) {
            console.error("Error calculating results:", error);
            Alert.alert("Error", "Could not calculate results");
        } finally {
            setLoading(false);
        }
    };

    const startRevealSequence = () => {
        // Simple timer sequence
        let step = 1;
        setRevealStep(1);

        const timer = setInterval(() => {
            step++;
            setRevealStep(step);
            if (step >= 4) {
                clearInterval(timer);
            }
        }, 1000);
    };

    const renderCountdown = () => {
        const count = 4 - revealStep;
        return (
            <View style={styles.centerContent}>
                <Text style={styles.countdownText}>{count}</Text>
                <Text style={styles.countdownSub}>Calculating the perfect movie...</Text>
            </View>
        );
    };

    const renderWinner = () => {
        if (!winner) return <Text style={{ color: '#fff' }}>No winner found.</Text>;

        return (
            <View style={styles.winnerContainer}>
                <Text style={styles.winnerText}>THE WINNER IS</Text>
                <Image source={{ uri: `https://image.tmdb.org/t/p/w500${winner.poster_path}` }} style={styles.winnerPoster} />
                <Text style={styles.winnerTitle}>{winner.title}</Text>
                <View style={styles.scoreBadge}>
                    <Text style={styles.scoreValue}>{winner.averageScore}</Text>
                    <Icon name="star" size={20} color="#fff" />
                </View>

                <TouchableOpacity style={styles.homeButton} onPress={() => navigation.navigate("MainTabs", { screen: "Film Friendzy" })}>
                    <Text style={styles.homeButtonText}>Return to Match Groups</Text>
                </TouchableOpacity>

                {/* Top 3 List */}
                {results.length > 1 && (
                    <View style={styles.runnersUp}>
                        <Text style={styles.runnersUpTitle}>Runners Up</Text>
                        {results.slice(1, 4).map((movie, index) => (
                            <View key={movie.id} style={styles.runnerRow}>
                                <Text style={styles.runnerRank}>#{index + 2}</Text>
                                <Text style={styles.runnerTitle}>{movie.title}</Text>
                                <Text style={styles.runnerScore}>{movie.averageScore}</Text>
                            </View>
                        ))}
                    </View>
                )}
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            {loading ? (
                <Text style={{ color: '#fff', marginTop: 100, textAlign: 'center' }}>Loading...</Text>
            ) : (
                revealStep < 4 ? renderCountdown() : renderWinner()
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0a0a1a',
        paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
    },
    centerContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center'
    },
    countdownText: {
        fontSize: 120,
        fontWeight: 'bold',
        color: '#e50914',
        fontFamily: 'Trebuchet MS'
    },
    countdownSub: {
        color: '#fff',
        fontSize: 18,
        marginTop: 20
    },
    winnerContainer: {
        flex: 1,
        alignItems: 'center',
        padding: 30
    },
    winnerText: {
        color: '#888',
        fontSize: 16,
        letterSpacing: 4,
        marginBottom: 20,
        fontWeight: 'bold'
    },
    winnerPoster: {
        width: 250,
        height: 375,
        borderRadius: 15,
        borderWidth: 2,
        borderColor: '#e50914',
        shadowColor: '#e50914',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 20,
        elevation: 10
    },
    winnerTitle: {
        color: '#fff',
        fontSize: 28,
        fontWeight: 'bold',
        textAlign: 'center',
        marginTop: 20,
        marginBottom: 10
    },
    scoreBadge: {
        flexDirection: 'row',
        backgroundColor: '#ff8c00',
        paddingHorizontal: 15,
        paddingVertical: 5,
        borderRadius: 20,
        alignItems: 'center'
    },
    scoreValue: {
        color: '#fff',
        fontSize: 20,
        fontWeight: 'bold',
        marginRight: 5
    },
    homeButton: {
        marginTop: 40,
        backgroundColor: '#333',
        paddingVertical: 12,
        paddingHorizontal: 30,
        borderRadius: 25
    },
    homeButtonText: {
        color: '#fff',
        fontSize: 16
    },
    runnersUp: {
        marginTop: 40,
        width: '100%',
        backgroundColor: '#161625',
        padding: 15,
        borderRadius: 10
    },
    runnersUpTitle: {
        color: '#aaa',
        marginBottom: 10,
        textTransform: 'uppercase',
        fontSize: 12
    },
    runnerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8
    },
    runnerRank: { color: '#666', width: 30 },
    runnerTitle: { color: '#fff', flex: 1 },
    runnerScore: { color: '#ff8c00', fontWeight: 'bold' }
});

export default RevealScreen;
