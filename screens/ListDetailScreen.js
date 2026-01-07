import React, { useContext, useMemo } from 'react';
import { View, Text, FlatList, StyleSheet, Image, TouchableOpacity, Alert } from 'react-native';
import { MoviesContext } from '../context/MoviesContext'; // Adjust path as needed
import { useNavigation } from '@react-navigation/native'; // Import useNavigation

// Define the name of your special, non-deletable list
const OVERALL_RATINGS_LIST_NAME = "Overall Ratings"; // Or "Overall Rank" if that's what you use

const ListDetailScreen = ({ route }) => {
  // Corrected: Moved console.log inside the component and fixed syntax
  console.log('[ListDetailScreen] Route params:', JSON.stringify(route.params, null, 2));
  const { listId, listName } = route.params;
  console.log(`[ListDetailScreen] Received listId: "${listId}", listName: "${listName}"`);

  const { getMoviesInList, removeMovieFromList } = useContext(MoviesContext);
  const navigation = useNavigation();

  // Corrected: Defined moviesInList once with console.log
  const moviesInList = useMemo(() => {
    const movies = getMoviesInList(listId) || [];
    console.log(`[ListDetailScreen] Movies fetched for listId "${listId}":`, JSON.stringify(movies, null, 2));
    return movies;
  }, [listId, getMoviesInList]);

  const isOverallRatingsList = listName === OVERALL_RATINGS_LIST_NAME;

  const sortedMovies = useMemo(() => {
    if (!moviesInList) return [];
    return [...moviesInList].sort((a, b) => {
      const ratingA = a.userOverallRating ?? a.vote_average ?? -1;
      const ratingB = b.userOverallRating ?? b.vote_average ?? -1;
      return ratingB - ratingA; // Descending order
    });
  }, [moviesInList]);

  const handleItemPress = (item) => {
    if (isOverallRatingsList) {
      navigation.navigate('MovieDetailScreen', { movieId: item.id, movieTitle: item.title });
    } else {
      Alert.alert(
        "Remove Movie",
        `Are you sure you want to remove "${item.title}" from this list?`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "OK", onPress: () => removeMovieFromList(listId, item.id) }
        ]
      );
    }
  };

  const renderMovieItem = ({ item, index }) => {
    const posterUrl = item.poster_path
      ? `https://image.tmdb.org/t/p/w200${item.poster_path}`
      : 'https://placehold.co/80x120/333/fff?text=No+Image';
    
    const rank = index + 1;
    const yourRating = item.userOverallRating;
    const usersRating = item.vote_average;

    return (
      <TouchableOpacity
        style={styles.itemContainer}
        onPress={() => handleItemPress(item)}
      >
        <Image source={{ uri: posterUrl }} style={styles.posterImage} />
        <View style={styles.rankContainer}>
          <Text style={styles.rankText}>{rank}</Text>
        </View>
        <View style={styles.itemTextContainer}>
          <Text style={styles.itemTitle} numberOfLines={2}>{item.title}</Text>
        </View>
        
        <View style={styles.ratingsBoxesContainer}>
            <View style={[styles.ratingBox, styles.yourRatingBox]}>
                <Text style={styles.ratingBoxLabel}>Your Rating</Text>
                <Text style={styles.ratingBoxValue}>
                    {yourRating !== undefined && yourRating !== null ? parseFloat(yourRating).toFixed(1) : 'N/A'}
                </Text>
            </View>
            <View style={[styles.ratingBox, styles.usersRatingBox]}>
                <Text style={styles.ratingBoxLabel}>Users Rating</Text>
                <Text style={styles.ratingBoxValue}>
                    {usersRating !== undefined && usersRating !== null ? parseFloat(usersRating).toFixed(1) : 'N/A'}
                </Text>
            </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.listNameTitle}>{listName}</Text>
      
      {sortedMovies.length > 0 ? (
        <FlatList
          data={sortedMovies}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderMovieItem}
          contentContainerStyle={styles.listContentContainer}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            {isOverallRatingsList ? "You haven't rated any movies yet." : "No movies in this list yet."}
          </Text>
        </View>
      )}
    </View>
  );
}; // Corrected: Removed the nested ListDetailScreen definition

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#141414', 
    },
    listNameTitle: { 
        fontSize: 22,
        fontWeight: 'bold',
        color: '#E0E0E0',
        textAlign: 'center',
        paddingVertical: 15,
        backgroundColor: '#1C1C1C', 
        borderBottomWidth: 1,        
        borderBottomColor: '#333',   
    },
    listContentContainer: {
        paddingHorizontal: 0, 
    },
    itemContainer: {
        flexDirection: 'row',
        backgroundColor: '#1C1C1C', 
        paddingVertical: 10,
        paddingHorizontal: 10, 
        marginBottom: 1, 
        alignItems: 'center',
    },
    posterImage: {
        width: 50, 
        height: 75,
        borderRadius: 3,
        marginRight: 8,
    },
    rankContainer: {
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 8,
        width: 25, 
    },
    rankText: {
        fontSize: 16, 
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    itemTextContainer: {
        flex: 1, 
        justifyContent: 'center',
        marginRight: 5, 
    },
    itemTitle: {
        fontSize: 15, 
        fontWeight: '600',
        color: '#E0E0E0',
    },
    ratingsBoxesContainer: {
        flexDirection: 'row', 
    },
    ratingBox: {
        width: 75, 
        height: 55, 
        borderRadius: 6,
        paddingVertical: 5,
        paddingHorizontal: 5, 
        alignItems: 'center',
        justifyContent: 'center', 
        marginLeft: 5, 
    },
    yourRatingBox: {
        borderColor: '#007AFF', 
        borderWidth: 1.5,
    },
    usersRatingBox: {
        borderColor: '#4CAF50', 
        borderWidth: 1.5,
    },
    ratingBoxLabel: {
        fontSize: 10,
        color: '#A0A0A0', 
        marginBottom: 3,
        textAlign: 'center',
    },
    ratingBoxValue: {
        fontSize: 16,
        fontWeight: 'bold',
        textAlign: 'center',
        color: '#FFFFFF', 
    },
    emptyContainer: { 
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
        backgroundColor: '#141414',
    },
    emptyText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#A0A0A0',
        textAlign: 'center',
    }
});

export default ListDetailScreen;