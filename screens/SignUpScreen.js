import React, { useState } from 'react';
import { View, Text, TextInput, Button, Alert, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { Picker } from '@react-native-picker/picker';
import US_CITIES from '../data/US_Cities'; // Ensure this file exists

console.log("US_CITIES:", US_CITIES);

const SignUpScreen = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [username, setUsername] = useState('');
    const [location, setLocation] = useState(US_CITIES[0] || '');

    const navigation = useNavigation();

    const handleSignUp = async () => {
        if (!email || !password || !name || !username || !location) {
            Alert.alert('Error', 'Please fill in all fields');
            return;
        }

        try {
            // Construct new user object
            const newUser = {email, password, name, username, location };

            const existingUsersData = await AsyncStorage.getItem('users');
            const existingUsers = existingUsersData ? JSON.parse(existingUsersData) : [];

            existingUsers.push(newUser); // Add the new user to the array

            // Save user data in AsyncStorage
            await AsyncStorage.setItem('users', JSON.stringify(existingUsers));

            Alert.alert('Success', 'Account created successfully!');
            navigation.navigate('Login'); // Navigate back to the login screen
        } catch (error) {
            Alert.alert('Error', 'Unable to create account. Please try again.');
            console.error('Sign up error:', error);
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Create an Account</Text>
            <TextInput style={styles.input} placeholder="Name (First & Last)" onChangeText={setName} value={name} />
            <TextInput style={styles.input} placeholder="Username" onChangeText={setUsername} value={username} />
            <TextInput style={styles.input} placeholder="Email" onChangeText={setEmail} value={email} />
            <TextInput style={styles.input} placeholder="Password" secureTextEntry onChangeText={setPassword} value={password} />

            <View style={styles.pickerContainer}>
                <Picker selectedValue={location} onValueChange={setLocation} style={styles.picker}>
                    {US_CITIES.map((city) => (
                        <Picker.Item key={city} label={city} value={city} />
                    ))}
                </Picker>
            </View>

            <Button title="Sign Up" onPress={handleSignUp} />
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#f5f5f5' },
    title: { fontSize: 36, fontWeight: 'bold', color: '#333', marginBottom: 20, textAlign: 'center' },
    input: { width: '100%', height: 40, borderColor: '#ccc', borderWidth: 1, borderRadius: 15, paddingHorizontal: 10, marginBottom: 15, backgroundColor: '#fff' },
    pickerContainer: { width: '100%', backgroundColor: '#fff', borderRadius: 15, borderWidth: 1, borderColor: '#ccc', marginBottom: 15 },
});

export default SignUpScreen;
