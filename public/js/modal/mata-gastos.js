// Gabay Gastos: Advanced AI Financial Behavior Analysis & Intelligent Spending Assistant
import { getAuth } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-auth.js";
import { 
    getUserTransactions,
    getUserBankAccounts,
    getUserData,
    storeUserData
} from "../firestoredb.js";

// Make the function globally accessible
window.loadMataGastosContent = loadMataGastosContent;

// Enhanced ML model configuration with advanced AI parameters - focused on only what's used
const ML_CONFIG = {
    // Core Financial Analysis Parameters
    UNUSUAL_EXPENSE_THRESHOLD: 1.5,          // Multiplier to detect unusual expenses
    RECURRING_PATTERN_THRESHOLD: 2,          // Minimum occurrences to identify recurring expenses
    
    // Financial Health Metrics
    SAVINGS_RATIO_IDEAL: 0.2,                // Ideal savings ratio (20% of income)
    DEBT_TO_INCOME_WARNING: 0.35,            // Warning threshold for debt to income ratio
    EMERGENCY_FUND_MONTHS: 6,                // Recommended emergency fund coverage in months
    
    // Smart Budgeting
    CATEGORY_MAX_THRESHOLD: 0.3,             // Maximum recommended spending in one category (30% of total)
    EXPENSE_TO_INCOME_WARNING: 0.8           // Warning threshold for expense-to-income ratio
};

// Implementation of loadMataGastosContent function
async function loadMataGastosContent() {
    const contentContainer = document.getElementById('mata-gastos-modal-content');
    
    if (!contentContainer) {
        console.error("Mata-Gastos content container not found");
        return;
    }
    
    try {
        const auth = getAuth();
        const user = auth.currentUser;
        
        if (!user) {
            contentContainer.innerHTML = `
                <div class="error-state">
                    <i class="fas fa-exclamation-circle"></i>
                    <p>Please log in to view your financial insights.</p>
                </div>
            `;
            return;
        }

        // Show loading state
        contentContainer.innerHTML = `
            <div class="loading-state">
                <div class="pulse-loader"></div>
                <p>Analyzing your financial behavior and spending patterns...</p>
            </div>
        `;

        // Get user data and transactions
        const userData = await getUserData(user.uid);
        const transactions = await getUserTransactions(user.uid);
        const bankAccounts = await getUserBankAccounts(user.uid);
        
        if (!transactions || transactions.length === 0) {
            contentContainer.innerHTML = `
                <div class="error-state">
                    <i class="fas fa-exclamation-circle"></i>
                    <p>We need more transaction data to analyze your spending patterns. Please add some transactions first.</p>
                    <button class="action-button" onclick="document.getElementById('add-transaction-modal').style.display='flex'">
                        <i class="fas fa-plus"></i> Add Transaction
                    </button>
                </div>
            `;
            return;
        }

        // Generate the content with spending insights
        contentContainer.innerHTML = `
            <div class="mata-gastos-container">
                <div class="spending-overview">
                    <div class="section-header">
                        <i class="fas fa-chart-line"></i>
                        <h3>Your Spending Overview</h3>
                        <span class="subtitle">Monthly Analysis</span>
                    </div>
                    <div class="spending-stats-grid">
                        <div class="stat-card">
                            <div class="stat-icon">
                                <i class="fas fa-wallet"></i>
                            </div>
                            <div class="stat-info">
                                <div class="stat-value">₱${formatAmount(calculateTotalSpending(transactions))}</div>
                                <div class="stat-label">Monthly Spending</div>
                            </div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-icon">
                                <i class="fas fa-chart-bar"></i>
                            </div>
                            <div class="stat-info">
                                <div class="stat-value">${calculateSpendingTrend(transactions)}%</div>
                                <div class="stat-label">Spending Trend</div>
                            </div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-icon">
                                <i class="fas fa-receipt"></i>
                            </div>
                            <div class="stat-info">
                                <div class="stat-value">₱${formatAmount(calculateAverageTransaction(transactions))}</div>
                                <div class="stat-label">Avg. Transaction</div>
                            </div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-icon">
                                <i class="fas fa-tags"></i>
                            </div>
                            <div class="stat-info">
                                <div class="stat-value">${calculateTopCategory(transactions)}</div>
                                <div class="stat-label">Top Category</div>
                            </div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-icon">
                                <i class="fas fa-piggy-bank"></i>
                            </div>
                            <div class="stat-info">
                                <div class="stat-value">${calculateSavingsRate(transactions, userData)}%</div>
                                <div class="stat-label">Savings Rate</div>
                            </div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-icon">
                                <i class="fas fa-calendar-alt"></i>
                            </div>
                            <div class="stat-info">
                                <div class="stat-value">₱${formatAmount(calculateRecurringExpenses(transactions))}</div>
                                <div class="stat-label">Monthly Recurring</div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="spending-insights">
                    <div class="section-header">
                        <i class="fas fa-lightbulb"></i>
                        <h3>AI-Powered Insights</h3>
                        <span class="subtitle">Based on Your Spending Patterns</span>
                    </div>
                    <div class="insights-list">
                        ${generateInsights(transactions, userData)}
                    </div>
                </div>

                <div class="recommended-actions">
                    <div class="section-header">
                        <i class="fas fa-tasks"></i>
                        <h3>Recommended Actions</h3>
                        <span class="subtitle">Personalized Financial Advice</span>
                    </div>
                    <div class="actions-grid">
                        ${generateRecommendedActions(transactions, userData)}
                    </div>
                </div>
            </div>
        `;
        
    } catch (error) {
        console.error('Error loading Mata-Gastos content:', error);
        contentContainer.innerHTML = `
            <div class="error-state">
                <i class="fas fa-exclamation-circle"></i>
                <p>Error analyzing spending patterns: ${error.message || 'Unknown error'}</p>
                <button class="action-button" onclick="loadMataGastosContent()">
                    <i class="fas fa-redo"></i> Retry
                </button>
            </div>
        `;
    }
}

