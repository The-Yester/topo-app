import React, { useState, useEffect, useCallback, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  TouchableOpacity
} from 'react-native';
import Slider from '@react-native-community/slider';

// Colors (Dark Theme)
const COLOR_BG = '#1a1a2e';
const COLOR_CARD_BG = '#252535';
const COLOR_TEXT_PRIMARY = '#FFFFFF';
const COLOR_TEXT_SECONDARY = '#ccc';
const COLOR_ACCENT = '#ff8c00'; // TOPO Orange
const COLOR_SLIDER_MAX = '#4A4A4A';

const SCREEN_WIDTH = Dimensions.get('window').width;

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

const ANIMATION_CATEGORIES = [
  'Directing',
  'Screenplay',
  'Score',
  'Song',
  'Film Editing',
  'Visual Effects'
];

const DOCUMENTARY_CATEGORIES = [
  'Directing',
  'Score',
  'Song',
  'Cinematography',
  'Production Design',
  'Film Editing'
];

// Memoized Row Component to ensure smooth slider performance
const CategoryRow = memo(({ category, value, onValueChange }) => {
  return (
    <View style={styles.row}>
      <View style={styles.labelContainer}>
        <Text style={styles.categoryLabel}>{category}</Text>
        <Text style={[styles.valueText, value === 0 && styles.valueTextDisabled]}>
          {value > 0 ? value.toFixed(1) : "N/A"}
        </Text>
      </View>

      <View style={styles.sliderContainer}>
        <Slider
          style={{ width: '100%', height: 40 }}
          minimumValue={0}
          maximumValue={10}
          step={0.1} // Smooth 0.1 increments
          value={value}
          onValueChange={onValueChange}
          minimumTrackTintColor={value > 0 ? COLOR_ACCENT : '#555'}
          maximumTrackTintColor={COLOR_SLIDER_MAX}
          thumbTintColor={value > 0 ? COLOR_ACCENT : '#777'}
        />
        <View style={styles.ticksConfig}>
          <Text style={styles.tickLabel}>0</Text>
          <Text style={styles.tickLabel}>5</Text>
          <Text style={styles.tickLabel}>10</Text>
        </View>
      </View>
    </View>
  );
}, (prevProps, nextProps) => {
  return prevProps.value === nextProps.value;
});

const DEFAULT_EXCLUDED = [];

