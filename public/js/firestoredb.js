// Firebase Firestore utility functions
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, getDocs, collection, deleteDoc, updateDoc, query, where, limit, orderBy } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-storage.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-auth.js";
import { firebaseConfig } from "./config.js";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);
const auth = getAuth(app);

// Security helper functions
function getCurrentUserId() {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("User not authenticated");
  }
  return user.uid;
}

function validateUserAccess(requestUserId) {
  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error("No authenticated user found");
    }
    if (user.uid !== requestUserId) {
      throw new Error(`User ID mismatch: ${user.uid} vs ${requestUserId}`);
    }
    return true;
  } catch (error) {
    console.error('validateUserAccess error:', error);
    throw new Error('Access validation failed: ' + error.message);
  }
}

// Store user data in Firestore
export async function storeUserData(userId, userData) {
  try {
    // Validate user is authorized to modify this data
    validateUserAccess(userId);
    
    // Adding additional fields if they don't exist
    const defaultData = {
      accountStatus: userData.accountStatus || 'active',
      lastLogin: userData.lastLogin || new Date().toISOString(),
      securityLevel: userData.securityLevel || 'standard',
      hasPassword: userData.hasPassword || false,
      preferences: userData.preferences || {
        notifications: true,
        twoFactorAuth: false,
        theme: 'dark'
      },
      financialProfile: userData.financialProfile || {
        accountType: 'personal',
        creditScore: null,
        riskProfile: null,
        employmentStatus: null,
        monthlyIncome: null,
        employmentHistory: [],
        documents: {}
      }
    };

    // Merge default data with provided userData
    const enrichedUserData = { ...userData, ...defaultData };
    
    // Add userId to data for security verification in rules
    enrichedUserData.userId = userId;
    
    await setDoc(doc(db, "users", userId), enrichedUserData);
    console.log("User data stored in Firestore!");
    return true;
  } catch (error) {
    console.error("Error storing user data in Firestore: ", error);
    return false;
  }
}

// Retrieve user data from Firestore
export async function getUserData(userId) {
  try {
    // Validate user is authorized to access this data
    validateUserAccess(userId);
    
    const docRef = doc(db, "users", userId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      console.log("User data retrieved from Firestore");
      return docSnap.data();
    } else {
      console.log("No user data found in Firestore");
      return null;
    }
  } catch (error) {
    console.error("Error retrieving user data from Firestore: ", error);
    return null;
  }
}

// Add a new function to update password status
export async function updatePasswordStatus(userId, hasPassword) {
    try {
        // Validate user is authorized to modify this data
        validateUserAccess(userId);
        
        await setDoc(doc(db, "users", userId), { 
            hasPassword,
            userId // Include userId for security rule validation
        }, { merge: true });
        return true;
    } catch (error) {
        console.error("Error updating password status: ", error);
        return false;
    }
}

// Store transaction in Firestore
export async function storeTransaction(userId, transactionData) {
    try {
        // Validate user is authorized to modify this data
        validateUserAccess(userId);
        
        const docRef = doc(db, "users", userId, "transactions", transactionData.id);
        
        // Add userId to transaction data for security rule validation
        const securedTransactionData = {
            ...transactionData,
            userId,
            timestamp: new Date().toISOString()
        };
        
        await setDoc(docRef, securedTransactionData);
        console.log("Transaction stored in Firestore!");
        return true;
    } catch (error) {
        console.error("Error storing transaction: ", error);
        return false;
    }
}

// Get all transactions for a user
export async function getUserTransactions(userId) {
    try {
        // Validate user is authorized to access this data
        validateUserAccess(userId);
        
        const transactions = [];
        const transactionsQuery = query(
            collection(db, "users", userId, "transactions"),
            orderBy("timestamp", "desc")
        );
        
        const querySnapshot = await getDocs(transactionsQuery);
        querySnapshot.forEach((doc) => {
            transactions.push({ id: doc.id, ...doc.data() });
        });
        return transactions;
    } catch (error) {
        console.error("Error getting transactions: ", error);
        return [];
    }
}

// Update transaction
export async function updateTransaction(userId, transactionId, updatedData) {
    try {
        // Validate user is authorized to modify this data
        validateUserAccess(userId);
        
        // Ensure userId is included in updated data for security rule validation
        updatedData.userId = userId;
        
        const docRef = doc(db, "users", userId, "transactions", transactionId);
        await setDoc(docRef, updatedData, { merge: true });
        return true;
    } catch (error) {
        console.error("Error updating transaction: ", error);
        return false;
    }
}

// Delete transaction
export async function deleteTransaction(userId, transactionId) {
    try {
        // Validate user is authorized to modify this data
        validateUserAccess(userId);
        
        const docRef = doc(db, "users", userId, "transactions", transactionId);
        await deleteDoc(docRef);
        console.log("Transaction deleted successfully!");
        return true;
    } catch (error) {
        console.error("Error deleting transaction:", error);
        return false;
    }
}