// Helper functions for Mata-Gastos analysis
function calculateTotalSpending(transactions) {
    return transactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + Math.abs(parseFloat(t.amount)), 0);
}

function calculateSpendingTrend(transactions) {
    // Simple trend calculation comparing last month to previous month
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    
    const lastMonthSpending = transactions
        .filter(t => t.type === 'expense' && new Date(t.date) >= lastMonth && new Date(t.date) < now)
        .reduce((sum, t) => sum + Math.abs(parseFloat(t.amount)), 0);
        
    const previousMonthSpending = transactions
        .filter(t => t.type === 'expense' && new Date(t.date) >= twoMonthsAgo && new Date(t.date) < lastMonth)
        .reduce((sum, t) => sum + Math.abs(parseFloat(t.amount)), 0);
    
    if (previousMonthSpending === 0) return 0;
    
    return Math.round(((lastMonthSpending - previousMonthSpending) / previousMonthSpending) * 100);
}

function calculateAverageTransaction(transactions) {
    if (transactions.length === 0) return 0;
    const expenses = transactions.filter(t => t.type === 'expense');
    if (expenses.length === 0) return 0;
    
    const total = expenses.reduce((sum, t) => sum + Math.abs(parseFloat(t.amount)), 0);
    return total / expenses.length;
}

function calculateTopCategory(transactions) {
    const categoryMap = transactions
        .filter(t => t.type === 'expense')
        .reduce((map, t) => {
            const category = t.category || 'Uncategorized';
            map[category] = (map[category] || 0) + Math.abs(parseFloat(t.amount));
            return map;
        }, {});
    
    let topCategory = 'None';
    let maxAmount = 0;
    
    Object.entries(categoryMap).forEach(([category, amount]) => {
        if (amount > maxAmount) {
            maxAmount = amount;
            topCategory = category;
        }
    });
    
    return topCategory;
}

// Calculate savings rate as a percentage of income
function calculateSavingsRate(transactions, userData) {
    const monthlyIncome = userData?.financialProfile?.monthlyIncome || calculateEstimatedMonthlyIncome(transactions);
    const totalSpending = calculateTotalSpending(transactions);
    
    if (monthlyIncome <= 0) return 0;
    
    const savingsRate = ((monthlyIncome - totalSpending) / monthlyIncome) * 100;
    return Math.max(0, Math.round(savingsRate)); // Return positive whole number or zero
}

// Calculate total monthly recurring expenses
function calculateRecurringExpenses(transactions) {
    const recurringExpenses = identifyRecurringExpenses(transactions);
    return recurringExpenses.reduce((sum, exp) => sum + exp.averageAmount, 0);
}

