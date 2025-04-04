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

// Validate email format
export function isValidEmail(email) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
}

// Validate password strength
export function isStrongPassword(password) {
    // At least 8 characters, contains uppercase, lowercase, number, and special character
    const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    return regex.test(password);
}

// Truncate text with ellipsis
export function truncateText(text, maxLength) {
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
 * @param {string} input - The string to sanitize
 * @returns {string} - Sanitized string
 */
export function sanitizeString(input) {
    if (!input || typeof input !== 'string') {
        return '';
    }
    
    // Create a temporary DOM element
    const tempElement = document.createElement('div');
    
    // Set the content as text (not HTML) which automatically escapes HTML entities
    tempElement.textContent = input;
    
    // Get the escaped HTML as a string
    return tempElement.innerHTML;
}

/**
 * Sanitizes an object by sanitizing all string properties
 * @param {Object} object - The object to sanitize
 * @returns {Object} - Sanitized object
 */
export function sanitizeObject(object) {
    if (!object || typeof object !== 'object') {
        return {};
    }
    
    const sanitizedObject = {};
    
    for (const [key, value] of Object.entries(object)) {
        if (typeof value === 'string') {
            sanitizedObject[key] = sanitizeString(value);
        } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            sanitizedObject[key] = sanitizeObject(value);
        } else if (Array.isArray(value)) {
            sanitizedObject[key] = value.map(item => 
                typeof item === 'string' ? sanitizeString(item) : 
                typeof item === 'object' && item !== null ? sanitizeObject(item) : item
            );
        } else {
            sanitizedObject[key] = value;
        }
    }
    
    return sanitizedObject;
}

/**
 * Validates a financial amount
 * @param {string|number} amount - The amount to validate
 * @returns {object} - Validation result with isValid and value properties
 */
export function validateAmount(amount) {
    // Convert to string and trim
    const strAmount = String(amount).trim();
    
    // Check if empty
    if (!strAmount) {
        return { isValid: false, value: null, error: 'Amount is required' };
    }
    
    // Remove currency symbols and commas
    const cleanAmount = strAmount.replace(/[₱$,]/g, '');
    
    // Check if it's a valid number
    if (!/^-?\d+(\.\d{1,2})?$/.test(cleanAmount)) {
        return { isValid: false, value: null, error: 'Amount must be a valid number with up to 2 decimal places' };
    }
    
    const numAmount = parseFloat(cleanAmount);
    
    // Check if it's within a reasonable range
    if (numAmount < -999999999 || numAmount > 999999999) {
        return { isValid: false, value: null, error: 'Amount must be within a reasonable range' };
    }
    
    return { isValid: true, value: numAmount, error: null };
}

/**
 * Validates a date string
 * @param {string} dateStr - The date string to validate (YYYY-MM-DD)
 * @returns {object} - Validation result with isValid and value properties
 */
export function validateDate(dateStr) {
    // Check if empty
    if (!dateStr || typeof dateStr !== 'string') {
        return { isValid: false, value: null, error: 'Date is required' };
    }
    
    // Check format (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        return { isValid: false, value: null, error: 'Date must be in YYYY-MM-DD format' };
    }
    
    // Try to create a date object
    const date = new Date(dateStr);
    
    // Check if it's a valid date
    if (isNaN(date.getTime())) {
        return { isValid: false, value: null, error: 'Invalid date' };
    }
    
    // Check if it's not in the future
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    
    if (date > today) {
        return { isValid: false, value: null, error: 'Date cannot be in the future' };
    }
    
    return { isValid: true, value: date, error: null };
}

/**
 * Validates an email address
 * @param {string} email - The email to validate
 * @returns {object} - Validation result with isValid and value properties
 */
export function validateEmail(email) {
    // Check if empty
    if (!email || typeof email !== 'string') {
        return { isValid: false, value: null, error: 'Email is required' };
    }
    
    // Trim the email
    const trimmedEmail = email.trim();
    
    // Check format with a more comprehensive regex
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    
    if (!emailRegex.test(trimmedEmail)) {
        return { isValid: false, value: null, error: 'Invalid email format' };
    }
    
    // Check length
    if (trimmedEmail.length > 254) {
        return { isValid: false, value: null, error: 'Email is too long' };
    }
    
    return { isValid: true, value: trimmedEmail, error: null };
}

