import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';

// Enable LayoutAnimation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const AWARD_CATEGORIES = [
  'Directing',
  'Leading Actress',
  'Leading Actor',
  'Supporting Actress',
  'Supporting Actor',
  'Screenplay',
  'Score',
  'Song',
  'Sound',
  'Makeup & Hairstyle',
  'Costume Design',
  'Cinematography',
  'Production Design',
  'Film Editing',
  'Visual Effects'
];

// Helper to generate picker items from 1.0 to 10.0 with 0.1 increments, plus a clear option
const generatePickerItems = () => {
  const items = [{ label: "Clear Rating", value: "" }]; // Use empty string for clear
  for (let i = 10; i <= 100; i += 1) { // 1.0 to 10.0 in 0.1 increments
    const value = (i / 10).toFixed(1);
    items.push({ label: value, value: value });
  }
  return items;
};

const RATING_PICKER_ITEMS = generatePickerItems();

const AwardsRating = ({ initialRatings = {}, onChange, excludedCategories = [] }) => {
  const [ratings, setRatings] = useState(() => {
    const defaultRatings = {};
    AWARD_CATEGORIES.forEach(category => {
      if (!excludedCategories.includes(category)) {
        const initialValue = initialRatings[category];
        defaultRatings[category] = initialValue !== undefined && initialValue !== null ? String(initialValue) : '';
      }
    });
    return defaultRatings;
  });

  const [expandedCategory, setExpandedCategory] = useState(null); // Tracks which category picker is open

  useEffect(() => {
    const validValues = Object.values(ratings)
      .map(v => parseFloat(v))
      .filter(v => !isNaN(v) && v >= 1.0 && v <= 10.0);

    if (validValues.length > 0) {
      const sum = validValues.reduce((acc, val) => acc + val, 0);
      const average = sum / validValues.length;
      onChange?.(parseFloat(average.toFixed(1)), ratings);
    } else {
      onChange?.(null, ratings);
    }
  }, [ratings, onChange]);

  const handleCategoryPress = (category) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); // Smooth animation
    setExpandedCategory(prevExpanded => (prevExpanded === category ? null : category));
  };

  const handlePickerValueChange = (category, itemValue) => {
    setRatings(prev => ({
      ...prev,
      [category]: itemValue, // itemValue will be "" if "Clear Rating" is selected
    }));
    // Collapse after selection:
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); // Animate the collapse
    setExpandedCategory(null); // Set to null to close the picker
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Academy Awards Rating (1.0–10.0)</Text>
      <ScrollView>
        {AWARD_CATEGORIES.filter(cat => !excludedCategories.includes(cat)).map((category) => (
          <View key={category} style={styles.categoryWrapper}> 
            <TouchableOpacity
              style={styles.categoryItem}
              onPress={() => handleCategoryPress(category)}
              activeOpacity={0.7}
            >
              <Text style={styles.categoryLabel}>{category}</Text>
              <View style={styles.ratingDisplay}>
                <Text style={styles.categoryValue}>
                  {ratings[category] && ratings[category] !== ''
                    ? `${parseFloat(ratings[category]).toFixed(1)}`
                    : 'Not Rated'}
                </Text>
                <Text style={styles.ratingMax}> / 10.00</Text>
              </View>
            </TouchableOpacity>
            {expandedCategory === category && (
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={ratings[category] || ""} // Default to empty string if no rating
                  style={styles.picker}
                  onValueChange={(itemValue) => handlePickerValueChange(category, itemValue)}
                  itemStyle={styles.pickerItem}
                >
                  {RATING_PICKER_ITEMS.map(item => (
                    <Picker.Item key={item.value} label={item.label} value={item.value} />
                  ))}
                </Picker>
              </View>
            )}
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

export default AwardsRating;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 5, 
    paddingTop: 16,
    paddingBottom: 16, 
    backgroundColor: '#fff'
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 15,
    textAlign: 'center',
    color: '#333',
  },
  categoryWrapper: { 
    marginBottom: 8, 
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    overflow: 'hidden', 
  },
  categoryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 18, 
    paddingHorizontal: 15,
  },
  categoryLabel: {
    fontSize: 16,
    fontWeight: '500', 
    color: '#333', 
    flexShrink: 1, 
    marginRight: 10,
  },
  ratingDisplay: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  categoryValue: {
    fontSize: 16,
    fontWeight: '600', 
    color: '#007AFF', 
  },
  ratingMax: {
    fontSize: 13,
    fontWeight: '400',
    color: '#666',
  },
  pickerContainer: {
    paddingVertical: 1, 
  },
  picker: {
    width: '100%',
    height: 50, 
  },
  pickerItem: {
    // fontSize: 17, // iOS specific styling
    // color: '#000', // iOS specific styling
  },
});