// Generate dynamic insights based purely on transaction patterns without any hardcoded suggestions
function generateInsights(transactions, userData) {
    const insights = [];
    
    // Access user's financial profile
    const monthlyIncome = userData?.financialProfile?.monthlyIncome || calculateEstimatedMonthlyIncome(transactions);
    const totalBalance = calculateTotalBalance(userData);
    
    // Calculate key financial metrics
    const totalSpending = calculateTotalSpending(transactions);
    const expenseToIncomeRatio = monthlyIncome ? (totalSpending / monthlyIncome) : 1;
    const categories = getExpenseCategoryBreakdown(transactions);
    
    // DYNAMIC INSIGHTS BASED ON ACTUAL DATA PATTERNS
    
    // Income vs Spending Analysis
    if (monthlyIncome > 0) {
        if (expenseToIncomeRatio > 1) {
            insights.push(createInsightCard(
                'warning',
                'fa-exclamation-triangle',
                'Spending Exceeds Income',
                `You're spending ₱${formatAmount(totalSpending - monthlyIncome)} more than your income. This is unsustainable long-term and may lead to debt.`
            ));
        } else if (expenseToIncomeRatio > 0.9) {
            insights.push(createInsightCard(
                'warning',
                'fa-exclamation-circle',
                'Limited Financial Buffer',
                `You're spending ${(expenseToIncomeRatio * 100).toFixed(0)}% of your income, leaving little room for savings. Aim to reduce this to below 80%.`
            ));
        } else if (expenseToIncomeRatio < 0.5) {
            insights.push(createInsightCard(
                'positive',
                'fa-thumbs-up',
                'Strong Saving Potential',
                `You're only spending ${(expenseToIncomeRatio * 100).toFixed(0)}% of your income. This is excellent and gives you strong potential for investing and building wealth.`
            ));
        }
    }
    
    // Category Analysis - generate dynamic insights based on actual spending categories
    if (categories.length > 0) {
        const topCategory = categories[0];
        
        // Unbalanced spending in any category
        if (topCategory.percentage > 50) {
            insights.push(createInsightCard(
                'warning',
                'fa-balance-scale',
                'Unbalanced Spending',
                `${topCategory.percentage.toFixed(0)}% of your expenses are in ${topCategory.category}. Consider diversifying your spending for better financial health.`
            ));
        }
        
        // Dynamic insight for the user's actual top spending category
        insights.push(createInsightCard(
            'neutral',
            getCategoryIcon(topCategory.category),
            `${capitalizeFirst(topCategory.category)} Analysis`,
            generateCategorySpecificAdvice(topCategory.category, topCategory.percentage, monthlyIncome)
        ));
    }
    
    // Emergency fund analysis
    const emergencyFundMonths = totalBalance / (totalSpending > 0 ? totalSpending : monthlyIncome);
    if (emergencyFundMonths < 3) {
        insights.push(createInsightCard(
            'warning',
            'fa-shield-alt',
            'Emergency Fund Status',
            `Your current balance could cover only ${emergencyFundMonths.toFixed(1)} months of expenses. Financial experts recommend having 3-6 months saved.`
        ));
    } else if (emergencyFundMonths >= 3 && emergencyFundMonths < 6) {
        insights.push(createInsightCard(
            'neutral',
            'fa-shield-alt',
            'Emergency Fund Status',
            `Your current balance could cover ${emergencyFundMonths.toFixed(1)} months of expenses. You're on the right track! Consider building up to 6 months for extra security.`
        ));
    }
    
    // Analyze spending trends
    const spendingTrend = calculateSpendingTrend(transactions);
    if (spendingTrend !== 0) {
        const trendDirection = spendingTrend > 0 ? 'increased' : 'decreased';
        const trendIcon = spendingTrend > 0 ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down';
        const trendType = spendingTrend > 0 ? 'warning' : 'positive';
        
        insights.push(createInsightCard(
            trendType,
            trendIcon,
            'Monthly Spending Trend',
            `Your monthly spending has ${trendDirection} by ${Math.abs(spendingTrend)}% compared to the previous month. ${spendingTrend > 10 ? 'Consider reviewing your budget to ensure this trend is sustainable.' : ''}`
        ));
    }
    
    // Analyze recurring expenses
    const recurringExpenses = identifyRecurringExpenses(transactions);
    if (recurringExpenses.length > 0) {
        const totalRecurring = recurringExpenses.reduce((sum, exp) => sum + exp.averageAmount, 0);
        if (totalRecurring > (monthlyIncome * 0.4)) {
            insights.push(createInsightCard(
                'warning',
                'fa-calendar-alt',
                'High Recurring Expenses',
                `Your recurring expenses of ₱${formatAmount(totalRecurring)} represent ${((totalRecurring/monthlyIncome)*100).toFixed(0)}% of your income. Consider reviewing these commitments.`
            ));
        }
    }
    
    // If no insights were generated, provide a basic financial health overview
    if (insights.length === 0) {
        if (transactions.length > 0) {
            insights.push(createInsightCard(
                'neutral',
                'fa-chart-line',
                'Financial Overview',
                `Your total spending this month is ₱${formatAmount(totalSpending)}. ${monthlyIncome > 0 ? `This represents ${(expenseToIncomeRatio * 100).toFixed(0)}% of your monthly income.` : ''}`
            ));
        } else {
            insights.push(createInsightCard(
                'neutral',
                'fa-chart-line',
                'Welcome to Financial Insights',
                'Start tracking your transactions to receive personalized financial insights and recommendations.'
            ));
        }
    }
    
    // Return top 3 most relevant insights
    return insights.slice(0, 3).join('');
}

