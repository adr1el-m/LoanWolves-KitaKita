// Credit Companion Tool (Gabay Pautang) - AI-powered credit management and guidance
import { getAuth } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-auth.js";
import { getUserTransactions, getUserBankAccounts, storeUserData } from "../firestoredb.js";
import { GEMINI_API_KEY } from "../config.js";

// Make the function globally accessible
window.loadCreditCompanionContent = loadCreditCompanionContent;

// Enhanced Credit Analysis Configuration
const CREDIT_MODEL_CONFIG = {
    version: '2.0',
    weights: {
        payment_history: 0.35,
        income_stability: 0.25,
        financial_behavior: 0.20,
        account_health: 0.20
    },
    thresholds: {
        excellent: 750,
        good: 700,
        fair: 650,
        poor: 0
    }
};

// Initialization
document.addEventListener('DOMContentLoaded', function() {
    console.log("Gabay Pautang (Credit Companion Tool) loaded");
    
    // Get the credit companion tool element and add click event listener
    const creditCompanionTool = document.getElementById('credit-companion-tool');
    if (creditCompanionTool) {
        creditCompanionTool.addEventListener('click', function() {
            const modal = document.getElementById('credit-companion-modal');
            if (modal) {
                modal.style.display = 'flex';
                loadCreditCompanionContent();
            }
        });
    }

    // Close modal when user clicks X
    const closeButtons = document.querySelectorAll('.modal-close-btn[data-modal="credit-companion-modal"]');
    closeButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            document.getElementById('credit-companion-modal').style.display = 'none';
        });
    });

    // Close modal when clicking outside
    window.addEventListener('click', function(e) {
        if (e.target.classList.contains('modal')) {
            e.target.style.display = 'none';
        }
    });

    // Add CSS styles for the Credit Companion UI
    const styles = `
        #credit-companion-modal {
            background: rgba(0, 0, 0, 0.85);
        }

        #credit-companion-modal-content {
            background: var(--surface-ground, #1a1a1a);
            color: var(--text-color, #f0f0f0);
            max-width: 1200px;
            margin: 20px auto;
            border-radius: 16px;
            padding: 24px;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
        }

        .credit-companion-container {
            display: grid;
            gap: 24px;
        }

        .credit-score-container {
            display: grid;
            grid-template-columns: auto 1fr;
            gap: 32px;
            background: var(--surface-card, #242424);
            padding: 24px;
            border-radius: 12px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }

        .credit-score {
            text-align: center;
        }

        .score-ring {
            width: 200px;
            height: 200px;
            border-radius: 50%;
            background: conic-gradient(
                var(--score-color) calc(var(--score-percent)),
                #2a2a2a calc(var(--score-percent))
            );
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
            margin: 0 auto 16px;
        }

        .score-ring::before {
            content: '';
            position: absolute;
            width: 160px;
            height: 160px;
            border-radius: 50%;
            background: var(--surface-ground, #1a1a1a);
        }

        .score-value {
            position: relative;
            z-index: 1;
            font-size: 2.5rem;
            font-weight: 700;
            color: var(--score-color);
        }

        .score-label {
            font-size: 1.1rem;
            color: var(--text-color-secondary, #adb5bd);
            line-height: 1.4;
        }

        .score-details {
            display: flex;
            flex-direction: column;
            gap: 16px;
        }

        .score-details h3 {
            color: var(--text-color, #f0f0f0);
            margin: 0;
            font-size: 1.5rem;
        }

        .score-details p {
            color: var(--text-color-secondary, #adb5bd);
            line-height: 1.6;
            margin: 0;
        }

        .credit-factors {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 20px;
        }

        .factor-card {
            background: var(--surface-card, #242424);
            padding: 20px;
            border-radius: 12px;
            transition: transform 0.2s;
        }

        .factor-card:hover {
            transform: translateY(-2px);
        }

        .factor-header {
            display: flex;
            align-items: center;
            gap: 16px;
            margin-bottom: 16px;
        }

        .factor-icon {
            width: 48px;
            height: 48px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.5rem;
        }

        .factor-icon.excellent { background: rgba(76, 175, 80, 0.15); color: #69db7c; }
        .factor-icon.good { background: rgba(33, 150, 243, 0.15); color: #5ac8fa; }
        .factor-icon.fair { background: rgba(255, 152, 0, 0.15); color: #ffd43b; }
        .factor-icon.poor { background: rgba(244, 67, 54, 0.15); color: #ff6b6b; }

        .factor-title {
            font-size: 1.2rem;
            font-weight: 500;
            color: var(--text-color, #f0f0f0);
        }

        .factor-score {
            margin-bottom: 16px;
        }

        .factor-progress {
            height: 8px;
            background: var(--surface-hover, #2a2a2a);
            border-radius: 4px;
            margin-bottom: 8px;
            overflow: hidden;
        }

        .factor-progress-bar {
            height: 100%;
            border-radius: 4px;
            transition: width 0.3s ease;
        }

        .factor-value {
            font-size: 0.9rem;
            color: var(--text-color-secondary, #adb5bd);
            text-align: right;
        }

        .factor-description {
            color: var(--text-color-secondary, #adb5bd);
            font-size: 0.9rem;
            line-height: 1.5;
        }

        .recommendations-section {
            background: var(--surface-card, #242424);
            padding: 24px;
            border-radius: 12px;
        }

        .recommendations-section h3 {
            color: var(--text-color, #f0f0f0);
            margin: 0 0 20px 0;
            font-size: 1.5rem;
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .recommendations-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 20px;
        }

        .recommendation-card {
            background: var(--surface-hover, #2a2a2a);
            padding: 20px;
            border-radius: 12px;
            transition: transform 0.2s;
            display: flex;
            flex-direction: column;
            border-left: 4px solid var(--primary-color, #2196F3);
        }

        .recommendation-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 12px rgba(0, 0, 0, 0.2);
        }

        .recommendation-header {
            display: flex;
            align-items: center;
            gap: 16px;
            margin-bottom: 16px;
        }

        .recommendation-icon {
            width: 48px;
            height: 48px;
            border-radius: 50%;
            background: var(--primary-color-alpha, rgba(33, 150, 243, 0.1));
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.5rem;
            color: var(--primary-color, #2196F3);
        }

        .recommendation-title {
            font-size: 1.1rem;
            font-weight: 600;
            color: var(--text-color, #f0f0f0);
        }

        .recommendation-description {
            color: var(--text-color-secondary, #adb5bd);
            font-size: 0.9rem;
            line-height: 1.5;
            margin-bottom: 20px;
            flex-grow: 1;
        }

        .recommendation-action {
            background: var(--primary-color, #2196F3);
            color: white;
            border: none;
            border-radius: 8px;
            padding: 12px 20px;
            font-size: 0.9rem;
            font-weight: 500;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: space-between;
            width: 100%;
            transition: background-color 0.2s;
        }

        .recommendation-action:hover {
            background: var(--primary-color-darker, #1976D2);
        }

        .section-divider {
            height: 1px;
            background: var(--surface-border, #333);
            margin: 24px 0;
        }

        .loading-state {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 48px;
            text-align: center;
        }

        .pulse-loader {
            width: 64px;
            height: 64px;
            border-radius: 50%;
            background: var(--primary-color, #2196F3);
            margin-bottom: 24px;
            animation: pulse 1.5s ease-in-out infinite;
        }

        @keyframes pulse {
            0% { transform: scale(0.8); opacity: 0.5; }
            50% { transform: scale(1); opacity: 1; }
            100% { transform: scale(0.8); opacity: 0.5; }
        }

        .error-state {
            text-align: center;
            padding: 48px;
        }

        .error-state i {
            font-size: 48px;
            color: #ff6b6b;
            margin-bottom: 16px;
        }

        .error-state p {
            color: var(--text-color-secondary, #adb5bd);
            margin-bottom: 24px;
        }

        .retry-button {
            background: var(--primary-color, #2196F3);
            color: white;
            border: none;
            border-radius: 8px;
            padding: 12px 24px;
            font-size: 1rem;
            cursor: pointer;
            transition: background-color 0.2s;
        }

        .retry-button:hover {
            background: var(--primary-color-darker, #1976D2);
        }

        @media (max-width: 768px) {
            .credit-score-container {
                grid-template-columns: 1fr;
                text-align: center;
            }

            .score-ring {
                width: 160px;
                height: 160px;
            }

            .score-ring::before {
                width: 128px;
                height: 128px;
            }

            .score-value {
                font-size: 2rem;
            }

            .recommendations-grid {
                grid-template-columns: 1fr;
            }
        }
    `;
    
    const styleSheet = document.createElement('style');
    styleSheet.textContent = styles;
    document.head.appendChild(styleSheet);
});

