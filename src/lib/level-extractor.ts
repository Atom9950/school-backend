/**
 * Convert Roman numeral to Arabic number
 */
function romanToArabic(roman: string): number | null {
    const romanMap: Record<string, number> = {
        I: 1,
        V: 5,
        X: 10,
        L: 50,
        C: 100,
        D: 500,
        M: 1000,
    };

    let result = 0;
    let prevValue = 0;

    for (let i = roman.length - 1; i >= 0; i--) {
        const char = roman[i];
        if (!char) return null;
        
        const value = romanMap[char];
        if (value === undefined) return null;

        if (value < prevValue) {
            result -= value;
        } else {
            result += value;
        }
        prevValue = value;
    }

    return result;
}

/**
 * Extract academic level from department name
 * 
 * Level Mapping:
 * - Lower Nursery = 0
 * - Upper Nursery = 1
 * - KG-1 = 2
 * - KG-2 = 3
 * - Class 1 = 4
 * - Class 2 = 5
 * - ...
 * - Class 12 = 15
 * 
 * Supports: Class 1, Class I, Class-1, Class-I, etc.
 */

export function extractLevelFromDepartmentName(name: string): number | null {
    const trimmed = name.trim().toLowerCase();

    // Nursery levels
    if (trimmed.includes("lower nursery")) return 0;
    if (trimmed.includes("upper nursery")) return 1;

    // Kindergarten levels
    if (trimmed.includes("kg-1") || trimmed.includes("kg 1") || trimmed.includes("kg1")) return 2;
    if (trimmed.includes("kg-2") || trimmed.includes("kg 2") || trimmed.includes("kg2")) return 3;

    // Class levels 1-12 (Arabic numerals)
    // Check from 12 down to 1 to avoid "class 1" matching "class 10", "class 11", "class 12"
    for (let i = 12; i >= 1; i--) {
        const patterns = [
            `class ${i}`,
            `class-${i}`,
            `class${i}`,
            `std ${i}`,
            `std-${i}`,
            `std${i}`,
        ];

        if (patterns.some((pattern) => trimmed.includes(pattern))) {
            return 3 + i; // Class 1 starts at level 4
        }
    }

    // Class levels 1-12 (Roman numerals)
    const romanNumerals = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
    for (let i = 0; i < romanNumerals.length; i++) {
        const roman = romanNumerals[i];
        const patterns = [
            `class ${roman}`,
            `class-${roman}`,
            `class${roman}`,
            `std ${roman}`,
            `std-${roman}`,
            `std${roman}`,
        ];

        if (patterns.some((pattern) => trimmed.includes(pattern.toLowerCase()))) {
            return 4 + i; // Class I starts at level 4
        }
    }

    // If no pattern matches, return null
    return null;
}

/**
 * Get all valid department names and their levels for reference
 */
export function getValidDepartmentLevels(): Record<string, number> {
    return {
        "Lower Nursery": 0,
        "Upper Nursery": 1,
        "KG-1": 2,
        "KG-2": 3,
        "Class 1 (or Class I)": 4,
        "Class 2 (or Class II)": 5,
        "Class 3 (or Class III)": 6,
        "Class 4 (or Class IV)": 7,
        "Class 5 (or Class V)": 8,
        "Class 6 (or Class VI)": 9,
        "Class 7 (or Class VII)": 10,
        "Class 8 (or Class VIII)": 11,
        "Class 9 (or Class IX)": 12,
        "Class 10 (or Class X)": 13,
        "Class 11 (or Class XI)": 14,
        "Class 12 (or Class XII)": 15,
    };
}
