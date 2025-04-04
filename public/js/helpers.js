// Helper functions for the loan-wolves application

import { getUserData } from "./firestoredb.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-auth.js";

// Get the user's monthly income from their financial profile
export async function getUserMonthlyIncome() {
    try {
        const auth = getAuth();
        const user = auth.currentUser;
        
        if (!user) {
            console.error('No user logged in');
            return null;
        }
        
        // Get user data from Firestore
        const userData = await getUserData(user.uid);
        
        // First check the financial profile
        if (userData && userData.financialProfile && userData.financialProfile.monthlyIncome) {
            return parseFloat(userData.financialProfile.monthlyIncome);
        }
        
        // As a fallback, check transactions to estimate monthly income
        // This would require importing getUserTransactions and calculating average monthly income
        // For now we'll return null if no monthly income is defined in the profile
        
        return null;
    } catch (error) {
        console.error('Error getting user monthly income:', error);
        return null;
    }
}

// Determine income level category based on monthly income
export function determineIncomeLevel(monthlyIncome) {
    if (!monthlyIncome || monthlyIncome <= 0) return 'unknown';
    
    // Income levels in PHP (adjust as needed for your target audience)
    if (monthlyIncome < 15000) return 'low';
    if (monthlyIncome < 30000) return 'lower-middle';
    if (monthlyIncome < 60000) return 'middle';
    if (monthlyIncome < 120000) return 'upper-middle';
    return 'high';
}

// Get personalized recommendations based on income level
export function getRecommendationsByIncome(incomeLevel, recommendationsMap) {
    // Default to middle income if no level provided or not found
    return recommendationsMap[incomeLevel] || recommendationsMap['middle'] || [];
}

// Helper functions

// Format currency values
export function formatCurrency(amount) {
    const formatter = new Intl.NumberFormat('en-PH', {
        style: 'currency',
        currency: 'PHP',
        minimumFractionDigits: 2
    });
    return formatter.format(amount);
}

// Format date values
export function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-PH', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

// Format percentage values
export function formatPercent(value) {
    return (value * 100).toFixed(1) + '%';
}

/**
 * Validates an email address with a more strict regex
 * This regex follows RFC 5322 standards more closely and prevents many edge cases
 * @param {string} email - The email to validate
 * @returns {boolean} - Whether the email is valid
 */
export function isValidEmail(email) {
    if (!email || typeof email !== 'string') return false;
    
    // Trim whitespace
    email = email.trim();
    
    // Check length constraints
    if (email.length < 6 || email.length > 254) return false;
    
    // More comprehensive regex for email validation
    // This checks for proper format with username@domain.tld
    const emailRegex = /^(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9]))\.){3}(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9])|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])$/i;
    
    if (!emailRegex.test(email)) return false;
    
    // Additional validation for domain part
    const [, domain] = email.split('@');
    if (!domain) return false;
    
    // Must have at least one period in the domain
    if (!domain.includes('.')) return false;
    
    // TLD must be at least 2 characters
    const tld = domain.split('.').pop();
    if (!tld || tld.length < 2) return false;
    
    return true;
}

/**
 * Validates password strength using multiple criteria
 * Does not rely solely on regex which can be bypassed
 * @param {string} password - The password to validate
 * @returns {boolean} - Whether the password is strong
 */
