// Login Tracking Diagnostics
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-auth.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, getDocs, collection, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-firestore.js";
import { firebaseConfig } from "./config.js";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

document.addEventListener('DOMContentLoaded', function() {
    const statusDisplay = document.getElementById('status-display');
    const userInfoDisplay = document.getElementById('user-info');
    const loginLogsDisplay = document.getElementById('login-logs');
    const manualLogBtn = document.getElementById('manual-log-btn');
    const refreshBtn = document.getElementById('refresh-btn');
    
    if (!statusDisplay || !userInfoDisplay || !loginLogsDisplay) {
        console.error("Required elements not found in the DOM");
        return;
    }
    
    // Show loading state
    statusDisplay.innerHTML = `
        <div class="loading">
            <div class="spinner"></div>
            <p>Checking authentication status...</p>
        </div>
    `;
    
    // Listen for auth state changes
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // User is signed in
            statusDisplay.innerHTML = `
                <div class="success">
                    <i class="fas fa-check-circle"></i>
                    <p>User is authenticated</p>
                </div>
            `;
            
            // Display user info
            userInfoDisplay.innerHTML = `
                <div class="user-info-card">
                    <div class="user-header">
                        <h3>User Information</h3>
                    </div>
                    <div class="user-details">
                        <p><strong>UID:</strong> ${user.uid}</p>
                        <p><strong>Email:</strong> ${user.email}</p>
                        <p><strong>Display Name:</strong> ${user.displayName || 'N/A'}</p>
                        <p><strong>Provider:</strong> ${user.providerData[0]?.providerId || 'N/A'}</p>
                        <p><strong>Created:</strong> ${new Date(user.metadata.creationTime).toLocaleString()}</p>
                        <p><strong>Last Sign In:</strong> ${new Date(user.metadata.lastSignInTime).toLocaleString()}</p>
                    </div>
                </div>
            `;
            
            // Fetch and display login logs
            fetchLoginLogs(user.uid);
            
            // Setup manual log button
            if (manualLogBtn) {
                manualLogBtn.addEventListener('click', async () => {
                    await createManualLoginLog(user.uid);
                    fetchLoginLogs(user.uid);
                });
            }
            
            // Setup refresh button
            if (refreshBtn) {
                refreshBtn.addEventListener('click', () => {
                    fetchLoginLogs(user.uid);
                });
            }
            
        } else {
            // User is signed out
            statusDisplay.innerHTML = `
                <div class="error">
                    <i class="fas fa-exclamation-circle"></i>
                    <p>User is not authenticated. Please <a href="login.html">log in</a> first.</p>
                </div>
            `;
            
            userInfoDisplay.innerHTML = '';
            loginLogsDisplay.innerHTML = '';
        }
    });
});

// Fetch login logs from Firestore
async function fetchLoginLogs(userId) {
    const loginLogsDisplay = document.getElementById('login-logs');
    
    loginLogsDisplay.innerHTML = `
        <div class="loading">
            <div class="spinner"></div>
            <p>Fetching login logs...</p>
        </div>
    `;
    
    try {
        // First, try to get login logs from loginActivity subcollection
        const loginCollection = collection(db, "users", userId, "loginActivity");
        const loginQuery = query(loginCollection, orderBy("timestamp", "desc"), limit(20));
        const loginSnapshot = await getDocs(loginQuery);
        
        // Check if we have logs
        if (loginSnapshot.empty) {
            // Try to check if structure is users > userId > logins instead
            const altLoginCollection = collection(db, "users", userId, "logins");
            const altLoginQuery = query(altLoginCollection, orderBy("timestamp", "desc"), limit(20));
            const altLoginSnapshot = await getDocs(altLoginQuery);
            
            if (altLoginSnapshot.empty) {
                loginLogsDisplay.innerHTML = `
                    <div class="warning">
                        <i class="fas fa-exclamation-triangle"></i>
                        <p>No login logs found in any expected collection. The login tracking system might not be properly configured.</p>
                    </div>
                `;
                return;
            }
            
            // Display logs from alternate collection
            displayLogs(altLoginSnapshot.docs.map(doc => ({id: doc.id, ...doc.data()})), loginLogsDisplay, "Logs from 'logins' collection:");
        } else {
            // Display logs from primary collection
            displayLogs(loginSnapshot.docs.map(doc => ({id: doc.id, ...doc.data()})), loginLogsDisplay, "Logs from 'loginActivity' collection:");
        }
        
    } catch (error) {
        console.error("Error fetching login logs:", error);
        loginLogsDisplay.innerHTML = `
            <div class="error">
                <i class="fas fa-times-circle"></i>
                <p>Error fetching login logs: ${error.message}</p>
            </div>
        `;
    }
}