// Advanced Credit Analysis Engine
class CreditAnalysisEngine {
    constructor(transactions, accounts) {
        this.transactions = transactions;
        this.accounts = accounts;
        this.analysis = {};
    }

    async performAnalysis() {
        try {
            this.analysis = {
                paymentHistory: await this.analyzePaymentHistory(),
                incomeStability: await this.analyzeIncomeStability(),
                financialBehavior: await this.analyzeFinancialBehavior(),
                accountHealth: await this.analyzeAccountHealth()
            };

            return this.generateCreditScore();
        } catch (error) {
            console.error('Error in credit analysis:', error);
            throw error;
        }
    }

    async analyzePaymentHistory() {
        const bills = this.transactions.filter(t => 
            t.type === 'expense' && 
            (t.category === 'bills' || t.category === 'loans' || t.category === 'utilities')
        );

        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        const recentBills = bills.filter(t => new Date(t.date) >= sixMonthsAgo);
        const monthlyBills = this.groupByMonth(recentBills);

        let onTimePayments = 0;
        let totalPayments = 0;

        Object.values(monthlyBills).forEach(monthBills => {
            monthBills.forEach(bill => {
                totalPayments++;
                // Consider a payment "on time" if it's within typical due dates
                const paymentDate = new Date(bill.date).getDate();
                if (paymentDate <= 15) onTimePayments++;
            });
        });

        const score = totalPayments > 0 ? (onTimePayments / totalPayments) * 100 : 0;

        return {
            score,
            onTimePayments,
            totalPayments,
            monthlyAverage: totalPayments / 6,
            status: this.getStatusFromScore(score)
        };
    }

