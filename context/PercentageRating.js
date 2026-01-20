import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, PanResponder, Dimensions, Animated } from 'react-native';
import Svg, { Path, Circle, G, Defs, LinearGradient, Stop, Text as SvgText } from 'react-native-svg';

// Configuration
const MAX_RATING = 100;
const MIN_RATING = 1; // Rating from 1% to 100%

const screenWidth = Dimensions.get('window').width;
const componentWidth = screenWidth * 0.9; // Width of the card

// Sizes for the circular slider
const circleRadius = componentWidth * 0.35;
const strokeWidth = componentWidth * 0.08;
const thumbRadius = strokeWidth * 0.6;
const svgSize = (circleRadius + strokeWidth) * 2;
const center = svgSize / 2;

// Colors (Dark Theme Match)
const COLOR_BACKGROUND_CARD = '#1a1a2e';
const COLOR_TITLE_TEXT = '#FFFFFF';
const COLOR_SUBTITLE_TEXT = '#ccc';
const COLOR_CIRCLE_TRACK = '#333';
const COLOR_CIRCLE_PROGRESS_START = '#ff8c00'; // TOPO Orange
const COLOR_CIRCLE_PROGRESS_END = '#ffda79';   // Lighter Orange/Yellow
const COLOR_THUMB = '#FFFFFF';
const COLOR_PERCENTAGE_TEXT = '#ff8c00';
const COLOR_DESCRIPTION_TEXT = '#cccccc';
const COLOR_SUBMIT_BUTTON_BG = '#ff8c00';
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

const getFeedback = (percentage) => {
    // Logic: 0-10 -> 0, 11-20 -> 1, ..., 91-99 -> 9, 100 -> 10
    let scaledValue = 0;
    if (percentage === 100) {
        scaledValue = 10;
    } else {
        // (percentage - 1) / 10 ensures that 10 falls into 0 (9/10), and 11 falls into 1 (10/10)
        scaledValue = Math.floor((percentage - 1) / 10);
        if (scaledValue < 0) scaledValue = 0; // Handle 0
    }

    const desc = RATING_DESCRIPTIONS.find(d => d.value === scaledValue);

    // Add some emojis based on the score
    let emoji = '😐';
    if (scaledValue >= 9) emoji = '🤩'; // Excellent/Perfect
    else if (scaledValue >= 7) emoji = '😄'; // MTG/Very Good
    else if (scaledValue >= 5) emoji = '🙂'; // Fair/Good
    else if (scaledValue >= 3) emoji = '😟'; // Poor/Watchable
    else emoji = '💀'; // DNW - Bad

    return {
        emoji: emoji,
        text: desc ? desc.label : "Unknown"
    };
};

const angleToPercentage = (angle) => {
    let normalizedAngle = (angle + 360) % 360;
    if (normalizedAngle === 0 && currentAngleRef.current > 270) {
        normalizedAngle = 360;
    }
    let percentage = (normalizedAngle / 360) * MAX_RATING;
    return Math.max(MIN_RATING, Math.min(MAX_RATING, Math.round(percentage)));
};

const percentageToAngle = (percentage) => {
    return (percentage / MAX_RATING) * 360;
};

const describeArc = (x, y, radius, startAngleDeg, endAngleDeg) => {
    const startAngleRad = ((startAngleDeg - 90) * Math.PI) / 180;
    const endAngleRad = ((endAngleDeg - 90) * Math.PI) / 180;
    const largeArcFlag = endAngleDeg - startAngleDeg <= 180 ? '0' : '1';

    const startX = x + radius * Math.cos(startAngleRad);
    const startY = y + radius * Math.sin(startAngleRad);
    const endX = x + radius * Math.cos(endAngleRad);
    const endY = y + radius * Math.sin(endAngleRad);

    if (Math.abs(startAngleDeg - endAngleDeg) >= 359.99) {
        return `M ${x} ${y - radius} A ${radius} ${radius} 0 1 1 ${x - 0.01} ${y - radius} Z`;
    }

    return [
        'M', startX, startY,
        'A', radius, radius, 0, largeArcFlag, 1, endX, endY,
    ].join(' ');
};

let currentAngleRef = { current: 0 };

