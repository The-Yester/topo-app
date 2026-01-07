import React, { useState, useEffect, useContext } from 'react';
import { View, Text, TextInput, Button, TouchableOpacity, StyleSheet, ScrollView, FlatList, Image, Modal } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { MoviesContext } from '../context/MoviesContext';
import { Picker } from '@react-native-picker/picker';
import US_CITIES from '../data/US_Cities'; // Ensure this file exists

const API_KEY = '46de4e8d3c4e28a2a768923324c89503'; // Replace with your actual TMDB API key

const ratingMethods = [
    { id: 1, name: "1-5" },
    { id: 2, name: "1-10" },
    { id: 3, name: "1%-100%" },
    { id: 4, name: "Awards" }
];

const ProfileSettings = ({ navigation }) => {
    const { setRatingMethod, movies, setMovies, friends } = useContext(MoviesContext);
    const [selectedRatingMethod, setSelectedRatingMethod] = useState(ratingMethods[0].name);
    const [profilePhoto, setProfilePhoto] = useState(null);
    const [username, setUsername] = useState('');
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [location, setLocation] = useState('');
    const [aboutMe, setAboutMe] = useState('');
    const [topMovies, setTopMovies] = useState([]);
    const [topFriends, setTopFriends] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearchModalVisible, setIsSearchModalVisible] = useState(false);

    useEffect(() => {
        console.log("Movies Context:", movies);
    }, [movies]);

    useEffect(() => {
        const loadUserData = async () => {
            try {
                const usersData = await AsyncStorage.getItem('users');
                const users = usersData ? JSON.parse(usersData) : [];
                const currentUserEmail = await AsyncStorage.getItem('currentUserEmail');
                const currentUser = users.find(user => user.email === currentUserEmail);

                if (currentUser) {
                    setProfilePhoto(currentUser.profilePhoto || null);
                    setUsername(currentUser.username || '');
                    setName(currentUser.name || '');
                    setEmail(currentUser.email || '');
                    setPassword(currentUser.password || '');
                    setLocation(currentUser.location || '');
                    setAboutMe(currentUser.aboutMe || '');
                    setSelectedRatingMethod(currentUser.ratingMethod || '1-5');
                    setTopMovies(currentUser.topMovies ? JSON.parse(currentUser.topMovies) : []);
                    setTopFriends(currentUser.topFriends ? JSON.parse(currentUser.topFriends) : []);
                } else {
                    console.warn("Current user data not found.");
                    navigation.navigate('Login');
                    console.log('Loaded profile:', currentUser);
                }
            } catch (error) {
                console.error('Error loading user data:', error);
            } finally {
                setIsLoading(false);
            }
        };

        loadUserData();
    }, [navigation]);

    const saveProfileSettings = async () => {
        try {
            const usersData = await AsyncStorage.getItem('users');
            const users = usersData ? JSON.parse(usersData) : [];
            const currentUserEmail = await AsyncStorage.getItem('currentUserEmail');
            const updatedUsers = users.map(user => {
                if (user.email === currentUserEmail) {
                    return {
                        ...user,
                        profilePhoto,
                        username,
                        name,
                        email,
                        password,
                        location,
                        aboutMe,
                        ratingMethod: selectedRatingMethod,
                        topMovies: JSON.stringify(topMovies),
                        topFriends: JSON.stringify(topFriends),
                    };
                }
                return user;
            });

            await AsyncStorage.setItem('users', JSON.stringify(updatedUsers));
            setRatingMethod(selectedRatingMethod);
            navigation.goBack();
        } catch (error) {
            console.error("Failed to save profile settings:", error);
        }
    };

    const pickImage = async () => {
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [4, 4],
            quality: 1,
        });

        if (!result.canceled) {
            setProfilePhoto(result.assets[0].uri);
        }
    };

    if (isLoading) {
        return (
            <View>
                <Text>Loading...</Text>
            </View>
        );
    }

    const handleRatingMethodChange = (methodName) => {
        const method = ratingMethods.find(m => m.name === methodName);
        if (method) {
            setSelectedRatingMethod(method.name);
        }
    };

    const openSearchModal = () => {
        setIsSearchModalVisible(true);
        setSearchQuery('');
        setSearchResults([]);
    };

    const closeSearchModal = () => {
        setIsSearchModalVisible(false);
    };

    const handleSearchMovie = async (query) => {
        setSearchQuery(query);

        if (!query) {
            setSearchResults([]);
            return;
        }

        try {
            const response = await fetch(`https://api.themoviedb.org/3/search/movie?api_key=${API_KEY}&query=${encodeURIComponent(query)}`);
            const data = await response.json();

            if (data.results) {
                setSearchResults(data.results.slice(0, 10)); // Limit to 10 results
            } else {
                setSearchResults([]);
            }
        } catch (error) {
            console.error("Search failed:", error);
            setSearchResults([]);
        }
    };

    const addTopMovie = (movie) => {
        if (topMovies.length >= 10) {
            Alert.alert("Limit Reached", "You can only select up to 10 favorite films.");
            return;
        }

        if (topMovies.find(m => m.id === movie.id)) {
            Alert.alert("Already Added", `${movie.title} is already in your favorites.`);
            return;
        }

        const movieToAdd = {
            id: movie.id,
            title: movie.title,
            posterPath: movie.poster_path,
        };

        setTopMovies([...topMovies, movieToAdd]);
        closeSearchModal();
    };

    const removeTopMovie = (movieId) => {
        setTopMovies(topMovies.filter((m) => m.id !== movieId));
    };

    const renderFavoriteMovieItem = ({ item }) => {
        const posterUrl = `https://image.tmdb.org/t/p/w200${item.posterPath}`;
        return (
            <TouchableOpacity onPress={() => removeTopMovie(item.id)} style={{ alignItems: 'center', marginRight: 10 }}>
                <Image
                    source={{ uri: posterUrl }}
                    style={{ width: 100, height: 150, borderRadius: 10 }}
                />
                <Text style={{ color: 'black', fontSize: 12, marginTop: 5, textAlign: 'center' }}>
                    {item.title}
                </Text>
            </TouchableOpacity>
        );
    };

    const renderSearchMovieItem = ({ item }) => {
        const posterUrl = `https://image.tmdb.org/t/p/w200${item.poster_path}`;
        return (
            <TouchableOpacity onPress={() => addTopMovie(item)} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                <Image
                    source={{ uri: posterUrl }}
                    style={{ width: 80, height: 120, borderRadius: 8, marginRight: 10 }}
                />
                <Text style={{ color: 'black', flexShrink: 1 }}>{item.title}</Text>
            </TouchableOpacity>
        );
    };

    const ListFooterComponent = () => (
        topMovies.length < 10 ? (
            <TouchableOpacity style={styles.addMoreButton} onPress={openSearchModal}>
                <Text style={styles.addMoreText}>+</Text>
            </TouchableOpacity>
        ) : null
    );

    return (
        <View style={styles.container}>
            <ScrollView>
                <Text style={styles.header}>Profile Settings</Text>

                {/* ... Profile Photo, Username, etc. ... */}
                <View style={styles.profilePhotoContainer}>
                    <Image source={profilePhoto ? { uri: profilePhoto } : require('../assets/profile_placeholder.jpg')} style={styles.profilePhoto} />
                    <TouchableOpacity style={styles.uploadButton} onPress={pickImage}>
                        <Text style={styles.uploadButtonText}>{profilePhoto ? 'Change Photo' : 'Upload Photo'}</Text>
                    </TouchableOpacity>
                </View>

                <TextInput style={[styles.input, { color: 'black' }]} placeholder="Username" value={username} onChangeText={setUsername} />
                <TextInput style={[styles.input, { color: 'black' }]} placeholder="Name (First & Last)" value={name} onChangeText={setName} />
                <TextInput style={[styles.input, { color: 'black' }]} placeholder="Email" value={email} editable={false} />
                <TextInput style={[styles.input, { color: 'black' }]} placeholder="Password" secureTextEntry value={password} onChangeText={setPassword} />
                <TextInput style={[styles.input, { color: 'black' }]} placeholder="About Me (120 chars)" maxLength={120} value={aboutMe} onChangeText={setAboutMe} />

                <Text style={styles.pickerHeader}>Location</Text>
                <View style={styles.pickerContainer}>
                    <Picker selectedValue={location} onValueChange={setLocation} style={styles.picker} itemStyle={styles.pickerItem} >
                        {US_CITIES.map((city) => (
                            <Picker.Item key={city} label={city} value={city} />
                        ))}
                    </Picker>
                </View>

                <Text style={styles.pickerHeader}>Rating Method</Text>
                <View style={styles.pickerContainer}>
                    <Picker
                        selectedValue={selectedRatingMethod}
                        onValueChange={handleRatingMethodChange}
                        style={styles.picker}
                        itemStyle={styles.pickerItem}
                    >
                        {ratingMethods.map((method) => (
                            <Picker.Item key={method.id} label={method.name} value={method.name} />
                        ))}
                    </Picker>
                </View>

                <Text style={styles.label}>Top 10 Films</Text>
                <FlatList
                    data={topMovies}
                    keyExtractor={(item) => item.id.toString()}
                    horizontal
                    renderItem={renderFavoriteMovieItem}
                    ListFooterComponent={ListFooterComponent}
                />
                <Text style={styles.helperText}>Tap a film to remove it. Click '+' to add more (max 10).</Text>

                <Text style={styles.label}>Top Friends</Text>
                <FlatList
                    data={friends}
                    keyExtractor={(item) => item.id.toString()}
                    horizontal
                    renderItem={({ item }) => (
                        <TouchableOpacity
                            style={[
                                styles.friendItem,
                                topFriends.includes(item.id) ? styles.selectedItem : null,
                            ]}
                            onPress={() => {
                                if (topFriends.includes(item.id)) {
                                    setTopFriends(topFriends.filter((id) => id !== item.id));
                                } else if (topFriends.length < 10) {
                                    setTopFriends([...topFriends, item.id]);
                                } else {
                                    Alert.alert("Limit Reached", "You can only select up to 10 top friends.");
                                }
                            }}>
                            <Text style={styles.friendText}>{item.name}</Text>
                        </TouchableOpacity>
                    )}
                />
                <Text style={styles.helperText}>Tap friends to add/remove from your Top 10 (max 10).</Text>

                <Button title="Save Changes" onPress={saveProfileSettings} />

                {/* Search Modal */}
                <Modal
                    animationType="slide"
                    transparent={true}
                    visible={isSearchModalVisible}
                    onRequestClose={closeSearchModal}
                >
                    <View style={styles.modalContainer}>
                        <View style={styles.modalContent}>
                            <Text style={styles.modalTitle}>Search Movies</Text>
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Enter movie title"
                                value={searchQuery}
                                onChangeText={handleSearchMovie}
                            />
                            <FlatList
                                data={searchResults}
                                keyExtractor={(item) => item.id.toString()}
                                renderItem={renderSearchMovieItem}
                            />
                            <Button title="Cancel" onPress={closeSearchModal} />
                        </View>
                    </View>
                </Modal>

            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, padding: 16, backgroundColor: '#FAF9F6' },
    header: { fontSize: 28, fontWeight: 'bold', marginBottom: 20, color: 'black' },
    input: { fontSize: 16, height: 50, borderColor: 'white', borderWidth: 2, borderRadius: 20, marginBottom: 10, paddingHorizontal: 10, color: 'black', backgroundColor: '#D3D3D3' },
    textarea: { fontSize: 16, height: 100, borderColor: 'white', borderWidth: 2, borderRadius: 20, marginBottom: 10, paddingHorizontal: 10, color: 'black', backgroundColor: '#D3D3D3' },
    picker: { height: 200, backgroundColor: '#D3D3D3', borderRadius: 10 },
    pickerContainer: { width: '100%', backgroundColor: 'black', borderRadius: 15, borderWidth: 1, borderColor: '#ccc', marginBottom: 10, alignSelf: 'center', height: 50, justifyContent: 'center', overflow: 'hidden', },
    pickerHeader: { fontSize: 18, fontWeight: 'bold', color: 'black', marginBottom: 5, marginLeft: 5 },
    label: { fontSize: 18, fontWeight: 'bold', marginTop: 20, color: 'black' },
    profilePhotoContainer: { alignItems: 'center', marginBottom: 20 },
    profilePhoto: { width: 150, height: 150, borderRadius: 75, marginBottom: 10 },
    uploadButton: { backgroundColor: '#CC5500', padding: 10, borderRadius: 20, alignItems: 'center' },
    uploadButtonText: { color: 'white', fontWeight: 'bold' },
    favoriteMovieItem: { padding: 10, marginHorizontal: 5, backgroundColor: '#D3D3D3', borderRadius: 20 },
    favoriteMovieText: { color: 'black' },
    addMoreButton: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#ccc',
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 10,
    },
    addMoreText: {
        fontSize: 30,
        color: 'grey',
    },
    modalContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    modalContent: {
        backgroundColor: 'white',
        padding: 20,
        borderRadius: 10,
        width: '80%',
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 10,
        color: 'black',
    },
    searchInput: {
        height: 40,
        borderColor: 'gray',
        borderWidth: 1,
        marginBottom: 10,
        paddingHorizontal: 10,
        borderRadius: 5,
        color: 'black',
        backgroundColor: '#f9f9f9',
    },
    searchMovieItem: {
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    searchMovieText: {
        color: 'black',
    },
    friendItem: { padding: 10, margin: 5, backgroundColor: '#D3D3D3', borderRadius: 20 },
    selectedItem: { backgroundColor: '#CC5500' },
    friendText: { color: 'black' },
    helperText: { fontSize: 12, color: 'grey', marginTop: 5, marginBottom: 10 },
});

export default ProfileSettings;
