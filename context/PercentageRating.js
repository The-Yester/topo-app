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

// Colors
const COLOR_BACKGROUND_CARD = '#FFFFFF';
const COLOR_TITLE_TEXT = '#333333';
const COLOR_SUBTITLE_TEXT = '#777777';
const COLOR_CIRCLE_TRACK = '#E0E0E0'; // Light gray for the track
const COLOR_CIRCLE_PROGRESS_START = '#FFF176'; // Light Yellow
const COLOR_CIRCLE_PROGRESS_END = '#FFD54F';   // Darker Yellow
const COLOR_THUMB = '#66BB6A'; // Green for the thumb
const COLOR_PERCENTAGE_TEXT = '#212121';
const COLOR_DESCRIPTION_TEXT = '#555555';
const COLOR_SUBMIT_BUTTON_BG_START = '#FFEE58'; // Yellow gradient for button
const COLOR_SUBMIT_BUTTON_BG_END = '#FFD600';
const COLOR_SUBMIT_BUTTON_TEXT = '#424242'; // Dark gray text for button

// Emojis and Descriptions based on percentage
const getFeedback = (percentage) => {
    if (percentage < 20) return { emoji: '😞', text: "Needs Improvement" };
    if (percentage < 40) return { emoji: '😟', text: "Below Average" };
    if (percentage < 60) return { emoji: '😐', text: "It's Okay" };
    if (percentage < 80) return { emoji: '🙂', text: "Good!" };
    if (percentage <= 99) return { emoji: '😄', text: "Great!" };
    return { emoji: '🤩', text: "Excellent!" };
};

// Helper to convert angle to percentage and vice-versa
const angleToPercentage = (angle) => {
    // Normalize angle (0 at top, clockwise)
    let normalizedAngle = (angle + 360) % 360;
    if (normalizedAngle === 0 && currentAngleRef.current > 270) { // Handle crossing 360 to 0 for 100%
        normalizedAngle = 360;
    }
    let percentage = (normalizedAngle / 360) * MAX_RATING;
    return Math.max(MIN_RATING, Math.min(MAX_RATING, Math.round(percentage)));
};

const percentageToAngle = (percentage) => {
    return (percentage / MAX_RATING) * 360;
};

// Helper to describe an SVG arc path
const describeArc = (x, y, radius, startAngleDeg, endAngleDeg) => {
    const startAngleRad = ((startAngleDeg - 90) * Math.PI) / 180;
    const endAngleRad = ((endAngleDeg - 90) * Math.PI) / 180;
    const largeArcFlag = endAngleDeg - startAngleDeg <= 180 ? '0' : '1';

    const startX = x + radius * Math.cos(startAngleRad);
    const startY = y + radius * Math.sin(startAngleRad);
    const endX = x + radius * Math.cos(endAngleRad);
    const endY = y + radius * Math.sin(endAngleRad);

    if (Math.abs(startAngleDeg - endAngleDeg) >= 359.99) { // Full circle
        return `M ${x} ${y - radius} A ${radius} ${radius} 0 1 1 ${x - 0.01} ${y - radius} Z`;
    }

    return [
        'M', startX, startY,
        'A', radius, radius, 0, largeArcFlag, 1, endX, endY,
    ].join(' ');
};

// To keep track of the current angle for smooth 0/360 transition
let currentAngleRef = { current: 0 };


const PercentageRating = ({ initialRating = 50, onSubmitRating = () => {} }) => {
    const [rating, setRating] = useState(Math.max(MIN_RATING, Math.min(MAX_RATING, initialRating)));
    const animatedRating = useRef(new Animated.Value(rating)).current;

    useEffect(() => {
        Animated.timing(animatedRating, {
            toValue: rating,
            duration: 200,
            useNativeDriver: false, // SVG attributes are not supported by native driver
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

        // Normalize angle: 0 at top (from -90 in atan2), increases clockwise
        angleDeg = (angleDeg + 90 + 360) % 360;
        currentAngleRef.current = angleDeg; // Store current angle for 0/360 transition logic

        const newRating = angleToPercentage(angleDeg);
        setRating(newRating);
    };

    const handleSubmit = () => {
        onSubmitRating(rating);
    };

    const currentAngle = percentageToAngle(rating);
    const feedback = getFeedback(rating);

    // Calculate thumb position
    const thumbAngleRad = ((currentAngle - 90) * Math.PI) / 180;
    const thumbX = center + circleRadius * Math.cos(thumbAngleRad);
    const thumbY = center + circleRadius * Math.sin(thumbAngleRad);

    return (
        <View style={styles.card}>
            <Text style={styles.title}>Percentage Rating</Text>
            <Text style={styles.subtitle}>Drag around the circle to rate from 1% to 100%</Text>

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
                            stroke={COLOR_BACKGROUND_CARD} // Small border for thumb
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
                            dy={-(componentWidth * 0.03)} // Adjust vertical position
                        >
                            {`${rating}%`}
                        </SvgText>
                        <SvgText
                            fontSize={componentWidth * 0.1} // Emoji size
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
                 <LinearGradient
                    colors={[COLOR_SUBMIT_BUTTON_BG_START, COLOR_SUBMIT_BUTTON_BG_END]}
                    style={styles.submitButtonGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                >
                    <Text style={styles.submitButtonText}>Submit Rating</Text>
                </LinearGradient>
            </TouchableOpacity>
             <Text style={styles.footerText}>
                This is how your circular rating would appear in a React Native
                app. The component uses PanResponder for touch interactions
                and SVG for visuals.
            </Text>
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
        borderRadius: 25,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 3,
        width: '80%',
        marginBottom: 20,
    },
    submitButtonGradient: {
        paddingVertical: 15,
        paddingHorizontal: 30,
        borderRadius: 25,
        alignItems: 'center',
        justifyContent: 'center',
    },
    submitButtonText: {
        color: COLOR_SUBMIT_BUTTON_TEXT,
        fontSize: componentWidth * 0.045,
        fontWeight: 'bold',
    },
    footerText: {
        fontSize: componentWidth * 0.035,
        color: COLOR_SUBTITLE_TEXT,
        textAlign: 'center',
        paddingHorizontal: componentWidth * 0.05,
    }
});

export default PercentageRating;