// Helper function to create insight cards with consistent styling
function createInsightCard(type, icon, title, description) {
    return `
        <div class="insight-card ${type}">
            <div class="insight-header">
                <div class="insight-icon">
                    <i class="fas ${icon}"></i>
                </div>
                <div class="insight-info">
                    <div class="insight-title">${title}</div>
                </div>
            </div>
            <div class="insight-description">
                ${description}
            </div>
        </div>
    `;
}

// Function to calculate total account balance from userData
function calculateTotalBalance(userData) {
    // If userData contains bankAccounts array directly
    if (userData && userData.bankAccounts && Array.isArray(userData.bankAccounts)) {
        return userData.bankAccounts.reduce((sum, account) => sum + (parseFloat(account.balance) || 0), 0);
    }
    
    // Otherwise return 0 as we can't determine the balance
    return 0;
}

// Function to find unusual expenses
function findUnusualExpense(transactions) {
    // Group expenses by name/description
    const expensesByName = {};
    
    transactions.forEach(t => {
        if (t.type === 'expense') {
            const name = t.name || t.description || 'Unknown';
            if (!expensesByName[name]) {
                expensesByName[name] = [];
            }
            expensesByName[name].push({
                amount: Math.abs(parseFloat(t.amount)),
                date: new Date(t.date)
            });
        }
    });
    
    // Look for any expense that's significantly higher than the average for that category
    let highestDeviation = null;
    
    Object.entries(expensesByName).forEach(([name, expenses]) => {
        if (expenses.length < 2) return; // Need at least 2 expenses to compare
        
        // Sort by date, most recent first
        expenses.sort((a, b) => b.date - a.date);
        
        // Get most recent expense
        const mostRecent = expenses[0];
        
        // Calculate average of previous expenses
        const previousExpenses = expenses.slice(1);
        const avgAmount = previousExpenses.reduce((sum, exp) => sum + exp.amount, 0) / previousExpenses.length;
        
        // Check if most recent is significantly higher
        if (mostRecent.amount > avgAmount * 1.5) { // 50% higher than average
            const deviation = {
                name: name,
                amount: mostRecent.amount,
                average: avgAmount,
                percentHigher: Math.round((mostRecent.amount / avgAmount - 1) * 100),
                date: mostRecent.date
            };
            
            // Keep track of highest deviation
            if (!highestDeviation || deviation.percentHigher > highestDeviation.percentHigher) {
                highestDeviation = deviation;
            }
        }
    });
    
    return highestDeviation;
}

