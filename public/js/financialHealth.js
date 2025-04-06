// Financial Health Module using Gemini API
import { GEMINI_API_KEY, GEMINI_MODEL } from "./config.js";

// Import necessary Firebase functions
import { getAuth } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-auth.js";
import { 
    getUserBankAccounts,
    getUserTransactions,
    collection,
    db,
    getDocs
} from "./firestoredb.js";
import { handleAPIError } from './helpers.js';

document.addEventListener('DOMContentLoaded', () => {
    const financialHealthContent = document.getElementById('financial-health-content');
    
    if (!financialHealthContent) return;
    
    const auth = getAuth();
    
    // Initialize Financial Health Widget
    initializeFinancialHealth();
    
    async function initializeFinancialHealth() {
        try {
            // Check if user is logged in
            const user = auth.currentUser;
            if (!user) {
                // If no user yet, wait for auth state to change
                const unsubscribe = auth.onAuthStateChanged(async (user) => {
                    if (user) {
                        unsubscribe(); // Stop listening once we have a user
                        const userData = await getUserFinancialData(user);
                        processFinancialData(userData);
                    }
                });
                return;
            }
            
            // Get financial data from user's account
            const userData = await getUserFinancialData(user);
            processFinancialData(userData);
        } catch (error) {
            console.error('Error initializing financial health widget:', error);
            showError("Something went wrong. Please try again later.");
        }
    }
    
    // Refresh financial health data
    async function refreshFinancialHealth(user) {
        try {
            // Clear any cached analysis
            sessionStorage.removeItem('financialHealthAnalysis');
            
            // Show loading state
            financialHealthContent.innerHTML = `
                <div class="loading-state">
                    <div class="pulse-loader"></div>
                    <p>Refreshing your financial data...</p>
                </div>
            `;
            
            // Get fresh data and process it
            const userData = await getUserFinancialData(user);
            processFinancialData(userData);
        } catch (error) {
            console.error('Error refreshing financial health:', error);
        }
    }
    
    async function processFinancialData(userData) {
        if (!userData) {
            showPlaceholderData();
            return;
        }
        
        try {
            // Analyze financial data with Gemini
            const analysis = await analyzeFinancialHealth(userData);
            
            // Render the widget with analysis results
            renderFinancialHealthWidget(analysis, userData);
        } catch (error) {
            console.error('Error processing financial data:', error);
            showPlaceholderData();
        }
    }
    
    function showPlaceholderData() {
        // Show empty state message instead of default analysis
        financialHealthContent.innerHTML = `
            <div class="empty-state" style="text-align: center; padding: 2rem;">
                <i class="fas fa-chart-line" style="font-size: 3rem; color: rgba(255, 255, 255, 0.3); margin-bottom: 1.5rem;"></i>
                <h3>No Financial Data Available</h3>
                <p>To see your financial health analysis:</p>
                <ul style="list-style: none; padding: 0; margin-top: 1rem; text-align: left; display: inline-block;">
                    <li style="margin-bottom: 0.5rem;"><i class="fas fa-plus-circle" style="margin-right: 0.5rem;"></i> Add bank accounts</li>
                    <li style="margin-bottom: 0.5rem;"><i class="fas fa-exchange-alt" style="margin-right: 0.5rem;"></i> Record transactions</li>
                </ul>
                <p style="margin-top: 1rem;">Once you have some financial activity, we'll analyze your data and provide personalized insights.</p>
            </div>
        `;
    }
    
    async function getUserFinancialData(user) {
        if (!user) return null;
        
        try {
            // Get balance data
            const accounts = await getUserBankAccounts(user.uid) || [];
            
            // If no accounts, return null
            if (accounts.length === 0) {
                return null;
            }
            
            const totalBalance = accounts.reduce((sum, account) => sum + parseFloat(account.balance || 0), 0);
            
            // Get transaction data
            const transactions = await getUserTransactions(user.uid) || [];
            
            // If there are accounts but no transactions, return basic account data
            if (transactions.length === 0) {
                return {
                    totalBalance,
                    accounts: accounts.length,
                    monthlyIncome: 0,
                    monthlyExpenses: 0,
                    hasOnlyAccounts: true,
                    expenseCategories: []
                };
            }
            
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
            
            // Get transaction categories
            const expenseCategories = {};
            monthlyTransactions
                .filter(t => t.type === 'expense')
                .forEach(t => {
                    const category = t.category || 'other';
                    expenseCategories[category] = (expenseCategories[category] || 0) + Math.abs(parseFloat(t.amount || 0));
                });
            
            // Format categories for analysis
            const formattedCategories = Object.entries(expenseCategories)
                .map(([category, amount]) => ({ 
                    category, 
                    amount,
                    percentage: monthlyExpenses > 0 ? (amount / monthlyExpenses * 100).toFixed(1) : 0
                }))
                .sort((a, b) => b.amount - a.amount);
            
            // Check for recent unusual expenses
            const lastWeek = new Date();
            lastWeek.setDate(lastWeek.getDate() - 7);
            
            const recentTransactions = transactions
                .filter(t => new Date(t.date) >= lastWeek)
                .sort((a, b) => Math.abs(parseFloat(b.amount)) - Math.abs(parseFloat(a.amount)));
            
            const largeExpenses = recentTransactions
                .filter(t => t.type === 'expense' && Math.abs(parseFloat(t.amount)) > (monthlyIncome * 0.1))
                .slice(0, 3);
            
            return {
                totalBalance,
                accounts: accounts.length,
                monthlyIncome,
                monthlyExpenses,
                expenseCategories: formattedCategories,
                recentTransactions: monthlyTransactions.slice(0, 5),
                largeExpenses
            };
        } catch (error) {
            console.error('Error getting user financial data:', error);
            return null;
        }
    }
    
    async function analyzeFinancialHealth(userData) {
        try {
            // Check if there's already a cached analysis
            const cachedAnalysis = sessionStorage.getItem('financialHealthAnalysis');
            if (cachedAnalysis) {
                return JSON.parse(cachedAnalysis);
            }
            
            // Basic analysis for when user only has accounts but no transactions
            if (userData.hasOnlyAccounts) {
                const basicAnalysis = {
                    score: 65,
                    status: `You've added ${userData.accounts} account(s) with a total balance of ₱${userData.totalBalance.toFixed(2)}`,
                    insights: [
                        {type: "positive", text: `Your account balance of ₱${userData.totalBalance.toFixed(2)} is a good starting point for financial tracking.`},
                        {type: "opportunity", text: "Start recording your income and expenses to gain insights into your spending patterns."},
                        {type: "neutral", text: "Regular transaction tracking will help identify areas where you can optimize your spending."}
                    ],
                    suggestion: "Add your next income or expense transaction to start building your financial profile."
                };
                
                sessionStorage.setItem('financialHealthAnalysis', JSON.stringify(basicAnalysis));
                return basicAnalysis;
            }
            
            // Add info about large recent expenses if any
            let largeExpensesInfo = '';
            if (userData.largeExpenses && userData.largeExpenses.length > 0) {
                largeExpensesInfo = `\nNotable recent expenses:\n${userData.largeExpenses.map(e => 
                    `- ${e.name}: ₱${Math.abs(parseFloat(e.amount)).toFixed(2)} (${e.category}, ${new Date(e.date).toLocaleDateString()})`
                ).join('\n')}`;
            }
            
            // Prepare data for Gemini API
            const prompt = `
            You are a financial health advisor. Based on the following financial data for this month, provide a detailed analysis:
            
            Total Balance: ₱${userData.totalBalance.toFixed(2)}
            Number of Accounts: ${userData.accounts}
            Monthly Income: ₱${userData.monthlyIncome.toFixed(2)}
            Monthly Expenses: ₱${userData.monthlyExpenses.toFixed(2)}
            
            Top expense categories:
            ${userData.expenseCategories.slice(0, 3).map(c => 
                `- ${c.category}: ₱${c.amount.toFixed(2)} (${c.percentage}%)`
            ).join('\n')}
            ${largeExpensesInfo}
            
            Please provide a PERSONALIZED financial health analysis with the following elements:
            1. A financial health score from 0-100 based on:
               - Expense-to-income ratio (below 70% is good)
               - Account balance relative to monthly expenses
               - Diversification of spending
               - Presence of large unusual expenses

            2. A brief status description (1 sentence) that specifically mentions their key financial strength or area for improvement

            3. Provide 2-4 specific, personalized insights directly referencing:
               - Their expense-to-income ratio and how it compares to recommended levels
               - Their highest spending category and whether it's appropriate
               - Their account balance relative to monthly expenses
               - Any other relevant observation about their spending patterns

            4. Label each insight as:
               - "positive" for good habits or achievements
               - "negative" for concerning patterns
               - "neutral" for informational or balanced observations
               - "warning" for urgent issues that need immediate attention
               - "opportunity" for growth potential based on their specific situation

            5. Include one practical, actionable suggestion that directly addresses their largest expense category or lowest financial score area

            Format your response as valid JSON with the following structure:
            {
                "score": 85,
                "status": "Your expense management is strong with a 65% expense-to-income ratio",
                "insights": [
                    {"type": "positive", "text": "Your expense-to-income ratio of 65% is within the recommended range."},
                    {"type": "warning", "text": "Housing expenses at 45% of your income are significantly higher than the recommended 30% maximum."},
                    {"type": "opportunity", "text": "With your current balance covering 2 months of expenses, consider building this to 3-6 months."},
                    {"type": "negative", "text": "Your discretionary spending has increased 25% compared to last month."}
                ],
                "suggestion": "To reduce your high housing costs, consider a roommate or negotiating rent at renewal time."
            }
            
            Make ALL insights and suggestions highly specific to their actual financial data. Reference actual numbers from their data. Avoid generic advice.
            `;
            
            // If API key is missing, return default analysis
            if (!GEMINI_API_KEY) {
                console.warn('Missing Gemini API key');
                return defaultAnalysis();
            }
            
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ text: prompt }]
                    }],
                    generationConfig: {
                        temperature: 0.2,
                        maxOutputTokens: 800
                    }
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                console.error('API response error:', errorData);
                const errorMessage = handleAPIError(errorData, response);
                throw new Error(errorMessage);
            }
            
            const data = await response.json();
            
            if (data.error) {
                console.error('API Error:', data.error);
                const errorMessage = handleAPIError(data.error);
                throw new Error(errorMessage);
            }
            
            // Extract response text
            if (data && data.candidates && data.candidates.length > 0 && 
                data.candidates[0].content && data.candidates[0].content.parts && 
                data.candidates[0].content.parts.length > 0) {
                
                const responseText = data.candidates[0].content.parts[0].text;
                
                try {
                    // Extract JSON from response text
                    const jsonStart = responseText.indexOf('{');
                    const jsonEnd = responseText.lastIndexOf('}') + 1;
                    const jsonString = responseText.substring(jsonStart, jsonEnd);
                    
                    const parsedResult = JSON.parse(jsonString);
                    
                    // Cache the result
                    sessionStorage.setItem('financialHealthAnalysis', JSON.stringify(parsedResult));
                    
                    return parsedResult;
                } catch (parseError) {
                    console.error('Error parsing Gemini response:', parseError);
                    return defaultAnalysis();
                }
            } else {
                console.warn('Unexpected API response structure:', data);
                return defaultAnalysis();
            }
        } catch (error) {
            console.error('Error analyzing financial health:', error);
            const errorMessage = handleAPIError(error);
            showError(`Failed to analyze financial health: ${errorMessage}`);
            return defaultAnalysis();
        }
    }
    
    function defaultAnalysis() {
        // Generate more dynamic default values that would be similar to what the AI would produce
        // but without hardcoding specific suggestions
        return {
            score: 72,
            status: "Your financial health is good with room for improvement",
            insights: [
                {type: "positive", text: "Your regular savings contribute to long-term financial stability."},
                {type: "opportunity", text: "Consider diversifying your financial portfolio for better risk management."},
                {type: "neutral", text: "Review your monthly expenses to identify potential savings opportunities."},
                {type: "warning", text: "Watch your spending in discretionary categories to improve your overall financial health."}
            ],
            suggestion: ""
        };
    }
    
    function renderFinancialHealthWidget(analysis, userData) {
        const scorePercent = `${analysis.score}%`;
        
        // Determine score color
        let scoreColor = '#2196F3'; // Default blue
        if (analysis.score >= 80) {
            scoreColor = '#10df6f'; // Green for good
        } else if (analysis.score < 50) {
            scoreColor = '#ff3b30'; // Red for poor
        } else if (analysis.score < 70) {
            scoreColor = '#ffcc00'; // Yellow for average
        }
        
        // Limit insights to a maximum of 4
        const limitedInsights = analysis.insights.slice(0, 4);
        
        const html = `
            <div class="financial-health-score">
                <div class="score-circle" style="--score-percent: ${scorePercent}; --score-color: ${scoreColor}">
                    <span class="score-value">${analysis.score}</span>
                </div>
                <div class="score-details">
                    <div class="score-label">Financial Health Score</div>
                    <div class="score-description">${analysis.status}</div>
                </div>
                <button class="refresh-button" id="refresh-financial-health">
                    <i class="fas fa-sync-alt"></i>
                </button>
            </div>
            
            <div class="financial-insights">
                ${limitedInsights.map(insight => `
                    <div class="insight-item">
                        <div class="insight-icon ${insight.type}">
                            <i class="fas ${getInsightIcon(insight.type)}"></i>
                        </div>
                        <div class="insight-content">
                            ${insight.text}
                        </div>
                    </div>
                `).join('')}
            </div>
            
            ${analysis.suggestion ? `
                <div class="suggestion-container" style="background-color: rgba(16, 223, 111, 0.1); border-left: 4px solid #10df6f; padding: 15px; margin: 15px 0; border-radius: 4px;">
                    <h3><i class="fas fa-lightbulb" style="color: #10df6f;"></i> Action Step</h3>
                    <p>${analysis.suggestion}</p>
                </div>
            ` : ''}
        `;
        
        // Update the widget content
        financialHealthContent.innerHTML = html;
        
        // Add event listener to refresh button
        const refreshButton = document.getElementById('refresh-financial-health');
        if (refreshButton) {
            refreshButton.addEventListener('click', () => {
                const user = auth.currentUser;
                if (user) {
                    refreshFinancialHealth(user);
                }
            });
        }
    }
    
    function getInsightIcon(type) {
        switch (type) {
            case 'positive': return 'fa-arrow-up';
            case 'negative': return 'fa-arrow-down';
            case 'neutral': return 'fa-minus';
            case 'warning': return 'fa-exclamation-triangle';
            case 'opportunity': return 'fa-star';
            default: return 'fa-info-circle';
        }
    }
    
    function showError(message) {
        financialHealthContent.innerHTML = `
            <div class="error-state" style="text-align: center; padding: 2rem;">
                <i class="fas fa-exclamation-circle" style="font-size: 2rem; color: #ff3b30; margin-bottom: 1rem;"></i>
                <p>${message}</p>
                <button class="action-button" style="margin-top: 1rem;" onclick="location.reload()">
                    <i class="fas fa-sync"></i> Retry
                </button>
            </div>
        `;
    }
    
    // Listen for custom refresh events from dashboard.js
    document.addEventListener('refreshFinancialHealth', () => {
        console.log('Financial health refresh event received');
        const user = auth.currentUser;
        if (user) {
            refreshFinancialHealth(user);
        }
    });
    
    // Handle page visibility changes - refresh when user returns to page
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            const user = auth.currentUser;
            if (user) {
                refreshFinancialHealth(user);
            }
        }
    });
}); 