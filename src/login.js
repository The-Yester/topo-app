import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, StyleSheet, ImageBackground } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/FontAwesome';
import { useEffect } from 'react';
import { ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const LoginScreen = () => {
    const [loading, setLoading] = useState(true); // Track Loading
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const navigation = useNavigation();

    useEffect(() => {
        const checkLoginStatus = async () => {
          try {
            const currentUser = await AsyncStorage.getItem('currentUserEmail');
            if (currentUser) {
              navigation.replace('MainTabs'); // Skip login if user already logged in
            } else {
              setLoading(false);
            }
          } catch (err) {
            console.error('Failed to check login status:', err);
            setLoading(false);
          }
        };
        checkLoginStatus();
    }, []);

    if (loading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' }}>
                <ActivityIndicator size="large" color="#ff8c00" />
            </View>
        );
    }

    const handleLogin = async () => {
        try {
            const usersData = await AsyncStorage.getItem('users');
            const users = usersData ? JSON.parse(usersData) : [];
            
            if (!Array.isArray(users)) {
                console.warn('Users data from storage is not an array:', users);
                Alert.alert('Error', 'Invalid user data stored. Please sign up.'); // More user-friendly message
                return;
              }

            const user = users.find((u) => u.email === email);

            if (user && user.password === password) {
                Alert.alert('Success', 'Welcome to TOPO!');

                await AsyncStorage.setItem('currentUserEmail', user.email); // Use the found user object
                
                navigation.navigate('MainTabs');
            } else {
                Alert.alert('Error', 'Invalid email or password');
            }

        } catch (error) {
            Alert.alert('Error', 'An error occurred. Please try again.');
            console.error('Login error:', error);
        }
    };

    return (
        <SafeAreaView style={{ flex: 1 }}>
            <ImageBackground 
                source={require('../assets/TOPO_logo_Full.jpg')} // Add a glamorous background
                style={styles.background}
            >
                <View style={styles.overlay}>
                    <Icon name="film" size={50} color="#ff8c00" style={styles.icon} />
                    <Text style={styles.title}>Rate | Stream | Collect</Text>
                    <Text style={styles.title}>& Eat Pizza!</Text>
                    <TextInput 
                        style={styles.input} 
                        placeholder="Email" 
                        placeholderTextColor="#ddd"
                        onChangeText={setEmail} 
                        value={email} 
                    />
                    <TextInput 
                        style={styles.input} 
                        placeholder="Password" 
                        placeholderTextColor="#ddd"
                        secureTextEntry 
                        onChangeText={setPassword} 
                        value={password} 
                    />

                    <TouchableOpacity style={styles.button} onPress={handleLogin}>
                        <Text style={styles.buttonText}>Login</Text>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => navigation.navigate('SignUp')}>
                        <Text style={styles.signupText}>SIGN UP</Text>
                    </TouchableOpacity>
                </View>
            </ImageBackground>
        </SafeAreaView>    
    );
};

const styles = StyleSheet.create({
    background: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#00008B',
    },
    overlay: {
        width: '90%',
        padding: 20,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        borderRadius: 10,
        alignItems: 'center',
    },
    icon: { marginBottom: 20 },
    title: { fontSize: 20, fontWeight: 'bold', color: '#ff8c00', marginBottom: 20, textAlign: 'center', fontFamily: 'Trebuchet MS' },
    input: {
        width: '100%',
        height: 40,
        borderColor: '#888',
        borderWidth: 1,
        borderRadius: 15,
        paddingHorizontal: 10,
        marginBottom: 20,
        backgroundColor: '#222',
        color: 'white',
    },
    button: {
        backgroundColor: '#ff8c00',
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 20,
        width: '100%',
        alignItems: 'center',
    },
    buttonText: { fontSize: 18, fontWeight: 'bold', color: 'white' },
    signupText: { color: '#ff8c00', marginTop: 15, textDecorationLine: 'underline' },
});

export default LoginScreen;