// Generate recommended actions based on actual financial data patterns
function generateRecommendedActions(transactions, userData) {
    const actions = [];
    
    // Get user's financial profile data
    const monthlyIncome = userData?.financialProfile?.monthlyIncome || calculateEstimatedMonthlyIncome(transactions);
    const totalBalance = calculateTotalBalance(userData);
    const spendingTotal = calculateTotalSpending(transactions);
    const categories = getExpenseCategoryBreakdown(transactions);
    
    // Advanced analysis for personalized recommendations
    const recurringExpenses = identifyRecurringExpenses(transactions);
    const totalRecurringExpense = recurringExpenses.reduce((sum, exp) => sum + exp.averageAmount, 0);
    const savingsRate = monthlyIncome > 0 ? ((monthlyIncome - spendingTotal) / monthlyIncome) * 100 : 0;
    const expenseRatio = monthlyIncome > 0 ? (spendingTotal / monthlyIncome) : 1;
    const weekdaySpending = analyzeWeekdaySpending(transactions);
    const frequentMerchants = identifyFrequentMerchants(transactions);
    const potentialSavings = identifyPotentialSavings(transactions, recurringExpenses);
    
    // TRULY PERSONALIZED RECOMMENDATIONS BASED ON USER'S UNIQUE DATA
    
    // Savings Rate Recommendations
    if (savingsRate < 10) {
        actions.push(createActionCard(
            'fa-piggy-bank',
            'Increase Your Savings Rate',
            `Your current savings rate is ${savingsRate.toFixed(1)}% of income. Try to save at least 10% by reducing expenses in your highest spending categories.`,
            'medium'
        ));
    } else if (savingsRate >= 10 && savingsRate < 20) {
        actions.push(createActionCard(
            'fa-chart-line',
            'Build Emergency Fund',
            `You're saving ${savingsRate.toFixed(1)}% of your income. Consider allocating these savings to an emergency fund until you have 3-6 months of expenses saved.`,
            'easy'
        ));
    } else if (savingsRate >= 20) {
        actions.push(createActionCard(
            'fa-chart-pie',
            'Consider Investing',
            `With a ${savingsRate.toFixed(1)}% savings rate, you're in a good position to start investing. Consider diversifying some of your savings into growth assets.`,
            'medium'
        ));
    }
    
    // Category-specific recommendations
    if (categories.length > 0) {
        const topCategory = categories[0];
        if (topCategory.percentage > 40) {
            actions.push(createActionCard(
                getCategoryIcon(topCategory.category),
                `Reduce ${topCategory.category} Expenses`,
                generateCategoryReduction(topCategory.category, topCategory.amount, monthlyIncome),
                'medium'
            ));
        }
    }
    
    // Expense-to-Income Ratio Recommendations
    if (expenseRatio > 0.9) {
        actions.push(createActionCard(
            'fa-exclamation-triangle',
            'Reduce Expense-to-Income Ratio',
            `You're spending ${(expenseRatio * 100).toFixed(0)}% of your income. Identify your top 3 non-essential expenses and aim to reduce each by 10-15%.`,
            'hard'
        ));
    }
    
    // Recurring Expense Recommendations
    if (totalRecurringExpense > (monthlyIncome * 0.4) && recurringExpenses.length > 0) {
        actions.push(createActionCard(
            'fa-calendar-alt',
            'Review Recurring Expenses',
            `Your recurring payments make up ${Math.round(totalRecurringExpense/monthlyIncome*100)}% of your income. Consider negotiating or eliminating your subscription to ${recurringExpenses[0].name} (₱${recurringExpenses[0].averageAmount.toFixed(2)}/month).`,
            'easy'
        ));
    }
    
    // Potential Savings Recommendations
    if (potentialSavings.category && potentialSavings.amount > 0) {
        actions.push(createActionCard(
            'fa-hand-holding-dollar',
            `Save on ${potentialSavings.category}`,
            `You could save approximately ₱${formatAmount(potentialSavings.amount)} monthly by optimizing your ${potentialSavings.category} expenses. ${potentialSavings.suggestion}`,
            'medium'
        ));
    }
    
    // Timing-based recommendations from weekday analysis
    if (weekdaySpending.highestDay) {
        actions.push(createActionCard(
            'fa-calendar-check',
            'Plan Your Spending Days',
            `Schedule your shopping and major purchases away from ${weekdaySpending.highestDay}s when you tend to spend more. Consider preparing a shopping list and budget before shopping trips.`,
            'easy'
        ));
    }
    
    // Income-based recommendations
    if (monthlyIncome > 0) {
        if (monthlyIncome < 20000) {
            actions.push(createActionCard(
                'fa-hand-holding-usd',
                'Focus on Essential Expenses',
                `With your current income level, try to keep essential expenses under 70% of your income. Look for opportunities to increase income through skills development.`,
                'medium'
            ));
        } else if (monthlyIncome >= 50000) {
            actions.push(createActionCard(
                'fa-seedling',
                'Maximize Tax Advantages',
                `With your income level, you should maximize tax-advantaged investment options. Aim to invest at least 15% of your income for long-term growth.`,
                'medium'
            ));
        }
    }
    
    // Emergency fund recommendations
    const emergencyFundMonths = totalBalance / (spendingTotal > 0 ? spendingTotal : monthlyIncome);
    if (emergencyFundMonths < 3) {
        actions.push(createActionCard(
            'fa-shield-alt',
            'Build Emergency Fund',
            `Your savings would cover only ${emergencyFundMonths.toFixed(1)} months of expenses. Prioritize building this to 3 months by saving an extra ₱${formatAmount((3 - emergencyFundMonths) * spendingTotal / 6)} monthly for the next 6 months.`,
            'hard'
        ));
    }
    
    // Default recommendation if nothing else applies
    if (actions.length === 0) {
        actions.push(createActionCard(
            'fa-chart-pie',
            'Track Your Expenses',
            'Continue tracking your expenses consistently to get more personalized financial recommendations based on your spending patterns.',
            'easy'
        ));
    }
    
    // Return 3 most relevant actions to avoid overwhelming the user
    return actions.slice(0, 3).join('');
}

