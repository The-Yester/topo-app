import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, PanResponder, Dimensions } from 'react-native';
import Svg, { Path, Circle, G } from 'react-native-svg';

// Configuration
const MAX_RATING = 5;
const NUM_MAIN_SLICES = 5;
const NUM_HALF_SLICES = MAX_RATING * 2;
const ANGLE_PER_HALF_SLICE = 360 / NUM_HALF_SLICES;

// Colors (Dark Theme)
const COLOR_BACKGROUND_CARD = '#1a1a2e';
const COLOR_PIE_CANVAS = '#252535';
const COLOR_SELECTED_FULL = '#ffda79';
const COLOR_SELECTED_HALF = '#ccae62';
const COLOR_UNSELECTED = '#333';
const COLOR_PIE_BORDER = '#d35400';
const PEPPERONI_COLOR = '#c0392b';
const TEXT_COLOR_PRIMARY = '#FFFFFF';
const TEXT_COLOR_SECONDARY = '#ccc';
const BUTTON_COLOR_RESET = '#e74c3c';
const BUTTON_TEXT_COLOR = '#FFFFFF';
const BUTTON_COLOR_SUBMIT = '#ff8c00'; // TOPO Orange

// Dimensions
const screenWidth = Dimensions.get('window').width;

// Helper to describe an SVG arc path for a pie slice
const describeArc = (x, y, radius, startAngleDeg, endAngleDeg) => {
    const startAngleRad = ((startAngleDeg - 90) * Math.PI) / 180;
    const endAngleRad = ((endAngleDeg - 90) * Math.PI) / 180;
    const largeArcFlag = endAngleDeg - startAngleDeg <= 180 ? '0' : '1';

    const startX = x + radius * Math.cos(startAngleRad);
    const startY = y + radius * Math.sin(startAngleRad);
    const endX = x + radius * Math.cos(endAngleRad);
    const endY = y + radius * Math.sin(endAngleRad);

    if (Math.abs(startAngleDeg - endAngleDeg) === 0) return "";

    return [
        'M', x, y,
        'L', startX, startY,
        'A', radius, radius, 0, largeArcFlag, 1, endX, endY,
        'Z',
    ].join(' ');
};

