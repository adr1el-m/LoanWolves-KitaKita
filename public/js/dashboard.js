// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-analytics.js";
import { getAuth, onAuthStateChanged, signOut, EmailAuthProvider, reauthenticateWithCredential } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-auth.js";
import { 
    getUserData, 
    storeTransaction, 
    getUserTransactions, 
    updateTransaction, 
    deleteTransaction as deleteFirestoreTransaction,
    storeBankAccount,
    getUserBankAccounts,
    updateBankAccount,
    doc, 
    setDoc, 
    getDocs, 
    collection, 
    deleteDoc,
    db
} from "./firestoredb.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-storage.js";
import { firebaseConfig } from "./config.js";
import { validateName, validateCardNumber, validateAmount, validateDate, showValidationError, clearAllValidationErrors, sanitizeString, secureStorage } from "./helpers.js";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);

document.addEventListener('DOMContentLoaded', function() {
  // Initialize page navigation
  initializeNavigation();
  
  // Check if user is logged in
  onAuthStateChanged(auth, (user) => {
    if (user) {
      // User is signed in, attempt to get data from Firestore
      updateUserInterface(user);
      
      // Initialize the dashboard components
      initializeDashboard();
      
      // Apply parallax effect for lights (same as index.html)
      document.addEventListener('mousemove', (e) => {
        const lights = document.querySelectorAll('.light');
        const x = e.clientX / window.innerWidth;
        const y = e.clientY / window.innerHeight;

        lights.forEach(light => {
          const speed = 50;
          light.style.transform = `translate(${x * speed}px, ${y * speed}px)`;
        });
      });
      
      // Setup logout button
      const logoutButton = document.getElementById('logout-button');
      if (logoutButton) {
        logoutButton.addEventListener('click', secureLogout);
      }
      initializeBankSection();
    } else {
      // User is signed out, redirect to login
      window.location.href = "login.html";
    }
  });
});

function initializeNavigation() {
  const navLinks = document.querySelectorAll('.sidebar-nav a');
  const pages = document.querySelectorAll('.page-content');
  
  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      
      // Remove active class from all links
      navLinks.forEach(l => l.classList.remove('active'));
      
      // Add active class to clicked link
      link.classList.add('active');
      
      // Hide all pages
      pages.forEach(page => page.style.display = 'none');
      
      // Show selected page
      const pageId = link.getAttribute('data-page');
      document.getElementById(`${pageId}-page`).style.display = 'block';
    });
  });
}

async function updateUserInterface(user) {
  const welcomeElement = document.getElementById('welcomeUsername');
  const userDisplayName = document.getElementById('user-display-name');
  
  // First try to get data from secure storage
  let userData = await secureStorage.getItem('userData');
  
  if (!userData) {
    // If not in secure storage, get from Firestore
    userData = await getUserData(user.uid);
    
    if (userData) {
      // Create a safe version with only non-sensitive data
      const safeUserData = {
        firstName: userData.firstName,
        lastName: userData.lastName,
        email: userData.email,
        lastLogin: userData.lastLogin,
        accountStatus: userData.accountStatus
      };
      
      // Store in secure storage for future quick access
      await secureStorage.setItem('userData', safeUserData);
    }
  }
  
  if (userData) {
    // We have the user data
    const fullName = `${userData.firstName} ${userData.lastName}`;
    welcomeElement.textContent = userData.firstName;
    userDisplayName.textContent = fullName;
  } else {
    // Fallback to email if no name data is available
    welcomeElement.textContent = user.email.split('@')[0];
    userDisplayName.textContent = user.email;
  }
}

function initializeDashboard() {
  // Initialize spending chart
  initializeSpendingChart();
  
  // Initialize transaction history
  initializeTransactionHistory();
}

function initializeSpendingChart() {
  const ctx = document.getElementById('spendingChart').getContext('2d');
  
  const chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      datasets: [
        {
          label: 'Income',
          data: [], 
          backgroundColor: 'rgba(16, 223, 111, 0.2)', // Green with opacity
          borderColor: '#10df6f', // Solid green
          borderWidth: 2,
          tension: 0.4,
          fill: true // Keep the fill for income
        },
        {
          label: 'Expenses',
          data: [], 
          backgroundColor: 'transparent', // Remove fill for expenses
          borderColor: '#e96d1f', // Solid orange
          borderWidth: 3, // Slightly thicker line for better visibility
          tension: 0.4,
          fill: false // No fill for expenses - just a line
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      aspectRatio: 2.5,
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: {
            color: 'rgba(255, 255, 255, 0.7)',
            usePointStyle: true, // Makes the legend markers more modern
            pointStyle: 'line' // Shows lines instead of boxes in legend
          }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              return `${context.dataset.label}: ₱${Math.abs(context.raw).toLocaleString()}`;
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: {
            color: 'rgba(255, 255, 255, 0.05)'
          },
          ticks: {
            color: 'rgba(255, 255, 255, 0.7)',
            callback: function(value) {
              return '₱' + value.toLocaleString('en-US', {maximumFractionDigits: 0});
            }
          }
        },
        x: {
          grid: {
            color: 'rgba(255, 255, 255, 0.05)'
          },
          ticks: {
            color: 'rgba(255, 255, 255, 0.7)'
          }
        }
      }
    }
  });
  
  window.spendingChart = chart;
  loadTransactionData();
}

// New function to load transaction data and update the chart
function loadTransactionData() {
  // Get transactions from localStorage or your database
  const transactions = JSON.parse(localStorage.getItem('userTransactions')) || [];
  
  if (transactions.length > 0) {
    // Process transactions for the chart
    updateSpendingChart(transactions);
  }
}

