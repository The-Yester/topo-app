import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, PanResponder } from 'react-native';
import Svg, { Path, Circle, G } from 'react-native-svg';

// Configuration
const MAX_RATING = 5;
const NUM_MAIN_SLICES = 5; // Corresponds to 5 stars
const NUM_HALF_SLICES = MAX_RATING * 2; // 10 segments for 0.5 granularity
const ANGLE_PER_HALF_SLICE = 360 / NUM_HALF_SLICES; // 36 degrees

// Colors (approximate from image, you can fine-tune these)
const COLOR_BACKGROUND_CARD = '#FFE0B2'; // Light peach/pink background of the card
const COLOR_PIE_CANVAS = '#FFF9C4';    // Pale yellow background of the pie chart circle itself
const COLOR_SELECTED_FULL = '#F57F17';   // Darker orange for full rated segments
const COLOR_SELECTED_HALF = '#FFA000';   // Lighter orange/yellowish for half rated segment
const COLOR_UNSELECTED = '#E0E0E0';     // Light gray for unselected segments
const COLOR_PIE_BORDER = '#D84315';     // Red-orange border of the pie
const DOT_COLOR = '#C62828';           // Deep red for the dots
const TEXT_COLOR_PRIMARY = '#212121';
const TEXT_COLOR_SECONDARY = '#757575';
const BUTTON_COLOR_RESET = '#FF7043';
const BUTTON_TEXT_COLOR = '#FFFFFF';

// Dimensions
const PIE_OUTER_RADIUS = 90;
const PIE_BORDER_WIDTH = 8; // Width of the red-orange border
const PIE_SLICE_RADIUS = PIE_OUTER_RADIUS - PIE_BORDER_WIDTH / 2; // Radius for drawing slices
const DOT_RADIUS = 6;
const DOT_DISTANCE_FROM_CENTER = PIE_SLICE_RADIUS * 0.55;

// Helper function to describe an SVG arc path for a pie slice
const describeArc = (x, y, radius, startAngleDeg, endAngleDeg) => {
    const startAngleRad = ((startAngleDeg - 90) * Math.PI) / 180; // Offset by -90 to start from top
    const endAngleRad = ((endAngleDeg - 90) * Math.PI) / 180;
    const largeArcFlag = endAngleDeg - startAngleDeg <= 180 ? '0' : '1';

    const startX = x + radius * Math.cos(startAngleRad);
    const startY = y + radius * Math.sin(startAngleRad);
    const endX = x + radius * Math.cos(endAngleRad);
    const endY = y + radius * Math.sin(endAngleRad);

    if (Math.abs(startAngleDeg - endAngleDeg) === 0) return ""; // Avoid zero-angle paths

    return [
        'M', x, y,
        'L', startX, startY,
        'A', radius, radius, 0, largeArcFlag, 1, endX, endY,
        'Z',
    ].join(' ');
};

