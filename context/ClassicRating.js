import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, PanResponder, Dimensions } from 'react-native';

// Configuration
const MAX_RATING = 10;
const MIN_RATING = 0;
const RATING_INCREMENT = 0.1;

const screenWidth = Dimensions.get('window').width;

// Colors
const COLOR_BACKGROUND_CARD = '#2C2C2C'; // Dark gray for the card
const COLOR_BACKGROUND_DISPLAY = '#1E1E1E'; // Slightly darker for rating display area
const COLOR_TEXT_PRIMARY = '#FFFFFF';
const COLOR_TEXT_SECONDARY = '#A0A0A0'; // Light gray for subtitles/hints
const COLOR_TEXT_RATING_VALUE = '#FF4757'; // Bright Red for the numerical rating
const COLOR_SLIDER_TRACK = '#4A4A4A';
const COLOR_SLIDER_THUMB = '#FF4757'; // Bright Red
const COLOR_BUTTON_GRID_BG = '#3A3A3A';
const COLOR_BUTTON_GRID_BG_ACTIVE = '#FF4757'; // Red for active rating button
const COLOR_BUTTON_GRID_TEXT = '#E0E0E0';
const COLOR_BUTTON_GRID_TEXT_ACTIVE = '#FFFFFF';
const COLOR_SUBMIT_BUTTON_BG = '#D32F2F'; // Darker Red for submit
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

const ClassicRating = ({ initialRating = 0, onSubmitRating = () => {} }) => {
    const [rating, setRating] = useState(parseFloat(initialRating.toFixed(1)));
    const [sliderLayout, setSliderLayout] = useState(null);
    const sliderRef = useRef(null);

    const getRatingLabel = (currentRating) => {
        const roundedRating = Math.floor(currentRating);
        const desc = RATING_DESCRIPTIONS.find(d => d.value === roundedRating);
        return desc ? desc.short.toUpperCase() : "";
    };

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderGrant: (evt, gestureState) => {
                updateRatingFromTouch(gestureState.x0);
            },
            onPanResponderMove: (evt, gestureState) => {
                updateRatingFromTouch(gestureState.moveX);
            },
        })
    ).current;

    const updateRatingFromTouch = (touchX) => {
        if (!sliderLayout || !sliderRef.current) return;

        sliderRef.current.measure((fx, fy, width, height, px, py) => {
            const relativeTouchX = touchX - px; // touchX relative to the slider component
            let newRating = (relativeTouchX / width) * MAX_RATING;
            newRating = Math.max(MIN_RATING, Math.min(MAX_RATING, newRating));
            newRating = parseFloat(newRating.toFixed(1)); // Round to one decimal place
            setRating(newRating);
        });
    };

    const handleRatingButtonPress = (value) => {
        setRating(parseFloat(value.toFixed(1)));
    };

    const handleSubmit = () => {
        onSubmitRating(rating);
    };

    const thumbPosition = sliderLayout ? (rating / MAX_RATING) * sliderLayout.width - styles.sliderThumb.width / 2 : 0;

    return (
        <View style={styles.card}>
            <Text style={styles.title}>Movie Rating System</Text>
            <Text style={styles.subtitle}>Rate from 0 to 10 in 0.1 increments</Text>

            <View style={styles.ratingDisplayArea}>
                <Text style={styles.ratingValueText}>{rating.toFixed(1)}</Text>
                <Text style={styles.ratingLabelText}>{getRatingLabel(rating)}</Text>
            </View>

            {/* Slider */}
            <View style={styles.sliderContainer}>
                <View
                    ref={sliderRef}
                    style={styles.sliderTrack}
                    onLayout={(event) => setSliderLayout(event.nativeEvent.layout)}
                    {...panResponder.panHandlers}
                >
                    {sliderLayout && (
                        <View style={[styles.sliderThumb, { left: Math.max(0, Math.min(thumbPosition, sliderLayout.width - styles.sliderThumb.width)) }]} />
                    )}
                </View>
                <View style={styles.sliderLabelsContainer}>
                    {[...Array(MAX_RATING + 1).keys()].map((num) => (
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
        padding: screenWidth * 0.05, // Responsive padding
        margin: screenWidth * 0.04,
        alignItems: 'center',
        width: screenWidth * 0.92, // Responsive width
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
    sliderTrack: {
        width: '90%',
        height: 8,
        backgroundColor: COLOR_SLIDER_TRACK,
        borderRadius: 4,
        justifyContent: 'center', // For thumb vertical centering if needed
    },
    sliderThumb: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: COLOR_SLIDER_THUMB,
        position: 'absolute', // Positioned by `left` style
    },
    sliderLabelsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '90%',
        marginTop: 8,
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
        width: '23%', // Adjust for 4 columns, considering spacing
        aspectRatio: 1.2, // Make buttons slightly taller than wide
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 5,
        marginBottom: screenWidth * 0.02, // Spacing between rows
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