// Function to update the spending chart with transaction data
function updateSpendingChart(transactions) {
  if (!window.spendingChart) return;
  
  // Group transactions by day of week and type
  const dailyData = {
    income: { 'Mon': 0, 'Tue': 0, 'Wed': 0, 'Thu': 0, 'Fri': 0, 'Sat': 0, 'Sun': 0 },
    expenses: { 'Mon': 0, 'Tue': 0, 'Wed': 0, 'Thu': 0, 'Fri': 0, 'Sat': 0, 'Sun': 0 }
  };
  
  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  
  // Process each transaction
  transactions.forEach(transaction => {
    if (transaction.amount && transaction.date) {
      const date = new Date(transaction.date);
      const dayName = daysOfWeek[date.getDay()];
      const amount = Math.abs(parseFloat(transaction.amount));
      
      if (transaction.type === 'income') {
        dailyData.income[dayName] += amount;
      } else {
        dailyData.expenses[dayName] += amount;
      }
    }
  });
  
  // Update chart data
  window.spendingChart.data.datasets[0].data = [
    dailyData.income['Mon'],
    dailyData.income['Tue'],
    dailyData.income['Wed'],
    dailyData.income['Thu'],
    dailyData.income['Fri'],
    dailyData.income['Sat'],
    dailyData.income['Sun']
  ];
  
  window.spendingChart.data.datasets[1].data = [
    dailyData.expenses['Mon'],
    dailyData.expenses['Tue'],
    dailyData.expenses['Wed'],
    dailyData.expenses['Thu'],
    dailyData.expenses['Fri'],
    dailyData.expenses['Sat'],
    dailyData.expenses['Sun']
  ];
  
  window.spendingChart.update();
}

// Add new function to handle transaction history and add transaction functionality
function initializeTransactionHistory() {
  const addTransactionBtn = document.getElementById('add-transaction-btn');
  const transactionModal = document.getElementById('transaction-modal');
  const closeTransactionModal = document.getElementById('close-transaction-modal');
  const transactionForm = document.getElementById('transaction-form');
  const transactionsList = document.getElementById('transactions-list');
  
  // Show add transaction modal
  if (addTransactionBtn) {
    addTransactionBtn.addEventListener('click', () => {
      transactionModal.style.display = 'block';
    });
  }
  
  // Close transaction modal
  if (closeTransactionModal) {
    closeTransactionModal.addEventListener('click', () => {
      transactionModal.style.display = 'none';
    });
  }
  
  // Handle transaction form submission
  if (transactionForm) {
    transactionForm.addEventListener('submit', (e) => {
      e.preventDefault();
      
      const transaction = {
        description: document.getElementById('transaction-description').value,
        amount: document.getElementById('transaction-amount').value,
        date: document.getElementById('transaction-date').value,
        category: document.getElementById('transaction-category').value,
        id: Date.now()
      };
      
      let transactions = JSON.parse(localStorage.getItem('userTransactions')) || [];
      transactions.push(transaction);
      localStorage.setItem('userTransactions', JSON.stringify(transactions));
      
      renderTransactions();
      updateSpendingChart(transactions);
      
      transactionForm.reset();
      transactionModal.style.display = 'none';
    });
  }
  
  renderTransactions();
}

function renderTransactions() {
  const transactionsList = document.getElementById('transactions-list');
  if (!transactionsList) return;
  
  const transactions = JSON.parse(localStorage.getItem('userTransactions')) || [];
  
  if (transactions.length === 0) {
    transactionsList.innerHTML = '<div class="no-transactions">No transactions yet</div>';
    return;
  }
  
  transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
  
  transactionsList.innerHTML = transactions.map(transaction => {
    const date = new Date(transaction.date).toLocaleDateString();
    return `
      <div class="transaction-item">
        <div class="transaction-info">
          <div class="transaction-description">${transaction.description}</div>
          <div class="transaction-date">${date}</div>
          <div class="transaction-category">${transaction.category}</div>
        </div>
        <div class="transaction-amount">₱${parseFloat(transaction.amount).toFixed(2)}</div>
        <button class="delete-transaction" data-id="${transaction.id}">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    `;
  }).join('');
  
  // Add event listeners for delete buttons
  document.querySelectorAll('.delete-transaction').forEach(button => {
    button.addEventListener('click', () => deleteTransaction(button.dataset.id));
  });
}

// Function to delete a transaction
function deleteTransaction(id) {
  let transactions = JSON.parse(localStorage.getItem('userTransactions')) || [];
  transactions = transactions.filter(t => t.id !== parseInt(id));
  localStorage.setItem('userTransactions', JSON.stringify(transactions));
  
  // Update UI
  renderTransactions();
  updateSpendingChart(transactions);
}

// Function to toggle between bank and e-wallet fields
function initializeBankModalToggles() {
    const accountTypeSelect = document.getElementById('account-type');
    const bankFields = document.getElementById('bank-fields');
    const ewalletFields = document.getElementById('ewallet-fields');
    const cardDetailsRow = document.getElementById('card-details-row');
    const numberLabel = document.getElementById('number-label');
    const ewalletProvider = document.getElementById('ewallet-provider');
    const otherProviderField = document.getElementById('other-provider-field');
    const currencySelect = document.getElementById('currency');
    const currencySymbol = document.getElementById('currency-symbol');
    
    // Currency symbols mapping
    const currencySymbols = {
        'PHP': '₱'
    };
    
    // Toggle fields based on account type
    accountTypeSelect.addEventListener('change', function() {
        if (this.value === 'bank') {
            bankFields.style.display = 'block';
            ewalletFields.style.display = 'none';
            cardDetailsRow.style.display = 'grid';
            numberLabel.textContent = 'Card Number';
        } else {
            bankFields.style.display = 'none';
            ewalletFields.style.display = 'block';
            cardDetailsRow.style.display = 'none';
            numberLabel.textContent = 'Account Number/ID';
        }
    });
    
    // Handle "Other" e-wallet provider selection
    ewalletProvider.addEventListener('change', function() {
        otherProviderField.style.display = this.value === 'other' ? 'block' : 'none';
    });
    
    // Update currency symbol when currency changes
    currencySelect.addEventListener('change', function() {
        currencySymbol.textContent = currencySymbols[this.value] || '₱';
    });
    
    // Close button functionality
    document.getElementById('close-add-bank').addEventListener('click', function() {
        document.getElementById('add-bank-modal').style.display = 'none';
    });
}

