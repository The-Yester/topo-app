import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/FontAwesome';
import Login from './src/login';
import SignUpScreen from './screens/SignUpScreen';
import HomeScreen from './screens/HomeScreen';
import AddMovieScreen from './screens/AddMovieScreen';
import MovieDetailScreen from './screens/MovieDetailScreen';
import { MoviesProvider } from './context/MoviesContext';
import ListScreen from './screens/ListScreen';
import ListDetailScreen from './screens/ListDetailScreen';
import SearchScreen from './screens/SearchScreen';
import MessageBoard from './screens/MessageBoard';
import ProfileScreen from './screens/ProfileScreen';
import ProfileSettings from './screens/ProfileSettings';
import 'react-native-get-random-values';
import GenreMovieScreen from './screens/GenreMovieScreen';
import NowPlayingScreen from './screens/NowPlayingScreen';
import NewStreamingScreen from './screens/NewStreamingScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// Stack for the Home tab
const HomeStack = createStackNavigator();
function HomeStackNavigator() {
    return (
        <HomeStack.Navigator screenOptions={{ headerShown: false }}>
            <HomeStack.Screen name="HomeScreen" component={HomeScreen} />
            <HomeStack.Screen name="MovieDetails" component={MovieDetailScreen} />
        </HomeStack.Navigator>
    );
}

// Bottom tab navigator
function BottomTabs() {
    return (
        <Tab.Navigator screenOptions={{ headerShown: false }}>
            <Tab.Screen 
                name="Home" 
                component={HomeStackNavigator} 
                options={{ tabBarIcon: ({ color, size }) => <Icon name="home" color={color} size={size} /> }} 
            />
            <Tab.Screen 
                name="New" 
                component={AddMovieScreen} 
                options={{ tabBarIcon: ({ color, size }) => <Icon name="plus" color={color} size={size} /> }} 
            />
            <Tab.Screen 
                name="List" 
                component={ListScreen} 
                options={{ tabBarIcon: ({ color, size }) => <Icon name="list" color={color} size={size} /> }} 
            />
            <Tab.Screen 
                name="Message Board" 
                component={MessageBoard} 
                options={{ tabBarIcon: ({ color, size }) => <Icon name="comments" color={color} size={size} /> }} 
            />
            <Tab.Screen 
                name="Search" 
                component={SearchScreen} 
                options={{ tabBarIcon: ({ color, size }) => <Icon name="search" color={color} size={size} /> }} 
            />
        </Tab.Navigator>
    );
}

function AppNavigator() {
    return (
        <MoviesProvider>
            <NavigationContainer>
                <Stack.Navigator initialRouteName="Login">
                    <Stack.Screen name="Login" component={Login} options={{ headerShown: false }} />
                    <Stack.Screen name="SignUp" component={SignUpScreen} />
                    <Stack.Screen name="MainTabs" component={BottomTabs} options={{ headerShown: false }} />
                    <Stack.Screen name="MovieDetailScreen" component={MovieDetailScreen} />
                    <Stack.Screen name="ListDetails" component={ListDetailScreen} />
                    <Stack.Screen name="Profile" component={ProfileScreen} />
                    <Stack.Screen name="ProfileSettings" component={ProfileSettings} />
                    <Stack.Screen name="SearchScreen" component={SearchScreen} />
                    <Stack.Screen name="MessageBoard" component={MessageBoard} />
                    <Stack.Screen name="GenreMoviesScreen" component={GenreMovieScreen} />
                    <Stack.Screen name="NowPlaying" component={NowPlayingScreen} />
                    <Stack.Screen name="NewStreaming" component={NewStreamingScreen} />
                    <Stack.Screen name="MovieDetails" component={MovieDetailScreen} />
                </Stack.Navigator>
            </NavigationContainer>
        </MoviesProvider>
    );
}

export default AppNavigator;