const PercentageRating = ({ value = 50, onChange = () => { } }) => {
    // Note: The parent component passes `onChange` which is effectively `onSubmit` in current usage for some reason?
    // Wait, in MovieDetailScreen: 
    // onChange={(newPercentage) => handleRatingSubmit(newPercentage)}
    // This submits immediately on release or change? 
    // Usually a slider updates state, then button submits.
    // Parent expects `onChange` to be the "submit" trigger currently for Percentage?
    // Let's check MovieDetailScreen usage:
    // onChange={(newPercentage) => handleRatingSubmit(newPercentage)}
    // This implies immediate submission on change which is annoyed for a slider.
    // I should change this to internal state and explicit submit.

    const [rating, setRating] = useState(Math.max(MIN_RATING, Math.min(MAX_RATING, value)));
    const animatedRating = useRef(new Animated.Value(rating)).current;

    useEffect(() => {
        Animated.timing(animatedRating, {
            toValue: rating,
            duration: 200,
            useNativeDriver: false,
        }).start();
    }, [rating]);

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderGrant: (evt, gestureState) => {
                updateRatingFromTouch(evt.nativeEvent.locationX, evt.nativeEvent.locationY);
            },
            onPanResponderMove: (evt, gestureState) => {
                updateRatingFromTouch(evt.nativeEvent.locationX, evt.nativeEvent.locationY);
            },
        })
    ).current;

    const updateRatingFromTouch = (touchX, touchY) => {
        const dx = touchX - center;
        const dy = touchY - center;
        let angleRad = Math.atan2(dy, dx);
        let angleDeg = (angleRad * 180) / Math.PI;

        angleDeg = (angleDeg + 90 + 360) % 360;
        currentAngleRef.current = angleDeg;

        const newRating = angleToPercentage(angleDeg);
        setRating(newRating);
    };

    const handleSubmit = () => {
        onChange(rating); // Calling the prop 'onChange' which triggers submit in parent
    };

    const currentAngle = percentageToAngle(rating);
    const feedback = getFeedback(rating);

    const thumbAngleRad = ((currentAngle - 90) * Math.PI) / 180;
    const thumbX = center + circleRadius * Math.cos(thumbAngleRad);
    const thumbY = center + circleRadius * Math.sin(thumbAngleRad);

    return (
        <View style={styles.card}>
            <Text style={styles.title}>Percentage Rating</Text>
            <Text style={styles.subtitle}>Drag to rate from 1% to 100%</Text>

            <View style={styles.circleContainer} {...panResponder.panHandlers}>
                <Svg width={svgSize} height={svgSize} viewBox={`0 0 ${svgSize} ${svgSize}`}>
                    <Defs>
                        <LinearGradient id="progressGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                            <Stop offset="0%" stopColor={COLOR_CIRCLE_PROGRESS_START} />
                            <Stop offset="100%" stopColor={COLOR_CIRCLE_PROGRESS_END} />
                        </LinearGradient>
                    </Defs>

                    {/* Background Track */}
                    <Circle
                        cx={center}
                        cy={center}
                        r={circleRadius}
                        stroke={COLOR_CIRCLE_TRACK}
                        strokeWidth={strokeWidth}
                        fill="none"
                    />

                    {/* Progress Arc */}
                    {rating > 0 && (
                        <Path
                            d={describeArc(center, center, circleRadius, 0, currentAngle)}
                            stroke="url(#progressGradient)"
                            strokeWidth={strokeWidth}
                            strokeLinecap="round"
                            fill="none"
                        />
                    )}

                    {/* Thumb */}
                    {rating > 0 && (
                        <Circle
                            cx={thumbX}
                            cy={thumbY}
                            r={thumbRadius}
                            fill={COLOR_THUMB}
                            stroke={COLOR_BACKGROUND_CARD}
                            strokeWidth={2}
                        />
                    )}

                    {/* Central Text Content */}
                    <G x={center} y={center}>
                        <SvgText
                            fontSize={componentWidth * 0.15}
                            fontWeight="bold"
                            fill={COLOR_PERCENTAGE_TEXT}
                            textAnchor="middle"
                            dy={-(componentWidth * 0.03)}
                        >
                            {`${rating}%`}
                        </SvgText>
                        <SvgText
                            fontSize={componentWidth * 0.1}
                            textAnchor="middle"
                            dy={componentWidth * 0.08}
                        >
                            {feedback.emoji}
                        </SvgText>
                        <SvgText
                            fontSize={componentWidth * 0.04}
                            fill={COLOR_DESCRIPTION_TEXT}
                            textAnchor="middle"
                            dy={componentWidth * 0.15}
                        >
                            {feedback.text}
                        </SvgText>
                    </G>
                </Svg>
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
        borderRadius: 20,
        padding: componentWidth * 0.06,
        marginVertical: 20,
        alignItems: 'center',
        width: componentWidth,
        alignSelf: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 5,
    },
    title: {
        fontSize: componentWidth * 0.065,
        fontWeight: 'bold',
        color: COLOR_TITLE_TEXT,
        marginBottom: 5,
    },
    subtitle: {
        fontSize: componentWidth * 0.04,
        color: COLOR_SUBTITLE_TEXT,
        marginBottom: 25,
        textAlign: 'center',
    },
    circleContainer: {
        width: svgSize,
        height: svgSize,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 30,
    },
    submitButton: {
        backgroundColor: COLOR_SUBMIT_BUTTON_BG,
        paddingVertical: 15,
        paddingHorizontal: 40,
        borderRadius: 25,
        width: '80%',
        alignItems: 'center',
        marginBottom: 10,
    },
    submitButtonText: {
        color: COLOR_SUBMIT_BUTTON_TEXT,
        fontSize: componentWidth * 0.045,
        fontWeight: 'bold',
    },
});

export default PercentageRating;
