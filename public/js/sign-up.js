// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-analytics.js";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries
import { getAuth, createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-auth.js";
import { storeUserData } from "./firestoredb.js";
import { firebaseConfig } from "./config.js";
import { initEncryption, secureStorage, isValidEmail, isStrongPassword } from "./helpers.js";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);  // Initialize auth instance

//googleAuth
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

  googleLogin.addEventListener("click", function() {
    console.log("Google login button clicked"); // Debug log
    googleLogin.disabled = true;
    googleLogin.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing in with Google...';
    
    signInWithPopup(auth, provider)
      .then(async (result) => {
        // Get user info from result
        const user = result.user;
        
        // Initialize encryption with user ID (now just compatibility)
        await initEncryption(user.uid);
        
        // Create a user data object
        const userData = {
          firstName: user.displayName ? user.displayName.split(' ')[0] : '',
          lastName: user.displayName ? user.displayName.split(' ').slice(1).join(' ') : '',
          email: user.email,
          createdAt: new Date().toISOString(),
          lastLogin: new Date().toISOString(),
          accountStatus: 'active',
          securityLevel: 'standard'
        };
        
        // Store in Firestore
        storeUserData(user.uid, userData)
          .then(async () => {
            // Store in secure storage for quick access - updated
            await secureStorage.setItem('userData', userData);
            secureStorage.setSecureCookie('auth_session', 'authenticated', 1);
            window.location.href = "dashboard.html";
          })
          .catch(error => {
            console.error("Error saving user data:", error);
            window.location.href = "dashboard.html";
          });
      })
      .catch(error => {
        // Handle Errors here
        const errorCode = error.code;
        const errorMessage = error.message;
        console.error(`Google sign-in error: ${errorCode} - ${errorMessage}`);
        
        // Reset the button
        googleLogin.disabled = false;
        googleLogin.innerHTML = 'Sign up with Google';
        
        // Display error message
        alert("Error signing in with Google: " + errorMessage);
      });
  });

  const form = document.querySelector('.auth-form');
  const passwordInput = document.getElementById('password');
  const confirmPasswordInput = document.getElementById('confirmPassword');
  
  // Password validation
  const reqLength = document.getElementById('req-length');
  const reqCriteria = document.getElementById('req-criteria');
  const reqLowercase = document.getElementById('req-lowercase');
  const reqUppercase = document.getElementById('req-uppercase');
  const reqNumbers = document.getElementById('req-numbers');
  const reqSpecial = document.getElementById('req-special');
  
  passwordInput.addEventListener('input', validatePassword);
  
  function validatePassword() {
    const password = passwordInput.value;
    
    // Check length
    const hasLength = password.length >= 8;
    toggleRequirement(reqLength, hasLength);
    
    // Check criteria
    const hasLowercase = /[a-z]/.test(password);
    const hasUppercase = /[A-Z]/.test(password);
    const hasNumbers = /[0-9]/.test(password);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    
    toggleRequirement(reqLowercase, hasLowercase);
    toggleRequirement(reqUppercase, hasUppercase);
    toggleRequirement(reqNumbers, hasNumbers);
    toggleRequirement(reqSpecial, hasSpecial);
    
    // Count criteria met
    const criteriaCount = [hasLowercase, hasUppercase, hasNumbers, hasSpecial].filter(Boolean).length;
    const hasCriteria = criteriaCount >= 3;
    toggleRequirement(reqCriteria, hasCriteria);
  }
  
  function toggleRequirement(element, isMet) {
    if (isMet) {
      element.classList.add('requirement-met');
      element.classList.remove('requirement-unmet');
    } else {
      element.classList.add('requirement-unmet');
      element.classList.remove('requirement-met');
    }
  }
  
  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    
    const firstNameInput = document.getElementById('firstName');
    const lastNameInput = document.getElementById('lastName');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const confirmPasswordInput = document.getElementById('confirmPassword');
    
    // Basic validation
    if (!firstNameInput.value.trim() || !lastNameInput.value.trim()) {
      alert("Please enter your full name");
      return;
    }
    
    if (!isValidEmail(emailInput.value)) {
      alert("Please enter a valid email address");
      return;
    }
    
    if (!isStrongPassword(passwordInput.value)) {
      alert("Password must be at least 8 characters long and include uppercase, lowercase, number, and special character");
      return;
    }
    
    if (passwordInput.value !== confirmPasswordInput.value) {
      alert("Passwords do not match");
      return;
    }
    
    const submitButton = form.querySelector('button[type="submit"]');
    const originalButtonText = submitButton.innerHTML;
    submitButton.disabled = true;
    submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating account...';
    
    createUserWithEmailAndPassword(auth, emailInput.value, passwordInput.value)
      .then(async (userCredential) => {
        // Signed up 
        const user = userCredential.user;
        
        // Initialize encryption with user ID (now just compatibility)
        await initEncryption(user.uid);
        
        // Create a user data object
        const userData = {
          firstName: firstNameInput.value,
          lastName: lastNameInput.value,
          email: emailInput.value,
          createdAt: new Date().toISOString(),
          lastLogin: new Date().toISOString(),
          accountStatus: 'active',
          securityLevel: 'standard'
        };
        
        // Store in Firestore
        storeUserData(user.uid, userData)
          .then(async () => {
            // Also store in secure storage for quick access - updated
            await secureStorage.setItem('userData', userData);
            secureStorage.setSecureCookie('auth_session', 'authenticated', 1);
            alert("Account created successfully!");
            window.location.href = "login.html"; // Redirect to login page
          })
          .catch(error => {
            console.error("Error saving user data:", error);
            alert("Account created but there was an issue saving your profile information.");
            window.location.href = "login.html";
          });
      })
      .catch((error) => {
        const errorCode = error.code;
        const errorMessage = error.message;
        
        // Reset the button
        submitButton.disabled = false;
        submitButton.innerHTML = originalButtonText;
        
        // Error handling for common errors
        switch (errorCode) {
          case 'auth/email-already-in-use':
            alert("This email is already registered. Please login instead.");
            break;
          case 'auth/weak-password':
            alert("Password is too weak. Please choose a stronger password.");
            break;
          default:
            alert(errorMessage);
        }
      });
  });
});