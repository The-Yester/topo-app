import * as Location from 'expo-location';

const GOOGLE_PLACES_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;

export const verifyTheaterLocation = async () => {
    try {
        // Request foreground permissions
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
            return {
                success: false,
                error: 'Permission to access location was denied. Go to Settings to enable it.'
            };
        }

        // Get current location (Balanced accuracy is faster and sufficient for 150m check)
        const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
        });

        const { latitude, longitude } = location.coords;

        // Ping Google Places API
        const radius = 150; // meters
        const type = 'movie_theater';
        const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${latitude},${longitude}&radius=${radius}&type=${type}&key=${GOOGLE_PLACES_API_KEY}`;

        const response = await fetch(url);
        const data = await response.json();

        if (data.status === 'OK' && data.results.length > 0) {
            // Found a theater! Assuming the first result is the closest/most prominent
            const theaterName = data.results[0].name;
            return {
                success: true,
                theaterName: theaterName,
            };
        } else if (data.status === 'ZERO_RESULTS') {
            return {
                success: false,
                error: 'No movie theater detected within 150 meters. Are you sure you are at the cinema?'
            };
        } else {
             return {
                 success: false,
                 error: `Location verification failed: ${data.status}`
             };
        }
    } catch (error) {
        console.error("LocationService Error:", error);
        return {
            success: false,
            error: 'Failed to verify location due to a network or GPS error.'
        };
    }
};
