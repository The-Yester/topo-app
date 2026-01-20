export const AWARD_CATEGORIES = [
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

/**
 * Calculates the average score for the Awards rating system.
 * @param {Object} ratings - Key-value pair of category: score (string or number)
 * @returns {number|null} - Average score rounded to 1 decimal, or null if no valid ratings
 */
export const calculateAwardAverage = (ratings) => {
    if (!ratings) return null;
    const validValues = Object.values(ratings)
        .map(v => parseFloat(v))
        .filter(v => !isNaN(v) && v >= 1.0 && v <= 10.0);

    if (validValues.length === 0) return null;

    const sum = validValues.reduce((acc, val) => acc + val, 0);
    return parseFloat((sum / validValues.length).toFixed(1));
};

/**
 * Normalizes any rating to a 0-100 scale for "Master Average" calculation.
 * @param {string} type - 'classic' | 'pizza' | 'percentage' | 'awards'
 * @param {number} score - The score value
 * @returns {number} - Normalized score 0-100
 */
export const normalizeScore = (type, score) => {
    switch (type) {
        case 'classic': // 0-10
        case 'awards':  // 1-10 (technically)
            return score * 10;
        case 'pizza':   // 0-5
            return score * 20;
        case 'percentage': // 0-100
            return score;
        default:
            return 0;
    }
};
