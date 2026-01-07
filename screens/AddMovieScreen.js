import React, { useState, useContext, useEffect } from 'react';
import {
    View, Text, TextInput, Button, StyleSheet, Alert, ScrollView, Image
} from 'react-native';
import { MoviesContext } from '../context/MoviesContext';
import { Picker } from '@react-native-picker/picker';

const awardCategories = [
    "Directing", "Leading Actress", "Leading Actor", "Supporting Actress", "Supporting Actor",
    "Screenplay", "Score", "Song", "Sound", "Makeup/Hair", "Costume",
    "Cinematography", "Production", "Film Editing", "Visual Effects"
];

const AddMovieScreen = ({ navigation }) => {
    const { addMovieToList, ratingMethod, lists } = useContext(MoviesContext);
    const [title, setTitle] = useState('');
    const [rating, setRating] = useState('');
    const [awardRatings, setAwardRatings] = useState({});
    const [movieData, setMovieData] = useState(null);
    const [debounceTimeout, setDebounceTimeout] = useState(null);
    const [selectedListId, setSelectedListId] = useState(null);

    useEffect(() => {
        if (!title.trim()) {
            setMovieData(null);
            return;
        }

        if (debounceTimeout) clearTimeout(debounceTimeout);

        const timeout = setTimeout(() => {
            fetchMovie(title.trim());
        }, 700);

        setDebounceTimeout(timeout);
    }, [title]);

    const fetchMovie = async (query) => {
        try {
            const apiKey = '46de4e8d3c4e28a2a768923324c89503'; // Replace with your TMDB API key
            const response = await fetch(`https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&query=${encodeURIComponent(query)}`);
            const data = await response.json();

            if (data.results && data.results.length > 0) {
                const result = data.results[0];
                setMovieData({
                    title: result.title,
                    year: result.release_date ? result.release_date.split('-')[0] : 'N/A',
                    poster: result.poster_path
                        ? `https://image.tmdb.org/t/p/w500${result.poster_path}`
                        : null
                });
            } else {
                setMovieData(null);
            }
        } catch (error) {
            console.error('TMDB fetch error:', error);
            setMovieData(null);
        }
    };

    const handleAddMovie = () => {
        const trimmedTitle = title.trim();
        if (!trimmedTitle) {
            Alert.alert("Error", "Please enter a movie title.");
            return;
        }

        if (!selectedListId) {
            Alert.alert("Error", "Please select a list.");
            return;
        }

        let movie;

        if (ratingMethod === 'Awards Rating') {
            for (const cat of awardCategories) {
                const value = parseFloat(awardRatings[cat]);
                if (isNaN(value) || value < 1 || value > 10) {
                    Alert.alert("Error", `Please rate ${cat} from 1 to 10.`);
                    return;
                }
            }

            movie = {
                id: Date.now(),
                title: trimmedTitle,
                year: movieData?.year || null,
                poster: movieData?.poster || null,
                awards: awardRatings
            };
        } else {
            const parsedRating = parseFloat(rating);
            const bounds = {
                '1-5': [1, 5],
                '1-10': [1, 10],
                '1%-100%': [1, 100],
            };
            const [min, max] = bounds[ratingMethod] || [1, 10];

            if (isNaN(parsedRating) || parsedRating < min || parsedRating > max) {
                Alert.alert("Error", `Rating must be between ${min} and ${max}.`);
                return;
            }

            movie = {
                id: Date.now(),
                title: trimmedTitle,
                year: movieData?.year || null,
                poster: movieData?.poster || null,
                rating: parsedRating
            };
        }

        addMovieToList(selectedListId, movie);
        Alert.alert("Success", "Movie added to list!");
        navigation.goBack();
    };

    const renderRatingInput = () => {
        if (ratingMethod === 'Awards Rating') {
            return (
                <>
                    <Text style={styles.sectionTitle}>Rate by Category (1–10)</Text>
                    {awardCategories.map((cat) => (
                        <TextInput
                            key={cat}
                            style={styles.input}
                            placeholder={`${cat} (1–10)`}
                            keyboardType="numeric"
                            value={awardRatings[cat] || ''}
                            onChangeText={(value) =>
                                setAwardRatings({ ...awardRatings, [cat]: value })
                            }
                        />
                    ))}
                </>
            );
        }

        const placeholder = {
            '1-5': 'Rating (1–5)',
            '1-10': 'Rating (1–10)',
            '1%-100%': 'Rating (1%–100%)'
        }[ratingMethod] || 'Rating';

        return (
            <TextInput
                style={styles.input}
                placeholder={placeholder}
                keyboardType="numeric"
                value={rating}
                onChangeText={setRating}
            />
        );
    };

    return (
        <ScrollView contentContainerStyle={styles.container}>
            <Text style={styles.title}>Rate a Movie</Text>

            <TextInput
                style={styles.input}
                placeholder="Search Movie Title"
                value={title}
                onChangeText={setTitle}
            />

            {movieData && (
                <View style={styles.moviePreview}>
                    {movieData.poster && (
                        <Image
                            source={{ uri: movieData.poster }}
                            style={styles.poster}
                            resizeMode="contain"
                        />
                    )}
                    <Text style={styles.movieTitle}>
                        {movieData.title} ({movieData.year})
                    </Text>
                    <Text style={styles.confirmText}>Is this the movie you're rating?</Text>
                </View>
            )}

            <Text style={styles.sectionTitle}>Select List</Text>
            <View style={styles.pickerContainer}>
                <Picker
                    selectedValue={selectedListId}
                    onValueChange={(itemValue) => setSelectedListId(itemValue)}
                    style={styles.picker}
                >
                    <Picker.Item label="Select a list..." value={null} />
                    {Array.isArray(lists) &&
                        lists.map((list) => (
                            <Picker.Item key={list.id} label={list.name} value={list.id} />
                    ))}
                </Picker>
            </View>

            {renderRatingInput()}

            <Button title="Add Movie Rating" onPress={handleAddMovie} />
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        padding: 16,
        alignItems: 'center',
        backgroundColor: '#D3D3D3',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 16,
        textAlign: 'center',
    },
    input: {
        width: '90%',
        backgroundColor: 'white',
        borderWidth: 1,
        borderColor: 'gray',
        borderRadius: 5,
        padding: 10,
        marginBottom: 10,
        textAlign: 'center',
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        marginTop: 20,
        marginBottom: 10,
        textAlign: 'center'
    },
    moviePreview: {
        alignItems: 'center',
        marginVertical: 20,
    },
    poster: {
        width: 150,
        height: 220,
        marginBottom: 10,
        borderRadius: 8,
    },
    movieTitle: {
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 4,
        textAlign: 'center'
    },
    confirmText: {
        fontSize: 14,
        color: '#333',
        marginBottom: 10,
        textAlign: 'center'
    },
    pickerContainer: {
        width: '90%',
        backgroundColor: 'white',
        borderWidth: 1,
        borderColor: 'gray',
        borderRadius: 5,
        marginBottom: 10,
    },
    picker: {
        width: '100%',
        height: 50,
    },
});

export default AddMovieScreen;