// Update the initializeBankSection function
async function initializeBankSection() {
    try {
        const user = auth.currentUser;
        if (!user) {
            console.error('No user logged in');
            return;
        }

        // Get bank accounts from Firestore
        const accounts = await getUserBankAccounts(user.uid);
        console.log('Loaded accounts from Firestore:', accounts);

        // Update localStorage with the latest data from Firestore
        if (accounts && accounts.length > 0) {
            localStorage.setItem('bankAccounts', JSON.stringify(accounts));
        }

        // Update UI elements
        const bankCardsGrid = document.querySelector('.bank-cards-grid');
        const emptyStateContainer = document.querySelector('.empty-state-container');

        if (!accounts || accounts.length === 0) {
            if (emptyStateContainer) emptyStateContainer.style.display = 'block';
            if (bankCardsGrid) bankCardsGrid.style.display = 'none';
        } else {
            if (emptyStateContainer) emptyStateContainer.style.display = 'none';
            if (bankCardsGrid) bankCardsGrid.style.display = 'grid';
        }

        // Initialize form toggles
        initializeInputFormatting();
        initializeBankModalToggles();

        // Render bank cards
        await renderBankCards();

    } catch (error) {
        console.error('Error initializing bank section:', error);
    }
}

function initializeInputFormatting() {
    // Format card number input
    const cardInput = document.getElementById('card-number');
    if (cardInput) {
        cardInput.addEventListener('input', (e) => {
            let value = e.target.value.replace(/\D/g, '');
            e.target.value = value;
        });
    }
}