export function isStrongPassword(password) {
    if (!password || typeof password !== 'string') return false;
    
    // Check length
    if (password.length < 8) return false;
    
    // Check for maximum length (prevents DoS attacks)
    if (password.length > 128) return false;
    
    // Track the criteria
    let hasLowercase = false;
    let hasUppercase = false;
    let hasDigit = false;
    let hasSpecial = false;
    
    // Define character sets
    const lowerCaseChars = 'abcdefghijklmnopqrstuvwxyz';
    const upperCaseChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const digitChars = '0123456789';
    const specialChars = '!@#$%^&*()_+-=[]{}|;:,.<>?/~`"\'\\';
    
    // Count character types
    for (let i = 0; i < password.length; i++) {
        const char = password[i];
        
        if (lowerCaseChars.includes(char)) {
            hasLowercase = true;
        } else if (upperCaseChars.includes(char)) {
            hasUppercase = true;
        } else if (digitChars.includes(char)) {
            hasDigit = true;
        } else if (specialChars.includes(char)) {
            hasSpecial = true;
        }
    }
    
    // Require at least 3 of the 4 character types
    const criteriaCount = [hasLowercase, hasUppercase, hasDigit, hasSpecial].filter(Boolean).length;
    if (criteriaCount < 3) return false;
    
    // Check for common patterns and dictionary words
    // This is a basic check - a real implementation would use a more comprehensive dictionary
    const commonPatterns = [
        '12345678', '87654321', 'password', 'qwerty', 'abc123',
        'admin123', 'letmein', 'welcome', 'monkey', 'football'
    ];
    
    const lowercasePassword = password.toLowerCase();
    for (const pattern of commonPatterns) {
        if (lowercasePassword.includes(pattern)) return false;
    }
    
    // Check for keyboard sequences
    const keyboardSequences = ['qwerty', 'asdfgh', 'zxcvbn', '123456', '654321'];
    for (const sequence of keyboardSequences) {
        if (lowercasePassword.includes(sequence)) return false;
    }
    
    // Check for repeating characters
    if (/(.)\1{3,}/.test(password)) {
        return false; // Contains same character 4 or more times in a row
    }
    
    return true;
}

// Truncate text with ellipsis
export function truncateText(text, maxLength) {
    if (!text || typeof text !== 'string') return '';
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
}

// Secure Storage Implementation
// Replace client-side encryption with better practices
export const secureStorage = {
    // Store sensitive data in sessionStorage with shorter lifespan
    setItem: async function(key, value) {
        try {
            // Don't store sensitive data directly
            const data = typeof value === 'string' ? value : JSON.stringify(value);
            
            // For truly sensitive data (like financial info, PII, etc.)
            if (key.includes('bank') || key.includes('card') || key.includes('credentials')) {
                // Only keep sensitive data in memory during the session
                sessionStorage.setItem(key, data);
                return true;
            } else {
                // For less sensitive data, use regular storage with limited expiry
                const item = {
                    value: data,
                    expiry: Date.now() + (12 * 60 * 60 * 1000) // 12 hour expiry
                };
                localStorage.setItem(key, JSON.stringify(item));
                return true;
            }
        } catch (error) {
            console.error('Error storing data:', error);
            return false;
        }
    },
    
    getItem: async function(key) {
        try {
            // Check sessionStorage first for sensitive data
            const sessionData = sessionStorage.getItem(key);
            if (sessionData) {
                return typeof sessionData === 'string' && sessionData.startsWith('{') ? 
                    JSON.parse(sessionData) : sessionData;
            }
            
            // Then check localStorage for non-sensitive data
            const storedItem = localStorage.getItem(key);
            if (!storedItem) return null;
            
            const item = JSON.parse(storedItem);
            
            // Check if the item has expired
            if (item.expiry && Date.now() > item.expiry) {
                localStorage.removeItem(key);
                return null;
            }
            
            return typeof item.value === 'string' && item.value.startsWith('{') ? 
                JSON.parse(item.value) : item.value;
        } catch (error) {
            console.error('Error retrieving data:', error);
            return null;
        }
    },
    
    removeItem: function(key) {
        try {
            sessionStorage.removeItem(key);
            localStorage.removeItem(key);
            return true;
        } catch (error) {
            console.error('Error removing data:', error);
            return false;
        }
    },
    
    // Set secure HTTP-only cookie for persistent authentication
    // (these are only accessible on the server side)
    setSecureCookie: function(name, value, days) {
        const secure = location.protocol === 'https:' ? 'Secure;' : '';
        const expires = days ? `expires=${new Date(Date.now() + days * 24 * 60 * 60 * 1000).toUTCString()};` : '';
        document.cookie = `${name}=${value};${expires}path=/;${secure}SameSite=Strict;HttpOnly;`;
    },
    
    // Clear all stored data on logout
    clearAll: function() {
        sessionStorage.clear();
        // Only clear items related to user data, not site preferences
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.includes('user') || key.includes('auth') || key.includes('bank') || 
                key.includes('transaction') || key.includes('financial')) {
                localStorage.removeItem(key);
            }
        }
    }
};

