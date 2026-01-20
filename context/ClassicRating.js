import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import Slider from '@react-native-community/slider';

// Configuration
const MAX_RATING = 10;
const MIN_RATING = 0;
const RATING_INCREMENT = 0.1;

const screenWidth = Dimensions.get('window').width;

// Colors
const COLOR_BACKGROUND_CARD = '#1a1a2e'; // App Dark Theme Background
const COLOR_BACKGROUND_DISPLAY = '#0a0a1a'; // Darker contrast
const COLOR_TEXT_PRIMARY = '#FFFFFF';
const COLOR_TEXT_SECONDARY = '#ccc';
const COLOR_TEXT_RATING_VALUE = '#ff8c00'; // App Orange Accent
const COLOR_SLIDER_TRACK_MIN = '#ff8c00'; // App Orange Accent
const COLOR_SLIDER_TRACK_MAX = '#4A4A4A';
const COLOR_SLIDER_THUMB = '#ff8c00'; // App Orange Accent
const COLOR_BUTTON_GRID_BG = '#252535'; // Slightly lighter than card
const COLOR_BUTTON_GRID_BG_ACTIVE = '#ff8c00'; // App Orange Accent
const COLOR_BUTTON_GRID_TEXT = '#E0E0E0';
const COLOR_BUTTON_GRID_TEXT_ACTIVE = '#FFFFFF';
const COLOR_SUBMIT_BUTTON_BG = '#ff8c00'; // App Orange Accent
const COLOR_SUBMIT_BUTTON_TEXT = '#FFFFFF';

const RATING_DESCRIPTIONS = [
    { value: 0, label: "Do Not Watch", short: "DNW" },
    { value: 1, label: "Awful", short: "Awful" },
    { value: 2, label: "Bad", short: "Bad" },
    { value: 3, label: "Poor", short: "Poor" },
    { value: 4, label: "Watchable", short: "Watchable" },
    { value: 5, label: "Fair", short: "Fair" },
    { value: 6, label: "Good", short: "Good" },
    { value: 7, label: "More Than Good", short: "MTG" },
    { value: 8, label: "Very Good", short: "Very Good" },
    { value: 9, label: "Excellent", short: "Excellent" },
    { value: 10, label: "Perfect", short: "Perfect" },
];