async function renderBankCards() {
    try {
        const user = auth.currentUser;
        if (!user) {
            console.error('No user logged in');
            return;
        }

        const bankCardsGrid = document.querySelector('.bank-cards-grid');
        const bankAccounts = await getUserBankAccounts(user.uid);
        
        // Currency symbols mapping
        const currencySymbols = {
            'PHP': '₱'
        };
        
        let cardsHTML = bankAccounts.map(account => {
            const isEwallet = account.accountType === 'ewallet';
            const currencySymbol = currencySymbols[account.currency] || '₱';
            
            return `
                <div class="bank-card ${isEwallet ? 'ewallet-card' : ''}" data-id="${account.id}">
                    <div class="card-type">
                        <i class="fas ${isEwallet ? 'fa-wallet' : 'fa-credit-card'}"></i>
                        <span>${account.currency}</span>
                    </div>
                    <h3>${account.accountName}</h3>
                    <div class="card-number">${isEwallet ? 'Account ID: ' : ''}**** **** **** ${account.cardNumber.slice(-4)}</div>
                    <div class="card-name">${account.cardName}</div>
                    <div class="balance">₱${account.balance.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                    <button class="delete-account-btn" data-id="${account.id}">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
        }).join('');
        
        // Add the "Add New Account" card
        cardsHTML += `
            <div class="bank-card add-card" id="add-card-button">
                <div class="add-card-content">
                    <i class="fas fa-plus"></i>
                    <p>Add New Account</p>
                </div>
            </div>
        `;
        
        bankCardsGrid.innerHTML = cardsHTML;
        bankCardsGrid.style.display = 'grid';
        
        // Add event listeners
        document.getElementById('add-card-button').addEventListener('click', () => {
            document.getElementById('add-bank-modal').style.display = 'block';
        });
        
        // Add event listeners for delete buttons
        document.querySelectorAll('.delete-account-btn').forEach(button => {
            button.addEventListener('click', async (e) => {
                e.stopPropagation(); // Prevent event bubbling
                const accountId = button.dataset.id;
                if (confirm('Are you sure you want to delete this account?')) {
                    try {
                        await deleteAccount(accountId);
                        alert('Account deleted successfully');
                    } catch (error) {
                        console.error('Error in delete handler:', error);
                        alert('Failed to delete account. Please try again.');
                    }
                }
            });
        });
        
        // Update summary
        updateBalanceSummary();
    } catch (error) {
        console.error('Error rendering bank cards:', error);
    }
}

function showSecurityModal(accountId) {
    const securityModal = document.getElementById('security-modal');
    securityModal.style.display = 'block';
    
    document.getElementById('verify-button').onclick = async function() {
        const password = document.getElementById('security-password').value;
        const cardId = document.getElementById('security-modal').dataset.cardId;
        
        try {
            // Verify password with Firebase Auth
            const user = auth.currentUser;
            const credential = EmailAuthProvider.credential(user.email, password);
            await reauthenticateWithCredential(user, credential);
            
            // If successful, show the details
            const bankCard = document.querySelector(`.bank-card[data-id="${cardId}"]`);
            // Show full card details here
            // You can implement the details display logic
            
            document.getElementById('security-modal').style.display = 'none';
            document.getElementById('security-password').value = '';
        } catch (error) {
            alert('Invalid password. Please try again.');
        }
    };

    document.getElementById('cancel-verification').onclick = () => {
        securityModal.style.display = 'none';
        document.getElementById('security-password').value = '';
    };
}

function showAccountDetails(accountId) {
    const bankAccounts = JSON.parse(localStorage.getItem('bankAccounts')) || [];
    const account = bankAccounts.find(acc => acc.id === parseInt(accountId));
    
    if (account) {
        alert(`
Full Card Number: ${account.cardNumber}
Account Name: ${account.cardName}
Balance: ₱${parseFloat(account.balance).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
        `);
    }
}

// Add this CSS to fix the grid layout
document.head.insertAdjacentHTML('beforeend', `
<style>
.bank-cards-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 1.5rem;
    padding: 1.5rem;
}

.bank-card {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 15px;
    padding: 1.5rem;
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    transition: all 0.3s ease;
}

.bank-card:hover {
    transform: translateY(-5px);
    box-shadow: 0 10px 20px rgba(0, 0, 0, 0.2);
}

.add-card {
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    border: 2px dashed rgba(255, 255, 255, 0.2);
    background: rgba(255, 255, 255, 0.02);
}

.add-card:hover {
    border-color: rgba(255, 255, 255, 0.3);
    background: rgba(255, 255, 255, 0.05);
}

.add-card-content {
    text-align: center;
}

.add-card-content i {
    font-size: 2rem;
    margin-bottom: 1rem;
    color: rgba(255, 255, 255, 0.7);
}

.add-card-content p {
    color: rgba(255, 255, 255, 0.7);
}

.delete-account-btn {
    position: absolute;
    top: 10px;
    right: 10px;
    background: rgba(255, 59, 48, 0.1);
    border: none;
    border-radius: 50%;
    width: 32px;
    height: 32px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s ease;
}

.delete-account-btn i {
    color: #ff3b30;
    font-size: 14px;
}

.delete-account-btn:hover {
    background: rgba(255, 59, 48, 0.2);
    transform: scale(1.1);
}

.bank-card {
    position: relative;
}
</style>
`);

// Add this to handle view details clicks
document.addEventListener('click', function(e) {
    if (e.target.classList.contains('view-details-btn')) {
        const bankCard = e.target.closest('.bank-card');
        if (bankCard) {
            document.getElementById('security-modal').style.display = 'flex';
            
            // Store the card ID temporarily
            document.getElementById('security-modal').dataset.cardId = bankCard.dataset.id;
        }
    }
});

// Add Transaction Modal Handlers
document.getElementById('add-transaction-button').addEventListener('click', function(e) {
    e.preventDefault(); // Prevent default button behavior
    const modal = document.getElementById('add-transaction-modal');
    modal.style.display = 'flex';
    
    // Set default date to today
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('transaction-date').value = today;
    
    // Populate the account dropdown
    populateAccountDropdown();
});

// Close transaction modal
document.getElementById('close-add-transaction').addEventListener('click', function(e) {
    e.preventDefault(); // Prevent default button behavior
    const modal = document.getElementById('add-transaction-modal');
    modal.style.display = 'none';
    
    // Reset the form when closing
    const form = document.getElementById('add-transaction-form');
    if (form) {
        form.reset();
        // Clear any validation errors
        clearAllValidationErrors(form);
    }
});

// Prevent form submission from scrolling
document.getElementById('add-transaction-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    e.stopPropagation();
    
    try {
        const user = auth.currentUser;
        if (!user) {
            throw new Error('No user logged in');
        }

        // Clear any previous validation errors
        clearAllValidationErrors(this);
        
        // Get and validate all form fields
        const nameField = document.getElementById('transaction-name');
        const typeField = document.getElementById('transaction-type');
        const amountField = document.getElementById('transaction-amount');
        const dateField = document.getElementById('transaction-date');
        const timeField = document.getElementById('transaction-time');
        const channelField = document.getElementById('transaction-channel');
        const categoryField = document.getElementById('transaction-category');
        const notesField = document.getElementById('transaction-notes');
        const accountField = document.getElementById('transaction-account');
        
        // Validate name (required)
        if (!nameField || !nameField.value.trim()) {
            showValidationError(nameField, 'Transaction name is required');
            return;
        }
        
        // Validate amount (required, must be a number)
        if (!amountField || !amountField.value.trim()) {
            showValidationError(amountField, 'Amount is required');
            return;
        }
        
        const amount = parseFloat(amountField.value.trim());
        if (isNaN(amount)) {
            showValidationError(amountField, 'Please enter a valid amount');
            return;
        }
        
        // Validate account selection (can be "no_account" now)
        if (!accountField || (!accountField.value && accountField.value !== "no_account")) {
            showValidationError(accountField, 'Please select an account or "No Account"');
            return;
        }
        
        // Validate date (required)
        if (!dateField || !dateField.value) {
            showValidationError(dateField, 'Date is required');
            return;
        }

        // Submit button state
        const submitBtn = this.querySelector('button[type="submit"]');
        const originalBtnText = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

        // Only update account balance if an actual account is selected
        if (accountField.value !== "no_account") {
            // Get the account to update its balance
            const accounts = await getUserBankAccounts(user.uid);
            const accountToUpdate = accounts.find(acc => acc.id === accountField.value);
            
            if (!accountToUpdate) {
                throw new Error('Selected account not found');
            }

            // Calculate transaction amount (negative for expense, positive for income)
            const transactionAmount = typeField && typeField.value === 'income' ? Math.abs(amount) : -Math.abs(amount);

            // Calculate new balance
            const newBalance = parseFloat(accountToUpdate.balance) + transactionAmount;

            // Update the account balance
            const accountUpdateSuccess = await updateBankAccount(user.uid, accountField.value, {
                balance: newBalance,
                lastUpdated: new Date().toISOString()
            });

            if (!accountUpdateSuccess) {
                throw new Error('Failed to update account balance');
            }
        }

        // Create the transaction data object
        const transactionData = {
            id: Date.now().toString(),
            name: nameField.value.trim(),
            type: typeField ? typeField.value : 'expense',
            amount: typeField && typeField.value === 'income' ? Math.abs(amount) : -Math.abs(amount),
            accountId: accountField.value === "no_account" ? null : accountField.value,
            date: dateField.value,
            time: timeField ? timeField.value : '00:00',
            channel: channelField ? channelField.value : 'other',
            category: categoryField ? categoryField.value : 'other',
            notes: notesField ? notesField.value.trim() : '',
            createdAt: new Date().toISOString(),
            userId: user.uid,
            isNoAccount: accountField.value === "no_account"
        };

        // Store the transaction
        const success = await storeTransaction(user.uid, transactionData);
        
        if (success) {
            // Reset form and close modal
            this.reset();
            document.getElementById('add-transaction-modal').style.display = 'none';

            // Update UI
            await Promise.all([
                loadTransactions(), // Reload transactions
                renderBankCards()   // Update bank cards to show new balance
            ]);
            
            // Update balance summary
            updateBalanceSummary();
            
            // Show success message
            alert('Transaction added successfully!');
        } else {
            throw new Error('Failed to store transaction');
        }
    } catch (error) {
        console.error('Error adding transaction:', error);
        alert('Failed to add transaction: ' + error.message);
    } finally {
        // Reset submit button state
        const submitBtn = this.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnText;
        }
    }
});

// Modify the loadTransactions function to include better error handling
async function loadTransactions() {
    try {
        const user = auth.currentUser;
        if (!user) {
            console.error('No user logged in');
            return;
        }

        console.log('Loading transactions for user:', user.uid);
        const transactions = await getUserTransactions(user.uid);
        console.log('Loaded transactions:', transactions);

        const tableBody = document.getElementById('transactions-table-body');
        if (!tableBody) {
            console.error('Table body element not found');
            return;
        }

        const emptyState = document.getElementById('transactions-empty-state');
        
        if (!transactions || transactions.length === 0) {
            if (emptyState) emptyState.style.display = 'block';
            tableBody.innerHTML = '';
            return;
        }
        
        if (emptyState) emptyState.style.display = 'none';
        
        // Sort transactions by timestamp (most recent first)
        transactions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        tableBody.innerHTML = transactions.map(transaction => `
            <tr data-transaction-id="${transaction.id}" class="transaction-row" style="cursor: pointer;">
                <td>${transaction.name}</td>
                <td class="${transaction.type === 'income' ? 'positive' : 'negative'}">
                    ${transaction.type === 'income' ? '+' : '-'}₱${Math.abs(transaction.amount).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                </td>
                <td><span class="transaction-type ${transaction.type}">${transaction.type === 'income' ? 'Income' : 'Expense'}</span></td>
                <td>${new Date(transaction.date).toLocaleDateString()}</td>
                <td>${transaction.channel}</td>
                <td>${transaction.category}</td>
                <td class="actions">
                    <button class="delete-transaction-btn" data-id="${transaction.id}" style="opacity: 1 !important;">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');

        // Add event listeners for delete buttons
        const deleteButtons = tableBody.querySelectorAll('.delete-transaction-btn');
        deleteButtons.forEach(button => {
            button.addEventListener('click', async function(e) {
                e.preventDefault();
                e.stopPropagation(); // Prevent the row click event
                const transactionId = this.getAttribute('data-id');
                
                if (confirm('Are you sure you want to delete this transaction?')) {
                    try {
                        // First get the transaction details to know which account to update
                        const allTransactions = await getUserTransactions(user.uid);
                        const transaction = allTransactions.find(t => t.id === transactionId);
                        
                        if (!transaction) {
                            throw new Error('Transaction not found');
                        }
                        
                        // If the transaction has an associated account, update its balance
                        if (transaction.accountId) {
                            // Get the account
                            const accounts = await getUserBankAccounts(user.uid);
                            const accountToUpdate = accounts.find(acc => acc.id === transaction.accountId);
                            
                            if (accountToUpdate) {
                                // Reverse the transaction effect on balance
                                // If it was an expense (negative amount), add it back
                                // If it was income (positive amount), subtract it
                                const newBalance = parseFloat(accountToUpdate.balance) - parseFloat(transaction.amount);
                                
                                // Update the account balance
                                await updateBankAccount(user.uid, transaction.accountId, {
                                    balance: newBalance,
                                    lastUpdated: new Date().toISOString()
                                });
                            }
                        }
                        
                        // Delete the transaction
                        const success = await deleteFirestoreTransaction(user.uid, transactionId);
                        
                        if (success) {
                            // Remove the row from the table
                            const row = this.closest('tr');
                            if (row) {
                                row.remove();
                                
                                // Check if table is empty
                                if (!tableBody.hasChildNodes()) {
                                    if (emptyState) {
                                        emptyState.style.display = 'block';
                                    }
                                }
                                
                                // Update the spending chart
                                const remainingTransactions = await getUserTransactions(user.uid);
                                if (typeof updateSpendingChart === 'function') {
                                    updateSpendingChart(remainingTransactions);
                                }
                                
                                // Update recent transactions widget
                                renderRecentTransactions(remainingTransactions);
                                
                                // Update bank cards to reflect new balance
                                await renderBankCards();

                                // Refresh financial health
                                refreshFinancialHealth();
                            }
                        } else {
                            throw new Error('Failed to delete transaction');
                        }
                    } catch (error) {
                        console.error('Error deleting transaction:', error);
                        alert('Failed to delete transaction. Please try again.');
                    }
                }
            });
        });
        
        // Add event listeners for transaction row clicks to show details
        const transactionRows = tableBody.querySelectorAll('tr.transaction-row');
        transactionRows.forEach(row => {
            row.addEventListener('click', function() {
                const transactionId = this.getAttribute('data-transaction-id');
                showTransactionDetails(transactionId, transactions);
            });
        });
        
        // Update spending chart with new data
        if (typeof updateSpendingChart === 'function') {
            updateSpendingChart(transactions);
        }

        // Update the recent transactions widget
        renderRecentTransactions(transactions);

        // Refresh financial health
        refreshFinancialHealth();
    } catch (error) {
        console.error('Error loading transactions:', error);
    }
}

// Add this line to initialize transactions when the page loads
document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            loadTransactions();
        }
    });
});

