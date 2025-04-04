  // Import the functions you need from the SDKs you need
  import { initializeApp } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-app.js";
  import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-analytics.js";
  // TODO: Add SDKs for Firebase products that you want to use
  // https://firebase.google.com/docs/web/setup#available-libraries
  import { getAuth, signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-auth.js";
  import { getUserData, storeUserData, recordLoginActivity, recordFailedLoginAttempt, checkLoginStatus, resetFailedLoginAttempts } from "./firestoredb.js";
  import { firebaseConfig } from "./config.js";
  import { initEncryption, secureStorage } from "./helpers.js";

  // Initialize Firebase
  const app = initializeApp(firebaseConfig);
  const analytics = getAnalytics(app);
  const auth = getAuth(app);  // Initialize auth instance

  // Add Google Auth provider initialization
  const provider = new GoogleAuthProvider();
  
  // Configure Google Auth provider to improve sign-in reliability
  provider.setCustomParameters({
    prompt: 'select_account'
  });

  
  //submit button
  document.addEventListener('DOMContentLoaded', function() {
    // Initialize Google login button
    const googleLogin = document.getElementById("google-login");
    if (!googleLogin) {
      console.error("Google login button not found in the DOM");
      return;
    }
    
    const originalGoogleText = googleLogin.innerHTML;
    
    googleLogin.addEventListener("click", function() {
        console.log("Google login button clicked"); // Debug log
        googleLogin.disabled = true;
        googleLogin.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing in with Google...';
        googleLogin.style.opacity = '0.8';
        
        try {
            // Find if we're using the test key which auto-verifies
            const recaptchaElement = document.querySelector('.g-recaptcha');
            const isTestKey = recaptchaElement && recaptchaElement.getAttribute('data-sitekey') === '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI';
            
            // Only check reCAPTCHA if not using the test key
            if (!isTestKey) {
                // Verify reCAPTCHA for Google login
                const recaptchaResponse = grecaptcha.getResponse();
                if (!recaptchaResponse) {
                    showError("Please complete the reCAPTCHA verification first.");
                    googleLogin.disabled = false;
                    googleLogin.innerHTML = originalGoogleText;
                    googleLogin.style.opacity = '1';
                    return;
                }
            }
            
            signInWithPopup(auth, provider)
                .then(async (result) => {
                    const user = result.user;
                    console.log("Google sign-in successful for user:", user.uid);
                    
                    // Initialize encryption with user ID - now just a compatibility function
                    await initEncryption(user.uid);
                    
                    getUserData(user.uid)
                        .then(async userData => {
                            if (userData) {
                                console.log("Existing user data found for:", user.uid);
                                // Store user data securely - UPDATED to use new approach
                                // Only store minimal, non-sensitive user profile in session
                                const safeUserData = {
                                    firstName: userData.firstName,
                                    lastName: userData.lastName,
                                    email: userData.email,
                                    lastLogin: userData.lastLogin,
                                    accountStatus: userData.accountStatus
                                };
                                
                                await secureStorage.setItem('userData', safeUserData);
                                
                                // Set a secure auth cookie for persistent auth
                                secureStorage.setSecureCookie('auth_session', 'authenticated', 1); // 1 day expiry
                                
                                // Log the login activity - make sure this happens before redirect
                                try {
                                    await logLoginActivity(user.uid, 'google');
                                    console.log("Login activity logged successfully");
                                    window.location.href = "dashboard.html";
                                } catch (logError) {
                                    console.error("Error logging login activity:", logError);
                                    // Continue to dashboard even if logging fails
                                    window.location.href = "dashboard.html";
                                }
                            } else {
                                console.log("Creating new user data for:", user.uid);
                                const newUserData = {
                                    firstName: user.displayName ? user.displayName.split(' ')[0] : '',
                                    lastName: user.displayName ? user.displayName.split(' ').slice(1).join(' ') : '',
                                    email: user.email,
                                    createdAt: new Date().toISOString(),
                                    lastLogin: new Date().toISOString(),
                                    accountStatus: 'active',
                                    securityLevel: 'standard'
                                };
                                
                                storeUserData(user.uid, newUserData)
                                    .then(async () => {
                                        // Store user data securely - UPDATED
                                        await secureStorage.setItem('userData', newUserData);
                                        secureStorage.setSecureCookie('auth_session', 'authenticated', 1);
                                        
                                        // Log the login activity - make sure this happens before redirect
                                        try {
                                            await logLoginActivity(user.uid, 'google');
                                            console.log("Login activity logged successfully");
                                            window.location.href = "dashboard.html";
                                        } catch (logError) {
                                            console.error("Error logging login activity:", logError);
                                            // Continue to dashboard even if logging fails
                                            window.location.href = "dashboard.html";
                                        }
                                    })
                                    .catch(error => {
                                        console.error("Error saving user data:", error);
                                        window.location.href = "dashboard.html";
                                    });
                            }
                        })
                        .catch(error => {
                            console.error("Error getting user data:", error);
                            window.location.href = "dashboard.html";
                        });
                })
                .catch((error) => {
                    console.error("Google sign-in error:", error);
                    googleLogin.disabled = false;
                    googleLogin.innerHTML = originalGoogleText;
                    googleLogin.style.opacity = '1';
                    
                    if (error.code !== 'auth/popup-closed-by-user') {
                        showError(`Error signing in with Google: ${error.message || error.code}`);
                        
                        // Log additional information for debugging
                        if (error.code === 'auth/network-request-failed') {
                            console.warn("Network error during authentication. Check your internet connection.");
                        } else if (error.code === 'auth/popup-blocked') {
                            console.warn("Popup was blocked by the browser. Please allow popups for this site.");
                            showError("Google sign-in popup was blocked. Please allow popups for this site and try again.");
                        } else if (error.code === 'auth/cancelled-popup-request') {
                            console.warn("Multiple popup requests were made. Only one popup can be opened at a time.");
                        } else if (error.code === 'auth/operation-not-allowed') {
                            console.error("Google authentication is not enabled in the Firebase console.");
                            showError("Google authentication is not enabled. Please contact the administrator.");
                        }
                    }
                });
        } catch (error) {
            console.error("Exception in click handler:", error);
            googleLogin.disabled = false;
            googleLogin.innerHTML = originalGoogleText;
            googleLogin.style.opacity = '1';
            showError("Error during Google sign-in setup: " + error.message);
        }
    });

    const form = document.querySelector('.auth-form');
    const loginButton = form.querySelector('button[type="submit"]');
    const originalButtonText = loginButton.innerHTML;
    
    // Function to show loading state
    function setLoading(isLoading) {
        if (isLoading) {
            loginButton.disabled = true;
            loginButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Logging in...';
            loginButton.style.opacity = '0.8';
        } else {
            loginButton.disabled = false;
            loginButton.innerHTML = originalButtonText;
            loginButton.style.opacity = '1';
        }
    }

    // Function to show error message
    function showError(message) {
        // Remove any existing error message
        const existingError = document.querySelector('.error-message');
        if (existingError) existingError.remove();

        // Create and insert error message
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.style.cssText = `
            color: #ff3b30;
            background: rgba(255, 59, 48, 0.1);
            border-left: 3px solid #ff3b30;
            padding: 1rem;
            margin: 1rem 0;
            border-radius: 4px;
            font-size: 0.9rem;
        `;
        errorDiv.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${message}`;
        form.insertBefore(errorDiv, loginButton.parentElement);

        // Animate error message
        errorDiv.style.animation = 'slideIn 0.3s ease-out';
    }

    form.addEventListener("submit", async function (event) {
        event.preventDefault();
        
        // Clear any existing error messages
        const existingError = document.querySelector('.error-message');
        if (existingError) existingError.remove();

        const emailInput = document.getElementById('email');
        const passwordInput = document.getElementById('password');
        
        // Check reCAPTCHA
        const recaptchaResponse = grecaptcha.getResponse();
        if (!recaptchaResponse) {
            showError("Please complete the reCAPTCHA verification first.");
            return;
        }
        
        // Check if login is allowed (not rate limited)
        const loginStatus = await checkLoginStatus(emailInput.value);
        if (!loginStatus.allowed) {
            showError(`For security reasons, this account has been temporarily locked. Please try again in ${loginStatus.remainingMinutes} minute(s).`);
            // Reset reCAPTCHA
            grecaptcha.reset();
            return;
        }
        
        setLoading(true);
        
        signInWithEmailAndPassword(auth, emailInput.value, passwordInput.value)
            .then(async (userCredential) => {
                const user = userCredential.user;
                
                // Initialize encryption with user ID - now just compatibility
                await initEncryption(user.uid);
                
                // Reset failed login attempts counter on successful login
                resetFailedLoginAttempts(emailInput.value)
                    .then(() => {
                        getUserData(user.uid)
                            .then(async userData => {
                                if (userData) {
                                    // Store only minimal, non-sensitive user data
                                    const safeUserData = {
                                        firstName: userData.firstName,
                                        lastName: userData.lastName,
                                        email: userData.email,
                                        lastLogin: userData.lastLogin,
                                        accountStatus: userData.accountStatus
                                    };
                                    
                                    // Use new secure storage method
                                    await secureStorage.setItem('userData', safeUserData);
                                    secureStorage.setSecureCookie('auth_session', 'authenticated', 1);
                                    
                                    // Log login activity for security auditing
                                    try {
                                        await logLoginActivity(user.uid, 'email');
                                        console.log("Login activity logged successfully");
                                        window.location.href = "dashboard.html";
                                    } catch (logError) {
                                        console.error("Error logging login activity:", logError);
                                        // Continue to dashboard even if logging fails
                                        window.location.href = "dashboard.html";
                                    }
                                } else {
                                    // User doesn't have data in Firestore, redirect anyway
                                    window.location.href = "dashboard.html";
                                }
                            });
                    })
                    .catch(error => {
                        console.error("Error resetting failed login attempts:", error);
                        window.location.href = "dashboard.html";
                    });
            })
            .catch(async (error) => {
                setLoading(false);
                
                // Record failed login attempt
                await recordFailedLoginAttempt(emailInput.value);
                
                const errorMessages = {
                    'auth/wrong-password': "Incorrect password. Please try again.",
                    'auth/user-not-found': "No account found with this email. Please check the email or sign up.",
                    'auth/invalid-credential': "Invalid login credentials. Please check your email and password.",
                    'auth/user-disabled': "This account has been disabled. Please contact support.",
                    'auth/too-many-requests': "Too many failed attempts. Please try again later.",
                    'auth/network-request-failed': "Network error. Please check your internet connection."
                };

                const errorMessage = errorMessages[error.code] || "An error occurred during login. Please try again.";
                showError(errorMessage);
                
                // Reset reCAPTCHA
                grecaptcha.reset();
                
                console.error("Firebase auth error:", error.code, error.message);
            });
    });

    // Add keypress handler for password field
    const passwordInput = document.getElementById('password');
    if (passwordInput) {
        passwordInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                loginButton.click();
            }
        });
    }
  });

  // Function to get user's location
  async function getUserLocation() {
    try {
      // Try to get user's IP-based location using a free API
      const response = await fetch('https://ipapi.co/json/');
      const locationData = await response.json();
      
      return {
        city: locationData.city || 'Unknown',
        region: locationData.region || 'Unknown',
        country: locationData.country_name || 'Unknown',
        ip: locationData.ip || 'Unknown',
        timezone: locationData.timezone || 'Unknown',
        latitude: locationData.latitude,
        longitude: locationData.longitude
      };
    } catch (error) {
      console.error("Error getting location:", error);
      return {
        city: 'Unknown',
        region: 'Unknown',
        country: 'Unknown',
        ip: 'Unknown',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Unknown'
      };
    }
  }

  // Function to record login activity
  async function logLoginActivity(userId, method) {
    if (!userId) {
      console.error("Cannot log login activity: User ID is missing");
      return false;
    }

    try {
      console.log(`Recording login activity for user ${userId} with method ${method}`);
      
      const deviceInfo = {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        vendor: navigator.vendor,
        screenResolution: `${window.screen.width}x${window.screen.height}`,
        language: navigator.language,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      };
      
      const location = await getUserLocation();
      
      const loginData = {
        timestamp: new Date().toISOString(),
        method: method,
        deviceInfo: deviceInfo,
        location: location,
        successful: true
      };
      
      // Record login activity in Firestore
      const result = await recordLoginActivity(userId, loginData);
      
      if (result) {
        console.log("Login activity recorded successfully in Firestore");
      } else {
        console.error("Failed to record login activity in Firestore");
      }
      
      return result;
    } catch (error) {
      console.error("Error recording login activity:", error);
      return false;
    }
  }