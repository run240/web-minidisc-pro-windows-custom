const HANGUL_SYLLABLE_BASE = 0xac00;
const HANGUL_SYLLABLE_COUNT = 11172;

const INITIALS = [
    'g', 'kk', 'n', 'd', 'tt', 'r', 'm', 'b', 'pp',
    's', 'ss', '', 'j', 'jj', 'ch', 'k', 't', 'p', 'h',
];

const VOWELS = [
    'a', 'ae', 'ya', 'yae', 'eo', 'e', 'yeo', 'ye',
    'o', 'wa', 'wae', 'oe', 'yo', 'u', 'wo', 'we',
    'wi', 'yu', 'eu', 'ui', 'i',
];

const FINALS = [
    '', 'k', 'k', 'ks', 'n', 'nj', 'nh', 't', 'l', 'lk',
    'lm', 'lb', 'ls', 'lt', 'lp', 'lh', 'm', 'p', 'ps',
    't', 't', 'ng', 't', 't', 'k', 't', 'p', 'h',
];

function romanizeSyllable(codePoint: number) {
    const offset = codePoint - HANGUL_SYLLABLE_BASE;
    const initial = Math.floor(offset / 588);
    const vowel = Math.floor((offset % 588) / 28);
    const final = offset % 28;
    return `${INITIALS[initial]}${VOWELS[vowel]}${FINALS[final]}`;
}

/**
 * Converts modern Korean syllables to predictable Latin text before NetMD's
 * Shift-JIS title sanitization removes unsupported characters.
 *
 * This is a lightweight romanization for device titles, not a translation or
 * a pronunciation dictionary. Existing Latin and Japanese text is untouched.
 */
export function romanizeKoreanTitle(input: string) {
    let result = '';
    let capitalizeNextKoreanWord = true;

    for (const character of input.normalize('NFC')) {
        const codePoint = character.codePointAt(0)!;
        if (
            codePoint >= HANGUL_SYLLABLE_BASE &&
            codePoint < HANGUL_SYLLABLE_BASE + HANGUL_SYLLABLE_COUNT
        ) {
            let romanized = romanizeSyllable(codePoint);
            if (capitalizeNextKoreanWord) {
                romanized = romanized[0].toUpperCase() + romanized.slice(1);
            }
            result += romanized;
            capitalizeNextKoreanWord = false;
            continue;
        }

        result += character;
        capitalizeNextKoreanWord = !/[A-Za-z0-9]/.test(character);
    }

    return result;
}