// Function to populate the account dropdown in the transaction form
async function populateAccountDropdown() {
    try {
        const user = auth.currentUser;
        if (!user) {
            console.error('No user logged in');
            return;
        }

        // Get the dropdown element
        const accountDropdown = document.getElementById('transaction-account');
        if (!accountDropdown) return;

        // Clear existing options except the first one
        while (accountDropdown.options.length > 1) {
            accountDropdown.remove(1);
        }

        // Add "No Account" option
        const noAccountOption = document.createElement('option');
        noAccountOption.value = "no_account";
        noAccountOption.textContent = "No Account (Cash Transaction)";
        accountDropdown.appendChild(noAccountOption);

        // Get user's bank accounts
        const accounts = await getUserBankAccounts(user.uid);
        
        // Add a separator if there are accounts
        if (accounts && accounts.length > 0) {
            const separator = document.createElement('option');
            separator.disabled = true;
            separator.textContent = "──────────";
            accountDropdown.appendChild(separator);
        }

        // Add each account as an option
        accounts.forEach(account => {
            const option = document.createElement('option');
            option.value = account.id;
            
            // Format display text with balance
            const formattedBalance = parseFloat(account.balance).toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });
            
            option.textContent = `${account.accountName} (₱${formattedBalance})`;
            accountDropdown.appendChild(option);
        });
    } catch (error) {
        console.error('Error populating account dropdown:', error);
    }
}