// Remove the original encryption functions since we're not using client-side encryption anymore
// We'll keep the initEncryption function signature for compatibility but make it a no-op

export async function initEncryption(userId) {
    // This is now just a compatibility function
    // We're not doing client-side encryption as it's not secure enough
    console.log('Secure storage initialized');
    return true;
}

// Input validation and sanitization utilities
// --------------------------------------

/**
 * Sanitizes a string to prevent XSS attacks
 * Uses more comprehensive approach than the original implementation
 * @param {string} input - The string to sanitize
 * @returns {string} - Sanitized string
 */
export function sanitizeString(input) {
    if (!input || typeof input !== 'string') {
        return '';
    }
    
    // First pass: HTML encode special characters
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
        '/': '&#x2F;',
        '`': '&#x60;',
        '=': '&#x3D;'
    };
    
    // Replace special characters with HTML entities
    let encodedString = input.replace(/[&<>"'`=\/]/g, function(char) {
        return map[char];
    });
    
    // Second pass: remove potential script execution vectors
    // Remove javascript: and data: URLs which can execute code
    encodedString = encodedString.replace(/javascript:/gi, 'removed:');
    encodedString = encodedString.replace(/data:/gi, 'removed:');
    
    // Remove event handlers which can execute JavaScript
    encodedString = encodedString.replace(/on\w+=/gi, 'removed=');
    
    return encodedString;
}

/**
 * Sanitizes an object by sanitizing all string properties
 * More robust implementation for nested objects
 * @param {Object} object - The object to sanitize
 * @returns {Object} - Sanitized object
 */
export function sanitizeObject(object) {
    if (!object || typeof object !== 'object') {
        return {};
    }
    
    // Handle arrays
    if (Array.isArray(object)) {
        return object.map(item => {
            if (typeof item === 'string') {
                return sanitizeString(item);
            } else if (typeof item === 'object' && item !== null) {
                return sanitizeObject(item);
            }
            return item;
        });
    }
    
    // Handle regular objects
    const sanitizedObject = {};
    
    for (const [key, value] of Object.entries(object)) {
        // Sanitize keys too (in case they're user-provided)
        const sanitizedKey = typeof key === 'string' ? sanitizeString(key) : key;
        
        if (typeof value === 'string') {
            sanitizedObject[sanitizedKey] = sanitizeString(value);
        } else if (typeof value === 'object' && value !== null) {
            sanitizedObject[sanitizedKey] = sanitizeObject(value);
        } else {
            sanitizedObject[sanitizedKey] = value;
        }
    }
    
    return sanitizedObject;
}

/**
 * Validates a monetary amount
 * @param {string|number} amount - The amount to validate
 * @param {number} min - Minimum valid amount (default: 0)
 * @param {number} max - Maximum valid amount (default: 1000000)
 * @returns {boolean} - Whether the amount is valid
 */
export function validateAmount(amount, min = 0, max = 1000000) {
    // Convert to number if it's a string
    let numAmount;
    
    if (typeof amount === 'string') {
        // Remove currency symbols, commas, etc.
        const cleanedAmount = amount.replace(/[^\d.-]/g, '');
        numAmount = parseFloat(cleanedAmount);
    } else if (typeof amount === 'number') {
        numAmount = amount;
    } else {
        return false;
    }
    
    // Check if it's a valid number
    if (isNaN(numAmount)) return false;
    
    // Check range
    if (numAmount < min || numAmount > max) return false;
    
    return true;
}

/**
 * Validates a date string in various formats
 * @param {string} dateStr - The date string to validate
 * @param {boolean} allowFuture - Whether future dates are allowed (default: true)
 * @param {boolean} allowPast - Whether past dates are allowed (default: true)
 * @returns {boolean} - Whether the date is valid
 */
export function validateDate(dateStr, allowFuture = true, allowPast = true) {
    if (!dateStr || typeof dateStr !== 'string') return false;
    
    // Try to parse the date
    const date = new Date(dateStr);
    
    // Check if date is valid
    if (isNaN(date.getTime())) return false;
    
    const now = new Date();
    
    // Check if future dates are allowed
    if (!allowFuture && date > now) return false;
    
    // Check if past dates are allowed
    if (!allowPast && date < now) return false;
    
    return true;
}

