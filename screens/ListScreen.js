import React, { useContext, useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, Button, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { MoviesContext } from '../context/MoviesContext';
import { v4 as uuidv4 } from 'uuid';
import Swipeable from 'react-native-gesture-handler/Swipeable';

const LOCKED_LISTS = ["Favorites", "Watch Later", "Overall Ratings"];

const ListScreen = ({ navigation }) => {
    const { movieLists, addList, deleteList, addMovieToList } = useContext(MoviesContext);
    const [newListName, setNewListName] = useState('');
    const overallRatingsListRef = useRef(null);

    useEffect(() => {
        // Ensure locked lists exist
        LOCKED_LISTS.forEach(listName => {
            const exists = movieLists.some(list => list.name === listName);
            if (!exists) {
                const newList = {
                    id: uuidv4(),
                    name: listName,
                    movies: [],
                };
                addList(newList);
                if (listName === "Overall Ratings") {
                    overallRatingsListRef.current = newList;
                }
            } else if (listName === "Overall Ratings") {
                overallRatingsListRef.current = movieLists.find(list => list.name === listName);
            }
        });
    }, [movieLists, addList]);

    const handleMovieRated = (movie) => {
        if (overallRatingsListRef.current) {
            addMovieToList(overallRatingsListRef.current.id, movie);
        }
    };

    const handleAddList = () => {
        const trimmedName = newListName.trim();
        if (trimmedName && !LOCKED_LISTS.includes(trimmedName)) {
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
        if (!LOCKED_LISTS.includes(item.name)) {
            return (
                <TouchableOpacity style={styles.deleteButton} onPress={() => deleteList(item.id)}>
                    <Text style={styles.deleteButtonText}>Delete</Text>
                </TouchableOpacity>
            );
        }
        return null;
    };

    const allLists = movieLists.filter(
        (list, index, self) => index === self.findIndex(l => l.name === list.name)
    );

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Your Movie Lists</Text>
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
                            <Text>{item.movies ? item.movies.length : 0} movies</Text>
                        </TouchableOpacity>
                    </Swipeable>
                )}
                ListEmptyComponent={<Text style={styles.empty}>No lists yet. Add one!</Text>}
            />
            <TextInput
                style={styles.input}
                placeholder="Add Your List Here"
                value={newListName}
                onChangeText={setNewListName}
            />
            <Button title="Add List" onPress={handleAddList} />
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, padding: 16, backgroundColor: '#D3D3D3' },
    title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
    listItem: {
        padding: 10,
        borderBottomWidth: 2,
        borderBottomColor: 'grey',
        marginBottom: 10,
    },
    listName: { fontSize: 18, fontWeight: 'bold' },
    input: {
        borderWidth: 2,
        borderColor: 'grey',
        padding: 10,
        marginBottom: 10,
        borderRadius: 5,
        backgroundColor: 'white'
    },
    empty: { textAlign: 'center', marginTop: 20, fontStyle: 'italic' },
    deleteButton: {
        backgroundColor: 'red',
        justifyContent: 'center',
        alignItems: 'center',
        width: 80,
        height: '100%',
    },
    deleteButtonText: {
        color: 'white',
        fontWeight: 'bold',
    },
});

export default ListScreen;

