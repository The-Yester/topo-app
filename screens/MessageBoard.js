import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import moment from 'moment';
import { v4 as uuidv4 } from 'uuid';

const MessageBoardScreen = () => {
    const [newMessage, setNewMessage] = useState(''); // ✅ Moved inside the component
    const [messages, setMessages] = useState([]); // ✅ Changed from "posts" to "messages"

    // Load posts when the component mounts
    useEffect(() => {
        loadPosts();
    }, []);

    // Save posts to AsyncStorage
    const savePosts = async (postsToSave) => {
        try {
            await AsyncStorage.setItem('messageBoardPosts', JSON.stringify(postsToSave));
        } catch (error) {
            console.error('Error saving posts:', error);
        }
    };

    // Load posts from AsyncStorage
    const loadPosts = async () => {
        try {
            const storedPosts = await AsyncStorage.getItem('messageBoardPosts');
            if (storedPosts) {
                setMessages(JSON.parse(storedPosts)); // ✅ Changed setPosts to setMessages
            }
        } catch (error) {
            console.error('Error loading posts:', error);
        }
    };

    const handlePostMessage = () => {
        if (newMessage.trim() === '') return;

        const newPost = {
            id: uuidv4(),
            text: newMessage,
            timestamp: moment().format('h:mm A - MMM D, YYYY'),
            username: 'The_Yester', // Replace this with actual username
        };

        const updatedPosts = [newPost, ...messages]; // ✅ Changed from posts to messages
        setMessages(updatedPosts); // ✅ Update correct state variable
        savePosts(updatedPosts); // ✅ Save to AsyncStorage
        setNewMessage(''); // ✅ Clear input
    };

    return (
        <View style={styles.container}>
            <Text style={styles.header}>Message Board</Text>

            <View style={styles.inputContainer}>
                <TextInput
                    style={styles.input}
                    placeholder="What's in the Box!?"
                    value={newMessage}
                    onChangeText={setNewMessage}
                    maxLength={120}
                />
                <TouchableOpacity style={styles.postButton} onPress={handlePostMessage}>
                    <Text style={styles.postButtonText}>Post</Text>
                </TouchableOpacity>
            </View>

            <FlatList
                data={messages} // ✅ Changed from posts to messages
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                    <View style={styles.postItem}>
                        <Text style={styles.username}>{item.username}</Text>
                        <Text style={styles.messageText}>{item.text}</Text>
                        <Text style={styles.timestamp}>{item.timestamp}</Text>
                    </View>
                )}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 16,
        backgroundColor: '#D3D3D3',
    },
    header: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 10,
        textAlign: 'center',
        fontFamily: 'Trebuchet MS',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    input: {
        flex: 1,
        borderWidth: 1,
        borderColor: 'white',
        borderRadius: 20,
        padding: 10,
        fontSize: 16,
        backgroundColor: 'white'
    },
    postButton: {
        backgroundColor: '#ff8c00',
        padding: 10,
        borderRadius: 20,
        marginLeft: 10,
    },
    postButtonText: {
        color: 'white',
        fontWeight: 'bold',
        fontFamily: 'Trebuchet MS',
    },
    postItem: {
        backgroundColor: '#f9f9f9',
        padding: 10,
        borderRadius: 20,
        marginVertical: 5,
    },
    username: {
        fontWeight: 'bold',
        fontSize: 14,
        fontFamily: 'Trebuchet MS',
    },
    messageText: {
        fontSize: 16,
        marginVertical: 5,
        fontFamily: 'Trebuchet MS',
    },
    timestamp: {
        fontSize: 12,
        color: '#777',
        fontFamily: 'Trebuchet MS',
    },
});

export default MessageBoardScreen;