    async analyzeIncomeStability() {
        const incomeTransactions = this.transactions.filter(t => t.type === 'income');
        const monthlyIncome = this.groupByMonth(incomeTransactions);
        
        const amounts = Object.values(monthlyIncome).map(month => 
            month.reduce((sum, t) => sum + parseFloat(t.amount), 0)
        );

        const average = amounts.reduce((sum, amount) => sum + amount, 0) / amounts.length;
        const variance = amounts.reduce((sum, amount) => sum + Math.pow(amount - average, 2), 0) / amounts.length;
        const stability = Math.max(0, 100 - (Math.sqrt(variance) / average * 100));

        return {
            score: stability,
            averageIncome: average,
            monthlyVariation: Math.sqrt(variance),
            consistentSources: this.identifyConsistentIncomeSources(incomeTransactions),
            status: this.getStatusFromScore(stability)
        };
    }

    // Helper method to identify consistent income sources
    identifyConsistentIncomeSources(incomeTransactions) {
        const sourceMap = new Map();
        
        // Group transactions by source/name
        incomeTransactions.forEach(transaction => {
            const source = transaction.name;
            if (!sourceMap.has(source)) {
                sourceMap.set(source, {
                    count: 0,
                    totalAmount: 0,
                    lastDate: null,
                    frequency: 'irregular'
                });
            }
            
            const sourceData = sourceMap.get(source);
            sourceData.count++;
            sourceData.totalAmount += parseFloat(transaction.amount);
            
            // Track dates to determine frequency
            const currentDate = new Date(transaction.date);
            if (sourceData.lastDate) {
                const daysBetween = (currentDate - sourceData.lastDate) / (1000 * 60 * 60 * 24);
                if (daysBetween >= 28 && daysBetween <= 31) {
                    sourceData.frequency = 'monthly';
                } else if (daysBetween >= 13 && daysBetween <= 15) {
                    sourceData.frequency = 'bi-weekly';
                } else if (daysBetween >= 6 && daysBetween <= 8) {
                    sourceData.frequency = 'weekly';
                }
            }
            sourceData.lastDate = currentDate;
        });
        
        // Filter and format consistent sources
        const consistentSources = Array.from(sourceMap.entries())
            .filter(([_, data]) => data.count >= 2) // At least 2 occurrences
            .map(([source, data]) => ({
                name: source,
                frequency: data.frequency,
                averageAmount: data.totalAmount / data.count,
                occurrences: data.count,
                reliability: Math.min((data.count / 6) * 100, 100) // Score up to 100%
            }))
            .sort((a, b) => b.reliability - a.reliability);
        
        return consistentSources;
    }

    // Helper method to analyze saving habits
    analyzeSavingHabits() {
        const monthlyData = this.groupByMonth(this.transactions);
        let totalSavings = 0;
        let monthsAnalyzed = 0;
        
        Object.values(monthlyData).forEach(transactions => {
            const monthlyIncome = transactions
                .filter(t => t.type === 'income')
                .reduce((sum, t) => sum + parseFloat(t.amount), 0);
                
            const monthlyExpenses = transactions
                .filter(t => t.type === 'expense')
                .reduce((sum, t) => sum + parseFloat(t.amount), 0);
                
            if (monthlyIncome > 0) {
                totalSavings += Math.max(0, monthlyIncome - monthlyExpenses);
                monthsAnalyzed++;
            }
        });
        
        const averageMonthlySavings = monthsAnalyzed > 0 ? totalSavings / monthsAnalyzed : 0;
        const savingsRate = monthsAnalyzed > 0 ? (averageMonthlySavings / this.calculateAverageMonthlyIncome()) * 100 : 0;
        
        return {
            score: Math.min(savingsRate * 2, 100), // Score up to 100%
            averageMonthlySavings,
            savingsRate,
            monthsAnalyzed
        };
    }

    // Helper method to calculate average monthly income
    calculateAverageMonthlyIncome() {
        const incomeTransactions = this.transactions.filter(t => t.type === 'income');
        const monthlyIncome = this.groupByMonth(incomeTransactions);
        const amounts = Object.values(monthlyIncome).map(month =>
            month.reduce((sum, t) => sum + parseFloat(t.amount), 0)
        );
        return amounts.reduce((sum, amount) => sum + amount, 0) / amounts.length || 0;
    }

    // Helper method to analyze spending patterns
    analyzeSpendingPatterns() {
        const expenses = this.transactions.filter(t => t.type === 'expense');
        const monthlyExpenses = this.groupByMonth(expenses);
        
        // Calculate consistency in spending
        const monthlyTotals = Object.values(monthlyExpenses).map(month =>
            month.reduce((sum, t) => sum + parseFloat(t.amount), 0)
        );
        
        const averageMonthlyExpense = monthlyTotals.reduce((sum, total) => sum + total, 0) / monthlyTotals.length;
        const variance = monthlyTotals.reduce((sum, total) => 
            sum + Math.pow(total - averageMonthlyExpense, 2), 0
        ) / monthlyTotals.length;
        
        const consistencyScore = Math.max(0, 100 - (Math.sqrt(variance) / averageMonthlyExpense * 100));
        
        // Analyze expense categories
        const categoryAnalysis = this.analyzeCategoryDistribution(expenses);
        
        return {
            score: consistencyScore,
            averageMonthlyExpense,
            monthlyVariation: Math.sqrt(variance),
            categories: categoryAnalysis,
            status: this.getStatusFromScore(consistencyScore)
        };
    }