const PizzaRating = ({ initialRating = 0, onRatingChange }) => {
    const [rating, setRating] = useState(initialRating);
    const pieCenter = { x: PIE_OUTER_RADIUS, y: PIE_OUTER_RADIUS };
    const panResponderRef = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onPanResponderGrant: (evt, gestureState) => handleTouch(gestureState),
            onPanResponderMove: (evt, gestureState) => handleTouch(gestureState),
        })
    ).current;

    const handleTouch = (gestureState) => {
        const { locationX, locationY } = gestureState;
        if (locationX === undefined || locationY === undefined) { // For web/other scenarios if values are not direct
             // Fallback or adjust if nativeEvent is needed for precise location within the SVG
            const touchXInSvg = gestureState.x0 - (/* offset of SVG from screen edge if needed */ 0);
            const touchYInSvg = gestureState.y0 - (/* offset of SVG from screen edge if needed */ 0);
            // This part might require onLayout of the Svg container to get its absolute position
            // For simplicity, assuming locationX/Y are relative to the PanResponder's view (the Svg parent)
            // This needs careful setup with onLayout to get the true center of the pie on screen.
            // For this example, we'll use rougher coordinates based on pieCenter.
            // A robust way is to get the Svg container's layout.
        }


        const dx = locationX - pieCenter.x;
        const dy = locationY - pieCenter.y;
        let angleRad = Math.atan2(dy, dx);
        let angleDeg = (angleRad * 180) / Math.PI;

        angleDeg = (angleDeg + 360 + 90) % 360; // Normalize: 0 at top, increases clockwise

        let newRating = (angleDeg / 360) * MAX_RATING;
        newRating = Math.round(newRating * 2) / 2; // Round to nearest 0.5
        newRating = Math.max(0.5, Math.min(newRating, MAX_RATING)); // Clamp to 0.5-5 range

        setRating(newRating);
        if (onRatingChange) onRatingChange(newRating);
    };


    const resetRating = () => {
        setRating(0);
        if (onRatingChange) onRatingChange(0);
    };

    const getRatingDescription = (r) => {
        if (r === 0) return "Select a rating";
        if (r >= 4.8) return "Absolutely perfect! Best pizza ever!";
        if (r >= 4.0) return "Excellent!";
        if (r >= 3.0) return "Pretty good!";
        if (r >= 2.0) return "Not bad.";
        return "Could be better.";
    };

    const ratingWholePart = Math.floor(rating);
    const ratingDecimalPart = rating - ratingWholePart;

    const slicePaths = [];
    for (let i = 0; i < NUM_HALF_SLICES; i++) {
        const startAngle = i * ANGLE_PER_HALF_SLICE;
        const endAngle = (i + 1) * ANGLE_PER_HALF_SLICE;
        const currentSegmentValue = (i + 1) * 0.5; // Value this segment *completes*

        let fillColor = COLOR_UNSELECTED;
        if (currentSegmentValue <= ratingWholePart) {
            fillColor = COLOR_SELECTED_FULL;
        } else if (currentSegmentValue > ratingWholePart && currentSegmentValue <= ratingWholePart + 0.5 && ratingDecimalPart >= 0.5) {
            fillColor = COLOR_SELECTED_HALF;
        }

        slicePaths.push(
            <Path
                key={`halfSlice-${i}`}
                d={describeArc(pieCenter.x, pieCenter.y, PIE_SLICE_RADIUS, startAngle, endAngle)}
                fill={fillColor}
            />
        );
    }

    const dots = [];
    if (rating >= 1) { // Dot for the first star area
        const angle1Deg = ANGLE_PER_HALF_SLICE * 0.5; // Center of the first full slice
        const angle1Rad = ((angle1Deg - 90) * Math.PI) / 180;
        dots.push(<Circle key="dot1" cx={pieCenter.x + DOT_DISTANCE_FROM_CENTER * Math.cos(angle1Rad)} cy={pieCenter.y + DOT_DISTANCE_FROM_CENTER * Math.sin(angle1Rad)} r={DOT_RADIUS} fill={DOT_COLOR} />);
    }
    if (rating >= 2) { // Dot for the second star area
        const angle2Deg = ANGLE_PER_HALF_SLICE * 2.5; // Center of the second full slice
        const angle2Rad = ((angle2Deg - 90) * Math.PI) / 180;
        dots.push(<Circle key="dot2" cx={pieCenter.x + DOT_DISTANCE_FROM_CENTER * Math.cos(angle2Rad)} cy={pieCenter.y + DOT_DISTANCE_FROM_CENTER * Math.sin(angle2Rad)} r={DOT_RADIUS} fill={DOT_COLOR} />);
    }

    return (
        <View style={styles.card}>
            <Text style={styles.title}>Pizza Pie Rating System</Text>

            <View style={styles.pieInteractionContainer} {...panResponderRef.panHandlers}>
                <Svg height={PIE_OUTER_RADIUS * 2} width={PIE_OUTER_RADIUS * 2} viewBox={`0 0 ${PIE_OUTER_RADIUS * 2} ${PIE_OUTER_RADIUS * 2}`}>
                    <Circle cx={pieCenter.x} cy={pieCenter.y} r={PIE_OUTER_RADIUS} fill={COLOR_PIE_CANVAS} />
                    <G>{slicePaths}</G>
                    <Circle cx={pieCenter.x} cy={pieCenter.y} r={PIE_SLICE_RADIUS} fill="transparent" stroke={COLOR_PIE_BORDER} strokeWidth={PIE_BORDER_WIDTH} />
                    <G>{dots}</G>
                </Svg>
            </View>

            <Text style={styles.ratingValueText}>{rating.toFixed(1)} / {MAX_RATING}</Text>
            <Text style={styles.ratingDescriptionText}>{getRatingDescription(rating)}</Text>

            <TouchableOpacity style={styles.resetButton} onPress={resetRating}>
                <Text style={styles.resetButtonText}>Reset Rating</Text>
            </TouchableOpacity>
            <Text style={styles.hintText}>Touch or drag on slices to select your rating</Text>
        </View>
    );
};

const styles = StyleSheet.create({
    card: {
        backgroundColor: COLOR_BACKGROUND_CARD,
        borderRadius: 15,
        padding: 20,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 5,
        elevation: 3,
        width: '90%',
        alignSelf: 'center',
        marginTop: 20,
    },
    title: {
        fontSize: 22,
        fontWeight: 'bold',
        color: TEXT_COLOR_PRIMARY,
        marginBottom: 15,
    },
    pieInteractionContainer: {
        width: PIE_OUTER_RADIUS * 2,
        height: PIE_OUTER_RADIUS * 2,
        marginBottom: 10,
        // backgroundColor: 'rgba(0,0,0,0.1)', // For debugging touch area
    },
    ratingValueText: {
        fontSize: 28,
        fontWeight: 'bold',
        color: COLOR_SELECTED_FULL, // Using a prominent color
        marginBottom: 5,
    },
    ratingDescriptionText: {
        fontSize: 16,
        color: TEXT_COLOR_SECONDARY,
        marginBottom: 15,
        textAlign: 'center',
    },
    resetButton: {
        backgroundColor: BUTTON_COLOR_RESET,
        paddingVertical: 10,
        paddingHorizontal: 30,
        borderRadius: 20,
        marginBottom: 10,
    },
    resetButtonText: {
        color: BUTTON_TEXT_COLOR,
        fontSize: 16,
        fontWeight: 'bold',
    },
    hintText: {
        fontSize: 12,
        color: TEXT_COLOR_SECONDARY,
    },
});

export default PizzaRating;