// Store bank account in Firestore
export async function storeBankAccount(userId, accountData) {
    try {
        console.log('Starting storeBankAccount with userId:', userId);
        console.log('Account data to store:', accountData);
        
        // Validate user is authorized to modify this data
        try {
            validateUserAccess(userId);
        } catch (authError) {
            console.error('Authorization error:', authError);
            throw new Error('Authorization failed: ' + authError.message);
        }
        
        // Ensure balance is a number
        const balance = parseFloat(accountData.balance);
        if (isNaN(balance)) {
            throw new Error('Invalid balance amount: must be a valid number');
        }
        
        // Create a reference to the bank account document
        const docRef = doc(db, "users", userId, "bankAccounts", accountData.id);
        console.log('Document reference created for path:', docRef.path);
        
        // Add userId and ensure balance is a number
        const securedAccountData = {
            ...accountData,
            userId,
            balance: balance,
            timestamp: new Date().toISOString()
        };
        
        console.log('Attempting to store secured account data:', securedAccountData);
        
        // Use setDoc to create/update the document
        try {
            await setDoc(docRef, securedAccountData);
            console.log('Account successfully stored in Firestore at path:', docRef.path);
            return true;
        } catch (firestoreError) {
            console.error('Firestore setDoc error:', firestoreError);
            throw new Error('Failed to save to Firestore: ' + firestoreError.message);
        }
    } catch (error) {
        console.error('Error in storeBankAccount:', error);
        throw error; // Re-throw to handle in the calling function
    }
}

// Get all bank accounts for a user
export async function getUserBankAccounts(userId) {
    try {
        console.log('Starting getUserBankAccounts for userId:', userId);
        
        // Validate user is authorized to access this data
        try {
            validateUserAccess(userId);
        } catch (authError) {
            console.error('Authorization error:', authError);
            throw new Error('Authorization failed: ' + authError.message);
        }
        
        const accounts = [];
        // Query the bankAccounts subcollection
        const accountsQuery = query(
            collection(db, "users", userId, "bankAccounts"),
            orderBy("timestamp", "desc")
        );
        
        console.log('Querying accounts from path:', `users/${userId}/bankAccounts`);
        
        try {
            const querySnapshot = await getDocs(accountsQuery);
            console.log('Query snapshot size:', querySnapshot.size);
            
            querySnapshot.forEach((doc) => {
                // Ensure balance is a number
                const data = doc.data();
                data.balance = parseFloat(data.balance) || 0;
                accounts.push({ id: doc.id, ...data });
            });
            
            console.log('Retrieved accounts:', accounts);
            return accounts;
        } catch (queryError) {
            console.error('Error querying accounts:', queryError);
            throw new Error('Failed to query accounts: ' + queryError.message);
        }
    } catch (error) {
        console.error('Error in getUserBankAccounts:', error);
        throw error; // Re-throw to handle in the calling function
    }
}

// Update bank account in Firestore
export async function updateBankAccount(userId, accountId, updatedData) {
    try {
        // Validate user is authorized to modify this data
        validateUserAccess(userId);
        
        // Ensure userId is included in updated data for security rule validation
        updatedData.userId = userId;
        
        const accountRef = doc(db, "users", userId, "bankAccounts", accountId);
        await updateDoc(accountRef, updatedData);
        console.log("Bank account updated in Firestore!");
        return true;
    } catch (error) {
        console.error("Error updating bank account:", error);
        return false;
    }
}

// NEW FUNCTIONS FOR FINANCIAL INFORMATION MANAGEMENT

// Update financial profile information
export async function updateFinancialProfile(userId, financialData) {
    try {
        // Validate user is authorized to modify this data
        validateUserAccess(userId);
        
        const userRef = doc(db, "users", userId);
        await updateDoc(userRef, {
            'financialProfile': {
                ...financialData,
                lastUpdated: new Date().toISOString()
            },
            'userId': userId // Include userId for security rule validation
        });
        console.log("Financial profile updated successfully!");
        return true;
    } catch (error) {
        console.error("Error updating financial profile:", error);
        return false;
    }
}

