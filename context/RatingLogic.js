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

export const normalizeType = (t) => {
    if (!t) return 'classic';
    const lower = t.toLowerCase();
    if (lower === '1-5' || lower === 'pizza') return 'pizza';
    if (lower === '1-10' || lower === 'classic') return 'classic';
    if (lower === 'percentage') return 'percentage';
    if (lower === 'awards') return 'awards';
    if (lower === 'thumbs') return 'thumbs';
    return lower;
};

export const convertRating = (score, fromType, toType) => {
    const nFrom = normalizeType(fromType);
    const nTo = normalizeType(toType);

    if (score === undefined || score === null) return 0;
    const numericScore = parseFloat(score);
    if (isNaN(numericScore)) return 0;

    if (nFrom === nTo) return numericScore;

    // Convert to 0-100 base
    let base100 = 0;
    switch (nFrom) {
        case 'pizza':
            base100 = numericScore * 20;
            break;
        case 'classic':
        case 'awards':
            base100 = numericScore * 10;
            break;
        case 'thumbs':
            base100 = numericScore * 25;
            break;
        case 'percentage':
            base100 = numericScore;
            break;
        default:
            base100 = numericScore;
    }

    // Convert from 0-100 base to target
    switch (nTo) {
        case 'pizza':
            return base100 / 20;
        case 'classic':
        case 'awards':
            return base100 / 10;
        case 'thumbs':
            return base100 / 25;
        case 'percentage':
            return base100;
        default:
            return base100;
    }
};

/**
 * Normalizes any rating to a 0-100 scale for "Master Average" calculation.
 * @param {string} type - 'classic' | 'pizza' | 'percentage' | 'awards' | 'thumbs'
 * @param {number} score - The score value
 * @returns {number} - Normalized score 0-100
 */
export const normalizeScore = (type, score) => {
    const nType = normalizeType(type);
    switch (nType) {
        case 'classic': // 0-10
        case 'awards':  // 1-10 (technically)
            return score * 10;
        case 'pizza':   // 0-5
            return score * 20;
        case 'thumbs':  // 0-4
            return score * 25;
        case 'percentage': // 0-100
            return score;
        default:
            return 0;
    }
};