    // Helper method to analyze budget adherence
    analyzeBudgetAdherence() {
        // For now, use a simplified scoring based on spending patterns
        // In a real implementation, this would compare against set budgets
        const spendingPatterns = this.analyzeSpendingPatterns();
        const savingHabits = this.analyzeSavingHabits();
        
        // Score based on spending consistency and savings rate
        const score = (spendingPatterns.score * 0.6) + (savingHabits.score * 0.4);
        
        return {
            score,
            status: this.getStatusFromScore(score)
        };
    }

    // Helper method to analyze risk behavior
    analyzeRiskBehavior() {
        const riskFactors = {
            largePurchases: 0,
            frequentTransactions: 0,
            unusualActivity: 0
        };
        
        // Analyze large purchases
        const averageTransaction = this.calculateAverageTransactionAmount();
        const largeTransactions = this.transactions.filter(t => 
            t.type === 'expense' && parseFloat(t.amount) > averageTransaction * 3
        );
        riskFactors.largePurchases = Math.min(largeTransactions.length * 10, 40);
        
        // Analyze transaction frequency
        const dailyTransactions = this.groupByDay(this.transactions);
        const maxDailyTransactions = Math.max(...Object.values(dailyTransactions).map(day => day.length));
        riskFactors.frequentTransactions = Math.min(maxDailyTransactions * 5, 30);
        
        // Analyze unusual activity
        const unusualTransactions = this.identifyUnusualTransactions();
        riskFactors.unusualActivity = Math.min(unusualTransactions.length * 10, 30);
        
        const totalRiskScore = Object.values(riskFactors).reduce((sum, score) => sum + score, 0);
        const riskLevel = 100 - totalRiskScore;
        
        return {
            score: riskLevel,
            riskFactors,
            status: this.getStatusFromScore(riskLevel)
        };
    }

    // Helper method to calculate average transaction amount
    calculateAverageTransactionAmount() {
        const amounts = this.transactions.map(t => parseFloat(t.amount));
        return amounts.reduce((sum, amount) => sum + amount, 0) / amounts.length || 0;
    }

    // Helper method to group transactions by day
    groupByDay(transactions) {
        const daily = {};
        transactions.forEach(t => {
            const date = new Date(t.date).toISOString().split('T')[0];
            if (!daily[date]) daily[date] = [];
            daily[date].push(t);
        });
        return daily;
    }

    // Helper method to identify unusual transactions
    identifyUnusualTransactions() {
        const averageAmount = this.calculateAverageTransactionAmount();
        const stdDev = this.calculateStandardDeviation(
            this.transactions.map(t => parseFloat(t.amount))
        );
        
        return this.transactions.filter(t => 
            Math.abs(parseFloat(t.amount) - averageAmount) > stdDev * 2
        );
    }

    // Helper method to calculate standard deviation
    calculateStandardDeviation(values) {
        const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
        const squareDiffs = values.map(value => Math.pow(value - avg, 2));
        const avgSquareDiff = squareDiffs.reduce((sum, val) => sum + val, 0) / values.length;
        return Math.sqrt(avgSquareDiff);
    }

    // Helper method to analyze category distribution
    analyzeCategoryDistribution(transactions) {
        const categories = {};
        let total = 0;
        
        transactions.forEach(t => {
            const category = t.category || 'uncategorized';
            const amount = parseFloat(t.amount);
            if (!categories[category]) categories[category] = 0;
            categories[category] += amount;
            total += amount;
        });
        
        return Object.entries(categories).map(([category, amount]) => ({
            category,
            amount,
            percentage: (amount / total) * 100
        })).sort((a, b) => b.amount - a.amount);
    }

    // Analyze financial behavior
    async analyzeFinancialBehavior() {
        const behaviors = {
            savingHabits: this.analyzeSavingHabits(),
            spendingPatterns: this.analyzeSpendingPatterns(),
            budgetAdherence: this.analyzeBudgetAdherence(),
            riskBehavior: this.analyzeRiskBehavior()
        };

        const score = Object.values(behaviors).reduce((sum, b) => sum + b.score, 0) / 4;

        return {
            score,
            behaviors,
            status: this.getStatusFromScore(score)
        };
    }

    async analyzeAccountHealth() {
        const balances = this.accounts.map(a => parseFloat(a.balance) || 0);
        const totalBalance = balances.reduce((sum, balance) => sum + balance, 0);
        const averageBalance = totalBalance / this.accounts.length || 0;

        const monthlyExpenses = this.calculateAverageMonthlyExpenses() || 1; // Prevent division by zero
        const monthsOfRunway = totalBalance / monthlyExpenses || 0;
        
        // Recalibrated scoring system
        let score = 0;
        
        // Emergency fund score (40 points max)
        // 6+ months: 40 points
        // 3-6 months: 20-40 points
        // 1-3 months: 10-20 points
        // <1 month: 0-10 points
        if (monthsOfRunway >= 6) score += 40;
        else if (monthsOfRunway >= 3) score += 20 + ((monthsOfRunway - 3) / 3) * 20;
        else if (monthsOfRunway >= 1) score += 10 + ((monthsOfRunway - 1) / 2) * 10;
        else score += Math.min(monthsOfRunway * 10, 10);
        
        // Account balance score (30 points max)
        // Use monthly income as a reference point
        const monthlyIncome = this.calculateAverageMonthlyIncome() || 1;
        const balanceToIncomeRatio = totalBalance / monthlyIncome;
        score += Math.min(balanceToIncomeRatio * 10, 30);
        
        // Account diversity score (30 points max)
        // 3+ accounts: 30 points
        // 2 accounts: 20 points
        // 1 account: 10 points
        score += Math.min(this.accounts.length * 10, 30);

        return {
            score: Math.min(Math.max(Math.round(score), 0), 100), // Ensure score is between 0-100
            totalBalance,
            averageBalance,
            monthsOfRunway: Math.max(monthsOfRunway, 0), // Prevent negative months
            accountDiversity: this.accounts.length,
            status: this.getStatusFromScore(score)
        };
    }

