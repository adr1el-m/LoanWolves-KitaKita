// Dashboard Chatbot Module - Personalized Financial Assistant
import { getAuth } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-auth.js";
import { 
    getUserBankAccounts,
    getUserTransactions,
    getUserData
} from "./firestoredb.js";
import { GEMINI_API_KEY, GEMINI_MODEL } from "./config.js";

document.addEventListener('DOMContentLoaded', () => {
    const chatbotToggle = document.getElementById('chatbotToggle');
    const chatbotWindow = document.getElementById('chatbotWindow');
    const closeChatbot = document.getElementById('closeChatbot');
    const sendMessage = document.getElementById('sendMessage');
    const userInput = document.getElementById('userInput');
    const chatMessages = document.getElementById('chatMessages');

    if (!chatbotToggle || !chatbotWindow || !closeChatbot || !sendMessage || !userInput || !chatMessages) {
        console.warn('Dashboard chatbot elements not found');
        return;
    }
    
    const auth = getAuth();
    let userContext = null;
    
    // Financial advice suggestions specific to the dashboard
    const financialSuggestions = [
        "How can I improve my spending habits?",
        "What should my savings goal be?",
        "How do I reduce my expenses?",
        "How's my financial health looking?"
    ];
    
    // Initialize chatbot with user data
    async function initializeChatbot() {
        try {
            // Get user data when authenticated
            auth.onAuthStateChanged(async (user) => {
                if (user) {
                    userContext = await collectUserFinancialData(user);
                    
                    // Clear previous messages
                    chatMessages.innerHTML = '';
                    
                    // Add welcome message
                    setTimeout(() => {
                        const firstName = userContext?.userData?.firstName || 'there';
                        addMessage('bot', `Hello ${firstName}! I'm your personal financial assistant. I can provide personalized advice based on your financial data. How can I help you today?`);
                        
                        // Add suggestion buttons after a delay
                        setTimeout(() => {
                            addSuggestions();
                        }, 500);
                    }, 300);
                }
            });
            
            // Toggle chatbot window with animation
            chatbotToggle.addEventListener('click', () => {
                console.log('Chatbot toggle clicked from dashboardChatbot.js');
                chatbotWindow.classList.toggle('active');
                
                if (chatbotWindow.classList.contains('active')) {
                    chatbotWindow.style.display = 'block';
                    setTimeout(() => {
                        chatbotWindow.style.opacity = '1';
                        chatbotWindow.style.transform = 'translateY(0)';
                    }, 10);
                } else {
                    chatbotWindow.style.opacity = '0';
                    chatbotWindow.style.transform = 'translateY(20px)';
                    setTimeout(() => {
                        chatbotWindow.style.display = 'none';
                    }, 300);
                }
            });
            
            // Close chatbot window
            closeChatbot.addEventListener('click', () => {
                chatbotWindow.classList.remove('active');
                chatbotWindow.style.opacity = '0';
                chatbotWindow.style.transform = 'translateY(20px)';
                setTimeout(() => {
                    chatbotWindow.style.display = 'none';
                }, 300);
            });
            
            // Send message
            sendMessage.addEventListener('click', () => {
                sendUserMessage();
            });
            
            // Add event listener for Enter key in the input field
            userInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    sendUserMessage();
                }
            });
            
        } catch (error) {
            console.error('Error initializing dashboard chatbot:', error);
        }
    }
    
    // Function to collect user's financial data for context
    async function collectUserFinancialData(user) {
        try {
            const userData = await getUserData(user.uid);
            const accounts = await getUserBankAccounts(user.uid) || [];
            const transactions = await getUserTransactions(user.uid) || [];
            
            // Calculate total balance
            const totalBalance = accounts.reduce((sum, account) => sum + parseFloat(account.balance || 0), 0);
            
            // Calculate monthly income and expenses
            const today = new Date();
            const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
            
            const monthlyTransactions = transactions.filter(t => {
                const transactionDate = new Date(t.date);
                return transactionDate >= firstDayOfMonth;
            });
            
            const monthlyIncome = monthlyTransactions
                .filter(t => t.type === 'income')
                .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);
                
            const monthlyExpenses = monthlyTransactions
                .filter(t => t.type === 'expense')
                .reduce((sum, t) => sum + Math.abs(parseFloat(t.amount || 0)), 0);
            
            // Calculate savings rate
            const savingsRate = monthlyIncome > 0 ? ((monthlyIncome - monthlyExpenses) / monthlyIncome * 100).toFixed(1) : 0;
            
            // Get top expense categories
            const expenseCategories = {};
            monthlyTransactions
                .filter(t => t.type === 'expense')
                .forEach(t => {
                    const category = t.category || 'other';
                    expenseCategories[category] = (expenseCategories[category] || 0) + Math.abs(parseFloat(t.amount || 0));
                });
                
            const topCategories = Object.entries(expenseCategories)
                .map(([category, amount]) => ({ 
                    category, 
                    amount,
                    percentage: monthlyExpenses > 0 ? (amount / monthlyExpenses * 100).toFixed(1) : 0
                }))
                .sort((a, b) => b.amount - a.amount)
                .slice(0, 3);
            
            return {
                userData,
                accounts: {
                    count: accounts.length,
                    totalBalance
                },
                financialMetrics: {
                    monthlyIncome,
                    monthlyExpenses,
                    savingsRate,
                    topExpenseCategories: topCategories
                },
                transactions: {
                    count: transactions.length,
                    recentTransactions: transactions
                        .sort((a, b) => new Date(b.date) - new Date(a.date))
                        .slice(0, 5)
                }
            };
        } catch (error) {
            console.error('Error collecting user financial data:', error);
            return null;
        }
    }
    
    // Function to send user message
    function sendUserMessage() {
        const message = userInput.value.trim();
        if (message) {
            addMessage('user', message);
            userInput.value = '';
            // Only scroll to bottom when user sends a message
            chatMessages.scrollTop = chatMessages.scrollHeight;
            getAIResponse(message);
        }
    }
    
    // Add message to chat
    function addMessage(sender, text) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message', `${sender}-message`);
        
        // Always use innerHTML with line break handling to support formatted text
        messageElement.innerHTML = text.replace(/\n/g, '<br>');
        
        chatMessages.appendChild(messageElement);
        messageElement.style.opacity = '0';
        messageElement.style.transform = 'translateY(20px)';
        
        // Apply animations without scrolling
        setTimeout(() => {
            messageElement.style.opacity = '1';
            messageElement.style.transform = 'translateY(0)';
        }, 10);
    }
    
    // Add suggestion buttons
    function addSuggestions() {
        const suggestionsContainer = document.createElement('div');
        suggestionsContainer.classList.add('suggestions-container');
        
        financialSuggestions.forEach(suggestion => {
            const button = document.createElement('button');
            button.classList.add('suggestion-button');
            button.textContent = suggestion;
            
            button.addEventListener('click', () => {
                addMessage('user', suggestion);
                // Scroll to bottom when suggestion is clicked
                chatMessages.scrollTop = chatMessages.scrollHeight;
                getAIResponse(suggestion);
            });
            
            suggestionsContainer.appendChild(button);
        });
        
        chatMessages.appendChild(suggestionsContainer);
    }
    
    // Get AI response based on user message and data
    async function getAIResponse(message) {
        try {
            // Show loading indicator
            const loadingMessage = document.createElement('div');
            loadingMessage.classList.add('message', 'bot-message', 'typing-indicator');
            for (let i = 0; i < 3; i++) {
                const dot = document.createElement('div');
                dot.classList.add('typing-dot');
                loadingMessage.appendChild(dot);
            }
            chatMessages.appendChild(loadingMessage);
            chatMessages.scrollTop = chatMessages.scrollHeight;
            
            // Check if we have user context
            if (!userContext) {
                const user = auth.currentUser;
                if (user) {
                    userContext = await collectUserFinancialData(user);
                }
            }
            
            // Create context-aware prompt
            let contextualPrompt = '';
            if (userContext) {
                const { userData, accounts, financialMetrics, transactions } = userContext;
                
                contextualPrompt = `
                As a personalized financial assistant, please provide advice based on the following user data:
                
                USER INFO:
                Name: ${userData?.firstName || 'User'} ${userData?.lastName || ''}
                
                FINANCIAL DATA:
                Total Balance: ₱${accounts.totalBalance.toFixed(2)}
                Number of Accounts: ${accounts.count}
                Monthly Income: ₱${financialMetrics.monthlyIncome.toFixed(2)}
                Monthly Expenses: ₱${financialMetrics.monthlyExpenses.toFixed(2)}
                Savings Rate: ${financialMetrics.savingsRate}%
                
                Top expense categories:
                ${financialMetrics.topExpenseCategories.map(c => 
                    `- ${c.category}: ₱${c.amount.toFixed(2)} (${c.percentage}% of expenses)`
                ).join('\n')}
                
                Recent Transactions: ${transactions.count} total
                ${transactions.recentTransactions.map((t, i) => 
                    `${i+1}. ${t.name}: ${t.type === 'income' ? '+' : '-'}₱${Math.abs(parseFloat(t.amount)).toFixed(2)} (${t.category}, ${new Date(t.date).toLocaleDateString()})`
                ).slice(0, 3).join('\n')}
                
                Based on this financial information, give a personalized response to the user's question/request: "${message}"
                
                Be friendly but concise. Focus on providing specific, actionable advice based on the user's actual financial data.
                Keep your response under 200 words. Use the user's first name.
                `;
            } else {
                contextualPrompt = `As a financial assistant, respond to: "${message}"\n\nProvide general financial advice since you don't have access to this user's specific financial data.`;
            }
            
            // Call Gemini API with user context
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ text: contextualPrompt }]
                    }],
                    generationConfig: {
                        temperature: 0.2,
                        maxOutputTokens: 800
                    }
                })
            });
            
            // Remove loading indicator
            chatMessages.removeChild(loadingMessage);
            
            const data = await response.json();
            
            // Check for error in response
            if (data.error) {
                console.error('API Error:', data.error);
                addMessage('bot', `I'm sorry, I couldn't process your request at the moment. Please try again later.`);
                return;
            }
            
            // Extract response text from Gemini API format
            if (data && data.candidates && data.candidates.length > 0 && 
                data.candidates[0].content && data.candidates[0].content.parts && 
                data.candidates[0].content.parts.length > 0) {
                
                let responseText = data.candidates[0].content.parts[0].text;
                
                // Format the response text
                // Convert text with single asterisks to bullet points
                responseText = responseText.replace(/\n\s*\*\s*([^\n*]+)/g, '\n• $1');
                
                // Convert text with double asterisks to bold
                responseText = responseText.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
                
                addMessage('bot', responseText);
            } else {
                console.warn('Unexpected API response structure:', data);
                addMessage('bot', 'Sorry, I couldn\'t generate a response. Please try again.');
            }
        } catch (error) {
            console.error('Error calling Gemini API:', error);
            addMessage('bot', `I'm having trouble connecting right now. Please try again in a moment.`);
            
            // Remove loading indicator if it exists
            const loadingIndicator = document.querySelector('.typing-indicator');
            if (loadingIndicator) {
                chatMessages.removeChild(loadingIndicator);
            }
        }
    }
    
    // Call the initialize function
    initializeChatbot();
});