// Update the add bank form submission handler
document.getElementById('add-bank-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    try {
        const user = auth.currentUser;
        if (!user) {
            throw new Error('No user logged in');
        }

        // Clear any previous validation errors
        clearAllValidationErrors(this);

        // Get and validate form fields
        const accountTypeField = document.getElementById('account-type');
        const bankNameField = document.getElementById('bank-name');
        const cardNameField = document.getElementById('card-name');
        const cardNumberField = document.getElementById('card-number');
        const balanceField = document.getElementById('balance');
        const currencyField = document.getElementById('currency');

        // Validate balance
        if (!balanceField || !balanceField.value) {
            throw new Error('Balance is required');
        }

        const balance = parseFloat(balanceField.value);
        if (isNaN(balance)) {
            throw new Error('Invalid balance amount');
        }

        // Submit button state
        const submitBtn = this.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adding Account...';
        }

        // Prepare account data
        const accountId = `acc_${Date.now()}`;
        let accountName;
        
        if (accountTypeField?.value === 'ewallet') {
            const ewalletProvider = document.getElementById('ewallet-provider');
            if (ewalletProvider.value === 'other') {
                accountName = document.getElementById('other-provider')?.value?.trim() || 'E-Wallet';
            } else {
                accountName = ewalletProvider.options[ewalletProvider.selectedIndex].text;
            }
        } else {
            accountName = bankNameField?.value?.trim() || 'My Account';
        }

        const accountData = {
            id: accountId,
            accountType: accountTypeField?.value || 'bank',
            currency: currencyField?.value || 'PHP',
            cardNumber: cardNumberField?.value?.trim() || '0000000000000000',
            cardName: cardNameField?.value?.trim() || 'Account Owner',
            balance: balance,
            createdAt: new Date().toISOString(),
            userId: user.uid,
            accountName: accountName
        };

        // Store in Firestore
        await storeBankAccount(user.uid, accountData);

        // Reset form and close modal
        this.reset();
        const modal = document.getElementById('add-bank-modal');
        if (modal) {
            modal.style.display = 'none';
        }

        // Update UI
        await renderBankCards();
        
        // Give the DOM time to update before calculating totals
        requestAnimationFrame(() => {
            updateBalanceSummary();
        });

        // Show success message
        alert('Account added successfully!');

    } catch (error) {
        console.error('Error adding account:', error);
        alert(error.message || 'Failed to add account');
    } finally {
        // Reset submit button state
        const submitBtn = this.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'Add Account';
        }
    }
});

// Add a direct event listener to the close button to make sure it works
document.addEventListener('DOMContentLoaded', function() {
    const closeAddBankButton = document.getElementById('close-add-bank');
    if (closeAddBankButton) {
        closeAddBankButton.addEventListener('click', function() {
            const addBankModal = document.getElementById('add-bank-modal');
            if (addBankModal) {
                addBankModal.style.cssText = 'display: none !important';
                console.log('Modal closed via close button');
            }
        });
    }
});

// Update the delete account function
async function deleteAccount(accountId) {
    try {
        const user = auth.currentUser;
        if (!user) {
            throw new Error('No user logged in');
        }

        // Delete from Firestore
        const accountRef = doc(db, 'users', user.uid, 'bankAccounts', accountId);
        await deleteDoc(accountRef);
        console.log('Account deleted from Firestore');

        // Re-render the cards
        await renderBankCards();

        // Show empty state if no accounts left
        const accounts = await getUserBankAccounts(user.uid);
        const emptyStateContainer = document.querySelector('.empty-state-container');
        if (accounts.length === 0 && emptyStateContainer) {
            emptyStateContainer.style.display = 'block';
        }

        // Refresh financial health
        refreshFinancialHealth();

        return true;

    } catch (error) {
        console.error('Error deleting account:', error);
        throw error;
    }
}

// Add this function to render recent transactions in the dashboard widget
function renderRecentTransactions(transactions) {
  const recentTransactionsContainer = document.getElementById('recent-transactions');
  
  // Clear existing content
  recentTransactionsContainer.innerHTML = '';
  
  // If no transactions, show empty state
  if (!transactions || transactions.length === 0) {
    recentTransactionsContainer.innerHTML = '<p class="empty-state">No recent transactions to display</p>';
    return;
  }
  
  // Get only the 3 most recent transactions
  const recentTransactions = [...transactions]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 3);
    
  // Create and append transaction items
  recentTransactions.forEach(transaction => {
    const transactionEl = document.createElement('div');
    transactionEl.className = `transaction-item ${transaction.type}`;
    
    // Format amount with proper currency symbol
    const amountText = transaction.amount >= 0 
      ? `+₱${Math.abs(transaction.amount).toLocaleString('en-US', {minimumFractionDigits: 2})}` 
      : `-₱${Math.abs(transaction.amount).toLocaleString('en-US', {minimumFractionDigits: 2})}`;
      
    // Get appropriate icon based on category
    const categoryIcon = getCategoryIcon(transaction.category);
    
    transactionEl.innerHTML = `
      <div class="transaction-icon ${transaction.category}">
        <i class="${categoryIcon}"></i>
      </div>
      <div class="transaction-details">
        <span class="transaction-name">${transaction.name}</span>
        <span class="transaction-date">${formatDate(new Date(transaction.date))}</span>
      </div>
      <div class="transaction-amount ${transaction.amount >= 0 ? 'positive' : 'negative'}">
        ${amountText}
      </div>
    `;
    
    recentTransactionsContainer.appendChild(transactionEl);
  });
}

// Helper function to get category icon
function getCategoryIcon(category) {
  const icons = {
    'food': 'fas fa-utensils',
    'shopping': 'fas fa-shopping-bag',
    'bills': 'fas fa-file-invoice',
    'transportation': 'fas fa-car',
    'entertainment': 'fas fa-film',
    'housing': 'fas fa-home',
    'health': 'fas fa-heartbeat',
    'education': 'fas fa-graduation-cap',
    'income': 'fas fa-money-bill-wave',
    'other': 'fas fa-receipt'
  };
  
  return icons[category] || 'fas fa-receipt';
}

// Helper function to format date
function formatDate(date) {
  const now = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  
  if (date.toDateString() === now.toDateString()) {
    return 'Today';
  } else if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  } else {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
}

