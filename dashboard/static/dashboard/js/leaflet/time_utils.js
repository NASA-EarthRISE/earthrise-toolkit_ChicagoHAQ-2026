/**
 * Time Utilities Module
 * Consolidated time conversion and formatting functions for Chicago timezone handling
 */

const TimeUtils = (function() {
    // Timezone formatters
    const chicagoDateFormatter = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Chicago",
        year: "numeric",
        month: "numeric",
        day: "numeric"
    });

    const chicagoHourFormatter = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Chicago",
        hour: "numeric",
        hour12: false
    });

    /**
     * Parse a UTC date string (with or without timezone indicator)
     * @param {string} s - Date string in format "YYYY-MM-DD", "YYYY-MM-DD HH:MM:SS", or ISO 8601
     * @returns {Date|null} - Parsed Date object or null if invalid
     */
    function parseUTCString(s) {
        if (!s) return null;

        // If string already contains a timezone designator (Z or ±HH[:MM]), use as-is
        if (/[Zz]$|[+\-]\d{2}:\d{2}$|[+\-]\d{4}$/.test(s)) {
            const d = new Date(s);
            return isNaN(d.getTime()) ? null : d;
        }

        // If it's a space-separated datetime, convert to ISO format
        const normalized = s.includes("T") ? s : s.replace(" ", "T");
        const d = new Date(normalized + "Z");
        return isNaN(d.getTime()) ? null : d;
    }

    /**
     * Get all Chicago timezone parts (year, month, day, hour, timezone name)
     * @param {Date} utcDate - UTC date object
     * @returns {Object} - { year, month, day, hour, timeZoneName }
     */
    function getChicagoParts(utcDate) {
        const parts = new Intl.DateTimeFormat("en-US", {
            timeZone: "America/Chicago",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            hour12: false,
            timeZoneName: "short"
        }).formatToParts(utcDate);

        const lookup = {};
        parts.forEach(part => {
            lookup[part.type] = part.value;
        });

        return {
            year: lookup.year,
            month: lookup.month,
            day: lookup.day,
            hour: lookup.hour === "24" ? "00" : lookup.hour,
            timeZoneName: lookup.timeZoneName
        };
    }

    /**
     * Extract Chicago date string (YYYY-MM-DD) from UTC string
     * @param {string} utcString - UTC date/time string
     * @returns {string|null} - Chicago date as "YYYY-MM-DD" or null if invalid
     */
    function getChicagoDateString(utcString) {
        if (!utcString) return null;

        const normalizedUTC = utcString.endsWith("Z") ? utcString : utcString + "Z";
        const utcDate = parseUTCString(normalizedUTC);

        if (!utcDate) return null;

        const chicagoParts = chicagoDateFormatter.formatToParts(utcDate);
        const y = chicagoParts.find(p => p.type === "year").value;
        const m = chicagoParts.find(p => p.type === "month").value.padStart(2, "0");
        const d = chicagoParts.find(p => p.type === "day").value.padStart(2, "0");

        return `${y}-${m}-${d}`;
    }

    /**
     * Format UTC string to Chicago timezone (human-readable)
     * Example: "Sep 15, 2025"
     * @param {string} utcString - UTC date/time string
     * @returns {string} - Formatted date string
     */
    function formatCentralDate(utcString) {
        const utcDate = parseUTCString(utcString + "Z");
        if (!utcDate) return "Invalid date";

        return utcDate.toLocaleDateString("en-US", {
            timeZone: "America/Chicago",
            year: "numeric",
            month: "long",
            day: "numeric"
        });
    }

    /**
     * Format UTC string to Chicago timezone with time
     * Example: "09:30:45 CDT"
     * @param {string} utcString - UTC date/time string
     * @returns {string} - Formatted datetime string
     */
    function formatCentralTime(utcString) {
        const d = parseUTCString(utcString + "Z");
        if (!d) return "";

        return d.toLocaleString("en-US", {
            timeZone: "America/Chicago",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            timeZoneName: "short"
        });
    }

    /**
     * Check if string is daily date format (YYYY-MM-DD)
     * @param {string} value - Date string to check
     * @returns {boolean}
     */
    function isDailyDate(value) {
        return /^\d{4}-\d{2}-\d{2}$/.test(value);
    }

    /**
     * Check if string is monthly format (YYYY-MM)
     * @param {string} value - Date string to check
     * @returns {boolean}
     */
    function isMonthlyDate(value) {
        return /^\d{4}-\d{2}$/.test(value);
    }

    /**
     * Convert date string to monthly key (YYYY-MM)
     * @param {string} value - Date string
     * @returns {string|null} - Monthly key or null if invalid
     */
    function toMonthKey(value) {
        if (!value || typeof value !== "string") return null;
        return isMonthlyDate(value) ? value : value.substring(0, 7);
    }

    /**
     * Convert date string to daily key (YYYY-MM-DD)
     * @param {string} value - Date string
     * @returns {string|null} - Daily key or null if invalid
     */
    function toDailyKey(value) {
        if (!value || typeof value !== "string") return null;
        return isDailyDate(value) ? value : null;
    }

    /**
     * Format month display (e.g., "September 2025")
     * @param {string} dateStr - Monthly key "YYYY-MM" or daily "YYYY-MM-DD"
     * @returns {string} - Formatted month string
     */
    function formatMonthForDisplay(dateStr) {
        if (!dateStr || typeof dateStr !== "string") {
            console.warn("formatMonthForDisplay received invalid date:", dateStr);
            return "Unknown Month";
        }

        const [year, month] = dateStr.substring(0, 7).split("-");
        return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString("en-US", {
            month: "long",
            year: "numeric"
        });
    }

    /**
     * Format daily date for display (e.g., "September 15, 2025")
     * @param {string} dateStr - Date string "YYYY-MM-DD"
     * @returns {string} - Formatted date string
     */
    function formatDailyForDisplay(dateStr) {
        if (!dateStr || typeof dateStr !== "string") {
            return "Invalid date";
        }

        if (isMonthlyDate(dateStr)) {
            return formatMonthForDisplay(dateStr);
        }

        const [year, month, day] = dateStr.split("-").map(Number);
        return new Date(year, month - 1, day).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric"
        });
    }

    /**
     * Universal date formatter (handles both monthly and daily formats)
     * @param {string} dateStr - Date string "YYYY-MM" or "YYYY-MM-DD"
     * @returns {string} - Formatted date string
     */
    function formatDateForDisplay(dateStr) {
        return isMonthlyDate(dateStr) 
            ? formatMonthForDisplay(dateStr) 
            : formatDailyForDisplay(dateStr);
    }

    /**
     * Format hour display with Chicago timezone awareness
     * Handles DST transitions (e.g., Nov 2, 2025 fallback)
     * @param {string} dateStr - Daily date string "YYYY-MM-DD"
     * @param {number} selectedHour - Hour (0-23)
     * @returns {string} - Formatted hour string (e.g., "2:30 PM CDT")
     */
    function formatHourForDisplay(dateStr, selectedHour) {
        if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
            return "";
        }

        // Special handling for DST transition dates
        // November 2, 2025: clocks fall back at 2 AM CDT → 1 AM CST
        if (dateStr === "2025-11-02") {
            const hourDisplays = {
                0: "12 AM CDT",
                1: "1 AM CDT / 1 AM CST",
                2: "2 AM CST"
            };

            if (hourDisplays[selectedHour]) {
                return hourDisplays[selectedHour];
            }
        }

        // Standard hour formatting
        const [year, month, day] = dateStr.split("-");
        const searchStart = parseUTCString(`${dateStr}T00:00:00Z`);
        searchStart.setUTCHours(searchStart.getUTCHours() - 12);

        // Search within a 48-hour window for the matching Chicago hour
        for (let i = 0; i < 48; i++) {
            const candidate = new Date(searchStart);
            candidate.setUTCHours(searchStart.getUTCHours() + i);

            const chicago = getChicagoParts(candidate);

            if (
                chicago.year === year &&
                chicago.month === month &&
                chicago.day === day &&
                chicago.hour === String(selectedHour).padStart(2, "0")
            ) {
                return candidate.toLocaleTimeString("en-US", {
                    timeZone: "America/Chicago",
                    hour: "numeric",
                    hour12: true,
                    timeZoneName: "short"
                });
            }
        }

        return `${selectedHour}:00 CT`;
    }

    /**
     * Get previous day from a date string
     * @param {string} dateStr - Date string "YYYY-MM-DD"
     * @returns {string} - Previous day as "YYYY-MM-DD"
     */
    function getPreviousDay(dateStr) {
        const d = parseUTCString(dateStr + "T00:00:00Z");
        d.setUTCDate(d.getUTCDate() - 1);
        return d.toISOString().split("T")[0];
    }

    /**
     * Extract Chicago date and hour from feature properties
     * @param {Object} properties - Feature properties with time/datetime field
     * @returns {Object|null} - { date: "YYYY-MM-DD", hour: 0-23 } or null if invalid
     */
    function extractChicagoDateHour(properties) {
        if (!properties) return null;

        const timeString = properties.time || properties.datetime || properties.datetime_local || properties.timestamp || "";
        if (!timeString) return null;

        // Normalize the time string
        let normalized = timeString;
        if (!normalized.includes("T")) {
            normalized = normalized.replace(" ", "T");
        }
        if (!normalized.endsWith("Z") && !/[+\-]\d{2}:\d{2}$|[+\-]\d{4}$/.test(normalized)) {
            normalized = normalized + "Z";
        }

        const utcDate = new Date(normalized);
        if (isNaN(utcDate.getTime())) {
            console.warn("Invalid date string:", timeString, normalized);
            return null;
        }

        try {
            const chicagoParts = chicagoDateFormatter.formatToParts(utcDate);
            const chicagoHourParts = chicagoHourFormatter.formatToParts(utcDate);

            const y = chicagoParts.find(p => p.type === "year")?.value;
            const m = chicagoParts.find(p => p.type === "month")?.value.padStart(2, "0");
            const d = chicagoParts.find(p => p.type === "day")?.value.padStart(2, "0");
            const hour = Number(chicagoHourParts.find(p => p.type === "hour")?.value);

            if (!y || !m || !d || isNaN(hour)) {
                console.warn("Failed to extract date parts:", { y, m, d, hour });
                return null;
            }

            return {
                date: `${y}-${m}-${d}`,
                hour: hour
            };
        } catch (err) {
            console.warn("Error extracting Chicago date/hour:", err, properties);
            return null;
        }
    }

    // Public API
    return {
        parseUTCString,
        getChicagoParts,
        getChicagoDateString,
        formatCentralDate,
        formatCentralTime,
        isDailyDate,
        isMonthlyDate,
        toMonthKey,
        toDailyKey,
        formatMonthForDisplay,
        formatDailyForDisplay,
        formatDateForDisplay,
        formatHourForDisplay,
        getPreviousDay,
        extractChicagoDateHour
    };
})();