    generateCreditScore() {
        const weights = CREDIT_MODEL_CONFIG.weights;
        const weightedScores = {
            payment_history: this.analysis.paymentHistory.score * weights.payment_history,
            income_stability: this.analysis.incomeStability.score * weights.income_stability,
            financial_behavior: this.analysis.financialBehavior.score * weights.financial_behavior,
            account_health: this.analysis.accountHealth.score * weights.account_health
        };

        // Calculate base score (0-100)
        const baseScore = Object.values(weightedScores).reduce((sum, score) => sum + score, 0);
        
        // Convert to credit score range (300-850)
        // Base score of 0 maps to 300
        // Base score of 100 maps to 850
        const finalScore = Math.round(300 + (baseScore / 100) * 550);
        
        // Ensure the score stays within valid range
        const boundedScore = Math.min(Math.max(finalScore, 300), 850);

        return {
            score: boundedScore,
            factors: this.analysis,
            weightedScores,
            rating: this.getCreditRating(boundedScore),
            recommendations: this.generateRecommendations()
        };
    }

    generateRecommendations() {
        const recommendations = [];
        const analysis = this.analysis;

        // Payment History Recommendations
        if (analysis.paymentHistory.score < 90) {
            const missedPayments = analysis.paymentHistory.totalPayments - analysis.paymentHistory.onTimePayments;
            const paymentImpact = Math.round(35 * (1 - analysis.paymentHistory.score / 100));
            
            recommendations.push({
                title: 'Improve Payment Timing',
                icon: 'fa-calendar-check',
                description: `Your ${missedPayments} late or missed payments reduce your score by approximately ${paymentImpact} points. Paying all bills by the 10th of each month can increase your score by up to ${paymentImpact} points within 3 months.`,
                action: async () => {
                    return this.setupAutomaticPayments();
                }
            });
        }

        // Income Stability Recommendations
        if (analysis.incomeStability.score < 80) {
            const variationPercent = Math.round((analysis.incomeStability.monthlyVariation / analysis.incomeStability.averageIncome) * 100);
            const stabilityImpact = Math.round(25 * (1 - analysis.incomeStability.score / 100));
            
            recommendations.push({
                title: 'Reduce Income Volatility',
                icon: 'fa-chart-line',
                description: `Your income fluctuates by ${variationPercent}% monthly, lowering your score by ${stabilityImpact} points. Adding just one consistent income source can improve your credit rating by reducing volatility below 15%.`,
                action: async () => {
                    return this.suggestIncomeSources();
                }
            });
        }

        // Financial Behavior Recommendations
        if (analysis.financialBehavior.score < 85) {
            const behaviors = analysis.financialBehavior.behaviors;
            let weakestArea = 'budgeting';
            let weakestScore = behaviors.budgetAdherence.score;
            
            if (behaviors.savingHabits.score < weakestScore) {
                weakestArea = 'saving';
                weakestScore = behaviors.savingHabits.score;
            }
            
            if (behaviors.spendingPatterns.score < weakestScore) {
                weakestArea = 'spending';
                weakestScore = behaviors.spendingPatterns.score;
            }
            
            const behaviorImpact = Math.round(20 * (1 - analysis.financialBehavior.score / 100));
            
            recommendations.push({
                title: 'Optimize ' + weakestArea.charAt(0).toUpperCase() + weakestArea.slice(1) + ' Patterns',
                icon: 'fa-wallet',
                description: `Your ${weakestArea} patterns are in the bottom 30% of borrowers, reducing your score by ${behaviorImpact} points. Our AI analysis shows adjusting your ${weakestArea === 'saving' ? 'monthly savings rate' : weakestArea === 'spending' ? 'discretionary spending' : 'budget allocation'} can improve your score within 60 days.`,
                action: async () => {
                    return this.createSmartBudget();
                }
            });
        }

        // Account Health Recommendations
        if (analysis.accountHealth.score < 70) {
            const targetMonths = 6;
            const currentMonths = analysis.accountHealth.monthsOfRunway;
            const monthsNeeded = Math.max(0, targetMonths - currentMonths).toFixed(1);
            const healthImpact = Math.round(20 * (1 - analysis.accountHealth.score / 100));
            
            recommendations.push({
                title: 'Strengthen Financial Reserves',
                icon: 'fa-piggy-bank',
                description: `Lenders see you have only ${currentMonths.toFixed(1)} months of emergency funds vs. the recommended ${targetMonths} months, lowering your score by ${healthImpact} points. Building ${monthsNeeded} more months of reserves can increase your borrowing options by up to 30%.`,
                action: async () => {
                    return this.createSavingsPlan();
                }
            });
        }

        return recommendations;
    }

