import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, StyleSheet, ScrollView, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Picker } from '@react-native-picker/picker';
import US_CITIES from '../data/US_Cities';
import { createUserWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import { doc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/FontAwesome';

const SignUpScreen = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [username, setUsername] = useState('');
    const [location, setLocation] = useState(US_CITIES[0] || '');
    const [loading, setLoading] = useState(false);

    // Validation State
    const [usernameError, setUsernameError] = useState(null);
    const [suggestions, setSuggestions] = useState([]);

    const navigation = useNavigation();

    React.useLayoutEffect(() => {
        navigation.setOptions({ headerShown: false });
    }, [navigation]);

    const checkUsernameUnique = async (currentUsername) => {
        if (!currentUsername || currentUsername.length < 3) return false;

        try {
            const usersRef = collection(db, "users");
            const q = query(usersRef, where("username", "==", currentUsername));
            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
                // Username taken
                const randomSuffix = Math.floor(100 + Math.random() * 900); // 3 digit
                const sugg1 = `${currentUsername}${randomSuffix}`;
                const sugg2 = `${currentUsername}_film`;
                setSuggestions([sugg1, sugg2]);
                setUsernameError('Username is already taken.');
                return false;
            } else {
                setUsernameError(null);
                setSuggestions([]);
                return true;
            }
        } catch (error) {
            console.error("Error checking username:", error);
            return true;
        }
    };

    const handleUsernameChange = (text) => {
        const cleaned = text.replace(/\s/g, ''); // Remove spaces
        setUsername(cleaned);
        // Reset errors when typing to avoid annoying UI jump
        if (usernameError) {
            setUsernameError(null);
            setSuggestions([]);
        }
    };

    const applySuggestion = (sugg) => {
        setUsername(sugg);
        setUsernameError(null);
        setSuggestions([]);
    };

    const validateInputs = () => {
        // 1. Email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            Alert.alert('Invalid Email', 'Please enter a valid email address.');
            return false;
        }

        // 2. Username Format
        const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
        if (!usernameRegex.test(username)) {
            Alert.alert('Invalid Username', 'Username must be 3-20 characters long and contain only letters, numbers, or underscores.');
            return false;
        }

        // 3. Password
        if (password.length < 8) {
            Alert.alert('Weak Password', 'Password must be at least 8 characters long.');
            return false;
        }
        if (!/\d/.test(password) || !/[a-zA-Z]/.test(password)) {
            Alert.alert('Weak Password', 'Password must contain at least one letter and one number.');
            return false;
        }

        if (!name || !location) {
            Alert.alert('Missing Info', 'Please fill in all fields.');
            return false;
        }

        return true;
    };

    const handleSignUp = async () => {
        if (!validateInputs()) return;
        setLoading(true);

        // 1. Check Uniqueness First
        const isUnique = await checkUsernameUnique(username);
        if (!isUnique) {
            setLoading(false);
            Alert.alert('Username Taken', 'Please choose a different username or select a suggestion.');
            return;
        }

        try {
            // 2. Create User in Auth
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // 3. Send Verification Email
            await sendEmailVerification(user);

            // 4. Save Profile Data in Firestore
            await setDoc(doc(db, "users", user.uid), {
                name: name,
                username: username,
                location: location,
                email: email,
                createdAt: new Date(),
                bio: 'Cinema lover joining the chat!',
                ratingSystem: 'awards',
                // Searchable fields (lowercase for case-insensitive search)
                username_lowercase: username.toLowerCase(),
                name_lowercase: name.toLowerCase(),
            });

            Alert.alert(
                'Account Created!',
                'A verification email has been sent to your inbox. Please verify it to complete your setup.',
                [{ text: 'OK', onPress: () => navigation.navigate('MainTabs') }]
            );

        } catch (error) {
            console.error('Sign up error:', error);
            let errorMessage = 'Unable to create account.';
            if (error.code === 'auth/email-already-in-use') errorMessage = 'That email is already in use.';
            if (error.code === 'auth/weak-password') errorMessage = 'Password is too weak (min 6 chars).';
            Alert.alert('Sign Up Failed', errorMessage);
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Icon name="arrow-left" size={24} color="#ff8c00" />
                </TouchableOpacity>

                <Text style={styles.title}>Join TOPO</Text>
                <Text style={styles.subtitle}>Start your cinema journey.</Text>

                <View style={styles.formContainer}>
                    <TextInput
                        style={styles.input}
                        placeholder="Full Name"
                        placeholderTextColor="#666"
                        onChangeText={setName}
                        value={name}
                    />

                    <View style={styles.inputGroup}>
                        <TextInput
                            style={[
                                styles.input,
                                usernameError && { borderColor: '#e74c3c' } // Red border on error
                            ]}
                            placeholder="Username"
                            placeholderTextColor="#666"
                            onChangeText={handleUsernameChange}
                            value={username}
                            autoCapitalize="none"
                            onBlur={() => checkUsernameUnique(username)}
                        />
                        {usernameError ? (
                            <View style={styles.errorContainer}>
                                <Text style={styles.errorText}>{usernameError}</Text>
                                <Text style={styles.suggestionLabel}>Suggestions:</Text>
                                <View style={styles.suggestionRow}>
                                    {suggestions.map((sugg, index) => (
                                        <TouchableOpacity key={index} style={styles.suggestionChip} onPress={() => applySuggestion(sugg)}>
                                            <Text style={styles.suggestionText}>{sugg}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>
                        ) : (
                            <Text style={styles.helperText}>3-20 chars, no spaces. Letters, numbers & _ only.</Text>
                        )}
                    </View>

                    <TextInput
                        style={styles.input}
                        placeholder="Email Address"
                        placeholderTextColor="#666"
                        onChangeText={setEmail}
                        value={email}
                        keyboardType="email-address"
                        autoCapitalize="none"
                    />

                    <View style={styles.inputGroup}>
                        <TextInput
                            style={styles.input}
                            placeholder="Password"
                            placeholderTextColor="#666"
                            secureTextEntry
                            onChangeText={setPassword}
                            value={password}
                        />
                        <Text style={styles.helperText}>Min 8 chars, 1 letter & 1 number</Text>
                    </View>

                    <Text style={styles.label}>Location</Text>
                    <View style={styles.pickerContainer}>
                        <Picker
                            selectedValue={location}
                            onValueChange={setLocation}
                            style={styles.picker}
                            dropdownIconColor="#ff8c00"
                        // Android: Dialog text color depends on system theme. 
                        // Avoid setting itemStyle or color prop to white if background is white.
                        >
                            {US_CITIES.map((city) => (
                                <Picker.Item
                                    key={city}
                                    label={city}
                                    value={city}
                                    // Remove explicit color prop for Android to let system default ensure visibility
                                    color={Platform.OS === 'ios' ? '#fff' : undefined}
                                />
                            ))}
                        </Picker>
                    </View>

                    <TouchableOpacity
                        style={[styles.signupButton, loading && styles.disabledButton]}
                        onPress={handleSignUp}
                        disabled={loading}
                    >
                        <Text style={styles.signupButtonText}>{loading ? 'Creating Account...' : 'Sign Up'}</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0a0a1a',
    },
    scrollContent: {
        padding: 20,
        paddingBottom: 40,
    },
    backButton: {
        alignSelf: 'flex-start',
        marginBottom: 20,
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#ff8c00',
        textAlign: 'center',
        fontFamily: 'Trebuchet MS',
    },
    subtitle: {
        fontSize: 16,
        color: '#ccc',
        textAlign: 'center',
        marginBottom: 30,
        fontFamily: 'Trebuchet MS',
    },
    formContainer: {
        width: '100%',
    },
    input: {
        backgroundColor: '#1a1a2e',
        color: '#fff',
        borderRadius: 12,
        paddingHorizontal: 15,
        paddingVertical: 12,
        fontSize: 16,
        marginBottom: 15,
        borderWidth: 1,
        borderColor: '#333',
    },
    inputGroup: {
        marginBottom: 15,
    },
    helperText: {
        color: '#666',
        fontSize: 12,
        marginTop: -10,
        marginLeft: 5,
        marginBottom: 10,
    },
    errorContainer: {
        marginBottom: 15,
        marginTop: -10,
        marginLeft: 5,
    },
    errorText: {
        color: '#e74c3c',
        fontSize: 12,
        fontWeight: 'bold',
        marginBottom: 5,
    },
    suggestionLabel: {
        color: '#ccc',
        fontSize: 12,
        marginBottom: 5,
    },
    suggestionRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    suggestionChip: {
        backgroundColor: '#333',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 15,
        marginRight: 10,
        marginBottom: 5,
    },
    suggestionText: {
        color: '#ff8c00',
        fontSize: 12,
        fontWeight: 'bold',
    },
    label: {
        color: '#ccc',
        marginBottom: 5,
        marginLeft: 5,
        fontSize: 14,
        fontWeight: 'bold',
    },
    pickerContainer: {
        backgroundColor: '#1a1a2e',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#333',
        marginBottom: 25,
        overflow: 'hidden',
    },
    picker: {
        color: '#fff',
        // On Android, this colors the selected text.
    },
    signupButton: {
        backgroundColor: '#ff8c00',
        borderRadius: 12,
        paddingVertical: 15,
        alignItems: 'center',
        shadowColor: '#ff8c00',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 5,
    },
    disabledButton: {
        backgroundColor: '#663c00',
    },
    signupButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold'
    },
});

export default SignUpScreen;