const AwardsRating = ({ initialRatings = {}, onChange, excludedCategories = DEFAULT_EXCLUDED, forceKey = 0, initialFilter = 'Movie', children }) => {
  const [activeFilter, setActiveFilter] = useState(initialFilter); // 'Movie', 'Animation', 'Documentary'

  // Initialize with initialRatings immediately to prevent N/A flicker
  const [ratings, setRatings] = useState(() => {
    const defaultRatings = {};
    AWARD_CATEGORIES.forEach(category => {
      const initialValue = initialRatings[category];
      defaultRatings[category] = initialValue !== undefined && initialValue !== null ? parseFloat(initialValue) : 0;
    });
    return defaultRatings;
  });

  const lastReportedJson = React.useRef("");
  const isMounted = React.useRef(false);

  // Deep Sync from Props (Hydration fix)
  useEffect(() => {
    if (initialRatings) {
      setRatings(prev => {
        const next = { ...prev };
        let changed = false;
        // We do a hard map of everything in AWARD_CATEGORIES based on what was passed
        AWARD_CATEGORIES.forEach(cat => {
          // Check if the prop has a value
          if (initialRatings[cat] !== undefined) {
            const initialVal = parseFloat(initialRatings[cat]);
            if (!isNaN(initialVal) && initialVal !== next[cat]) {
              next[cat] = initialVal;
              changed = true;
            }
          } else {
            // If the prop DOES NOT have this cat, and our local state does, reset local to 0.
            // (This happens if we switch from a movie with a deep review to a brand new one)
            if (next[cat] !== 0) {
              next[cat] = 0;
              changed = true;
            }
          }
        });
        return changed ? next : prev;
      });
    }
  }, [initialRatings]);

  // Calculate Average on change
  useEffect(() => {
    // Basic structural check to avoid churn
    const currentJson = JSON.stringify(ratings);
    if (lastReportedJson.current === currentJson) return;

    // Filter valid values based on CURRENT active filter so average reflects the filter
    let visibleCategories = AWARD_CATEGORIES;
    if (activeFilter === 'Animation') visibleCategories = ANIMATION_CATEGORIES;
    if (activeFilter === 'Documentary') visibleCategories = DOCUMENTARY_CATEGORIES;

    const validValues = Object.entries(ratings)
      .filter(([key, val]) => visibleCategories.includes(key) && !excludedCategories.includes(key) && val > 0)
      .map(([_, val]) => val);

    if (validValues.length > 0) {
      const sum = validValues.reduce((acc, val) => acc + val, 0);
      const average = sum / validValues.length;
      lastReportedJson.current = currentJson;
      onChange?.(parseFloat(average.toFixed(1)), ratings, activeFilter);
    } else {
      if (lastReportedJson.current !== currentJson) {
        lastReportedJson.current = currentJson;
        onChange?.(null, ratings, activeFilter);
      }
    }
  }, [ratings, excludedCategories, activeFilter, onChange]); // Re-calculate average if filter changes

  // Stable callback for updating state
  const handleSliderChange = useCallback((category, value) => {
    setRatings(prev => {
      if (prev[category] === parseFloat(value.toFixed(1))) return prev; // Avoid unnecessary updates
      return {
        ...prev,
        [category]: parseFloat(value.toFixed(1))
      };
    });
  }, []);

  const getOverallScore = () => {
    let visibleCategories = AWARD_CATEGORIES;
    if (activeFilter === 'Animation') visibleCategories = ANIMATION_CATEGORIES;
    if (activeFilter === 'Documentary') visibleCategories = DOCUMENTARY_CATEGORIES;

    const validValues = Object.entries(ratings)
      .filter(([key, val]) => visibleCategories.includes(key) && !excludedCategories.includes(key) && val > 0)
      .map(([_, val]) => val);

    if (validValues.length === 0) return "N/A";
    const sum = validValues.reduce((acc, val) => acc + val, 0);
    return (sum / validValues.length).toFixed(1);
  };

  // Determine categories to show based on filter
  let displayCategories = AWARD_CATEGORIES;
  if (activeFilter === 'Animation') displayCategories = ANIMATION_CATEGORIES;
  if (activeFilter === 'Documentary') displayCategories = DOCUMENTARY_CATEGORIES;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Awards Rating</Text>

        {/* Filter Tabs */}
        <View style={styles.filterTabsContainer}>
          <TouchableOpacity
            style={[styles.filterTab, activeFilter === 'Movie' && styles.filterTabActive]}
            onPress={() => setActiveFilter('Movie')}
          >
            <Text style={[styles.filterTabText, activeFilter === 'Movie' && styles.filterTabTextActive]}>Movie</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterTab, activeFilter === 'Animation' && styles.filterTabActive]}
            onPress={() => setActiveFilter('Animation')}
          >
            <Text style={[styles.filterTabText, activeFilter === 'Animation' && styles.filterTabTextActive]}>Animation</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterTab, activeFilter === 'Documentary' && styles.filterTabActive]}
            onPress={() => setActiveFilter('Documentary')}
          >
            <Text style={[styles.filterTabText, activeFilter === 'Documentary' && styles.filterTabTextActive]}>Doc</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.averageContainer}>
          <Text style={styles.averageLabel}>{activeFilter} Score</Text>
          <Text style={styles.averageValue}>{getOverallScore()}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} removeClippedSubviews={false}>
        {displayCategories.filter(cat => !excludedCategories.includes(cat)).map((category) => (
          <CategoryRow
            key={category}
            category={category}
            value={ratings[category] || 0}
            onValueChange={(val) => handleSliderChange(category, val)}
          />
        ))}
        {/* Render buttons or extra content supplied by parent */}
        {children && <View style={styles.childrenWrapper}>{children}</View>}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  childrenWrapper: {
    marginTop: 20,
    width: '100%'
  },
  container: {
    flex: 1,
    flexShrink: 1, // Let it shrink
    backgroundColor: COLOR_BG,
    borderRadius: 15,
    overflow: 'hidden',
  },
  header: {
    paddingTop: 15,
    paddingHorizontal: 20,
    paddingBottom: 15,
    backgroundColor: COLOR_BG,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLOR_TEXT_PRIMARY,
    marginBottom: 15,
  },
  filterTabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#333',
    borderRadius: 8,
    padding: 3,
    marginBottom: 15,
    width: '100%',
    justifyContent: 'space-between'
  },
  filterTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  filterTabActive: {
    backgroundColor: COLOR_ACCENT,
  },
  filterTabText: {
    color: '#aaa',
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase'
  },
  filterTabTextActive: {
    color: '#fff',
  },
  averageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLOR_CARD_BG,
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
  averageLabel: {
    fontSize: 16,
    color: COLOR_TEXT_SECONDARY,
    marginRight: 10,
  },
  averageValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLOR_ACCENT,
  },
  scrollContent: {
    padding: 15,
    paddingBottom: 25, // Reduced from 40 to bring it tighter
  },
  row: {
    backgroundColor: COLOR_CARD_BG,
    marginBottom: 10,
    borderRadius: 12,
    padding: 15,
  },
  labelContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  categoryLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: COLOR_TEXT_PRIMARY,
  },
  valueText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLOR_ACCENT,
  },
  valueTextDisabled: {
    color: '#666',
  },
  sliderContainer: {
    width: '100%',
    justifyContent: 'center',
  },
  ticksConfig: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    marginTop: -5,
  },
  tickLabel: {
    fontSize: 10,
    color: '#666',
  }

});

export default AwardsRating;
