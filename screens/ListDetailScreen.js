import React, { useContext, useMemo, useLayoutEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, Image, TouchableOpacity, Alert, Modal, SafeAreaView, Platform, StatusBar, Share } from 'react-native';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import Icon from 'react-native-vector-icons/FontAwesome';
import { MoviesContext } from '../context/MoviesContext'; // Adjust path as needed
import { useNavigation } from '@react-navigation/native'; // Import useNavigation

// Define the name of your special, non-deletable list
const OVERALL_RATINGS_LIST_NAME = "Overall Ratings"; // Or "Overall Rank" if that's what you use

const ListDetailScreen = ({ route }) => {
  // Corrected: Moved console.log inside the component and fixed syntax
  console.log('[ListDetailScreen] Route params:', JSON.stringify(route.params, null, 2));
  const { listId, listName } = route.params;
  console.log(`[ListDetailScreen] Received listId: "${listId}", listName: "${listName}"`);

  const { getMoviesInList, removeMovieFromList, overallRatedMovies } = useContext(MoviesContext);
  const navigation = useNavigation();
  const [sortBy, setSortBy] = useState('Highest Rated'); // Default sort
  const [isSortModalVisible, setSortModalVisible] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  // Corrected: Defined moviesInList once with console.log
  const moviesInList = useMemo(() => {
    const movies = getMoviesInList(listId) || [];

    // Merge with overallRatedMovies to ensure we have the latest rating
    return movies.map(movie => {
      const ratedVersion = overallRatedMovies.find(rm => rm.id === movie.id);
      return {
        ...movie,
        userOverallRating: ratedVersion ? ratedVersion.userOverallRating : movie.userOverallRating,
        release_date: ratedVersion ? (ratedVersion.release_date || movie.release_date) : movie.release_date // Ensure date availability if possible
      };
    });
  }, [listId, getMoviesInList, overallRatedMovies]);

  const isOverallRatingsList = listName === OVERALL_RATINGS_LIST_NAME;

  const sortedMovies = useMemo(() => {
    if (!moviesInList) return [];
    let sorted = [...moviesInList];

    switch (sortBy) {
      case 'Highest Rated':
        sorted.sort((a, b) => (b.userOverallRating || 0) - (a.userOverallRating || 0));
        break;
      case 'Lowest Rated':
        sorted.sort((a, b) => (a.userOverallRating || 0) - (b.userOverallRating || 0));
        break;
      case 'Alphabetical (A-Z)':
        sorted.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'Alphabetical (Z-A)':
        sorted.sort((a, b) => b.title.localeCompare(a.title));
        break;
      case 'Release Date (Newest)':
        sorted.sort((a, b) => new Date(b.release_date || 0) - new Date(a.release_date || 0));
        break;
      case 'Release Date (Oldest)':
        sorted.sort((a, b) => new Date(a.release_date || 0) - new Date(b.release_date || 0));
        break;
    }
    return sorted;
  }, [moviesInList, sortBy]);

  const handleItemPress = (item) => {
    navigation.navigate('MovieDetails', { movieId: item.id, movieTitle: item.title });
  };

  const renderRightActions = (item) => {
    if (isOverallRatingsList) return null; // Cannot delete from Overall Ratings/Rank list directly here usually, or maybe we allow it? User said "my list". Let's assume custom lists.
    // Actually, user said "my list i create", so it applies to custom lists.

    return (
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => {
          Alert.alert(
            "Remove Movie",
            `Remove "${item.title}"?`,
            [
              { text: "Cancel", style: "cancel" },
              { text: "Remove", onPress: () => removeMovieFromList(listId, item.id), style: 'destructive' }
            ]
          );
        }}
      >
        <Text style={styles.deleteButtonText}>Delete</Text>
      </TouchableOpacity>
    );
  };

  const handleShare = async (item) => {
    Alert.alert(
      "Share Movie",
      `Share "${item.title}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Post to Reelz",
          onPress: () => {
            const text = `Watching ${item.title}! 🍿 Rating: ${item.userOverallRating ? parseFloat(item.userOverallRating).toFixed(1) : 'N/A'}/10`;
            // Ensure 'MessageBoard' matches your stack navigator name for the Reelz screen. 
            // If it is 'Reelz' in bottom tab but stack name is 'MessageBoard', use that. 
            // Assuming 'MessageBoard' based on file name or usage.
            // If it's a tab, we might need navigation.navigate('ReelzTab', { screen: 'MessageBoard', params: ... })
            // Let's assume global 'MessageBoard' or 'Reelz' screen name.
            // Given previous step confirmed 'MessageBoard.js', let's try 'MessageBoard' first or 'Reelz' if that is the route name.
            // User called it "Reelz page", bottom tab is often 'Reelz'.
            navigation.navigate('MessageBoard', { initialText: text });
          }
        },
        {
          text: "Share Externally",
          onPress: async () => {
            try {
              const posterUrl = item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : '';
              await Share.share({
                message: `Check out "${item.title}" on Topo! ${posterUrl}`,
                url: posterUrl
              });
            } catch (error) {
              console.error(error);
            }
          }
        }
      ]
    );
  };

  const renderMovieItem = ({ item, index }) => {
    const posterUrl = item.poster_path
      ? `https://image.tmdb.org/t/p/w200${item.poster_path}`
      : 'https://placehold.co/80x120/333/fff?text=No+Image';

    const rank = index + 1;
    const yourRating = item.userOverallRating;
    const usersRating = item.vote_average;

    return (
      <Swipeable renderRightActions={() => renderRightActions(item)}>
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
            {/* User Rating Removed as requested */}
            {/* Users Rating Removed as requested */}
            <View style={[styles.ratingBox, styles.yourRatingBox]}>
              <Text style={styles.ratingBoxLabel}>Your Rating</Text>
              <Text style={styles.ratingBoxValue}>
                {yourRating !== undefined && yourRating !== null ? parseFloat(yourRating).toFixed(1) : 'N/A'}
              </Text>
            </View>

            {/* Share Button */}
            <TouchableOpacity style={styles.shareButton} onPress={() => handleShare(item)}>
              <Icon name="share-square-o" size={20} color="#888" />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Swipeable>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerContainer}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.listNameTitle}>{listName}</Text>
        <TouchableOpacity style={styles.sortButton} onPress={() => setSortModalVisible(true)}>
          <Icon name="sort" size={24} color="#FFF" />
        </TouchableOpacity>
      </View>

      <View style={styles.subHeader}>
        <Text style={styles.sortLabel}>Sorted by: {sortBy}</Text>
      </View>

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

      <Modal
        animationType="slide"
        transparent={true}
        visible={isSortModalVisible}
        onRequestClose={() => setSortModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Sort By</Text>
            {[
              'Highest Rated',
              'Lowest Rated',
              'Alphabetical (A-Z)',
              'Alphabetical (Z-A)',
              'Release Date (Newest)',
              'Release Date (Oldest)'
            ].map((option) => (
              <TouchableOpacity
                key={option}
                style={[styles.modalOption, sortBy === option && styles.selectedOption]}
                onPress={() => {
                  setSortBy(option);
                  setSortModalVisible(false);
                }}
              >
                <Text style={[styles.modalOptionText, sortBy === option && styles.selectedOptionText]}>{option}</Text>
                {sortBy === option && <Icon name="check" size={16} color="#ff8c00" />}
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.closeButton} onPress={() => setSortModalVisible(false)}>
              <Text style={styles.closeButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView >
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#141414',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
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
  shareButton: {
    justifyContent: 'center',
    paddingHorizontal: 10,
    marginLeft: 5
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
  },
  deleteButton: {
    backgroundColor: '#d32f2f',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    height: '100%',
  },
  deleteButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center', // Center title, but absolute back/sort buttons
    paddingVertical: 15,
    backgroundColor: '#1C1C1C',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    position: 'relative',
    height: 60
  },
  backButton: {
    position: 'absolute',
    left: 15,
    padding: 10,
    zIndex: 10,
  },
  sortButton: {
    position: 'absolute',
    right: 15,
    padding: 10,
    zIndex: 10,
  },
  listNameTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#E0E0E0',
    textAlign: 'center',
  },
  subHeader: {
    backgroundColor: '#141414',
    paddingVertical: 8,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#222'
  },
  sortLabel: {
    color: '#888',
    fontSize: 12,
    fontStyle: 'italic'
  },
  // Modal Styles
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: '#1a1a2e',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '70%'
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 20,
    textAlign: 'center'
  },
  modalOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#333'
  },
  selectedOption: {
    backgroundColor: '#252535',
    borderRadius: 8,
    paddingHorizontal: 10
  },
  modalOptionText: {
    fontSize: 16,
    color: '#ccc'
  },
  selectedOptionText: {
    color: '#ff8c00',
    fontWeight: 'bold'
  },
  closeButton: {
    marginTop: 20,
    alignItems: 'center',
    padding: 15
  },
  closeButtonText: {
    color: '#ff4444',
    fontSize: 16
  }
});

export default ListDetailScreen;