import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, SafeAreaView, Platform, StatusBar, ScrollView } from 'react-native';
import { auth, db } from '../firebaseConfig';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import TicketStubCard from '../components/TicketStubCard';
import Icon from 'react-native-vector-icons/FontAwesome';

const TicketWalletScreen = ({ navigation }) => {
    const [ticketWallet, setTicketWallet] = useState([]);
    const [sortMethod, setSortMethod] = useState('newest'); // newest, points, title
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const user = auth.currentUser;
        if (!user) return;

        const q = query(
            collection(db, "users", user.uid, "ticketWallet"),
            orderBy("mintDate", "desc")
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            let stubs = [];
            snapshot.forEach((doc) => {
                stubs.push(doc.data());
            });
            setTicketWallet(stubs);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const getSortedData = () => {
        let sorted = [...ticketWallet];
        if (sortMethod === 'points') {
            sorted.sort((a, b) => (b.pointsEarned || 0) - (a.pointsEarned || 0));
        } else if (sortMethod === 'title') {
            sorted.sort((a, b) => (a.movieTitle || '').localeCompare(b.movieTitle || ''));
        } else {
            // Default newest
            sorted.sort((a, b) => new Date(b.mintDate) - new Date(a.mintDate));
        }
        return sorted;
    };

    const totalPoints = ticketWallet.reduce((sum, item) => sum + (item.pointsEarned || 10), 0);

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Icon name="arrow-left" size={24} color="#ff8c00" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>My Ticket Wallet</Text>
                <View style={{ alignItems: 'center', justifyContent: 'center', paddingRight: 10 }}>
                    <Text style={{ color: '#ff8c00', fontSize: 18, fontWeight: '900' }}>{totalPoints}</Text>
                    <Text style={{ color: '#ff8c00', fontSize: 10, fontWeight: 'bold' }}>PTS</Text>
                </View>
            </View>

            <View style={styles.sortContainer}>
                <Text style={styles.sortLabel}>Sort By:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginLeft: 10 }}>
                    <TouchableOpacity
                        style={[styles.sortPill, sortMethod === 'newest' && styles.sortPillActive]}
                        onPress={() => setSortMethod('newest')}
                    >
                        <Text style={[styles.sortText, sortMethod === 'newest' && styles.sortTextActive]}>Newest</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.sortPill, sortMethod === 'points' && styles.sortPillActive]}
                        onPress={() => setSortMethod('points')}
                    >
                        <Text style={[styles.sortText, sortMethod === 'points' && styles.sortTextActive]}>Highest Points</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.sortPill, sortMethod === 'title' && styles.sortPillActive]}
                        onPress={() => setSortMethod('title')}
                    >
                        <Text style={[styles.sortText, sortMethod === 'title' && styles.sortTextActive]}>Alphabetical</Text>
                    </TouchableOpacity>
                </ScrollView>
            </View>

            {ticketWallet.length === 0 && !loading ? (
                <View style={styles.emptyContainer}>
                    <Icon name="ticket" size={60} color="#555" />
                    <Text style={styles.emptyText}>Your wallet is empty.</Text>
                    <Text style={styles.emptySubtext}>Check into theaters to secure stubs!</Text>
                </View>
            ) : (
                <FlatList
                    data={getSortedData()}
                    keyExtractor={(item) => item.id}
                    numColumns={2}
                    contentContainerStyle={{ paddingHorizontal: 10, paddingBottom: 50, paddingTop: 10 }}
                    renderItem={({ item }) => (
                        <View style={{ alignItems: 'center', flex: 1, marginVertical: 10 }}>
                            <TicketStubCard stubData={item} widthScale={0.42} />
                            <Text style={styles.pointsText}>{item.pointsEarned || 10} PTS</Text>
                        </View>
                    )}
                />
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
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 15,
        backgroundColor: '#111',
        borderBottomWidth: 1,
        borderBottomColor: '#333',
    },
    backButton: {
        padding: 5,
    },
    headerTitle: {
        flex: 1,
        textAlign: 'center',
        color: '#ff8c00',
        fontSize: 20,
        fontWeight: 'bold',
        letterSpacing: 1,
    },
    sortContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 15,
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#222',
        backgroundColor: '#111'
    },
    sortLabel: {
        color: '#aaa',
        fontWeight: 'bold',
        fontSize: 14
    },
    sortPill: {
        paddingHorizontal: 15,
        paddingVertical: 6,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#444',
        marginRight: 10,
        backgroundColor: '#222'
    },
    sortPillActive: {
        backgroundColor: '#ff8c00',
        borderColor: '#ff8c00'
    },
    sortText: {
        color: '#bbb',
        fontWeight: 'bold',
        fontSize: 12
    },
    sortTextActive: {
        color: '#fff'
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center'
    },
    emptyText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
        marginTop: 15
    },
    emptySubtext: {
        color: '#888',
        marginTop: 5,
        fontStyle: 'italic'
    },
    pointsText: {
        color: '#ff8c00',
        marginTop: -5,
        fontWeight: '900',
        fontSize: 14,
        letterSpacing: 1
    }
});

export default TicketWalletScreen;
