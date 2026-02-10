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
 */

export function extractLevelFromDepartmentName(name: string): number | null {
    const trimmed = name.trim().toLowerCase();

    // Nursery levels
    if (trimmed.includes("lower nursery")) return 0;
    if (trimmed.includes("upper nursery")) return 1;

    // Kindergarten levels
    if (trimmed.includes("kg-1") || trimmed.includes("kg 1") || trimmed.includes("kg1")) return 2;
    if (trimmed.includes("kg-2") || trimmed.includes("kg 2") || trimmed.includes("kg2")) return 3;

    // Class levels 1-12
    for (let i = 1; i <= 12; i++) {
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
        "Class 1": 4,
        "Class 2": 5,
        "Class 3": 6,
        "Class 4": 7,
        "Class 5": 8,
        "Class 6": 9,
        "Class 7": 10,
        "Class 8": 11,
        "Class 9": 12,
        "Class 10": 13,
        "Class 11": 14,
        "Class 12": 15,
    };
}
