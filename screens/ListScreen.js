import React, { useContext, useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, Button, FlatList, StyleSheet, TouchableOpacity, SafeAreaView, Platform, StatusBar, KeyboardAvoidingView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MoviesContext, OVERALL_RATINGS_LIST_ID, OVERALL_RATINGS_LIST_NAME } from '../context/MoviesContext';
import { v4 as uuidv4 } from 'uuid';
import Swipeable from 'react-native-gesture-handler/Swipeable';

// Locked lists that exist in user's movieLists
const USER_LOCKED_LISTS = ["Favorites", "Watch Later"];

const ListScreen = ({ navigation }) => {
    const { movieLists, addList, deleteList, addMovieToList, overallRatedMovies } = useContext(MoviesContext);
    const [newListName, setNewListName] = useState('');

    useEffect(() => {
        // Ensure user locked lists exist (Favorites, Watch Later)
        const missingLists = USER_LOCKED_LISTS.filter(listName => 
            !movieLists.some(list => list.name === listName)
        ).map(listName => ({
            id: uuidv4(),
            name: listName,
            movies: [],
        }));

        if (missingLists.length > 0) {
            // Batch add them all at once to prevent React closure clobbering and queue exhaustion
            const updatedLists = [...movieLists, ...missingLists];
            // We can't use `addList` context here directly without mutating Context state sync logic,
            // but we can call a new context batch func, or just directly trigger saveData by rewriting context or triggering addList safely?
            // Actually, we can just let MoviesContext handle this. Wait, we can't redefine Context here.
            // Let's call addList sequentially with a slight delay if missing multiple, or rely on the queue.
            // But since we disabled long polling, sequential writes are perfectly safe and will batch automatically in Firestore SDK.
            const ensureListsSync = async () => {
                for (const newList of missingLists) {
                    await new Promise(resolve => setTimeout(resolve, 50)); 
                    // Slight delay to ensure React state flushes in the addList closure properly
                    addList(newList);
                }
            };
            ensureListsSync();
        }
    }, []); // Run ONCE on mount, don't ping-pong if state gets stuck!

    const handleAddList = () => {
        const trimmedName = newListName.trim();
        // Check both user locked lists and the special Overall Ratings name
        if (trimmedName && !USER_LOCKED_LISTS.includes(trimmedName) && trimmedName !== OVERALL_RATINGS_LIST_NAME) {
            const newList = {
                id: uuidv4(),
                name: trimmedName,
                movies: [],
            };
            addList(newList);
            setNewListName('');
        }
    };

    const navigateToListDetails = (item) => {
        navigation.navigate('ListDetails', {
            listId: item.id,
            listName: item.name,
        });
    };

    const rightSwipeActions = (item) => {
        // Prevent deletion of Favorites, Watch Later, and Overall Ratings
        if (!USER_LOCKED_LISTS.includes(item.name) && item.name !== OVERALL_RATINGS_LIST_NAME) {
            return (
                <TouchableOpacity style={styles.deleteButton} onPress={() => deleteList(item.id)}>
                    <Text style={styles.deleteButtonText}>Delete</Text>
                </TouchableOpacity>
            );
        }
        return null;
    };

    // Locked lists that are always at the top
    const LOCKED_ORDER = [OVERALL_RATINGS_LIST_NAME, "Favorites", "Watch Later"];

    // Sorting state: 'asc' (A-Z / 1-10), 'desc' (Z-A / 10-1), or null (creation order)
    const [sortOrder, setSortOrder] = useState(null);

    // Load persisted sort order on mount
    useEffect(() => {
        const loadSortOrder = async () => {
            try {
                const savedOrder = await AsyncStorage.getItem('sortOrderLists');
                if (savedOrder !== null) {
                    setSortOrder(savedOrder);
                }
            } catch (error) {
                console.error("Error loading sort order:", error);
            }
        };
        loadSortOrder();
    }, []);

    const toggleSort = async () => {
        let newOrder = null;
        if (sortOrder === null) newOrder = 'asc';
        else if (sortOrder === 'asc') newOrder = 'desc';
        else newOrder = null;

        setSortOrder(newOrder);

        try {
            if (newOrder === null) {
                await AsyncStorage.removeItem('sortOrderLists');
            } else {
                await AsyncStorage.setItem('sortOrderLists', newOrder);
            }
        } catch (error) {
            console.error("Error saving sort order:", error);
        }
    };

    // Separate lists
    const lockedLists = [];
    let customLists = [];

    // 1. Get Overall Ratings List
    const overallList = {
        id: OVERALL_RATINGS_LIST_ID,
        name: OVERALL_RATINGS_LIST_NAME,
        movies: overallRatedMovies || []
    };

    // 2. Identify Locked vs Custom from User Lists
    movieLists.forEach(list => {
        if (LOCKED_ORDER.includes(list.name) && list.name !== OVERALL_RATINGS_LIST_NAME) {
            lockedLists.push(list);
        } else if (list.name !== OVERALL_RATINGS_LIST_NAME) {
            customLists.push(list);
        }
    });

    // 3. Sort Locked Lists (Ensure specific order: Favorites -> Watch Later)
    lockedLists.sort((a, b) => {
        return LOCKED_ORDER.indexOf(a.name) - LOCKED_ORDER.indexOf(b.name);
    });

    // 4. Sort Custom Lists
    if (sortOrder) {
        customLists.sort((a, b) => {
            // "Numeric" true allows "1. List", "2. List", "10. List" to sort naturally
            const compareResult = a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
            return sortOrder === 'asc' ? compareResult : -compareResult;
        });
    }

    // 5. Concatenate All
    const allLists = [overallList, ...lockedLists, ...customLists];

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.headerRow}>
                <Text style={styles.title}>Your Movie Lists</Text>
                <TouchableOpacity onPress={toggleSort} style={styles.sortButton}>
                    <Text style={styles.sortButtonText}>
                        {sortOrder === 'asc' ? "Sort: A-Z ⬇️" : sortOrder === 'desc' ? "Sort: Z-A ⬆️" : "Sort: Default"}
                    </Text>
                </TouchableOpacity>
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={{ flex: 1 }}
                keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0}
            >
                <FlatList
                    data={allLists}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => (
                        <Swipeable renderRightActions={() => rightSwipeActions(item)}>
                            <TouchableOpacity
                                style={styles.listItem}
                                onPress={() => navigateToListDetails(item)}
                            >
                                <Text style={styles.listName}>{item.name}</Text>
                                <Text style={styles.listCount}>{item.movies ? item.movies.length : 0} movies</Text>
                            </TouchableOpacity>
                        </Swipeable>
                    )}
                    ListEmptyComponent={<Text style={styles.empty}>No lists yet. Add one!</Text>}
                />
                <View style={styles.inputContainer}>
                    <TextInput
                        style={styles.input}
                        placeholder="New List Name..."
                        placeholderTextColor="#666"
                        value={newListName}
                        onChangeText={setNewListName}
                    />
                    <Button title="Add List" onPress={handleAddList} color="#ff8c00" />
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 16,
        backgroundColor: '#0a0a1a',
        paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + 16 : 16 // Add extra 16 for standard padding
    },
    title: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20
    },
    sortButton: {
        backgroundColor: '#333',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#555'
    },
    sortButtonText: {
        color: '#ccc',
        fontSize: 14,
        fontWeight: 'bold'
    },
    listItem: {
        padding: 15,
        backgroundColor: '#1a1a2e',
        marginBottom: 10,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#333'
    },
    listName: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
    listCount: { color: '#888', marginTop: 4 },
    inputContainer: { marginTop: 20 },
    input: {
        borderWidth: 1,
        borderColor: '#333',
        padding: 12,
        marginBottom: 10,
        borderRadius: 8,
        backgroundColor: '#1a1a2e',
        color: '#fff'
    },
    empty: { textAlign: 'center', marginTop: 20, fontStyle: 'italic', color: '#666' },
    deleteButton: {
        backgroundColor: '#d32f2f',
        justifyContent: 'center',
        alignItems: 'center',
        width: 80,
        height: '84%', // Adjusted to match vertical spacing logic roughly or use borderRadius
        marginTop: 0,
        marginBottom: 10,
        borderRadius: 8,
        marginLeft: 10
    },
    deleteButtonText: {
        color: 'white',
        fontWeight: 'bold',
    },
});

export default ListScreen;