const PizzaRating = ({ initialRating = 0, onSubmitRating, readonly = false, size }) => {
    const [rating, setRating] = useState(parseFloat(initialRating));

    useEffect(() => {
        setRating(parseFloat(initialRating));
    }, [initialRating]);

    // Calculate dimensions based on `size` prop or default responsive size
    const PIE_OUTER_RADIUS = size ? size / 2 : screenWidth * 0.35;
    const PIE_BORDER_WIDTH = size ? size * 0.08 : 10;
    const PIE_SLICE_RADIUS = PIE_OUTER_RADIUS - PIE_BORDER_WIDTH / 2;
    const PEPPERONI_RADIUS = PIE_OUTER_RADIUS * 0.06;
    const pieCenter = { x: PIE_OUTER_RADIUS, y: PIE_OUTER_RADIUS };

    const panResponderRef = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => !readonly,
            onPanResponderGrant: (evt, gestureState) => !readonly && handleTouch(gestureState),
            onPanResponderMove: (evt, gestureState) => !readonly && handleTouch(gestureState),
        })
    ).current;

    const handleTouch = (gestureState) => {
        // Placeholder for pan logic if we ever implement layout-based pan
    };

    const handleLayout = (event) => {
        // layout capture
    };

    const handleTouchWithEvent = (event) => {
        if (readonly) return;

        const { locationX, locationY } = event.nativeEvent;
        // x, y relative to the view
        const dx = locationX - pieCenter.x;
        const dy = locationY - pieCenter.y;
        let angleRad = Math.atan2(dy, dx);
        let angleDeg = (angleRad * 180) / Math.PI;

        angleDeg = (angleDeg + 90);
        if (angleDeg < 0) angleDeg += 360;

        let newRating = (angleDeg / 360) * MAX_RATING;
        newRating = Math.ceil(newRating * 2) / 2;
        newRating = Math.max(0.5, Math.min(newRating, MAX_RATING));

        setRating(newRating);
    };

    const resetRating = () => {
        setRating(0);
    };

    const handleSubmit = () => {
        if (onSubmitRating) onSubmitRating(rating);
    };

    const getRatingDescription = (r) => {
        if (r === 0) return "Select a rating";
        if (r >= 4.8) return "Chef's Kiss! 🍕";
        if (r >= 4.0) return "Delicious!";
        if (r >= 3.0) return "Tasty";
        if (r >= 2.0) return "Edible";
        return "Burnt Crust";
    };

    const ratingWholePart = Math.floor(rating);
    const slicePaths = [];
    const toppings = [];

    for (let i = 0; i < NUM_HALF_SLICES; i++) {
        const startAngle = i * ANGLE_PER_HALF_SLICE;
        const endAngle = (i + 1) * ANGLE_PER_HALF_SLICE;
        const midAngle = startAngle + (ANGLE_PER_HALF_SLICE / 2);
        const currentSegmentValue = (i + 1) * 0.5;

        let fillColor = COLOR_UNSELECTED;
        let hasCheese = false;

        if (rating >= currentSegmentValue) {
            fillColor = COLOR_SELECTED_FULL;
            hasCheese = true;
        }

        slicePaths.push(
            <Path
                key={`slice-${i}`}
                d={describeArc(pieCenter.x, pieCenter.y, PIE_SLICE_RADIUS, startAngle, endAngle)}
                fill={fillColor}
                stroke={readonly ? 'transparent' : COLOR_BACKGROUND_CARD} // Cleaner look for mini version
                strokeWidth={readonly ? 0.5 : 2}
                onPress={handleTouchWithEvent}
            />
        );

        if (hasCheese) {
            const rad = ((midAngle - 90) * Math.PI) / 180;
            const dist = PIE_SLICE_RADIUS * 0.6;
            const pepX = pieCenter.x + dist * Math.cos(rad);
            const pepY = pieCenter.y + dist * Math.sin(rad);

            toppings.push(
                <Circle
                    key={`pep-${i}`}
                    cx={pepX}
                    cy={pepY}
                    r={PEPPERONI_RADIUS}
                    fill={PEPPERONI_COLOR}
                    opacity={0.9}
                    onPress={handleTouchWithEvent}
                />
            );

            if (i % 2 === 0) {
                const dist2 = PIE_SLICE_RADIUS * 0.35;
                const pepX2 = pieCenter.x + dist2 * Math.cos(rad);
                const pepY2 = pieCenter.y + dist2 * Math.sin(rad);
                toppings.push(
                    <Circle
                        key={`pep2-${i}`}
                        cx={pepX2}
                        cy={pepY2}
                        r={PEPPERONI_RADIUS * 0.7}
                        fill={PEPPERONI_COLOR}
                        opacity={0.9}
                        onPress={handleTouchWithEvent}
                    />
                );
            }
        }
    }

    // Mini / Readonly container styles
    if (readonly) {
        return (
            <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                <Svg height={PIE_OUTER_RADIUS * 2} width={PIE_OUTER_RADIUS * 2}>
                    <Circle cx={pieCenter.x} cy={pieCenter.y} r={PIE_OUTER_RADIUS} fill={COLOR_PIE_BORDER} />
                    <Circle cx={pieCenter.x} cy={pieCenter.y} r={PIE_SLICE_RADIUS} fill={COLOR_PIE_CANVAS} />
                    <G>{slicePaths}</G>
                    <G>{toppings}</G>
                </Svg>
            </View>
        );
    }

    return (
        <View style={styles.card}>
            <Text style={styles.title}>Pizza Rating</Text>

            <View
                style={styles.pieContainer}
                onStartShouldSetResponder={() => true}
                onResponderMove={handleTouchWithEvent}
                onResponderGrant={handleTouchWithEvent}
            >
                <Svg height={PIE_OUTER_RADIUS * 2} width={PIE_OUTER_RADIUS * 2}>
                    <Circle cx={pieCenter.x} cy={pieCenter.y} r={PIE_OUTER_RADIUS} fill={COLOR_PIE_BORDER} />
                    <Circle cx={pieCenter.x} cy={pieCenter.y} r={PIE_SLICE_RADIUS} fill={COLOR_PIE_CANVAS} />
                    <G>{slicePaths}</G>
                    <G>{toppings}</G>
                </Svg>
            </View>

            <Text style={styles.ratingValueText}>{rating.toFixed(1)} / {MAX_RATING}</Text>
            <Text style={styles.ratingDescriptionText}>{getRatingDescription(rating)}</Text>

            <View style={styles.buttonsContainer}>
                <TouchableOpacity style={styles.resetButton} onPress={resetRating}>
                    <Text style={styles.resetButtonText}>Reset</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
                    <Text style={styles.submitButtonText}>Submit Rating</Text>
                </TouchableOpacity>
            </View>
            <Text style={styles.hintText}>Slide finger customized pizza slices!</Text>
        </View>
    );
};

const styles = StyleSheet.create({
    card: {
        backgroundColor: COLOR_BACKGROUND_CARD,
        borderRadius: 15,
        padding: 20,
        alignItems: 'center',
        width: screenWidth * 0.92,
        alignSelf: 'center',
        marginTop: 10,
    },
    title: {
        fontSize: 22,
        fontWeight: 'bold',
        color: TEXT_COLOR_PRIMARY,
        marginBottom: 15,
    },
    pieContainer: {
        marginBottom: 20,
    },
    ratingValueText: {
        fontSize: 28,
        fontWeight: 'bold',
        color: COLOR_SELECTED_FULL,
        marginBottom: 5,
    },
    ratingDescriptionText: {
        fontSize: 16,
        color: TEXT_COLOR_SECONDARY,
        marginBottom: 20,
        textAlign: 'center',
    },
    buttonsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
        marginBottom: 10,
    },
    resetButton: {
        backgroundColor: BUTTON_COLOR_RESET,
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 25,
        flex: 1,
        marginRight: 10,
        alignItems: 'center',
    },
    resetButtonText: {
        color: BUTTON_TEXT_COLOR,
        fontSize: 16,
        fontWeight: 'bold',
    },
    submitButton: {
        backgroundColor: BUTTON_COLOR_SUBMIT,
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 25,
        flex: 2,
        alignItems: 'center',
    },
    submitButtonText: {
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