const ClassicRating = ({ initialRating = 0, onSubmitRating = () => { } }) => {
    const [rating, setRating] = useState(parseFloat(initialRating.toFixed(1)));

    const getRatingLabel = (currentRating) => {
        const roundedRating = Math.floor(currentRating);
        const desc = RATING_DESCRIPTIONS.find(d => d.value === roundedRating);
        return desc ? desc.short.toUpperCase() : "";
    };

    const handleRatingButtonPress = (value) => {
        setRating(parseFloat(value.toFixed(1)));
    };

    const handleSubmit = () => {
        onSubmitRating(rating);
    };

    return (
        <View style={styles.card}>
            <Text style={styles.title}>Movie Rating System</Text>
            <Text style={styles.subtitle}>Rate from 0 to 10 in 0.1 increments</Text>

            <View style={styles.ratingDisplayArea}>
                <Text style={styles.ratingValueText}>{rating.toFixed(1)}</Text>
                <Text style={styles.ratingLabelText}>{getRatingLabel(rating)}</Text>
            </View>

            {/* Native Slider */}
            <View style={styles.sliderContainer}>
                <Slider
                    style={{ width: '100%', height: 40 }}
                    minimumValue={MIN_RATING}
                    maximumValue={MAX_RATING}
                    step={RATING_INCREMENT}
                    value={rating}
                    onValueChange={(val) => setRating(parseFloat(val.toFixed(1)))}
                    minimumTrackTintColor={COLOR_SLIDER_TRACK_MIN}
                    maximumTrackTintColor={COLOR_SLIDER_TRACK_MAX}
                    thumbTintColor={COLOR_SLIDER_THUMB}
                />

                <View style={styles.sliderLabelsContainer}>
                    {[0, 2, 4, 6, 8, 10].map((num) => (
                        <Text key={`label-${num}`} style={styles.sliderLabel}>{num}</Text>
                    ))}
                </View>
            </View>

            {/* Rating Buttons Grid */}
            <View style={styles.buttonsGrid}>
                {RATING_DESCRIPTIONS.map((desc) => (
                    <TouchableOpacity
                        key={`btn-${desc.value}`}
                        style={[
                            styles.gridButton,
                            Math.floor(rating) === desc.value && styles.gridButtonActive,
                        ]}
                        onPress={() => handleRatingButtonPress(desc.value)}
                    >
                        <Text style={[styles.gridButtonValue, Math.floor(rating) === desc.value && styles.gridButtonTextActive]}>{desc.value}</Text>
                        <Text style={[styles.gridButtonLabel, Math.floor(rating) === desc.value && styles.gridButtonTextActive]}>{desc.label}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
                <Text style={styles.submitButtonText}>Submit Rating</Text>
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    card: {
        backgroundColor: COLOR_BACKGROUND_CARD,
        borderRadius: 15,
        padding: screenWidth * 0.05,
        margin: screenWidth * 0.04,
        alignItems: 'center',
        width: screenWidth * 0.92,
        alignSelf: 'center',
    },
    title: {
        fontSize: screenWidth * 0.06,
        fontWeight: 'bold',
        color: COLOR_TEXT_PRIMARY,
        marginBottom: 5,
    },
    subtitle: {
        fontSize: screenWidth * 0.035,
        color: COLOR_TEXT_SECONDARY,
        marginBottom: 20,
    },
    ratingDisplayArea: {
        backgroundColor: COLOR_BACKGROUND_DISPLAY,
        paddingVertical: 15,
        paddingHorizontal: 20,
        borderRadius: 10,
        alignItems: 'center',
        marginBottom: 25,
        width: '100%',
    },
    ratingValueText: {
        fontSize: screenWidth * 0.12,
        fontWeight: 'bold',
        color: COLOR_TEXT_RATING_VALUE,
    },
    ratingLabelText: {
        fontSize: screenWidth * 0.045,
        color: COLOR_TEXT_PRIMARY,
        fontWeight: '600',
        marginTop: 5,
        textTransform: 'uppercase',
    },
    sliderContainer: {
        width: '100%',
        marginBottom: 25,
        alignItems: 'center',
    },
    sliderLabelsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
        marginTop: 5,
        paddingHorizontal: 10,
    },
    sliderLabel: {
        fontSize: screenWidth * 0.03,
        color: COLOR_TEXT_SECONDARY,
    },
    buttonsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        width: '100%',
        marginBottom: 30,
    },
    gridButton: {
        backgroundColor: COLOR_BUTTON_GRID_BG,
        width: '23%',
        aspectRatio: 1.2,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 5,
        marginBottom: screenWidth * 0.02,
    },
    gridButtonActive: {
        backgroundColor: COLOR_BUTTON_GRID_BG_ACTIVE,
    },
    gridButtonValue: {
        fontSize: screenWidth * 0.05,
        fontWeight: 'bold',
        color: COLOR_BUTTON_GRID_TEXT,
    },
    gridButtonLabel: {
        fontSize: screenWidth * 0.025,
        color: COLOR_BUTTON_GRID_TEXT,
        textAlign: 'center',
        marginTop: 3,
    },
    gridButtonTextActive: {
        color: COLOR_BUTTON_GRID_TEXT_ACTIVE,
    },
    submitButton: {
        backgroundColor: COLOR_SUBMIT_BUTTON_BG,
        paddingVertical: 15,
        paddingHorizontal: 40,
        borderRadius: 25,
        width: '80%',
        alignItems: 'center',
    },
    submitButtonText: {
        color: COLOR_SUBMIT_BUTTON_TEXT,
        fontSize: screenWidth * 0.045,
        fontWeight: 'bold',
    },
});

export default ClassicRating;
