import React from 'react';
import { View, TouchableOpacity, StyleSheet, Text } from 'react-native';
import MaterialIcon from 'react-native-vector-icons/MaterialCommunityIcons';

const ThumbsRating = ({ rating, onRate, size = 30, color = "#4CAF50" }) => {
    // Rating is 0.5 to 4.0

    const handlePress = (index, isLeftHalf) => {
        // index is 0, 1, 2, 3 (for Thumb 1, 2, 3, 4)
        // isLeftHalf: true if tapped left side

        // Calculate potential new score
        let newScore = index + (isLeftHalf ? 0.5 : 1.0);

        // If tapping the exact same score, maybe clear it? Or just set it.
        onRate(newScore);
    };

    const renderThumb = (index) => {
        const value = index + 1;
        const isFull = rating >= value;
        const isHalf = rating >= value - 0.5 && !isFull;

        // Determine Icon
        let iconName = "thumb-up-outline";
        if (isFull) iconName = "thumb-up";
        // MaterialCommunityIcons doesn't always have a perfect thumb-up-half. 
        // We can simulate visual halfness or just use outline/filled for now.
        // Actually, let's use a trick: Overlay two icons for half?
        // Or if 'thumb-up-half' exists (often doesn't in default sets).
        // Let's stick to: Full = Filled, Empty = Outline.
        // For Half, maybe we check if `thumb-up-half` works? If not, we might need a custom SVG.
        // For now, let's assume "Outline" vs "Filled".
        // If Half, we can maybe use color opacity or a specific icon if available.
        // Let's rely on standard logic:
        // If 2.5: Thumb 1, 2 are Full. Thumb 3 is... Half?

        // Alternative: Use Star logic logic but with Thumbs?
        // Limitation: If no half-thumb icon, 0.5 increments are hard to visualize perfectly without SVG.
        // I will implement a "Half" overlay logic.

        return (
            <View key={index} style={{ width: size, height: size, marginHorizontal: 2, justifyContent: 'center', alignItems: 'center' }}>
                {/* Background Outline (always visible) */}
                <MaterialIcon name="thumb-up-outline" size={size} color={color} style={{ position: 'absolute' }} />

                {/* Full Fill */}
                {isFull && (
                    <MaterialIcon name="thumb-up" size={size} color={color} style={{ position: 'absolute' }} />
                )}

                {/* Half Fill (Left Half Clipped) - This is tricky in RN without Overflow Hidden View wrapping */}
                {isHalf && (
                    <View style={{ width: size / 2, height: size, overflow: 'hidden', position: 'absolute', left: 0 }}>
                        <MaterialIcon name="thumb-up" size={size} color={color} style={{ marginLeft: 0 }} />
                    </View>
                )}

                {/* Touch targets */}
                <View style={{ flexDirection: 'row', position: 'absolute', width: '100%', height: '100%' }}>
                    <TouchableOpacity style={{ flex: 1 }} onPress={() => handlePress(index, true)} />
                    <TouchableOpacity style={{ flex: 1 }} onPress={() => handlePress(index, false)} />
                </View>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.thumbsRow}>
                {[0, 1, 2, 3].map(i => renderThumb(i))}
            </View>
            <Text style={styles.ratingText}>{rating > 0 ? rating.toFixed(1) : "0.0"} / 4.0</Text>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { alignItems: 'center' },
    thumbsRow: { flexDirection: 'row', marginBottom: 5 },
    ratingText: { color: '#ccc', fontWeight: 'bold', fontSize: 14 }
});

export default ThumbsRating;
