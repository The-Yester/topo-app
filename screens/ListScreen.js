import React, { useContext, useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, Button, FlatList, StyleSheet, TouchableOpacity, SafeAreaView, Platform, StatusBar, KeyboardAvoidingView } from 'react-native';
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
        USER_LOCKED_LISTS.forEach(listName => {
            const exists = movieLists.some(list => list.name === listName);
            if (!exists) {
                const newList = {
                    id: uuidv4(),
                    name: listName,
                    movies: [],
                };
                addList(newList);
            }
        });
    }, [movieLists, addList]);

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

    // Construct the full list to display
    const allLists = [
        // 1. Special "Overall Ratings" list (Always first or specifically placed)
        {
            id: OVERALL_RATINGS_LIST_ID,
            name: OVERALL_RATINGS_LIST_NAME,
            movies: overallRatedMovies || []
        },
        // 2. User's lists (Favorites, Watch Later, Custom Lists)
        ...movieLists.filter(
            (list, index, self) => index === self.findIndex(l => l.name === list.name) && list.name !== OVERALL_RATINGS_LIST_NAME // Filter out any accidental "Overall Ratings" dups in user lists
        )
    ];

    return (
        <SafeAreaView style={styles.container}>
            <Text style={styles.title}>Your Movie Lists</Text>
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
    title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, color: '#fff' },
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