// Helper function to create action cards with consistent styling
function createActionCard(icon, title, description, difficulty) {
    return `
        <div class="action-card">
            <div class="action-icon">
                <i class="fas ${icon}"></i>
            </div>
            <div class="action-content">
                <h4>${title}</h4>
                <p>${description}</p>
                <span class="difficulty-tag ${difficulty}">${capitalizeFirst(difficulty)}</span>
            </div>
        </div>
    `;
}

// Get appropriate icon for a spending category
function getCategoryIcon(category) {
    const categoryIcons = {
        'Food': 'fa-utensils',
        'Dining': 'fa-utensils',
        'Groceries': 'fa-shopping-basket',
        'Restaurants': 'fa-utensils',
        'Shopping': 'fa-shopping-bag',
        'Clothing': 'fa-tshirt',
        'Transportation': 'fa-car',
        'Commute': 'fa-bus',
        'Travel': 'fa-plane',
        'Entertainment': 'fa-film',
        'Housing': 'fa-home',
        'Rent': 'fa-home',
        'Utilities': 'fa-bolt',
        'Bills': 'fa-file-invoice',
        'Health': 'fa-heartbeat',
        'Medical': 'fa-pills',
        'Education': 'fa-graduation-cap',
        'Personal': 'fa-user',
        'Fitness': 'fa-dumbbell',
        'Technology': 'fa-laptop',
        'Subscriptions': 'fa-calendar-alt',
        'Income': 'fa-money-bill-wave',
        'Savings': 'fa-piggy-bank',
        'Investment': 'fa-chart-line',
        'Gifts': 'fa-gift',
        'Donations': 'fa-hand-holding-heart'
    };
    
    return categoryIcons[category] || 'fa-receipt';
}

// Generate customized advice for specific spending categories
function generateCategorySpecificAdvice(category, percentage, monthlyIncome) {
    const categoryLowerCase = category.toLowerCase();
    let advice = '';
    
    // Generate completely dynamic advice based on the category and percentage
    advice = `${capitalizeFirst(category)} represents ${percentage.toFixed(0)}% of your total expenses. `;
    
    // Add dynamic suggestions based on percentage thresholds
    if (percentage > 50) {
        advice += `This is quite high and represents a significant portion of your spending. `;
        advice += `Consider ways to gradually reduce this expense category by 15-20% to create better balance in your budget.`;
    } else if (percentage > 30) {
        advice += `This is a substantial portion of your budget. `;
        advice += `Look for specific ways to optimize spending in this category without sacrificing quality.`;
    } else if (percentage > 15) {
        advice += `This is a moderate portion of your spending. `;
        advice += `Regularly review these expenses to ensure you're getting the best value.`;
    } else {
        advice += `This is a relatively small portion of your budget. `;
        advice += `Monitor these expenses to ensure they don't increase unexpectedly.`;
    }
    
    return advice;
}

// Generate category reduction suggestions based on actual spending analysis
function generateCategoryReduction(category, amount, monthlyIncome) {
    const percentOfIncome = monthlyIncome > 0 ? (amount / monthlyIncome * 100).toFixed(0) : 0;
    
    // Completely dynamic suggestion without hardcoded advice
    let suggestion = `Your ${category} expenses are ${percentOfIncome}% of your income. `;
    
    if (percentOfIncome > 30) {
        suggestion += `This is significantly higher than recommended. Aim to reduce this by 20-30% through careful planning and prioritization.`;
    } else if (percentOfIncome > 20) {
        suggestion += `This is moderately high. Look for 2-3 specific expenses in this category that could be reduced or eliminated.`;
    } else if (percentOfIncome > 10) {
        suggestion += `This is a reasonable amount, but consider if there are any unnecessary expenses that could be optimized.`;
    } else {
        suggestion += `This is well managed. Continue to monitor these expenses to maintain your good habits.`;
    }
    
    return suggestion;
}