// Display logs in the UI
function displayLogs(logs, container, title) {
    if (logs.length === 0) {
        container.innerHTML = `
            <div class="warning">
                <i class="fas fa-exclamation-triangle"></i>
                <p>No login logs found.</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = `
        <div class="logs-container">
            <h3>${title}</h3>
            <table class="logs-table">
                <thead>
                    <tr>
                        <th>Timestamp</th>
                        <th>Method</th>
                        <th>Location</th>
                        <th>Device</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${logs.map(log => `
                        <tr>
                            <td>${new Date(log.timestamp).toLocaleString()}</td>
                            <td>${log.method || 'N/A'}</td>
                            <td>${formatLocation(log.location)}</td>
                            <td>${formatDevice(log.deviceInfo)}</td>
                            <td>${log.successful ? 
                                '<span class="success-badge">Success</span>' : 
                                '<span class="error-badge">Failed</span>'}
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            <div class="log-info">
                <p>${logs.length} login records found</p>
            </div>
        </div>
    `;
}

// Format location for display
function formatLocation(location) {
    if (!location) return 'Unknown';
    
    const city = location.city || 'Unknown';
    const country = location.country || location.country_name || 'Unknown';
    
    return `${city}, ${country}`;
}

// Format device info for display
function formatDevice(deviceInfo) {
    if (!deviceInfo) return 'Unknown';
    
    const ua = deviceInfo.userAgent || '';
    let device = 'Unknown';
    
    if (ua.includes('Mobile')) {
        device = 'Mobile';
    } else if (ua.includes('Tablet')) {
        device = 'Tablet';
    } else {
        device = 'Desktop';
    }
    
    let browser = 'Unknown';
    if (ua.includes('Chrome')) browser = 'Chrome';
    else if (ua.includes('Firefox')) browser = 'Firefox';
    else if (ua.includes('Safari')) browser = 'Safari';
    else if (ua.includes('Edge')) browser = 'Edge';
    
    return `${browser} on ${device}`;
}

// Create a manual login log for testing
async function createManualLoginLog(userId) {
    try {
        const timestamp = new Date().toISOString();
        const loginId = `manual_login_${Date.now()}`;
        
        const loginData = {
            timestamp: timestamp,
            method: 'manual',
            deviceInfo: {
                userAgent: navigator.userAgent,
                platform: navigator.platform,
                screenResolution: `${window.screen.width}x${window.screen.height}`,
                language: navigator.language
            },
            location: await getUserLocation(),
            successful: true
        };
        
        // Try to store in both possible collections
        await Promise.all([
            setDoc(doc(db, "users", userId, "loginActivity", loginId), loginData),
            setDoc(doc(db, "users", userId, "logins", loginId), loginData)
        ]);
        
        alert("Manual login log created successfully!");
        return true;
    } catch (error) {
        console.error("Error creating manual login log:", error);
        alert(`Error creating manual login log: ${error.message}`);
        return false;
    }
}

// Get user's location for login log
async function getUserLocation() {
    try {
        const response = await fetch('https://ipapi.co/json/');
        const locationData = await response.json();
        
        return {
            city: locationData.city || 'Unknown',
            region: locationData.region || 'Unknown',
            country: locationData.country_name || 'Unknown',
            ip: locationData.ip || 'Unknown',
            latitude: locationData.latitude,
            longitude: locationData.longitude
        };
    } catch (error) {
        console.error("Error getting location:", error);
        return {
            city: 'Unknown',
            region: 'Unknown',
            country: 'Unknown',
            ip: 'Unknown'
        };
    }
} 