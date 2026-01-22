import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { db, auth } from '../firebaseConfig';
import { doc, updateDoc, getDoc } from 'firebase/firestore';

// Default Handler
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
    }),
});

// 1. Register for Push Notifications
export async function registerForPushNotificationsAsync() {
    let token;

    if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
            name: 'default',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FF231F7C',
        });
    }

    if (Device.isDevice) {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }

        if (finalStatus !== 'granted') {
            console.log('Failed to get push token for push notification!');
            return null;
        }

        try {
            const projectId = "165b4588-e9f0-4665-9831-2947116a81be"; // Explicitly pass Project ID (Ryest Expo) or handle via Constants if configured
            // Best practice: use Constants.expoConfig.extra.eas.projectId but hardcoding temporarily or letting it infer is ok for dev
            // Actually, let's try infer first, if fails we might need ID.
            token = (await Notifications.getExpoPushTokenAsync()).data;
            console.log("Push Token:", token);
        } catch (e) {
            console.error("Error getting Expo Push Token:", e);
            return null; // Handle error gracefully
        }
    } else {
        console.log('Must use physical device for Push Notifications');
    }

    // Save token to Firestore if user is logged in
    if (token && auth.currentUser) {
        try {
            const userRef = doc(db, "users", auth.currentUser.uid);
            await updateDoc(userRef, {
                pushToken: token,
                notificationsEnabled: true
            });
        } catch (e) {
            console.error("Error saving token to Firestore:", e);
        }
    }

    return token;
}

// Helper: Broadcast to Group
export async function broadcastToGroup(uids, title, body, data) {
    for (const uid of uids) {
        if (uid === auth.currentUser?.uid) continue; // Don't notify self
        const token = await getUserPushToken(uid);
        if (token) {
            await sendPushNotification(token, title, body, data);
        }
    }
}

// 2. Disable Notifications (Remove token)
export async function unregisterForPushNotificationsAsync() {
    if (auth.currentUser) {
        try {
            const userRef = doc(db, "users", auth.currentUser.uid);
            await updateDoc(userRef, {
                pushToken: null,
                notificationsEnabled: false
            });
        } catch (e) {
            console.error("Error removing token:", e);
        }
    }
}

// 3. Send Notification (Client-side trigger for prototype)
// In production, this should happen on Cloud Functions backend.
export async function sendPushNotification(targetExpoPushToken, title, body, data = {}) {
    if (!targetExpoPushToken) {
        // Check if we need to fetch it from a user ID?
        // This function assumes we have limits. 
        return;
    }

    // Check if it's a valid Expo token
    if (!Notifications.isDevicePushToken(targetExpoPushToken) && !targetExpoPushToken.startsWith('ExponentPushToken')) {
        console.warn("Invalid Expo Push Token:", targetExpoPushToken);
        return;
    }

    const message = {
        to: targetExpoPushToken,
        sound: 'default',
        title: title,
        body: body,
        data: data,
    };

    try {
        await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Accept-encoding': 'gzip, deflate',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(message),
        });
    } catch (error) {
        console.error("Error sending push:", error);
    }
}

// Helper: Get Token for User
export async function getUserPushToken(uid) {
    try {
        const docRef = doc(db, "users", uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.notificationsEnabled && data.pushToken) {
                return data.pushToken;
            }
        }
    } catch (e) {
        console.error("Error fetching user token:", e);
    }
    return null;
}