// Analyze weekday spending patterns
function analyzeWeekdaySpending(transactions) {
    const daySpending = {
        'Sunday': 0,
        'Monday': 0,
        'Tuesday': 0,
        'Wednesday': 0,
        'Thursday': 0,
        'Friday': 0,
        'Saturday': 0
    };
    
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    // Count spending by day of week
    transactions.forEach(t => {
        if (t.type === 'expense' && t.date) {
            const date = new Date(t.date);
            const day = dayNames[date.getDay()];
            daySpending[day] += Math.abs(parseFloat(t.amount));
        }
    });
    
    // Find highest spending day
    let highestDay = null;
    let highestAmount = 0;
    let totalSpending = 0;
    
    Object.entries(daySpending).forEach(([day, amount]) => {
        totalSpending += amount;
        if (amount > highestAmount) {
            highestAmount = amount;
            highestDay = day;
        }
    });
    
    // Calculate percentage of total for highest day
    const highestPercentage = totalSpending > 0 ? (highestAmount / totalSpending * 100) : 0;
    
    return {
        highestDay,
        highestAmount,
        highestPercentage,
        dayBreakdown: daySpending
    };
}

// Identify frequent merchants
function identifyFrequentMerchants(transactions) {
    const merchants = {};
    
    // Count transactions and total by merchant
    transactions.forEach(t => {
        if (t.type === 'expense' && t.name) {
            const merchantName = t.name;
            if (!merchants[merchantName]) {
                merchants[merchantName] = {
                    name: merchantName,
                    count: 0,
                    total: 0
                };
            }
            
            merchants[merchantName].count++;
            merchants[merchantName].total += Math.abs(parseFloat(t.amount));
        }
    });
    
    // Convert to array and sort by frequency
    return Object.values(merchants)
        .sort((a, b) => b.count - a.count || b.total - a.total)
        .slice(0, 3); // Return top 3 merchants
}

// Analyze spending patterns
function analyzeSpendingPatterns(transactions) {
    // Time analysis - morning, afternoon, evening, late night
    const timePatterns = {
        morning: 0,   // 5am-11:59am
        afternoon: 0, // 12pm-5:59pm
        evening: 0,   // 6pm-10:59pm
        lateNight: 0  // 11pm-4:59am
    };
    
    // Count transactions with time information
    let timeTransactions = 0;
    
    // Analyze each transaction
    transactions.forEach(t => {
        if (t.type === 'expense') {
            // Time pattern analysis if time information is available
            if (t.date && t.time) {
                const date = new Date(`${t.date}T${t.time}`);
                const hour = date.getHours();
                
                if (hour >= 5 && hour < 12) {
                    timePatterns.morning += Math.abs(parseFloat(t.amount));
                } else if (hour >= 12 && hour < 18) {
                    timePatterns.afternoon += Math.abs(parseFloat(t.amount));
                } else if (hour >= 18 && hour < 23) {
                    timePatterns.evening += Math.abs(parseFloat(t.amount));
                } else {
                    timePatterns.lateNight += Math.abs(parseFloat(t.amount));
                }
                
                timeTransactions++;
            }
        }
    });
    
    return {
        timePatterns,
        hasTimeData: timeTransactions > 0
    };
}

// Identify potential savings opportunities
function identifyPotentialSavings(transactions, recurringExpenses) {
    let potentialSavings = {
        category: null,
        amount: 0,
        suggestion: ''
    };
    
    // Check for potential savings in recurring expenses
    if (recurringExpenses.length > 0) {
        // Look for subscription services that could be optimized
        const subscriptions = recurringExpenses.filter(exp => 
            exp.name.toLowerCase().includes('subscription') || 
            exp.name.toLowerCase().includes('streaming') ||
            exp.name.toLowerCase().includes('membership')
        );
        
        if (subscriptions.length > 0) {
            const totalSubscriptionCost = subscriptions.reduce((sum, sub) => sum + sub.averageAmount, 0);
            
            potentialSavings = {
                category: 'Subscriptions',
                amount: totalSubscriptionCost * 0.3, // Assume 30% potential savings
                suggestion: 'Consider bundling services or sharing accounts with family members where allowed.'
            };
            
            return potentialSavings;
        }
    }
    
    // Check for high frequency small transactions (e.g. daily coffee)
    const smallTransactions = transactions.filter(t => 
        t.type === 'expense' && 
        Math.abs(parseFloat(t.amount)) < 500 && 
        Math.abs(parseFloat(t.amount)) > 50
    );
    
    if (smallTransactions.length > 10) {
        const totalSmallSpending = smallTransactions.reduce((sum, t) => sum + Math.abs(parseFloat(t.amount)), 0);
        const avgPerTransaction = totalSmallSpending / smallTransactions.length;
        
        potentialSavings = {
            category: 'Small Purchases',
            amount: totalSmallSpending * 0.4, // Assume 40% potential savings
            suggestion: `Reducing your frequent small purchases (avg. ₱${avgPerTransaction.toFixed(0)}) could add up to significant savings.`
        };
        
        return potentialSavings;
    }
    
    // Check for dining out expenses
    const diningTransactions = transactions.filter(t => 
        t.type === 'expense' && 
        (t.category === 'Dining' || 
         t.category === 'Restaurants' || 
         (t.name && (t.name.toLowerCase().includes('restaurant') || t.name.toLowerCase().includes('cafe'))))
    );
    
    if (diningTransactions.length > 3) {
        const totalDiningSpending = diningTransactions.reduce((sum, t) => sum + Math.abs(parseFloat(t.amount)), 0);
        
        potentialSavings = {
            category: 'Dining Out',
            amount: totalDiningSpending * 0.35, // Assume 35% potential savings
            suggestion: 'Cooking at home more often and meal prepping could substantially reduce this expense.'
        };
        
        return potentialSavings;
    }
    
    return potentialSavings;
}