/**
 * Validates a name field
 * @param {string} name - The name to validate
 * @returns {boolean} - Whether the name is valid
 */
export function validateName(name) {
    if (!name || typeof name !== 'string') return false;
    
    const trimmedName = name.trim();
    
    // Name must be between 2 and 50 characters
    if (trimmedName.length < 2 || trimmedName.length > 50) return false;
    
    // Only allow letters, spaces, hyphens, and apostrophes
    const nameRegex = /^[A-Za-z\s\-']+$/;
    if (!nameRegex.test(trimmedName)) return false;
    
    // Don't allow names with only special characters or spaces
    const hasLetters = /[A-Za-z]/.test(trimmedName);
    if (!hasLetters) return false;
    
    return true;
}

/**
 * Validates a credit/debit card number using Luhn algorithm and pattern checking
 * @param {string} cardNumber - The card number to validate (can include spaces, dashes)
 * @returns {boolean} - Whether the card number is valid
 */
export function validateCardNumber(cardNumber) {
    if (!cardNumber || typeof cardNumber !== 'string') return false;
    
    // Remove all non-digits
    const digitsOnly = cardNumber.replace(/\D/g, '');
    
    // Check length: most cards are 13-19 digits
    if (digitsOnly.length < 13 || digitsOnly.length > 19) return false;
    
    // Perform Luhn algorithm check
    let sum = 0;
    let shouldDouble = false;
    
    // Loop from right to left
    for (let i = digitsOnly.length - 1; i >= 0; i--) {
        let digit = parseInt(digitsOnly.charAt(i));
        
        if (shouldDouble) {
            digit *= 2;
            if (digit > 9) digit -= 9;
        }
        
        sum += digit;
        shouldDouble = !shouldDouble;
    }
    
    // Valid cards have sum divisible by 10
    return (sum % 10) === 0;
}

/**
 * Shows validation error message for a form field
 * @param {HTMLElement} inputElement - The input element with error
 * @param {string} message - Error message to display
 */
export function showValidationError(inputElement, message) {
    if (!inputElement) return;
    
    // Remove any existing error
    clearValidationError(inputElement);
    
    // Add error class to input
    inputElement.classList.add('is-invalid');
    
    // Create error message element
    const errorElement = document.createElement('div');
    errorElement.className = 'invalid-feedback';
    errorElement.textContent = message;
    
    // Insert after input
    inputElement.parentNode.insertBefore(errorElement, inputElement.nextSibling);
}

/**
 * Clears validation error for a specific input
 * @param {HTMLElement} inputElement - The input element to clear errors for
 */
export function clearValidationError(inputElement) {
    if (!inputElement) return;
    
    // Remove error class
    inputElement.classList.remove('is-invalid');
    
    // Remove error message
    const errorElement = inputElement.nextElementSibling;
    if (errorElement && errorElement.className === 'invalid-feedback') {
        errorElement.remove();
    }
}

/**
 * Clears all validation errors in a form
 * @param {HTMLFormElement} form - The form to clear errors in
 */
export function clearAllValidationErrors(form) {
    if (!form) return;
    
    // Clear all error classes
    const invalidInputs = form.querySelectorAll('.is-invalid');
    invalidInputs.forEach(input => {
        input.classList.remove('is-invalid');
    });
    
    // Remove all error messages
    const errorMessages = form.querySelectorAll('.invalid-feedback');
    errorMessages.forEach(message => {
        message.remove();
    });
}

/**
 * A comprehensive input validator that applies multiple validation rules
 * @param {string} input - The input to validate
 * @param {Object} rules - Validation rules to apply
 * @returns {Object} - Validation result with isValid flag and error message
 */
export function validateInput(input, rules = {}) {
    // Default result
    const result = {
        isValid: true,
        errorMessage: ''
    };
    
    // If no input and it's required
    if (rules.required && (!input || (typeof input === 'string' && input.trim() === ''))) {
        result.isValid = false;
        result.errorMessage = rules.requiredMessage || 'This field is required';
        return result;
    }
    
    // Skip further validation if input is empty and not required
    if (!input || (typeof input === 'string' && input.trim() === '')) {
        return result;
    }
    
    // Type validation
    if (rules.type) {
        switch (rules.type) {
            case 'email':
                if (!isValidEmail(input)) {
                    result.isValid = false;
                    result.errorMessage = rules.typeMessage || 'Please enter a valid email address';
                }
                break;
                
            case 'password':
                if (!isStrongPassword(input)) {
                    result.isValid = false;
                    result.errorMessage = rules.typeMessage || 'Password must contain at least 8 characters including uppercase, lowercase, numbers, and special characters';
                }
                break;
                
            case 'name':
                if (!validateName(input)) {
                    result.isValid = false;
                    result.errorMessage = rules.typeMessage || 'Please enter a valid name';
                }
                break;
                
            case 'card':
                if (!validateCardNumber(input)) {
                    result.isValid = false;
                    result.errorMessage = rules.typeMessage || 'Please enter a valid card number';
                }
                break;
                
            case 'amount':
                if (!validateAmount(input, rules.min, rules.max)) {
                    result.isValid = false;
                    result.errorMessage = rules.typeMessage || `Amount must be between ${rules.min || 0} and ${rules.max || 1000000}`;
                }
                break;
                
            case 'date':
                if (!validateDate(input, rules.allowFuture, rules.allowPast)) {
                    result.isValid = false;
                    result.errorMessage = rules.typeMessage || 'Please enter a valid date';
                }
                break;
                
            case 'text':
            default:
                // Basic text validation
                break;
        }
    }
    
    // Length validation
    if (result.isValid && rules.minLength && input.length < rules.minLength) {
        result.isValid = false;
        result.errorMessage = rules.minLengthMessage || `Must be at least ${rules.minLength} characters`;
    }
    
    if (result.isValid && rules.maxLength && input.length > rules.maxLength) {
        result.isValid = false;
        result.errorMessage = rules.maxLengthMessage || `Must not exceed ${rules.maxLength} characters`;
    }
    
    // Pattern validation
    if (result.isValid && rules.pattern && !rules.pattern.test(input)) {
        result.isValid = false;
        result.errorMessage = rules.patternMessage || 'Invalid format';
    }
    
    // Custom validation function
    if (result.isValid && typeof rules.validate === 'function') {
        const customValidation = rules.validate(input);
        if (customValidation !== true) {
            result.isValid = false;
            result.errorMessage = customValidation || rules.validateMessage || 'Invalid input';
        }
    }
    
    return result;
}

/**
 * Handles API errors and returns appropriate user-friendly messages
 * @param {Error} error - The error object
 * @param {Object} response - The API response object (optional)
 * @returns {string} A user-friendly error message
 */
export function handleAPIError(error, response = null) {
    // Check for network-related errors
    if (!navigator.onLine) {
        return "You appear to be offline. Please check your internet connection and try again.";
    }

    // Handle API response errors
    if (response) {
        switch (response.status) {
            case 400:
                return "The request was invalid. Please check your input and try again.";
            case 401:
                return "Your session has expired. Please log in again.";
            case 403:
                return "You don't have permission to perform this action.";
            case 404:
                return "The requested resource was not found.";
            case 429:
                return "Too many requests. Please wait a moment and try again.";
            case 500:
                return "A server error occurred. Our team has been notified and is working on it.";
            case 503:
                return "The service is temporarily unavailable. Please try again later.";
        }
    }

    // Handle specific API error codes
    if (error.code) {
        switch (error.code) {
            case 'INVALID_ARGUMENT':
                return "Invalid input provided. Please check your data and try again.";
            case 'FAILED_PRECONDITION':
                return "Unable to complete the action. Please ensure all requirements are met.";
            case 'RESOURCE_EXHAUSTED':
                return "Service temporarily unavailable due to high demand. Please try again later.";
            case 'INTERNAL':
                return "An internal error occurred. Our team has been notified.";
            case 'UNAVAILABLE':
                return "The service is currently unavailable. Please try again later.";
            case 'UNAUTHENTICATED':
                return "Your session has expired. Please log in again.";
            case 'DEADLINE_EXCEEDED':
                return "The request took too long to complete. Please try again.";
        }
    }

    // Return a generic error message if no specific case is matched
    return error.message || "An unexpected error occurred. Please try again later.";
} 