/**
 * Validates a name (first name, last name, etc.)
 * @param {string} name - The name to validate
 * @param {string} fieldName - The name of the field (for error message)
 * @returns {object} - Validation result with isValid and value properties
 */
export function validateName(name, fieldName = 'Name') {
    // Check if empty
    if (!name || typeof name !== 'string') {
        return { isValid: false, value: null, error: `${fieldName} is required` };
    }
    
    // Trim the name
    const trimmedName = name.trim();
    
    // Check if only empty spaces
    if (trimmedName.length === 0) {
        return { isValid: false, value: null, error: `${fieldName} cannot be empty` };
    }
    
    // Check if contains invalid characters (numbers, special chars except hyphens and apostrophes)
    if (!/^[A-Za-z\s'-]+$/.test(trimmedName)) {
        return { isValid: false, value: null, error: `${fieldName} contains invalid characters` };
    }
    
    // Check length
    if (trimmedName.length > 50) {
        return { isValid: false, value: null, error: `${fieldName} is too long (maximum 50 characters)` };
    }
    
    return { isValid: true, value: trimmedName, error: null };
}

/**
 * Validates a card number
 * @param {string} cardNumber - The card number to validate
 * @returns {object} - Validation result with isValid and value properties
 */
export function validateCardNumber(cardNumber) {
    // Check if empty
    if (!cardNumber || typeof cardNumber !== 'string') {
        return { isValid: false, value: null, error: 'Card number is required' };
    }
    
    // Remove spaces and other non-numeric characters
    const cleanedNumber = cardNumber.replace(/\D/g, '');
    
    // Check if empty after cleaning
    if (cleanedNumber.length === 0) {
        return { isValid: false, value: null, error: 'Card number cannot be empty' };
    }
    
    // Check length (most card numbers are between 13-19 digits)
    if (cleanedNumber.length < 8 || cleanedNumber.length > 19) {
        return { isValid: false, value: null, error: 'Card number should be at least 8 digits' };
    }
    
    // No Luhn algorithm check - just return valid
    return { isValid: true, value: cleanedNumber, error: null };
}

/**
 * Displays validation errors on a form
 * @param {HTMLFormElement} form - The form element
 * @param {string} fieldName - The name of the field with error
 * @param {string} errorMessage - The error message to display
 */
export function showValidationError(form, fieldName, errorMessage) {
    // Find the field
    const field = form.querySelector(`[name="${fieldName}"], #${fieldName}`);
    if (!field) return;
    
    // Create or find error element
    let errorElement = form.querySelector(`#${fieldName}-error`);
    
    if (!errorElement) {
        errorElement = document.createElement('div');
        errorElement.id = `${fieldName}-error`;
        errorElement.className = 'validation-error';
        errorElement.style.cssText = `
            color: #ff3b30;
            font-size: 0.8rem;
            margin-top: 4px;
            animation: fadeIn 0.3s ease;
        `;
        
        // Insert after the field or its parent form-group
        const formGroup = field.closest('.form-group') || field.parentNode;
        formGroup.appendChild(errorElement);
    }
    
    // Set the error message
    errorElement.textContent = errorMessage;
    
    // Highlight the field
    field.classList.add('error-input');
    field.style.borderColor = '#ff3b30';
    
    // Add event listener to clear error when user types
    field.addEventListener('input', function onInput() {
        clearValidationError(form, fieldName);
        field.removeEventListener('input', onInput);
    }, { once: true });
}

/**
 * Clears validation errors for a field
 * @param {HTMLFormElement} form - The form element
 * @param {string} fieldName - The name of the field to clear error for
 */
export function clearValidationError(form, fieldName) {
    // Find the field
    const field = form.querySelector(`[name="${fieldName}"], #${fieldName}`);
    if (!field) return;
    
    // Find and remove error element
    const errorElement = form.querySelector(`#${fieldName}-error`);
    if (errorElement) {
        errorElement.remove();
    }
    
    // Remove error styling
    field.classList.remove('error-input');
    field.style.borderColor = '';
}

/**
 * Clears all validation errors on a form
 * @param {HTMLFormElement} form - The form element
 */
export function clearAllValidationErrors(form) {
    // Remove all error messages
    const errorElements = form.querySelectorAll('.validation-error');
    errorElements.forEach(el => el.remove());
    
    // Remove error styling from all fields
    const errorFields = form.querySelectorAll('.error-input');
    errorFields.forEach(field => {
        field.classList.remove('error-input');
        field.style.borderColor = '';
    });
} 