// Upload financial document (ID, proof of income, etc.)
export async function uploadFinancialDocument(userId, file, documentType) {
    try {
        // Generate a unique filename
        const timestamp = new Date().getTime();
        const fileExtension = file.name.split('.').pop();
        const fileName = `${userId}_${documentType}_${timestamp}.${fileExtension}`;
        
        // Create a reference to the file location
        const storageRef = ref(storage, `financial_documents/${userId}/${fileName}`);
        
        // Upload the file
        await uploadBytes(storageRef, file);
        
        // Get the download URL
        const downloadURL = await getDownloadURL(storageRef);
        
        // Store document metadata in Firestore
        const documentData = {
            id: `${documentType}_${timestamp}`,
            type: documentType,
            fileName: fileName,
            uploadDate: new Date().toISOString(),
            url: downloadURL,
            status: 'pending', // pending, verified, rejected
            verifiedBy: null,
            verificationDate: null,
            notes: null
        };
        
        // Update user's financial profile with the new document
        const userRef = doc(db, "users", userId);
        const userDoc = await getDoc(userRef);
        
        if (userDoc.exists()) {
            const userData = userDoc.data();
            const financialProfile = userData.financialProfile || {};
            const documents = financialProfile.documents || {};
            
            // Add the new document
            documents[documentType] = documentData;
            
            // Update the user document
            await updateDoc(userRef, {
                'financialProfile.documents': documents
            });
            
            console.log(`Financial document ${documentType} uploaded successfully!`);
            return documentData;
        } else {
            throw new Error("User document not found");
        }
    } catch (error) {
        console.error(`Error uploading financial document ${documentType}:`, error);
        return null;
    }
}

// Delete financial document
export async function deleteFinancialDocument(userId, documentType) {
    try {
        // Get user data to find the document
        const userRef = doc(db, "users", userId);
        const userDoc = await getDoc(userRef);
        
        if (userDoc.exists()) {
            const userData = userDoc.data();
            const financialProfile = userData.financialProfile || {};
            const documents = financialProfile.documents || {};
            
            // Check if the document exists
            if (documents[documentType]) {
                const document = documents[documentType];
                
                // Delete from Storage
                const storageRef = ref(storage, `financial_documents/${userId}/${document.fileName}`);
                await deleteObject(storageRef);
                
                // Remove from Firestore
                delete documents[documentType];
                
                // Update the user document
                await updateDoc(userRef, {
                    'financialProfile.documents': documents
                });
                
                console.log(`Financial document ${documentType} deleted successfully!`);
                return true;
            } else {
                console.log(`No document of type ${documentType} found`);
                return false;
            }
        } else {
            throw new Error("User document not found");
        }
    } catch (error) {
        console.error(`Error deleting financial document ${documentType}:`, error);
        return false;
    }
}

// Add employment history
export async function addEmploymentHistory(userId, employmentData) {
    try {
        const userRef = doc(db, "users", userId);
        const userDoc = await getDoc(userRef);
        
        if (userDoc.exists()) {
            const userData = userDoc.data();
            const financialProfile = userData.financialProfile || {};
            const employmentHistory = financialProfile.employmentHistory || [];
            
            // Add new employment record
            employmentHistory.push({
                ...employmentData,
                id: `emp_${Date.now()}`,
                addedDate: new Date().toISOString()
            });
            
            // Update the user document
            await updateDoc(userRef, {
                'financialProfile.employmentHistory': employmentHistory
            });
            
            console.log("Employment history added successfully!");
            return true;
        } else {
            throw new Error("User document not found");
        }
    } catch (error) {
        console.error("Error adding employment history:", error);
        return false;
    }
}

// Update employment history
export async function updateEmploymentHistory(userId, employmentId, updatedData) {
    try {
        const userRef = doc(db, "users", userId);
        const userDoc = await getDoc(userRef);
        
        if (userDoc.exists()) {
            const userData = userDoc.data();
            const financialProfile = userData.financialProfile || {};
            const employmentHistory = financialProfile.employmentHistory || [];
            
            // Find and update the employment record
            const index = employmentHistory.findIndex(emp => emp.id === employmentId);
            if (index !== -1) {
                employmentHistory[index] = {
                    ...employmentHistory[index],
                    ...updatedData,
                    lastUpdated: new Date().toISOString()
                };
                
                // Update the user document
                await updateDoc(userRef, {
                    'financialProfile.employmentHistory': employmentHistory
                });
                
                console.log("Employment history updated successfully!");
                return true;
            } else {
                console.log(`Employment record with ID ${employmentId} not found`);
                return false;
            }
        } else {
            throw new Error("User document not found");
        }
    } catch (error) {
        console.error("Error updating employment history:", error);
        return false;
    }
}

// Delete employment history
export async function deleteEmploymentHistory(userId, employmentId) {
    try {
        const userRef = doc(db, "users", userId);
        const userDoc = await getDoc(userRef);
        
        if (userDoc.exists()) {
            const userData = userDoc.data();
            const financialProfile = userData.financialProfile || {};
            const employmentHistory = financialProfile.employmentHistory || [];
            
            // Filter out the employment record
            const updatedHistory = employmentHistory.filter(emp => emp.id !== employmentId);
            
            // Update the user document
            await updateDoc(userRef, {
                'financialProfile.employmentHistory': updatedHistory
            });
            
            console.log("Employment history deleted successfully!");
            return true;
        } else {
            throw new Error("User document not found");
        }
    } catch (error) {
        console.error("Error deleting employment history:", error);
        return false;
    }
}