function updateBalanceSummary() {
    try {
        // Get all bank cards except the add-card
        const bankCards = document.querySelectorAll('.bank-card:not(.add-card)');
        
        let totalBalance = 0;
        let count = 0;
        
        // Convert NodeList to Array and iterate
        Array.from(bankCards).forEach(card => {
            if (card instanceof Element) {  // Type check the node
                const balanceElement = card.querySelector('.balance');
                if (balanceElement && balanceElement.textContent) {
                    // Remove currency symbol, commas, and spaces, then parse
                    const balanceText = balanceElement.textContent.trim();
                    const balance = parseFloat(balanceText.replace(/[₱,\s]/g, ''));
                    if (!isNaN(balance)) {
                        totalBalance += balance;
                        count++;
                    }
                }
            }
        });
        
        // Update the summary displays
        const totalBalanceElement = document.getElementById('total-balance-amount');
        if (totalBalanceElement) {
            totalBalanceElement.textContent = `₱${totalBalance.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
        }
        
        const totalAccountsElement = document.getElementById('total-accounts');
        if (totalAccountsElement) {
            totalAccountsElement.textContent = count.toString();
        }

        console.log('Balance summary updated:', { totalBalance, count });
    } catch (error) {
        console.error('Error updating balance summary:', error);
        // Don't throw the error - just log it to prevent form submission from failing
    }
}

// Function to refresh financial health data
function refreshFinancialHealth() {
  // Dispatch a custom event that the financial health module will listen for
  const refreshEvent = new CustomEvent('refreshFinancialHealth');
  document.dispatchEvent(refreshEvent);
  console.log('Financial health refresh triggered');
  
  // Also refresh the forecast
  const refreshForecastEvent = new CustomEvent('refreshForecast');
  document.dispatchEvent(refreshForecastEvent);
  console.log('Forecast refresh triggered');
}

// Handle financial form submission
document.addEventListener('DOMContentLoaded', () => {
    // ... existing code ...

    // Handle financial form submission
    const financialForm = document.getElementById('financial-form');
    if (financialForm) {
        financialForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            try {
                // We've already imported these functions at the top of the file
                const user = auth.currentUser;
                if (!user) {
                    throw new Error('No user logged in');
                }

                // Clear any previous validation errors
                clearAllValidationErrors(this);
                
                // Get form fields
                const monthlyIncomeField = document.getElementById('monthly-income');
                const governmentIdField = document.getElementById('government-id');
                const addressProofField = document.getElementById('address-proof');
                const incomeProofField = document.getElementById('income-proof');
                const taxReturnField = document.getElementById('tax-return');
                
                // Validate monthly income (required, must be a positive number)
                const monthlyIncomeValidation = validateAmount(monthlyIncomeField.value);
                if (!monthlyIncomeValidation.isValid) {
                    showValidationError(this, 'monthly-income', monthlyIncomeValidation.error);
                    monthlyIncomeField.focus();
                    return;
                }
                
                // Validate file uploads
                if (!governmentIdField.files.length) {
                    showValidationError(this, 'government-id', 'Please upload a valid government ID');
                    governmentIdField.focus();
                    return;
                }
                
                if (!addressProofField.files.length) {
                    showValidationError(this, 'address-proof', 'Please upload a proof of address');
                    addressProofField.focus();
                    return;
                }
                
                if (!incomeProofField.files.length) {
                    showValidationError(this, 'income-proof', 'Please upload a proof of income');
                    incomeProofField.focus();
                    return;
                }
                
                if (!taxReturnField.files.length) {
                    showValidationError(this, 'tax-return', 'Please upload your tax return');
                    taxReturnField.focus();
                    return;
                }
                
                // Validate file types and sizes
                const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
                const maxFileSize = 5 * 1024 * 1024; // 5MB
                
                const files = [
                    { field: 'government-id', file: governmentIdField.files[0] },
                    { field: 'address-proof', file: addressProofField.files[0] },
                    { field: 'income-proof', file: incomeProofField.files[0] },
                    { field: 'tax-return', file: taxReturnField.files[0] }
                ];
                
                for (const { field, file } of files) {
                    if (!allowedTypes.includes(file.type)) {
                        showValidationError(this, field, 'Invalid file type. Please upload a JPEG, PNG, GIF, or PDF file.');
                        document.getElementById(field).focus();
                        return;
                    }
                    
                    if (file.size > maxFileSize) {
                        showValidationError(this, field, 'File is too large. Maximum size is 5MB.');
                        document.getElementById(field).focus();
                        return;
                    }
                }

                // Show loading state
                const submitButton = this.querySelector('button[type="submit"]');
                const originalButtonText = submitButton.innerHTML;
                submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading...';
                submitButton.disabled = true;

                // Create a reference to the user's documents in Firebase Storage
                const storageRef = ref(storage, `users/${user.uid}/verification`);
                
                // Upload files and get their URLs
                const [
                    governmentIdUrl,
                    addressProofUrl,
                    incomeProofUrl,
                    taxReturnUrl
                ] = await Promise.all([
                    uploadFile(storageRef, 'government-id', governmentIdField.files[0]),
                    uploadFile(storageRef, 'address-proof', addressProofField.files[0]),
                    uploadFile(storageRef, 'income-proof', incomeProofField.files[0]),
                    uploadFile(storageRef, 'tax-return', taxReturnField.files[0])
                ]);

                // Update user's financial information in Firestore
                const financialData = {
                    monthlyIncome: monthlyIncomeValidation.value,
                    documents: {
                        governmentId: governmentIdUrl,
                        addressProof: addressProofUrl,
                        incomeProof: incomeProofUrl,
                        taxReturn: taxReturnUrl
                    },
                    verificationStatus: 'pending',
                    submittedAt: new Date().toISOString()
                };

                await setDoc(doc(db, 'users', user.uid, 'financial_verification'), financialData);

                // Show success message
                showSuccessMessage('Documents uploaded successfully! They will be reviewed within 2-3 business days.');
                
                // Reset form
                this.reset();

            } catch (error) {
                console.error('Error submitting financial information:', error);
                showErrorMessage('Error submitting documents: ' + error.message);
            } finally {
                // Restore button state
                const submitButton = this.querySelector('button[type="submit"]');
                submitButton.innerHTML = originalButtonText;
                submitButton.disabled = false;
            }
        });
        
        // Add file upload preview functionality
        const fileInputs = financialForm.querySelectorAll('input[type="file"]');
        fileInputs.forEach(input => {
            input.addEventListener('change', function(e) {
                const fileInfo = this.closest('.file-upload-container').querySelector('.file-upload-info');
                if (this.files && this.files[0]) {
                    const fileName = this.files[0].name;
                    fileInfo.innerHTML = `
                        <i class="fas fa-check-circle" style="color: #10df6f;"></i>
                        <span>${fileName}</span>
                    `;
                }
            });
        });
    }
});

// Helper function to upload a file to Firebase Storage
async function uploadFile(storageRef, path, file) {
    const fileRef = ref(storageRef, path);
    await uploadBytes(fileRef, file);
    return await getDownloadURL(fileRef);
}

// Add new function to show transaction details
function showTransactionDetails(transactionId, transactions) {
    // Find the transaction by ID
    const transaction = transactions.find(t => t.id === transactionId);
    if (!transaction) return;
    
    // Get the modal and set the transaction ID for future use
    const modal = document.getElementById('transaction-details-modal');
    if (!modal) return;
    
    modal.dataset.transactionId = transactionId;
    
    // Fill in the details
    document.getElementById('view-transaction-name').textContent = transaction.name || 'N/A';
    document.getElementById('view-transaction-amount').textContent = `${transaction.type === 'income' ? '+' : '-'}₱${Math.abs(transaction.amount).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    document.getElementById('view-transaction-amount').className = transaction.type === 'income' ? 'detail-value positive' : 'detail-value negative';
    
    // Display account information if available
    const accountElement = document.getElementById('view-transaction-account');
    if (transaction.isNoAccount || !transaction.accountId) {
        accountElement.textContent = 'No Account (Cash Transaction)';
    } else {
        // Try to get account name from active accounts
        getUserBankAccounts(auth.currentUser.uid).then(accounts => {
            const account = accounts.find(a => a.id === transaction.accountId);
            if (account) {
                accountElement.textContent = account.accountName || 'Unknown Account';
            } else {
                accountElement.textContent = 'Account ID: ' + transaction.accountId;
            }
        }).catch(err => {
            console.error('Error getting account details:', err);
            accountElement.textContent = 'Account ID: ' + transaction.accountId;
        });
    }
    
    // Display the formatted date
    const dateObj = new Date(transaction.date);
    const formattedDate = dateObj.toLocaleDateString('en-US', { 
        month: 'long', 
        day: 'numeric',
        year: 'numeric'
    });
    document.getElementById('view-transaction-date').textContent = formattedDate;
    
    // Set other fields
    document.getElementById('view-transaction-channel').textContent = transaction.channel || 'N/A';
    document.getElementById('view-transaction-category').textContent = transaction.category || 'N/A';
    
    // Show the type 
    const typeElement = document.getElementById('view-transaction-status');
    typeElement.textContent = transaction.type === 'income' ? 'Income' : 'Expense';
    typeElement.className = `detail-value transaction-type ${transaction.type}`;
    
    // Set notes if available
    document.getElementById('view-transaction-notes').textContent = transaction.notes || 'No notes';
    
    // Show the modal
    modal.style.display = 'flex';
}

// Add the editTransaction function (referenced in the HTML)
function editTransaction(transactionId) {
    // This function can be implemented later
    console.log('Edit transaction:', transactionId);
    // Hide the details modal
    document.getElementById('transaction-details-modal').style.display = 'none';
}

// Add a secure logout function
function secureLogout() {
  // Clear all sensitive data from storage
  secureStorage.clearAll();
  
  // Sign out from Firebase
  signOut(auth).then(() => {
    window.location.href = "login.html";
  }).catch((error) => {
    console.error("Error signing out:", error);
    // Force redirect even if there's an error
    window.location.href = "login.html";
  });
}

// When displaying sensitive data like bank account details, implement additional security
function showSensitiveData(element, data) {
  // Only display when user is actively viewing
  if (element && data) {
    // Mask sensitive data
    if (typeof data === 'string' && data.length > 4) {
      // For card numbers, account numbers, etc.
      const lastFour = data.slice(-4);
      const masked = '•'.repeat(data.length - 4) + lastFour;
      element.textContent = masked;
      
      // Add option to temporarily reveal with additional auth
      const revealButton = document.createElement('button');
      revealButton.className = 'reveal-btn';
      revealButton.innerHTML = '<i class="fas fa-eye"></i>';
      revealButton.title = 'Reveal (requires authentication)';
      
      revealButton.addEventListener('click', () => {
        // Ask for authentication before revealing
        requestAuthentication(() => {
          // Temporarily show the actual data
          element.textContent = data;
          
          // Hide it again after a short time
          setTimeout(() => {
            element.textContent = masked;
          }, 5000); // Show for 5 seconds
        });
      });
      
      // Append button next to element
      element.parentNode.insertBefore(revealButton, element.nextSibling);
    }
  }
}

// Function to request authentication before showing sensitive data
function requestAuthentication(onSuccess) {
  // Create modal for password verification
  const modal = document.createElement('div');
  modal.className = 'auth-modal';
  modal.innerHTML = `
    <div class="auth-modal-content">
      <h3>Verify Identity</h3>
      <p>Please enter your password to view sensitive information</p>
      <input type="password" id="auth-password" placeholder="Password">
      <div class="auth-buttons">
        <button id="auth-cancel">Cancel</button>
        <button id="auth-confirm">Confirm</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Add event listeners
  document.getElementById('auth-cancel').addEventListener('click', () => {
    document.body.removeChild(modal);
  });
  
  document.getElementById('auth-confirm').addEventListener('click', async () => {
    const password = document.getElementById('auth-password').value;
    const user = auth.currentUser;
    
    if (user && password) {
      try {
        // Reauthenticate the user
        const credential = EmailAuthProvider.credential(user.email, password);
        await reauthenticateWithCredential(user, credential);
        
        // Remove modal and call success callback
        document.body.removeChild(modal);
        onSuccess();
      } catch (error) {
        alert('Authentication failed. Please try again.');
        console.error('Reauthentication error:', error);
      }
    } else {
      alert('Please enter your password.');
    }
  });
}

// Add event listener to re-populate account dropdown when transaction type changes
document.getElementById('transaction-type').addEventListener('change', function() {
    populateAccountDropdown();
});