function formatAmount(amount) {
    return amount.toLocaleString('en-PH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

// Helper function to get expense breakdown by category
function getExpenseCategoryBreakdown(transactions) {
    const categoryMap = {};
    const totalExpenses = transactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + Math.abs(parseFloat(t.amount)), 0);
    
    // Count each category's total
    transactions.forEach(t => {
        if (t.type === 'expense') {
            const category = t.category || 'Uncategorized';
            categoryMap[category] = (categoryMap[category] || 0) + Math.abs(parseFloat(t.amount));
        }
    });
    
    // Convert to percentages
    const breakdown = Object.entries(categoryMap).map(([category, amount]) => ({
        category,
        amount,
        percentage: totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0
    }));
    
    return breakdown.sort((a, b) => b.amount - a.amount);
}

// Helper function to calculate estimated monthly income
function calculateEstimatedMonthlyIncome(transactions) {
    const incomeTransactions = transactions.filter(t => t.type === 'income');
    const totalIncome = incomeTransactions.reduce((sum, t) => sum + parseFloat(t.amount), 0);
    
    // If we have income transactions, calculate a monthly average
    if (incomeTransactions.length > 0) {
        // Get the date range of transactions
        const dates = incomeTransactions.map(t => new Date(t.date));
        const minDate = new Date(Math.min(...dates));
        const maxDate = new Date(Math.max(...dates));
        
        // Calculate the number of months
        const months = (maxDate - minDate) / (30 * 24 * 60 * 60 * 1000) + 1;
        
        return totalIncome / Math.max(1, months);
    }
    
    return 0;
}

// Helper function to identify recurring expenses
function identifyRecurringExpenses(transactions) {
    const recurringExpenses = [];
    const potentialRecurring = {};
    
    // Group transactions by name and category
    transactions.forEach(t => {
        if (t.type === 'expense') {
            const key = `${t.name}_${t.category}`.toLowerCase();
            if (!potentialRecurring[key]) {
                potentialRecurring[key] = [];
            }
            potentialRecurring[key].push({
                amount: Math.abs(parseFloat(t.amount)),
                date: new Date(t.date)
            });
        }
    });
    
    // Check for recurring patterns (at least 2 occurrences)
    Object.entries(potentialRecurring).forEach(([key, transactions]) => {
        if (transactions.length >= 2) {
            const averageAmount = transactions.reduce((sum, t) => sum + t.amount, 0) / transactions.length;
            const [name, category] = key.split('_');
            
            recurringExpenses.push({
                name,
                category,
                count: transactions.length,
                averageAmount
            });
        }
    });
    
    // Sort by frequency and amount
    return recurringExpenses.sort((a, b) => (b.count * b.averageAmount) - (a.count * a.averageAmount));
}

// Initialization
document.addEventListener('DOMContentLoaded', function() {
    console.log("Gabay Gastos Advanced AI module loaded");
    
    // Get the mata-gastos tool element and add click event listener
    const mataGastosTool = document.getElementById('mata-gastos-tool');
    if (mataGastosTool) {
        mataGastosTool.addEventListener('click', function() {
            const modal = document.getElementById('mata-gastos-modal');
            if (modal) {
                modal.style.display = 'flex';
                loadMataGastosContent();
            }
        });
    }

    // Close modal when user clicks X
    const closeButtons = document.querySelectorAll('.modal-close-btn[data-modal="mata-gastos-modal"]');
    closeButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            document.getElementById('mata-gastos-modal').style.display = 'none';
        });
    });

    // Close modal when clicking outside
    window.addEventListener('click', function(e) {
        if (e.target.classList.contains('modal')) {
            e.target.style.display = 'none';
        }
    });
}); 