// Record login activity
export async function recordLoginActivity(userId, loginData) {
    try {
        // Generate a unique ID for this login record
        const loginId = `login_${Date.now()}`;
        
        // Store login data in a subcollection
        await setDoc(doc(db, "users", userId, "loginActivity", loginId), loginData);
        
        // Update user's last login timestamp
        await updateDoc(doc(db, "users", userId), {
            lastLogin: loginData.timestamp
        });
        
        console.log("Login activity recorded");
        return true;
    } catch (error) {
        console.error("Error recording login activity:", error);
        return false;
    }
}

// Get login history for a user
export async function getLoginHistory(userId) {
    try {
        const loginLogs = [];
        const querySnapshot = await getDocs(collection(db, "users", userId, "loginActivity"));
        
        querySnapshot.forEach((doc) => {
            loginLogs.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        // Sort by timestamp, most recent first
        loginLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        return loginLogs;
    } catch (error) {
        console.error("Error getting login history:", error);
        return [];
    }
}

// Record failed login attempt and implement rate limiting
export async function recordFailedLoginAttempt(email) {
    try {
        // Create a hash of the email to use as ID (for security)
        const emailHash = await hashString(email);
        const failedLoginRef = doc(db, "failedLogins", emailHash);
        
        // Get current failed attempts if they exist
        const failedLoginDoc = await getDoc(failedLoginRef);
        
        const now = new Date();
        const currentTime = now.getTime();
        
        if (failedLoginDoc.exists()) {
            const data = failedLoginDoc.data();
            // Reset counter if last attempt was more than 30 minutes ago
            const timeSinceLastAttempt = currentTime - data.lastAttemptTime;
            const resetTimeInMs = 30 * 60 * 1000; // 30 minutes
            
            if (timeSinceLastAttempt > resetTimeInMs) {
                // Reset counter if it's been more than 30 minutes
                await setDoc(failedLoginRef, {
                    count: 1,
                    lastAttemptTime: currentTime,
                    lockedUntil: null
                });
            } else {
                // Increment counter and check if account should be locked
                const newCount = data.count + 1;
                const maxAttempts = 5; // Lock after 5 failed attempts
                const lockDurationInMs = 15 * 60 * 1000; // 15 minutes
                
                const lockedUntil = newCount >= maxAttempts ? currentTime + lockDurationInMs : null;
                
                await setDoc(failedLoginRef, {
                    count: newCount,
                    lastAttemptTime: currentTime,
                    lockedUntil: lockedUntil
                });
            }
        } else {
            // First failed attempt
            await setDoc(failedLoginRef, {
                count: 1,
                lastAttemptTime: currentTime,
                lockedUntil: null
            });
        }
        
        return true;
    } catch (error) {
        console.error("Error recording failed login attempt:", error);
        return false;
    }
}

// Check if login is allowed or if account is locked
export async function checkLoginStatus(email) {
    try {
        const emailHash = await hashString(email);
        const failedLoginRef = doc(db, "failedLogins", emailHash);
        const failedLoginDoc = await getDoc(failedLoginRef);
        
        if (failedLoginDoc.exists()) {
            const data = failedLoginDoc.data();
            const currentTime = new Date().getTime();
            
            // If account is locked and lock time hasn't expired
            if (data.lockedUntil && currentTime < data.lockedUntil) {
                // Calculate remaining lock time in minutes
                const remainingTimeInMs = data.lockedUntil - currentTime;
                const remainingMinutes = Math.ceil(remainingTimeInMs / (60 * 1000));
                
                return {
                    allowed: false,
                    lockedUntil: data.lockedUntil,
                    remainingMinutes,
                    attemptsCount: data.count
                };
            }
            
            // Account not locked or lock time expired
            return {
                allowed: true,
                attemptsCount: data.count
            };
        }
        
        // No records found, login allowed
        return { allowed: true, attemptsCount: 0 };
    } catch (error) {
        console.error("Error checking login status:", error);
        // Default to allowing login if there's an error checking status
        return { allowed: true, attemptsCount: 0 };
    }
}

// Helper function to hash email for privacy
async function hashString(str) {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Reset failed login attempts after successful login
export async function resetFailedLoginAttempts(email) {
    try {
        const emailHash = await hashString(email);
        const failedLoginRef = doc(db, "failedLogins", emailHash);
        
        await setDoc(failedLoginRef, {
            count: 0,
            lastAttemptTime: new Date().getTime(),
            lockedUntil: null
        });
        
        return true;
    } catch (error) {
        console.error("Error resetting failed login attempts:", error);
        return false;
    }
}

// Export these Firestore functions to be used in dashboard.js
export { doc, setDoc, getDocs, collection, deleteDoc, db, updateDoc };
