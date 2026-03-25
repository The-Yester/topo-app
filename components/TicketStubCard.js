import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, Dimensions } from 'react-native';
import { DeviceMotion } from 'expo-sensors';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width * 0.45;
const CARD_HEIGHT = CARD_WIDTH * 1.5;

const TicketStubCard = ({ stubData }) => {
    const { movieTitle, poster_path, theaterName, mintDate, rarityTier } = stubData;
    
    // Gyroscope tracking for Holographic shine
    const [tiltX, setTiltX] = useState(0);
    const [tiltY, setTiltY] = useState(0);

    useEffect(() => {
        let subscription;
        if (rarityTier === 'Holographic' || rarityTier === 'Gold') {
            DeviceMotion.setUpdateInterval(50);
            subscription = DeviceMotion.addListener((motionData) => {
                // Map rotation to gradient coordinates (values roughly -1 to 1)
                const pitch = motionData.rotation.beta || 0; // Front to back
                const roll = motionData.rotation.gamma || 0; // Left to right
                
                // Add some math to make the gradient responsive
                setTiltX(Math.min(Math.max(roll * 2, -1), 1));
                setTiltY(Math.min(Math.max(pitch * 2, -1), 1));
            });
        }
        return () => {
            if (subscription) subscription.remove();
        };
    }, [rarityTier]);

    const posterUrl = poster_path 
        ? `https://image.tmdb.org/t/p/w500${poster_path}` 
        : 'https://placehold.co/300x450/333/fff?text=No+Poster';

    const formattedDate = new Date(mintDate).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });

    const getGradientColors = () => {
        switch(rarityTier) {
            case 'Holographic':
                return [
                    'rgba(255,0,0,0.3)', 
                    'rgba(0,255,0,0.3)', 
                    'rgba(0,0,255,0.3)', 
                    'rgba(255,255,0,0.3)', 
                    'rgba(255,0,255,0.3)'
                ];
            case 'Gold':
                return ['rgba(255,215,0,0.5)', 'rgba(218,165,32,0.1)', 'rgba(255,223,0,0.5)'];
            case 'Silver':
            default:
                return ['rgba(192,192,192,0.3)', 'rgba(224,224,224,0.1)', 'rgba(192,192,192,0.3)'];
        }
    };

    const getBorderColor = () => {
        switch(rarityTier) {
            case 'Holographic': return '#ff00ff';
            case 'Gold': return '#FFD700';
            case 'Silver': return '#C0C0C0';
            default: return '#C0C0C0';
        }
    };

    return (
        <View style={[styles.cardContainer, { borderColor: getBorderColor() }]}>
            {/* Base Poster */}
            <Image source={{ uri: posterUrl }} style={styles.poster} />
            
            {/* Dynamic Sensor Gradient Overlay */}
            <LinearGradient
                colors={getGradientColors()}
                start={{ x: 0.5 + tiltX, y: 0.5 + tiltY }}
                end={{ x: 1 - tiltX, y: 1 - tiltY }}
                style={styles.shinyOverlay}
            />

            {/* Ticket Information Footer */}
            <View style={styles.footer}>
                <Text style={styles.title} numberOfLines={1}>{movieTitle}</Text>
                <View style={styles.divider} />
                <Text style={styles.theaterText} numberOfLines={1}>{theaterName}</Text>
                <View style={styles.dateRow}>
                    <Text style={styles.dateText}>{formattedDate}</Text>
                    <Text style={[styles.tierBadge, { color: getBorderColor() }]}>{rarityTier}</Text>
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    cardContainer: {
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        backgroundColor: '#111',
        borderRadius: 12,
        borderWidth: 2,
        overflow: 'hidden',
        margin: 8,
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 5,
    },
    poster: {
        width: '100%',
        height: '70%',
        resizeMode: 'cover',
    },
    shinyOverlay: {
        ...StyleSheet.absoluteFillObject,
        opacity: 0.8,
        zIndex: 1, // Stay above poster but below text ideally
    },
    footer: {
        position: 'absolute',
        bottom: 0,
        width: '100%',
        height: '30%',
        backgroundColor: 'rgba(0,0,0,0.85)',
        padding: 8,
        justifyContent: 'center',
        zIndex: 2,
    },
    title: {
        color: '#fff',
        fontWeight: '900',
        fontSize: 14,
        textAlign: 'center',
        marginBottom: 4,
        textTransform: 'uppercase',
    },
    divider: {
        height: 1,
        backgroundColor: '#444',
        width: '80%',
        alignSelf: 'center',
        marginBottom: 6,
    },
    theaterText: {
        color: '#ff8c00',
        fontSize: 10,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 2,
    },
    dateRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 5,
        marginTop: 4,
    },
    dateText: {
        color: '#aaa',
        fontSize: 9,
    },
    tierBadge: {
        fontSize: 9,
        fontWeight: '900',
        textTransform: 'uppercase',
    }
});

export default TicketStubCard;