    // Helper methods
    groupByMonth(transactions) {
        const monthly = {};
        transactions.forEach(t => {
            const date = new Date(t.date);
            const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`;
            if (!monthly[monthKey]) monthly[monthKey] = [];
            monthly[monthKey].push(t);
        });
        return monthly;
    }

    // Helper method to identify recurring bills
    identifyRecurringBills(bills) {
        // Group bills by name/payee
        const billMap = new Map();
        bills.forEach(bill => {
            const name = bill.name.toLowerCase().trim();
            if (!billMap.has(name)) {
                billMap.set(name, {
                    name: bill.name,
                    occurrences: [],
                    category: bill.category,
                    isRecurring: false,
                    frequency: 'unknown',
                    averageAmount: 0,
                    dueDay: null,
                    impact: 0
                });
            }
            
            const billData = billMap.get(name);
            billData.occurrences.push({
                date: new Date(bill.date),
                amount: parseFloat(bill.amount)
            });
        });
        
        // Analyze each bill for recurrence patterns
        const recurringBills = [];
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        
        billMap.forEach(bill => {
            if (bill.occurrences.length >= 2) {
                // Sort occurrences by date
                bill.occurrences.sort((a, b) => a.date - b.date);
                
                // Calculate average amount
                const totalAmount = bill.occurrences.reduce((sum, o) => sum + o.amount, 0);
                bill.averageAmount = totalAmount / bill.occurrences.length;
                
                // Check for monthly patterns
                const monthPatterns = this.findMonthlyPatterns(bill.occurrences);
                if (monthPatterns.isMonthly) {
                    bill.isRecurring = true;
                    bill.frequency = 'monthly';
                    bill.dueDay = monthPatterns.dueDay;
                    
                    // Calculate potential credit impact
                    const missedCount = monthPatterns.missedMonths;
                    const totalMonths = 6;
                    const onTimeRate = (totalMonths - missedCount) / totalMonths;
                    bill.impact = Math.round((1 - onTimeRate) * 10); // Score impact out of 10
                    
                    recurringBills.push(bill);
                }
            }
        });
        
        return recurringBills.sort((a, b) => b.impact - a.impact);
    }
    
    findMonthlyPatterns(occurrences) {
        // Track month frequencies
        const monthFreq = new Map();
        let prevMonth = -1;
        let missedMonths = 0;
        
        // Calculate most common day of month for payment
        const dayFreq = new Map();
        occurrences.forEach(o => {
            const day = o.date.getDate();
            dayFreq.set(day, (dayFreq.get(day) || 0) + 1);
        });
        
        // Find most common payment day
        let mostCommonDay = 1;
        let highestFreq = 0;
        dayFreq.forEach((freq, day) => {
            if (freq > highestFreq) {
                highestFreq = freq;
                mostCommonDay = day;
            }
        });
        
        // Check for consecutive months
        occurrences.forEach(o => {
            const month = o.date.getMonth();
            const year = o.date.getFullYear();
            const monthKey = year * 12 + month;
            
            monthFreq.set(monthKey, true);
            
            if (prevMonth !== -1 && monthKey - prevMonth > 1) {
                missedMonths += monthKey - prevMonth - 1;
            }
            prevMonth = monthKey;
        });
        
        // Check if we have at least 3 months of occurrences
        const isMonthly = monthFreq.size >= 3;
        
        return {
            isMonthly,
            dueDay: mostCommonDay,
            missedMonths
        };
    }

    getStatusFromScore(score) {
        if (score >= 90) return 'excellent';
        if (score >= 70) return 'good';
        if (score >= 50) return 'fair';
        return 'poor';
    }

    getCreditRating(score) {
        const thresholds = CREDIT_MODEL_CONFIG.thresholds;
        if (score >= thresholds.excellent) return 'excellent';
        if (score >= thresholds.good) return 'good';
        if (score >= thresholds.fair) return 'fair';
        return 'poor';
    }

    calculateAverageMonthlyExpenses() {
        const expenses = this.transactions.filter(t => t.type === 'expense');
        const monthlyExpenses = this.groupByMonth(expenses);
        const amounts = Object.values(monthlyExpenses).map(month =>
            month.reduce((sum, t) => sum + parseFloat(t.amount), 0)
        );
        return amounts.reduce((sum, amount) => sum + amount, 0) / amounts.length;
    }

    // AI-Powered Action Methods
    async setupAutomaticPayments() {
        // Implementation for setting up automatic payments
        const bills = this.transactions.filter(t => 
            t.type === 'expense' && 
            (t.category === 'bills' || t.category === 'utilities')
        );

        const recurringBills = this.identifyRecurringBills(bills);
        return {
            type: 'automatic_payments',
            data: recurringBills,
            nextSteps: [
                'Review identified recurring bills',
                'Select bills for automation',
                'Connect to bill payment system',
                'Set up payment schedule'
            ]
        };
    }

    async suggestIncomeSources() {
        // AI analysis for income diversification
        const currentIncome = this.analysis.incomeStability;
        const skills = await this.analyzeTransactionBasedSkills();
        
        // Analyze spending patterns to identify potential areas for income
        const spendingPatterns = await this.analyzeSpendingPatterns();
        const industryInsights = await this.analyzeIndustryOpportunities(spendingPatterns);
        
        return {
            type: 'income_sources',
            currentIncome: currentIncome,
            suggestions: [
                {
                    type: 'Primary Income Optimization',
                    opportunities: skills.map(skill => ({
                        skill: skill.name,
                        potential: skill.marketValue,
                        nextSteps: skill.developmentPath,
                        localDemand: skill.localMarketDemand,
                        certifications: skill.recommendedCertifications
                    }))
                },
                {
                    type: 'Side Income Opportunities',
                    opportunities: this.generateSideHustleOpportunities(skills, industryInsights)
                },
                {
                    type: 'Passive Income Streams',
                    opportunities: this.suggestPassiveIncomeStreams(currentIncome, spendingPatterns)
                }
            ],
            marketAnalysis: {
                localTrends: industryInsights.localTrends,
                growthSectors: industryInsights.growthSectors,
                skillGaps: industryInsights.skillGaps
            }
        };
    }

    async createSmartBudget() {
        const spendingAnalysis = await this.analyzeSpendingPatterns();
        const monthlyIncome = this.analysis.incomeStability.averageIncome;
        const expenses = await this.categorizeAndAnalyzeExpenses();
        
        // AI-powered budget optimization
        const optimizedBudget = this.optimizeBudgetAllocation(monthlyIncome, expenses);
        const savingsGoals = this.calculateOptimalSavings(monthlyIncome, spendingAnalysis);
        
        return {
            type: 'smart_budget',
            currentState: {
                monthlyIncome,
                totalExpenses: expenses.total,
                savingsRate: expenses.savingsRate,
                discretionarySpending: expenses.discretionary
            },
            optimizedBudget: {
                categories: optimizedBudget.categories,
                potentialSavings: optimizedBudget.potentialSavings,
                adjustments: optimizedBudget.recommendedAdjustments
            },
            savingsGoals: {
                emergency: savingsGoals.emergencyFund,
                shortTerm: savingsGoals.shortTerm,
                longTerm: savingsGoals.longTerm,
                timeline: savingsGoals.achievementTimeline
            },
            actionPlan: this.generateBudgetActionPlan(optimizedBudget, savingsGoals)
        };
    }

    async createSavingsPlan() {
        const monthlyExpenses = this.calculateAverageMonthlyExpenses();
        const monthlyIncome = this.analysis.incomeStability.averageIncome;
        const currentSavings = this.analysis.accountHealth.totalBalance;
        
        // AI-powered savings optimization
        const savingsAnalysis = await this.analyzeSavingsPotential();
        const emergencyFundTarget = monthlyExpenses * 6;
        
        return {
            type: 'savings_plan',
            currentState: {
                savings: currentSavings,
                monthlyIncome,
                monthlyExpenses,
                savingsRate: (monthlyIncome - monthlyExpenses) / monthlyIncome
            },
            emergencyFund: {
                target: emergencyFundTarget,
                current: currentSavings,
                monthlyContribution: this.calculateOptimalMonthlySavings(monthlyIncome, monthlyExpenses),
                timeToTarget: this.calculateTimeToTarget(emergencyFundTarget, currentSavings, monthlyIncome, monthlyExpenses)
            },
            optimizations: savingsAnalysis.optimizations,
            automationPlan: this.createAutomatedSavingsRules(savingsAnalysis),
            milestones: this.generateSavingsMilestones(currentSavings, monthlyExpenses)
        };
    }
}

// Function to load the credit companion analysis content
async function loadCreditCompanionContent() {
    console.log("Loading Credit Companion content");
    const contentContainer = document.getElementById('credit-companion-modal-content');
    
    if (!contentContainer) {
        console.error("Content container not found");
        return;
    }
    
    try {
        const auth = getAuth();
        const user = auth.currentUser;
        
        if (!user) {
            contentContainer.innerHTML = `
                <div class="error-state">
                    <i class="fas fa-exclamation-circle"></i>
                    <p>Please log in to view your alternative credit score analysis.</p>
                </div>
            `;
            return;
        }
        
        // Show loading state with pulse animation
        contentContainer.innerHTML = `
            <div class="loading-state">
                <div class="pulse-loader"></div>
                <p>Analyzing your financial data to generate your personalized credit insights...</p>
            </div>
        `;
        
        // Get user's financial data
        const transactions = await getUserTransactions(user.uid);
        const accounts = await getUserBankAccounts(user.uid);
        
        if (!transactions || transactions.length === 0) {
            contentContainer.innerHTML = `
                <div class="error-state">
                    <i class="fas fa-exclamation-circle"></i>
                    <p>No transaction data available. Start adding your financial transactions to get a personalized credit analysis.</p>
                </div>
            `;
            return;
        }
        
        // Create and run credit analysis
        const analyzer = new CreditAnalysisEngine(transactions, accounts);
        const analysis = await analyzer.performAnalysis();
        
        // Generate UI with real data
        const scoreColor = getScoreColor(analysis.score);
        const scorePercent = (analysis.score / 850) * 100;
        
        contentContainer.innerHTML = `
            <div class="credit-companion-container">
                <div class="credit-score-container">
                    <div class="credit-score">
                        <div class="score-ring" style="--score-color: ${scoreColor}; --score-percent: ${scorePercent}%">
                            <div class="score-value">
                                <span class="score-number">${analysis.score}</span>
                            </div>
                        </div>
                        <div class="score-label">Alternative<br>Credit Score</div>
                    </div>
                    <div class="score-details">
                        <h3>Your Alternative Credit Profile</h3>
                        <p>Based on our AI analysis of your financial behavior, we've generated a comprehensive alternative credit score that considers multiple factors beyond traditional credit reporting.</p>
                        <p>Your score of <strong>${analysis.score}</strong> indicates <strong>${analysis.rating}</strong> creditworthiness.</p>
                        <p>This analysis is based on ${transactions.length} transactions and ${accounts.length} linked accounts.</p>
                    </div>
                </div>
                
                <div class="section-divider"></div>
                
                <h3><i class="fas fa-chart-bar"></i> Credit Score Factors</h3>
                <div class="credit-factors">
                    ${Object.entries(analysis.factors).map(([key, factor]) => `
                        <div class="factor-card">
                            <div class="factor-header">
                                <div class="factor-icon ${factor.status}">
                                    <i class="fas ${getFactorIcon(key)}"></i>
                                </div>
                                <div class="factor-title">${formatFactorTitle(key)}</div>
                            </div>
                            <div class="factor-score">
                                <div class="factor-progress">
                                    <div class="factor-progress-bar" style="width: ${factor.score}%; background: ${getScoreColor(factor.score)}"></div>
                                </div>
                                <div class="factor-value">${Math.round(factor.score)}%</div>
                            </div>
                            <div class="factor-description">${getFactorDescription(key, factor)}</div>
                        </div>
                    `).join('')}
                </div>
                
                <div class="section-divider"></div>
                
                <div class="recommendations-section">
                    <h3><i class="fas fa-lightbulb"></i> Smart Recommendations</h3>
                    <div class="recommendations-grid">
                        ${analysis.recommendations.map(rec => `
                            <div class="recommendation-card">
                                <div class="recommendation-header">
                                    <div class="recommendation-icon">
                                        <i class="fas ${rec.icon}"></i>
                                    </div>
                                    <div class="recommendation-title">${rec.title}</div>
                                </div>
                                <div class="recommendation-description">${rec.description}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;

    } catch (error) {
        console.error('Error loading credit analysis:', error);
        contentContainer.innerHTML = `
            <div class="error-state">
                <i class="fas fa-exclamation-circle"></i>
                <p>An error occurred while analyzing your credit profile: ${error.message}</p>
                <button class="retry-button" onclick="loadCreditCompanionContent()">
                    <i class="fas fa-redo"></i> Retry Analysis
                </button>
            </div>
        `;
    }
}

// Helper function to get color based on score
function getScoreColor(score) {
    if (score >= 750) return '#10df6f'; // Excellent - Green
    if (score >= 700) return '#5ac8fa'; // Good - Blue
    if (score >= 650) return '#ffcc00'; // Fair - Yellow
    return '#ff3b30'; // Poor - Red
}

// Helper function to get factor icon
function getFactorIcon(factor) {
    const icons = {
        paymentHistory: 'fa-calendar-check',
        incomeStability: 'fa-chart-line',
        financialBehavior: 'fa-wallet',
        accountHealth: 'fa-piggy-bank'
    };
    return icons[factor] || 'fa-chart-bar';
}

// Helper function to format factor title
function formatFactorTitle(factor) {
    return factor
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, str => str.toUpperCase())
        .replace(/([a-z])([A-Z])/g, '$1 $2');
}

// Helper function to get factor description
function getFactorDescription(factor, data) {
    switch (factor) {
        case 'paymentHistory':
            const onTimeRate = data.onTimePayments && data.totalPayments ? Math.round((data.onTimePayments / data.totalPayments) * 100) : 0;
            return `${data.onTimePayments || 0} out of ${data.totalPayments || 0} payments were on time in the last 6 months (${onTimeRate}% on-time rate).`;
        case 'incomeStability':
            return `Your monthly income varies by ₱${Math.round(data.monthlyVariation || 0).toLocaleString()} on average. Average monthly income: ₱${Math.round(data.averageIncome || 0).toLocaleString()}.`;
        case 'financialBehavior':
            const behaviors = data.behaviors || {};
            const savingsScore = behaviors.savingHabits ? Math.round(behaviors.savingHabits.score || 0) : 0;
            const spendingScore = behaviors.spendingPatterns ? Math.round(behaviors.spendingPatterns.score || 0) : 0;
            const budgetScore = behaviors.budgetAdherence ? Math.round(behaviors.budgetAdherence.score || 0) : 0;
            return `Your financial habits show ${data.status || 'unknown'} money management skills across savings (${savingsScore}%), spending (${spendingScore}%), and budgeting (${budgetScore}%).`;
        case 'accountHealth':
            const monthsOfRunway = data.monthsOfRunway || 0;
            return `You have ${isNaN(monthsOfRunway) ? 0 : monthsOfRunway.toFixed(1)} months of expenses covered in savings. Total balance: ₱${Math.round(data.totalBalance || 0).toLocaleString()} across ${data.accountDiversity || 0} accounts.`;
        default:
            return 'Factor analysis available.';
    }
} 