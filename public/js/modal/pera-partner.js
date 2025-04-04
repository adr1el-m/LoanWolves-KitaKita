// Pera Partner Tool - Advanced AI-powered loan assistance and financial advisory
import { getAuth } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-auth.js";
import { getUserTransactions, getUserBankAccounts, storeUserData } from "../firestoredb.js";
import { GEMINI_API_KEY, GEMINI_MODEL } from "../config.js";
import { getUserMonthlyIncome, determineIncomeLevel, getRecommendationsByIncome } from "../helpers.js";

// Make function globally accessible
window.loadPeraPartnerContent = loadPeraPartnerContent;

// ML Model version and configuration
const ML_CONFIG = {
    version: '2.0',
    features: ['transaction_patterns', 'income_stability', 'expense_patterns', 'credit_behavior'],
    weights: {
        income_stability: 0.3,
        expense_patterns: 0.25,
        credit_behavior: 0.25,
        transaction_patterns: 0.2
    },
    UNUSUAL_EXPENSE_THRESHOLD: 2
};

// Income-based loan recommendations config
const INCOME_BASED_RECOMMENDATIONS = {
    'low': [
        {
            name: 'Micro Business Loan',
            description: 'Small loan designed for micro-entrepreneurs with minimal documentation',
            minAmount: 5000,
            maxAmount: 20000,
            interestRate: '10-15%',
            terms: '6-12 months',
            requirements: ['Valid ID', 'Proof of residence', 'Simple business plan']
        },
        {
            name: 'Emergency Cash Loan',
            description: 'Quick access to emergency funds with simplified application',
            minAmount: 2000,
            maxAmount: 10000,
            interestRate: '12-18%',
            terms: '3-6 months',
            requirements: ['Valid ID', 'Proof of residence', 'Source of income declaration']
        }
    ],
    'lower-middle': [
        {
            name: 'Personal Cash Loan',
            description: 'General purpose loan with flexible payment terms',
            minAmount: 10000,
            maxAmount: 50000,
            interestRate: '9-14%',
            terms: '12-24 months',
            requirements: ['Valid ID', 'Proof of income', 'Credit assessment']
        },
        {
            name: 'Small Business Starter',
            description: 'Financing option for small business owners with growth potential',
            minAmount: 20000,
            maxAmount: 100000,
            interestRate: '8-12%',
            terms: '12-36 months',
            requirements: ['Business registration', 'Financial statements', 'Business plan']
        }
    ],
    'middle': [
        {
            name: 'Multi-Purpose Personal Loan',
            description: 'Versatile loan product for various personal needs with competitive rates',
            minAmount: 50000,
            maxAmount: 250000,
            interestRate: '7-12%',
            terms: '12-60 months',
            requirements: ['Government ID', 'Proof of income', 'Bank statements', 'Credit check']
        },
        {
            name: 'Home Improvement Loan',
            description: 'Financing for home renovations and improvements',
            minAmount: 100000,
            maxAmount: 500000,
            interestRate: '6-10%',
            terms: '12-60 months',
            requirements: ['Property documentation', 'Proof of income', 'Renovation plan']
        },
        {
            name: 'Vehicle Acquisition Loan',
            description: 'Loan product for vehicle purchases with competitive rates',
            minAmount: 100000,
            maxAmount: 800000,
            interestRate: '7-11%',
            terms: '12-60 months',
            requirements: ['Vehicle details', 'Income verification', 'Downpayment (20%)']
        }
    ],
    'upper-middle': [
        {
            name: 'Premium Personal Loan',
            description: 'High-value personal loan with preferred rates for high-income individuals',
            minAmount: 250000,
            maxAmount: 1000000,
            interestRate: '6-9%',
            terms: '12-60 months',
            requirements: ['Government ID', 'Income tax returns', 'Bank statements', 'Credit history']
        },
        {
            name: 'Business Expansion Loan',
            description: 'Financing for established businesses looking to expand operations',
            minAmount: 500000,
            maxAmount: 2000000,
            interestRate: '5-8%',
            terms: '24-60 months',
            requirements: ['Business registration', 'Financial statements', 'Business plan', 'Collateral options']
        },
        {
            name: 'Investment Property Loan',
            description: 'Financing for real estate investments with competitive terms',
            minAmount: 500000,
            maxAmount: 5000000,
            interestRate: '5-8%',
            terms: '60-180 months',
            requirements: ['Property details', 'Financial documentation', 'Investment plan']
        }
    ],
    'high': [
        {
            name: 'Executive Loan Package',
            description: 'Premium loan package with tailored terms for high-net-worth individuals',
            minAmount: 1000000,
            maxAmount: 10000000,
            interestRate: '4-7%',
            terms: '12-120 months',
            requirements: ['Financial portfolio review', 'Income verification', 'Asset documentation']
        },
        {
            name: 'Wealth Management Financing',
            description: 'Sophisticated financing solutions aligned with wealth management strategies',
            minAmount: 2000000,
            maxAmount: 20000000,
            interestRate: '3.5-6%',
            terms: '12-240 months',
            requirements: ['Net worth statement', 'Investment portfolio', 'Financial strategy consultation']
        },
        {
            name: 'Corporate Expansion Facility',
            description: 'Comprehensive financing solution for business expansion and acquisition',
            minAmount: 5000000,
            maxAmount: 50000000,
            interestRate: '4-8%',
            terms: '36-120 months',
            requirements: ['Business audit reports', 'Corporate financial statements', 'Business valuation']
        }
    ]
};

// Initialize event listeners
document.addEventListener('DOMContentLoaded', function() {
    // Get the pera-partner tool element and add click event listener
    const peraPartnerTool = document.getElementById('pera-partner-tool');
    if (peraPartnerTool) {
        peraPartnerTool.addEventListener('click', function() {
            document.getElementById('pera-partner-modal').style.display = 'flex';
            loadPeraPartnerContent();
        });
    }

    // Close modal when user clicks X
    const closeButtons = document.querySelectorAll('.modal-close-btn[data-modal="pera-partner-modal"]');
    closeButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            document.getElementById('pera-partner-modal').style.display = 'none';
        });
    });

    // Close modal when clicking outside
    window.addEventListener('click', function(e) {
        if (e.target.classList.contains('modal')) {
            e.target.style.display = 'none';
        }
    });

    // Add CSS styles for the new UI
    const styles = `
        #pera-partner-modal {
            background: rgba(0, 0, 0, 0.85);
        }

        #pera-partner-modal-content {
            background: var(--surface-ground, #1a1a1a);
            color: var(--text-color, #f0f0f0);
            max-width: 1200px;
            margin: 20px auto;
            border-radius: 16px;
            padding: 24px;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
        }

        .loan-assistance-container {
            display: grid;
            gap: 24px;
        }

        .financial-insights-header {
            display: flex;
            align-items: center;
            margin-bottom: 24px;
            margin-top: 12px;
        }
        
        .financial-insights-header i {
            font-size: 2.2rem;
            color: #4e95fd;
            margin-right: 1rem;
        }
        
        .financial-insights-header h2 {
            font-size: 2rem;
            font-weight: 600;
            color: var(--text-color, #f0f0f0);
            margin: 0;
        }
        
        .insights-cards-container {
            display: flex;
            flex-direction: column;
            gap: 16px;
            margin-bottom: 24px;
            margin-top: 16px;
        }

        .section-header {
            display: flex;
            align-items: center;
            margin-bottom: 1.5rem;
            padding-bottom: 0.75rem;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            position: relative;
        }

        .section-header i {
            font-size: 1.5rem;
            margin-right: 1rem;
            color: #4e95fd;
        }

        .section-header h3 {
            margin: 0;
            font-size: 1.5rem;
            color: var(--text-color, #f0f0f0);
        }

        .section-header .subtitle {
            position: absolute;
            right: 0;
            bottom: 0.75rem;
            font-size: 0.9rem;
            color: rgba(255, 255, 255, 0.6);
        }

        .financial-summary {
            background: var(--surface-card, #242424);
            padding: 24px;
            border-radius: 12px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }

        .summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-top: 20px;
        }

        .summary-item {
            background: var(--surface-hover, #2a2a2a);
            padding: 20px;
            border-radius: 12px;
            display: flex;
            align-items: center;
            gap: 16px;
            transition: transform 0.2s, box-shadow 0.2s;
        }

        .summary-item:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        }

        .summary-icon {
            width: 48px;
            height: 48px;
            border-radius: 12px;
            background: rgba(78, 149, 253, 0.1);
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .summary-icon i {
            font-size: 1.5rem;
            color: #4e95fd;
        }

        .summary-content {
            flex: 1;
        }

        .summary-label {
            font-size: 0.9rem;
            color: rgba(255, 255, 255, 0.6);
            margin-bottom: 4px;
            display: block;
        }

        .summary-value {
            font-size: 1.4rem;
            font-weight: 600;
            color: var(--text-color, #f0f0f0);
        }

        .income-level {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 1rem;
            font-weight: 500;
        }

        .income-level.low {
            background: rgba(220, 53, 69, 0.1);
            color: #dc3545;
        }

        .income-level.lower-middle {
            background: rgba(255, 193, 7, 0.1);
            color: #ffc107;
        }

        .income-level.middle {
            background: rgba(13, 202, 240, 0.1);
            color: #0dcaf0;
        }

        .income-level.upper-middle {
            background: rgba(25, 135, 84, 0.1);
            color: #198754;
        }

        .income-level.high {
            background: rgba(111, 66, 193, 0.1);
            color: #6f42c1;
        }

        .loan-recommendations {
            background: var(--surface-card, #242424);
            padding: 24px;
            border-radius: 12px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }

        .recommendations-container {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
            gap: 20px;
            margin-top: 20px;
        }

        .loan-card {
            background: var(--surface-hover, #2a2a2a);
            border-radius: 12px;
            padding: 20px;
            position: relative;
            overflow: hidden;
            transition: transform 0.2s, box-shadow 0.2s;
            display: flex;
            flex-direction: column;
        }

        .loan-card:hover {
            transform: translateY(-3px);
            box-shadow: 0 6px 15px rgba(0, 0, 0, 0.2);
        }

        .loan-card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 4px;
            background: linear-gradient(90deg, #4e95fd, #37cfdc);
            opacity: 0.7;
        }

        .loan-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 16px;
        }

        .loan-header h4 {
            font-size: 1.2rem;
            margin: 0;
            color: var(--text-color, #f0f0f0);
        }

        .loan-eligibility {
            display: flex;
            align-items: center;
            gap: 6px;
            background: rgba(25, 135, 84, 0.1);
            color: #28a745;
            padding: 4px 10px;
            border-radius: 12px;
            font-size: 0.8rem;
            font-weight: 500;
        }

        .loan-description {
            color: rgba(255, 255, 255, 0.8);
            line-height: 1.5;
            margin-bottom: 16px;
        }

        .loan-specs {
            display: grid;
            gap: 12px;
            margin-bottom: 16px;
        }

        .loan-spec {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 0;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .loan-spec:last-child {
            border-bottom: none;
        }

        .spec-label {
            color: rgba(255, 255, 255, 0.6);
            font-size: 0.9rem;
        }

        .spec-value {
            color: var(--text-color, #f0f0f0);
            font-weight: 500;
        }

        .loan-requirements {
            margin-bottom: 16px;
        }

        .loan-requirements h5 {
            font-size: 1rem;
            margin: 0 0 10px 0;
            color: rgba(255, 255, 255, 0.8);
        }

        .loan-requirements ul {
            margin: 0;
            padding-left: 20px;
            color: rgba(255, 255, 255, 0.7);
        }

        .loan-requirements li {
            margin-bottom: 6px;
        }

        .loan-actions {
            display: flex;
            gap: 12px;
            margin-top: auto;
            padding-top: 16px;
        }

        .primary-button,
        .secondary-button {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            padding: 10px 16px;
            border-radius: 8px;
            font-size: 0.9rem;
            font-weight: 600;
            cursor: pointer;
            transition: background-color 0.2s, transform 0.1s;
            border: none;
        }

        .primary-button {
            background: #4e95fd;
            color: #fff;
            flex: 2;
        }

        .primary-button:hover {
            background: #3a7ad9;
            transform: translateY(-2px);
        }

        .secondary-button {
            background: rgba(255, 255, 255, 0.1);
            color: rgba(255, 255, 255, 0.9);
            flex: 1;
        }

        .secondary-button:hover {
            background: rgba(255, 255, 255, 0.15);
            transform: translateY(-2px);
        }

        .financial-insights {
            background: var(--surface-card, #242424);
            padding: 24px;
            border-radius: 12px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
            margin-top: 24px;
        }
        
        .financial-insights-heading {
            display: flex;
            align-items: center;
            margin-bottom: 1.5rem;
            padding-left: 10px;
        }
        
        .financial-insights-heading i {
            font-size: 2rem;
            margin-right: 1rem;
            color: #4e95fd;
        }
        
        .financial-insights-heading h3 {
            font-size: 1.8rem;
            margin: 0;
            font-weight: 600;
        }

        .insights-container {
            display: flex;
            flex-direction: column;
            gap: 16px;
        }

        .insight-card {
            background: var(--surface-hover, #2a2a2a);
            padding: 20px;
            border-radius: 12px;
            display: flex;
            flex-direction: row;
            align-items: center;
            text-align: left;
            width: 100%;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
            border-left: 4px solid transparent;
            transition: transform 0.2s, box-shadow 0.2s;
        }
        
        .insight-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 12px rgba(0, 0, 0, 0.3);
        }
        
        .insight-card .insight-icon {
            width: 64px;
            height: 64px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-right: 20px;
            flex-shrink: 0;
        }
        
        .insight-card .insight-icon i {
            font-size: 1.8rem;
        }

        .insight-content {
            width: 100%;
        }

        .insight-content h4 {
            font-size: 1.2rem;
            margin: 0 0 12px 0;
            color: var(--text-color, #f0f0f0);
            font-weight: 600;
        }

        .insight-content p {
            color: rgba(255, 255, 255, 0.8);
            line-height: 1.6;
            margin: 0;
            font-size: 0.95rem;
        }

        .loading-state {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 40px;
            text-align: center;
        }

        .pulse-loader {
            width: 48px;
            height: 48px;
            border: 4px solid rgba(78, 149, 253, 0.1);
            border-top-color: #4e95fd;
            border-radius: 50%;
            animation: pulse 1s infinite linear;
            margin-bottom: 20px;
        }

        @keyframes pulse {
            to {
                transform: rotate(360deg);
            }
        }

        .error-state {
            text-align: center;
            padding: 40px;
        }

        .error-state i {
            font-size: 3rem;
            color: #dc3545;
            margin-bottom: 20px;
        }

        .error-state p {
            color: rgba(255, 255, 255, 0.9);
            margin-bottom: 20px;
        }

        .action-button {
            background: #4e95fd;
            color: #fff;
            border: none;
            border-radius: 8px;
            padding: 12px 24px;
            font-size: 1rem;
            font-weight: 600;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: 8px;
            transition: background-color 0.2s;
        }

        .action-button:hover {
            background: #3a7ad9;
        }

        @media (max-width: 768px) {
            #pera-partner-modal-content {
                margin: 10px;
                padding: 16px;
            }

            .summary-grid,
            .recommendations-container {
                grid-template-columns: 1fr;
            }
            
            .insights-container {
                gap: 12px;
            }
            
            .financial-insights-heading i {
                font-size: 1.6rem;
            }
            
            .financial-insights-heading h3 {
                font-size: 1.5rem;
            }

            .loan-actions {
                flex-direction: column;
            }

            .insight-card {
                padding: 18px;
            }

            .insight-icon {
                width: 48px;
                height: 48px;
            }
            
            .insight-icon i {
                font-size: 1.3rem;
            }
            
            .insight-content h4 {
                font-size: 1.1rem;
                margin-bottom: 8px;
            }
            
            .insight-content p {
                font-size: 0.9rem;
                line-height: 1.5;
            }
        }

        .insight-card.borrowing-capacity {
            border-left-color: #4e95fd;
        }
        
        .insight-card.debt-management {
            border-left-color: #66bb6a;
        }
        
        .insight-card.budget-optimization {
            border-left-color: #ffc107;
        }
        
        .insight-card.borrowing-capacity .insight-icon {
            background: rgba(78, 149, 253, 0.15);
        }
        
        .insight-card.borrowing-capacity .insight-icon i {
            color: #4e95fd;
        }
        
        .insight-card.debt-management .insight-icon {
            background: rgba(102, 187, 106, 0.15);
        }
        
        .insight-card.debt-management .insight-icon i {
            color: #66bb6a;
        }
        
        .insight-card.budget-optimization .insight-icon {
            background: rgba(255, 193, 7, 0.15);
        }
        
        .insight-card.budget-optimization .insight-icon i {
            color: #ffc107;
        }
    `;
    
    const styleSheet = document.createElement('style');
    styleSheet.textContent = styles;
    document.head.appendChild(styleSheet);
});

// Enhanced financial metrics calculation
class FinancialMetricsAnalyzer {
    constructor(transactions, accounts) {
        this.transactions = transactions;
        this.accounts = accounts;
        this.metrics = {};
    }

    async analyzeAll() {
        this.metrics = {
            income: await this.analyzeIncome(),
            expenses: await this.analyzeExpenses(),
            creditBehavior: await this.analyzeCreditBehavior(),
            cashFlow: await this.analyzeCashFlow(),
            riskScore: await this.calculateRiskScore()
        };
        return this.metrics;
    }

    async analyzeIncome() {
        const incomeTransactions = this.transactions.filter(t => t.type === 'income');
        const monthlyIncome = this.calculateMonthlyAverage(incomeTransactions);
        const incomeStability = this.calculateIncomeStability(incomeTransactions);
        const incomeGrowth = this.calculateIncomeGrowth(incomeTransactions);

        return {
            monthly: monthlyIncome,
            stability: incomeStability,
            growth: incomeGrowth,
            sources: this.categorizeIncomeSources(incomeTransactions)
        };
    }

    async analyzeExpenses() {
        const expenseTransactions = this.transactions.filter(t => t.type === 'expense');
        const monthlyExpenses = this.calculateMonthlyAverage(expenseTransactions);
        const expenseCategories = this.categorizeExpenses(expenseTransactions);
        const discretionarySpending = this.calculateDiscretionarySpending(expenseCategories);

        return {
            monthly: monthlyExpenses,
            categories: expenseCategories,
            discretionary: discretionarySpending,
            patterns: this.analyzeExpensePatterns(expenseTransactions)
        };
    }

    async analyzeCreditBehavior() {
        const loanPayments = this.transactions.filter(t => 
            t.type === 'expense' && 
            (t.category === 'loans' || t.name.toLowerCase().includes('loan'))
        );

        return {
            existingLoans: this.analyzeExistingLoans(loanPayments),
            paymentHistory: this.analyzePaymentHistory(loanPayments),
            creditUtilization: this.calculateCreditUtilization()
        };
    }

    async analyzeCashFlow() {
        const monthlyData = this.getMonthlyFinancialData();
        const volatility = this.calculateCashFlowVolatility(monthlyData);
        const projection = this.projectCashFlow(monthlyData);

        return {
            current: monthlyData.currentMonth,
            trend: monthlyData.trend,
            volatility: volatility,
            projection: projection
        };
    }

    calculateIncomeStability(incomeTransactions) {
        const monthlyIncomes = this.groupTransactionsByMonth(incomeTransactions);
        const values = Object.values(monthlyIncomes);
        return values.length > 1 ? this.calculateStandardDeviation(values) / this.calculateMean(values) : 1;
    }

    calculateIncomeGrowth(incomeTransactions) {
        const monthlyIncomes = this.groupTransactionsByMonth(incomeTransactions);
        const months = Object.keys(monthlyIncomes).sort();
        if (months.length < 2) return 0;

        const firstMonth = monthlyIncomes[months[0]];
        const lastMonth = monthlyIncomes[months[months.length - 1]];
        return ((lastMonth - firstMonth) / firstMonth) * 100;
    }

    analyzeExpensePatterns(expenses) {
        const patterns = {
            recurring: this.identifyRecurringExpenses(expenses),
            seasonal: this.identifySeasonalPatterns(expenses),
            unusual: this.identifyUnusualExpenses(expenses)
        };

        return patterns;
    }

    async calculateRiskScore() {
        const weights = ML_CONFIG.weights;
        const scores = {
            income_stability: this.metrics.income?.stability || 0,
            expense_patterns: this.metrics.expenses?.discretionary?.ratio || 0,
            credit_behavior: this.calculateCreditBehaviorScore(),
            transaction_patterns: this.calculateTransactionPatternScore()
        };

        let totalScore = 0;
        for (const [key, weight] of Object.entries(weights)) {
            totalScore += scores[key] * weight;
        }

        return {
            overall: Math.min(Math.max(totalScore, 300), 850),
            components: scores
        };
    }

    calculateMonthlyAverage(transactions) {
        const monthlyTotals = this.groupTransactionsByMonth(transactions);
        const values = Object.values(monthlyTotals);
        return values.length > 0 ? this.calculateMean(values) : 0;
    }

    groupTransactionsByMonth(transactions) {
        const monthlyTotals = {};
        transactions.forEach(transaction => {
            const date = new Date(transaction.date);
            const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`;
            monthlyTotals[monthKey] = (monthlyTotals[monthKey] || 0) + parseFloat(transaction.amount);
        });
        return monthlyTotals;
    }

    calculateMean(values) {
        return values.reduce((sum, value) => sum + value, 0) / values.length;
    }

    calculateStandardDeviation(values) {
        const mean = this.calculateMean(values);
        const squareDiffs = values.map(value => Math.pow(value - mean, 2));
        const avgSquareDiff = this.calculateMean(squareDiffs);
        return Math.sqrt(avgSquareDiff);
    }

    categorizeIncomeSources(transactions) {
        const sources = {};
        transactions.forEach(transaction => {
            const source = transaction.category || 'uncategorized';
            if (!sources[source]) {
                sources[source] = {
                    total: 0,
                    count: 0,
                    average: 0,
                    reliability: 0
                };
            }
            sources[source].total += parseFloat(transaction.amount);
            sources[source].count++;
        });

        // Calculate averages and reliability scores
        Object.values(sources).forEach(source => {
            source.average = source.total / source.count;
            source.reliability = this.calculateSourceReliability(source);
        });

        return sources;
    }

    calculateSourceReliability(source) {
        // Higher reliability for consistent, frequent income sources
        const frequencyScore = Math.min(source.count / 12, 1); // Max score for monthly or more frequent
        const amountConsistency = 1 - (source.average / source.total);
        return (frequencyScore + amountConsistency) / 2;
    }

    categorizeExpenses(transactions) {
        const categories = {};
        transactions.forEach(transaction => {
            const category = transaction.category || 'uncategorized';
            if (!categories[category]) {
                categories[category] = {
                    total: 0,
                    transactions: [],
                    monthly: {},
                    trend: 'stable'
                };
            }
            categories[category].total += parseFloat(transaction.amount);
            categories[category].transactions.push(transaction);
            
            // Track monthly totals
            const month = new Date(transaction.date).getMonth();
            categories[category].monthly[month] = (categories[category].monthly[month] || 0) + parseFloat(transaction.amount);
        });

        // Calculate trends for each category
        Object.keys(categories).forEach(category => {
            categories[category].trend = this.calculateExpenseTrend(categories[category].monthly);
        });

        return categories;
    }

    calculateExpenseTrend(monthlyData) {
        const months = Object.keys(monthlyData).sort();
        if (months.length < 3) return 'insufficient_data';

        const values = months.map(m => monthlyData[m]);
        const changes = [];
        for (let i = 1; i < values.length; i++) {
            changes.push(((values[i] - values[i-1]) / values[i-1]) * 100);
        }

        const avgChange = this.calculateMean(changes);
        if (avgChange > 5) return 'increasing';
        if (avgChange < -5) return 'decreasing';
        return 'stable';
    }

    calculateDiscretionarySpending(categories) {
        const essentialCategories = ['rent', 'utilities', 'groceries', 'healthcare', 'transportation'];
        let essential = 0;
        let discretionary = 0;

        Object.entries(categories).forEach(([category, data]) => {
            if (essentialCategories.includes(category.toLowerCase())) {
                essential += data.total;
            } else {
                discretionary += data.total;
            }
        });

        return {
            essential,
            discretionary,
            ratio: discretionary / (essential + discretionary)
        };
    }

    identifyRecurringExpenses(expenses) {
        const recurring = {};
        const monthlyThreshold = 0.8; // 80% occurrence rate to be considered recurring

        expenses.forEach(expense => {
            const key = `${expense.category}-${expense.amount}`;
            if (!recurring[key]) {
                recurring[key] = {
                    category: expense.category,
                    amount: expense.amount,
                    occurrences: new Set(),
                    confidence: 0
                };
            }
            recurring[key].occurrences.add(new Date(expense.date).getMonth());
        });

        return Object.values(recurring).filter(exp => {
            exp.confidence = exp.occurrences.size / 12;
            return exp.confidence >= monthlyThreshold;
        });
    }

    identifySeasonalPatterns(expenses) {
        const seasonalExpenses = {};
        const seasons = {
            summer: [5, 6, 7],
            fall: [8, 9, 10],
            winter: [11, 0, 1],
            spring: [2, 3, 4]
        };

        expenses.forEach(expense => {
            const month = new Date(expense.date).getMonth();
            const season = Object.entries(seasons).find(([_, months]) => months.includes(month))[0];
            
            if (!seasonalExpenses[season]) {
                seasonalExpenses[season] = {
                    total: 0,
                    categories: {},
                    average: 0
                };
            }
            
            seasonalExpenses[season].total += parseFloat(expense.amount);
            if (!seasonalExpenses[season].categories[expense.category]) {
                seasonalExpenses[season].categories[expense.category] = 0;
            }
            seasonalExpenses[season].categories[expense.category] += parseFloat(expense.amount);
        });

        // Calculate averages and identify significant seasonal variations
        const totalExpenses = Object.values(seasonalExpenses).reduce((sum, season) => sum + season.total, 0);
        const averagePerSeason = totalExpenses / 4;

        Object.keys(seasonalExpenses).forEach(season => {
            seasonalExpenses[season].average = seasonalExpenses[season].total / 3; // 3 months per season
            seasonalExpenses[season].variation = (seasonalExpenses[season].total - averagePerSeason) / averagePerSeason;
        });

        return seasonalExpenses;
    }

    identifyUnusualExpenses(expenses) {
        const unusualThreshold = ML_CONFIG.UNUSUAL_EXPENSE_THRESHOLD;
        const amounts = expenses.map(e => Math.abs(parseFloat(e.amount)));
        const stats = {
            mean: this.calculateMean(amounts),
            stdDev: this.calculateStandardDeviation(amounts)
        };

        return expenses.filter(expense => {
            const amount = Math.abs(parseFloat(expense.amount));
            return Math.abs(amount - stats.mean) > (stats.stdDev * unusualThreshold);
        });
    }

    calculateExpenseRiskScore() {
        const metrics = {
            discretionaryRatio: this.metrics.expenses?.discretionary?.ratio || 0,
            unusualExpenses: this.identifyUnusualExpenses(this.transactions).length,
            recurringExpenses: this.identifyRecurringExpenses(this.transactions).length
        };

        // Calculate risk score (0-100)
        let score = 100;
        if (metrics.discretionaryRatio > 0.4) score -= 20;
        if (metrics.unusualExpenses > 5) score -= 15;
        if (metrics.recurringExpenses > 10) score -= 10;

        return Math.max(0, score);
    }

    calculateCreditBehaviorScore() {
        const loanPayments = this.transactions.filter(t => 
            t.type === 'expense' && 
            (t.category === 'loans' || t.name.toLowerCase().includes('loan'))
        );

        const metrics = {
            paymentHistory: this.analyzePaymentHistory(loanPayments),
            utilization: this.calculateCreditUtilization(),
            existingLoans: this.analyzeExistingLoans(loanPayments)
        };

        let score = 100;
        if (metrics.paymentHistory.latePayments > 0) score -= 30;
        if (metrics.utilization > 0.7) score -= 20;
        if (metrics.existingLoans.active > 3) score -= 15;

        return Math.max(0, score);
    }

    calculateTransactionPatternScore() {
        const patterns = {
            income: this.metrics.income?.stability || 0,
            expenses: this.metrics.expenses?.patterns || {},
            cashFlow: this.metrics.cashFlow?.volatility || 0
        };

        let score = 100;
        if (patterns.income < 0.7) score -= 20;
        if (patterns.cashFlow > 0.3) score -= 15;
        if (Object.keys(patterns.expenses.recurring || {}).length < 3) score -= 10;

        return Math.max(0, score);
    }

    // Add missing methods for credit behavior analysis
    analyzeExistingLoans(loanPayments) {
        if (!loanPayments || loanPayments.length === 0) {
            return { active: 0, amounts: [], total: 0 };
        }

        // Group by loan name/category to identify unique loans
        const loansByName = {};
        loanPayments.forEach(payment => {
            const key = payment.name.toLowerCase();
            if (!loansByName[key]) {
                loansByName[key] = {
                    name: payment.name,
                    payments: [],
                    total: 0
                };
            }
            loansByName[key].payments.push(payment);
            loansByName[key].total += parseFloat(payment.amount || 0);
        });

        const activeLoans = Object.keys(loansByName).length;
        const loanAmounts = Object.values(loansByName).map(loan => loan.total);
        const totalLoanAmount = loanAmounts.reduce((sum, amount) => sum + amount, 0);

        return {
            active: activeLoans,
            amounts: loanAmounts,
            total: totalLoanAmount
        };
    }

    analyzePaymentHistory(loanPayments) {
        if (!loanPayments || loanPayments.length === 0) {
            return { onTime: 0, late: 0, latePayments: 0 };
        }

        // For simplicity, we'll consider payments made at the beginning of the month as on-time
        // and those at the end as potentially late (simplified assumption)
        let onTimePayments = 0;
        let latePayments = 0;

        loanPayments.forEach(payment => {
            const paymentDate = new Date(payment.date).getDate();
            if (paymentDate <= 15) {
                onTimePayments++;
            } else {
                latePayments++;
            }
        });

        return {
            onTime: onTimePayments,
            late: latePayments,
            latePayments: latePayments,
            score: loanPayments.length > 0 ? (onTimePayments / loanPayments.length) * 100 : 100
        };
    }

    calculateCreditUtilization() {
        // Check if we have credit card accounts
        const creditCardAccounts = this.accounts.filter(a => 
            a.accountType?.toLowerCase().includes('credit') || 
            a.accountName?.toLowerCase().includes('credit')
        );

        if (creditCardAccounts.length === 0) {
            return 0.3; // Return a default moderate utilization if no credit cards found
        }

        // Calculate utilization based on balance and credit limit
        let totalBalance = 0;
        let totalLimit = 0;

        creditCardAccounts.forEach(account => {
            const balance = parseFloat(account.balance || 0);
            // Use provided limit or estimate based on highest transaction amount
            let limit = parseFloat(account.creditLimit || 0);
            
            if (!limit || limit <= 0) {
                // Estimate limit as 3x the highest transaction amount for this account
                const accountTransactions = this.transactions.filter(t => t.accountId === account.id);
                const highestAmount = accountTransactions.reduce((max, t) => 
                    Math.max(max, Math.abs(parseFloat(t.amount || 0))), 0);
                limit = Math.max(balance * 3, highestAmount * 3, 50000); // Reasonable fallback values
            }
            
            totalBalance += balance;
            totalLimit += limit;
        });

        // Calculate utilization ratio (capped at 1.0)
        return totalLimit > 0 ? Math.min(totalBalance / totalLimit, 1.0) : 0.5;
    }

    getMonthlyFinancialData() {
        const monthlyData = {};
        const today = new Date();
        const currentMonth = today.getMonth();
        const currentYear = today.getFullYear();

        // Get last 12 months of data
        for (let i = 0; i < 12; i++) {
            const month = (currentMonth - i + 12) % 12;
            const year = currentYear - Math.floor((currentMonth - i + 12) / 12);
            const key = `${year}-${month + 1}`;

            monthlyData[key] = {
                income: 0,
                expenses: 0,
                balance: 0,
                cashFlow: 0
            };
        }

        // Populate with transaction data
        this.transactions.forEach(transaction => {
            const date = new Date(transaction.date);
            const key = `${date.getFullYear()}-${date.getMonth() + 1}`;
            if (monthlyData[key]) {
                if (transaction.type === 'income') {
                    monthlyData[key].income += parseFloat(transaction.amount);
                } else {
                    monthlyData[key].expenses += parseFloat(transaction.amount);
                }
                monthlyData[key].cashFlow = monthlyData[key].income - monthlyData[key].expenses;
            }
        });

        // Calculate running balance
        let runningBalance = this.accounts.reduce((sum, account) => sum + parseFloat(account.balance || 0), 0);
        Object.keys(monthlyData).sort().reverse().forEach(key => {
            monthlyData[key].balance = runningBalance;
            runningBalance -= monthlyData[key].cashFlow;
        });

        return {
            currentMonth: monthlyData[`${currentYear}-${currentMonth + 1}`],
            trend: this.calculateTrend(Object.values(monthlyData)),
            data: monthlyData
        };
    }

    calculateCashFlowVolatility(monthlyData) {
        const cashFlows = Object.values(monthlyData.data).map(month => month.cashFlow);
        return this.calculateStandardDeviation(cashFlows) / Math.abs(this.calculateMean(cashFlows));
    }

    projectCashFlow(monthlyData) {
        const cashFlows = Object.values(monthlyData.data).map(month => month.cashFlow);
        const trend = this.calculateTrend(cashFlows);
        const average = this.calculateMean(cashFlows);
        const volatility = this.calculateCashFlowVolatility(monthlyData);

        // Project next 3 months
        const projections = [];
        for (let i = 1; i <= 3; i++) {
            const projectedValue = average * (1 + trend * i);
            const range = projectedValue * volatility;
            projections.push({
                month: i,
                expected: projectedValue,
                range: {
                    low: projectedValue - range,
                    high: projectedValue + range
                },
                confidence: 1 - (volatility * i * 0.2) // Decreasing confidence over time
            });
        }

        return projections;
    }

    calculateTrend(values) {
        if (values.length < 2) return 0;
        
        const xMean = (values.length - 1) / 2;
        const yMean = this.calculateMean(values);
        
        let numerator = 0;
        let denominator = 0;
        
        values.forEach((y, x) => {
            numerator += (x - xMean) * (y - yMean);
            denominator += Math.pow(x - xMean, 2);
        });
        
        return denominator !== 0 ? numerator / denominator : 0;
    }
}

// Function to load the loan assistance content
async function loadPeraPartnerContent() {
    const contentContainer = document.getElementById('pera-partner-modal-content');
    const auth = getAuth();
    const user = auth.currentUser;

    if (!user) {
        contentContainer.innerHTML = `
            <div class="error-state">
                <i class="fas fa-exclamation-circle"></i>
                <p>Please log in to view your personalized loan recommendations.</p>
            </div>
        `;
        return;
    }

    // Show loading state
    contentContainer.innerHTML = `
        <div class="loading-state">
            <div class="pulse-loader"></div>
            <p>Analyzing your financial profile and finding the best loan options...</p>
        </div>
    `;

    try {
        // Get user data sources
        const accounts = await getUserBankAccounts(user.uid);
        const transactions = await getUserTransactions(user.uid);
        
        // Get monthly income from user profile
        const declaredMonthlyIncome = await getUserMonthlyIncome();
        const incomeLevel = determineIncomeLevel(declaredMonthlyIncome);
        
        // Continue with existing analysis...
        // Calculate total balance across all accounts
        const totalBalance = accounts.reduce((total, account) => total + parseFloat(account.balance || 0), 0);

        // Analyze monthly transactions
        const today = new Date();
        const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const firstDayOfLastThreeMonths = new Date(today.getFullYear(), today.getMonth() - 3, 1);

        // Filter for this month's transactions
        const monthlyTransactions = transactions.filter(t => {
            const transactionDate = new Date(t.date);
            return transactionDate >= firstDayOfMonth;
        });

        // Filter for last three months' transactions for better analysis
        const threeMonthTransactions = transactions.filter(t => {
            const transactionDate = new Date(t.date);
            return transactionDate >= firstDayOfLastThreeMonths;
        });

        // Calculate monthly income and expenses
        const calculatedMonthlyIncome = monthlyTransactions
            .filter(t => t.type === 'income')
            .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);

        // Use declared income if available, otherwise use calculated income
        const monthlyIncome = declaredMonthlyIncome || calculatedMonthlyIncome;

        const monthlyExpenses = monthlyTransactions
            .filter(t => t.type === 'expense')
            .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);

        // Calculate debt-to-income ratio
        const debtToIncomeRatio = monthlyIncome > 0 ? (monthlyExpenses / monthlyIncome) : 1;

        // Identify existing loan payments
        const existingLoans = threeMonthTransactions.filter(t =>
            t.type === 'expense' &&
            (t.category === 'loans' || t.name.toLowerCase().includes('loan') || t.name.toLowerCase().includes('payment'))
        );

        // Calculate monthly loan payments
        const monthlyLoanPayments = existingLoans.reduce((sum, loan) => sum + parseFloat(loan.amount || 0), 0) / 3;

        // Estimate credit score (simplified)
        let estimatedCreditScore = 650; // Base score

        // Adjust based on financial factors
        if (debtToIncomeRatio < 0.3) estimatedCreditScore += 50;
        else if (debtToIncomeRatio > 0.5) estimatedCreditScore -= 50;

        if (totalBalance > 50000) estimatedCreditScore += 30;
        if (existingLoans.length === 0) estimatedCreditScore += 20;

        // Cap the credit score
        estimatedCreditScore = Math.min(850, Math.max(300, estimatedCreditScore));

        // Calculate available credit (simplified)
        const maxMonthlyPayment = monthlyIncome * 0.36 - monthlyLoanPayments;
        const availableCredit = maxMonthlyPayment * 24;

        // Analyze financial metrics for more insights
        let financialMetrics = null;
        if (transactions.length > 0 && accounts.length > 0) {
            const analyzer = new FinancialMetricsAnalyzer(transactions, accounts);
            financialMetrics = await analyzer.analyzeAll();
            
            // Update the estimated credit score with the more sophisticated calculation
            if (financialMetrics.riskScore && financialMetrics.riskScore.overall) {
                estimatedCreditScore = financialMetrics.riskScore.overall;
            }
        }

        // Get personalized loan recommendations
        let loanRecommendations;
        
        // First try from income-based configurations
        const incomeBasedRecommendations = getRecommendationsByIncome(incomeLevel, INCOME_BASED_RECOMMENDATIONS);
        
        if (incomeBasedRecommendations && incomeBasedRecommendations.length > 0) {
            loanRecommendations = incomeBasedRecommendations;
        } else {
            // Fallback to AI generation or defaults
            try {
                const recommendations = await generateLoanRecommendations({
                    monthlyIncome,
                    monthlyExpenses,
                    debtToIncomeRatio,
                    estimatedCreditScore,
                    availableCredit,
                    existingLoans: existingLoans.length,
                    totalBalance,
                    financialMetrics
                });
                
                // Extract the loan options from the recommendations
                loanRecommendations = recommendations.loanOptions || [];
                
                // If we have no loan options, use fallback
                if (loanRecommendations.length === 0) {
                    const fallbackRecs = generateFallbackRecommendations({
                        monthlyIncome,
                        estimatedCreditScore,
                        availableCredit
                    });
                    loanRecommendations = fallbackRecs.loanOptions || [];
                }
            } catch (error) {
                console.error("Error generating AI recommendations:", error);
                const fallbackRecs = generateFallbackRecommendations({
                    monthlyIncome,
                    estimatedCreditScore,
                    availableCredit
                });
                loanRecommendations = fallbackRecs.loanOptions || [];
            }
        }
        
        // Make sure we have at least an empty array to avoid mapping errors
        if (!loanRecommendations || !Array.isArray(loanRecommendations)) {
            loanRecommendations = [];
        }

        // Generate HTML content with new UI structure
        contentContainer.innerHTML = `
            <div class="loan-assistance-container">
                <div class="financial-summary">
                    <div class="section-header">
                        <i class="fas fa-user-circle"></i>
                        <h3>Your Financial Profile</h3>
                        <span class="subtitle">Loan Eligibility Overview</span>
                    </div>
                    <div class="summary-grid">
                        <div class="summary-item">
                            <div class="summary-icon">
                                <i class="fas fa-money-bill-wave"></i>
                            </div>
                            <div class="summary-content">
                                <span class="summary-label">Monthly Income</span>
                                <span class="summary-value">₱${monthlyIncome.toLocaleString()}</span>
                            </div>
                        </div>
                        <div class="summary-item">
                            <div class="summary-icon">
                                <i class="fas fa-shopping-cart"></i>
                            </div>
                            <div class="summary-content">
                                <span class="summary-label">Monthly Expenses</span>
                                <span class="summary-value">₱${monthlyExpenses.toLocaleString()}</span>
                            </div>
                        </div>
                        <div class="summary-item">
                            <div class="summary-icon">
                                <i class="fas fa-percentage"></i>
                            </div>
                            <div class="summary-content">
                                <span class="summary-label">Debt-to-Income</span>
                                <span class="summary-value">${(debtToIncomeRatio * 100).toFixed(1)}%</span>
                            </div>
                        </div>
                        <div class="summary-item">
                            <div class="summary-icon">
                                <i class="fas fa-chart-line"></i>
                            </div>
                            <div class="summary-content">
                                <span class="summary-label">Credit Score</span>
                                <span class="summary-value">${Math.round(estimatedCreditScore)}</span>
                            </div>
                        </div>
                        <div class="summary-item">
                            <div class="summary-icon">
                                <i class="fas fa-credit-card"></i>
                            </div>
                            <div class="summary-content">
                                <span class="summary-label">Available Credit</span>
                                <span class="summary-value">₱${availableCredit.toLocaleString()}</span>
                            </div>
                        </div>
                        <div class="summary-item">
                            <div class="summary-icon">
                                <i class="fas fa-coins"></i>
                            </div>
                            <div class="summary-content">
                                <span class="summary-label">Income Level</span>
                                <span class="summary-value income-level ${incomeLevel}">${formatIncomeLevel(incomeLevel)}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="financial-insights-header">
                    <i class="fas fa-lightbulb"></i>
                    <h2>Financial Insights</h2>
                </div>

                <div class="insights-cards-container">
                    <div class="insight-card borrowing-capacity">
                        <div class="insight-icon">
                            <i class="fas fa-hand-holding-usd"></i>
                        </div>
                        <div class="summary-content">
                            <span class="summary-label">Borrowing Capacity</span>
                            <span class="summary-value">Based on your income level (${formatIncomeLevel(incomeLevel)}) and financial profile, your monthly loan payment capacity is approximately ₱${maxMonthlyPayment.toLocaleString()}.</span>
                        </div>
                    </div>
                    <div class="insight-card debt-management">
                        <div class="insight-icon">
                            <i class="fas fa-balance-scale"></i>
                        </div>
                        <div class="summary-content">
                            <span class="summary-label">Debt Management</span>
                            <span class="summary-value">Your debt-to-income ratio is ${(debtToIncomeRatio * 100).toFixed(1)}%, which is ${debtToIncomeRatio < 0.36 ? 'healthy' : 'above recommended limits'}. ${debtToIncomeRatio > 0.36 ? 'Consider reducing existing debt before taking new loans.' : 'You have room to take on additional credit if needed.'}</span>
                        </div>
                    </div>
                    <div class="insight-card budget-optimization">
                        <div class="insight-icon">
                            <i class="fas fa-chart-pie"></i>
                        </div>
                        <div class="summary-content">
                            <span class="summary-label">Budget Optimization</span>
                            <span class="summary-value">${generateBudgetInsight(monthlyIncome, monthlyExpenses, incomeLevel)}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Store financial metrics for future use
        if (financialMetrics) {
            // Removed connection to financial health monitoring
        }

    } catch (error) {
        console.error("Error loading loan recommendations:", error);
        contentContainer.innerHTML = `
            <div class="error-state">
                <i class="fas fa-exclamation-circle"></i>
                <p>An error occurred while analyzing your financial profile. Please try again later.</p>
                <button class="action-button" onclick="loadPeraPartnerContent()">
                    <i class="fas fa-sync"></i> Retry
                </button>
            </div>
        `;
    }
}

// Helper function to format income level
function formatIncomeLevel(level) {
    switch(level) {
        case 'low': return 'Low Income';
        case 'lower-middle': return 'Lower-Middle Income';
        case 'middle': return 'Middle Income';
        case 'upper-middle': return 'Upper-Middle Income';
        case 'high': return 'High Income';
        default: return 'Income Not Specified';
    }
}

// Generate personalized budget insights based on income level
function generateBudgetInsight(income, expenses, incomeLevel) {
    if (income <= 0) return "Please update your income information for personalized budget insights.";
    
    const savingsRate = (income - expenses) / income;
    let recommendations = '';
    
    if (savingsRate < 0) {
        recommendations = "Your expenses exceed your income. Consider reviewing your spending patterns to reduce expenses.";
    } else if (savingsRate < 0.1) {
        recommendations = "Your savings rate is less than 10%. Consider allocating more towards saving for emergencies and future goals.";
    } else if (savingsRate < 0.2) {
        recommendations = "Your savings rate is good but could be improved. Aim for 20-30% of income for savings and investments.";
    } else {
        recommendations = "Great job! You're saving more than 20% of your income. Consider diversifying investments for long-term growth.";
    }
    
    // Add income level specific advice
    switch(incomeLevel) {
        case 'low':
            recommendations += " Focus on building an emergency fund of at least ₱15,000 before considering loans.";
            break;
        case 'lower-middle':
            recommendations += " Consider maintaining an emergency fund of 3 months' expenses (around ₱" + (expenses * 3).toLocaleString() + ").";
            break;
        case 'middle':
            recommendations += " Explore investment options to grow your wealth alongside maintaining an emergency fund.";
            break;
        case 'upper-middle':
            recommendations += " Consider a diversified investment strategy including stocks, bonds, and real estate.";
            break;
        case 'high':
            recommendations += " Talk to a financial advisor about tax-efficient investment strategies and wealth management solutions.";
            break;
    }
    
    return recommendations;
}

// Display detailed loan information
function showLoanDetails(loan) {
    // Get the loan name or title
    const loanName = loan.name || loan.title;
    
    // Get the loan details
    const minAmount = loan.minAmount || 10000;
    const maxAmount = loan.maxAmount || 100000;
    const interestRate = loan.interestRate || 
        (loan.details && loan.details.find(d => d.label === 'Interest Rate')?.value) || '8-12%';
    const terms = loan.terms || 
        (loan.details && loan.details.find(d => d.label === 'Term')?.value) || '12-36 months';
    const processingFee = loan.processingFee || '1-3% of loan amount';
    const disbursementTime = loan.disbursementTime || '3-5 business days';
    const requirements = loan.requirements || 
        [(loan.details && loan.details.find(d => d.label === 'Requirements')?.value) || 'Valid ID, Proof of Income'];
    
    const modalContent = `
        <div class="loan-details-modal">
            <div class="loan-details-header">
                <h3>${loanName}</h3>
                <button class="close-details-btn" aria-label="Close">×</button>
            </div>
            <div class="loan-details-content">
                <div class="section-header" style="margin-top: 0;">
                    <i class="fas fa-info-circle"></i>
                    <h3>Loan Overview</h3>
                </div>
                <div class="loan-description">
                    <p>${loan.description}</p>
                </div>
                
                <div class="section-header">
                    <i class="fas fa-file-contract"></i>
                    <h3>Loan Specifications</h3>
                </div>
                <div class="loan-specs-detailed">
                    <div class="loan-spec">
                        <span class="spec-label">Amount Range</span>
                        <span class="spec-value">₱${minAmount.toLocaleString()} - ₱${maxAmount.toLocaleString()}</span>
                    </div>
                    <div class="loan-spec">
                        <span class="spec-label">Interest Rate</span>
                        <span class="spec-value">${interestRate}</span>
                    </div>
                    <div class="loan-spec">
                        <span class="spec-label">Term</span>
                        <span class="spec-value">${terms}</span>
                    </div>
                    <div class="loan-spec">
                        <span class="spec-label">Processing Fee</span>
                        <span class="spec-value">${processingFee}</span>
                    </div>
                    <div class="loan-spec">
                        <span class="spec-label">Disbursement Time</span>
                        <span class="spec-value">${disbursementTime}</span>
                    </div>
                </div>
                
                <div class="section-header">
                    <i class="fas fa-clipboard-list"></i>
                    <h3>Requirements</h3>
                </div>
                <div class="loan-requirements">
                    <ul>
                        ${requirements.map(req => `<li>${req}</li>`).join('')}
                    </ul>
                </div>
                
                <div class="section-header">
                    <i class="fas fa-star"></i>
                    <h3>Features & Benefits</h3>
                </div>
                <div class="loan-features">
                    <ul>
                        <li>Flexible repayment options</li>
                        <li>No prepayment penalties</li>
                        <li>Online application and tracking</li>
                        <li>Dedicated loan officer assistance</li>
                    </ul>
                </div>
                
                <div class="loan-actions" style="margin-top: 24px;">
                    <button class="primary-button apply-now-detailed">
                        <i class="fas fa-paper-plane"></i> Apply Now
                    </button>
                    <button class="secondary-button calculate-btn">
                        <i class="fas fa-calculator"></i> Loan Calculator
                    </button>
                </div>
            </div>
        </div>
    `;
    
    // Create modal element
    const modal = document.createElement('div');
    modal.className = 'loan-modal';
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100%';
    modal.style.height = '100%';
    modal.style.backgroundColor = 'rgba(0, 0, 0, 0.85)';
    modal.style.display = 'flex';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    modal.style.zIndex = '9999';
    modal.innerHTML = modalContent;
    document.body.appendChild(modal);
    
    // Style the loan details modal
    const loanDetailsModal = modal.querySelector('.loan-details-modal');
    loanDetailsModal.style.backgroundColor = 'var(--surface-ground, #1a1a1a)';
    loanDetailsModal.style.color = 'var(--text-color, #f0f0f0)';
    loanDetailsModal.style.borderRadius = '16px';
    loanDetailsModal.style.width = '90%';
    loanDetailsModal.style.maxWidth = '800px';
    loanDetailsModal.style.maxHeight = '90vh';
    loanDetailsModal.style.overflowY = 'auto';
    loanDetailsModal.style.position = 'relative';
    
    const loanDetailsHeader = modal.querySelector('.loan-details-header');
    loanDetailsHeader.style.display = 'flex';
    loanDetailsHeader.style.justifyContent = 'space-between';
    loanDetailsHeader.style.alignItems = 'center';
    loanDetailsHeader.style.padding = '20px 24px';
    loanDetailsHeader.style.borderBottom = '1px solid rgba(255, 255, 255, 0.1)';
    
    const loanDetailsTitle = loanDetailsHeader.querySelector('h3');
    loanDetailsTitle.style.margin = '0';
    loanDetailsTitle.style.fontSize = '1.5rem';
    loanDetailsTitle.style.color = 'var(--text-color, #f0f0f0)';
    
    const closeButton = loanDetailsHeader.querySelector('.close-details-btn');
    closeButton.style.background = 'none';
    closeButton.style.border = 'none';
    closeButton.style.color = 'rgba(255, 255, 255, 0.7)';
    closeButton.style.fontSize = '2rem';
    closeButton.style.cursor = 'pointer';
    closeButton.style.padding = '0';
    closeButton.style.lineHeight = '1';
    
    const loanDetailsContent = modal.querySelector('.loan-details-content');
    loanDetailsContent.style.padding = '24px';
    
    // Add event listeners
    modal.querySelector('.close-details-btn').addEventListener('click', () => {
        document.body.removeChild(modal);
    });
    
    modal.querySelector('.apply-now-detailed').addEventListener('click', () => {
        document.body.removeChild(modal);
        showLoanApplicationForm(loan);
    });
    
    modal.querySelector('.calculate-btn').addEventListener('click', () => {
        showLoanCalculator(loan);
    });
    
    // Close when clicking outside
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            document.body.removeChild(modal);
        }
    });
}

// Show loan application form
function showLoanApplicationForm(loan) {
    // Get the loan name or title
    const loanName = loan.name || loan.title;
    
    // Get the loan details
    const minAmount = loan.minAmount || 10000;
    const maxAmount = loan.maxAmount || 100000;
    const interestRate = loan.interestRate || 
        (loan.details && loan.details.find(d => d.label === 'Interest Rate')?.value) || '8-12%';
    const terms = loan.terms || 
        (loan.details && loan.details.find(d => d.label === 'Term')?.value) || '12-36 months';
    const requirements = loan.requirements || 
        [(loan.details && loan.details.find(d => d.label === 'Requirements')?.value) || 'Valid ID, Proof of Income'];

    // Import necessary functions
    import('../js/helpers.js').then(({ validateName, validateEmail, validateAmount, validateDate, sanitizeString, showValidationError, clearAllValidationErrors }) => {
        const modalContent = `
            <div class="loan-application-modal">
                <div class="loan-application-header">
                    <h3>Application for ${loanName}</h3>
                    <button class="close-application-btn" aria-label="Close">×</button>
                </div>
                <div class="loan-application-content">
                    <div class="section-header" style="margin-top: 0;">
                        <i class="fas fa-file-alt"></i>
                        <h3>Loan Summary</h3>
                    </div>
                    <div class="loan-summary">
                        <div class="summary-grid" style="margin-top: 0;">
                            <div class="summary-item">
                                <div class="summary-icon">
                                    <i class="fas fa-tag"></i>
                                </div>
                                <div class="summary-content">
                                    <span class="summary-label">Loan Type</span>
                                    <span class="summary-value">${loanName}</span>
                                </div>
                            </div>
                            <div class="summary-item">
                                <div class="summary-icon">
                                    <i class="fas fa-dollar-sign"></i>
                                </div>
                                <div class="summary-content">
                                    <span class="summary-label">Amount Range</span>
                                    <span class="summary-value">₱${minAmount.toLocaleString()} - ₱${maxAmount.toLocaleString()}</span>
                                </div>
                            </div>
                            <div class="summary-item">
                                <div class="summary-icon">
                                    <i class="fas fa-percentage"></i>
                                </div>
                                <div class="summary-content">
                                    <span class="summary-label">Interest Rate</span>
                                    <span class="summary-value">${interestRate}</span>
                                </div>
                            </div>
                            <div class="summary-item">
                                <div class="summary-icon">
                                    <i class="fas fa-calendar-alt"></i>
                                </div>
                                <div class="summary-content">
                                    <span class="summary-label">Term</span>
                                    <span class="summary-value">${terms}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="section-header">
                        <i class="fas fa-user-edit"></i>
                        <h3>Application Form</h3>
                    </div>
                    <form id="loan-application-form" class="loan-application-form">
                        <div class="form-section">
                            <h4>Loan Request</h4>
                            <div class="form-group">
                                <label for="loan-amount">Requested Loan Amount (₱)</label>
                                <input type="number" id="loan-amount" name="loan-amount" required 
                                    min="${minAmount}" max="${maxAmount}" 
                                    placeholder="Enter amount between ₱${minAmount.toLocaleString()} - ₱${maxAmount.toLocaleString()}">
                                <div class="validation-feedback"></div>
                            </div>
                            
                            <div class="form-group">
                                <label for="loan-purpose">Loan Purpose</label>
                                <select id="loan-purpose" name="loan-purpose" required>
                                    <option value="" disabled selected>Select purpose</option>
                                    <option value="education">Education</option>
                                    <option value="home-improvement">Home Improvement</option>
                                    <option value="business">Business</option>
                                    <option value="debt-consolidation">Debt Consolidation</option>
                                    <option value="emergency">Emergency Expenses</option>
                                    <option value="vehicle">Vehicle Purchase</option>
                                    <option value="medical">Medical Expenses</option>
                                    <option value="travel">Travel</option>
                                    <option value="wedding">Wedding</option>
                                    <option value="other">Other</option>
                                </select>
                                <div class="validation-feedback"></div>
                            </div>
                            
                            <div class="form-group" id="other-purpose-group" style="display: none;">
                                <label for="other-purpose">Specify Other Purpose</label>
                                <input type="text" id="other-purpose" name="other-purpose" placeholder="Please specify your loan purpose">
                                <div class="validation-feedback"></div>
                            </div>
                            
                            <div class="form-group">
                                <label for="loan-term">Preferred Term</label>
                                <select id="loan-term" name="loan-term" required>
                                    <option value="" disabled selected>Select term</option>
                                    <option value="3">3 months</option>
                                    <option value="6">6 months</option>
                                    <option value="12">12 months</option>
                                    <option value="24">24 months</option>
                                    <option value="36">36 months</option>
                                    <option value="48">48 months</option>
                                    <option value="60">60 months</option>
                                </select>
                                <div class="validation-feedback"></div>
                            </div>
                        </div>
                        
                        <div class="form-section">
                            <h4>Personal Information</h4>
                            <div class="form-group">
                                <label for="full-name">Full Name</label>
                                <input type="text" id="full-name" name="full-name" required placeholder="Enter your full name">
                                <div class="validation-feedback"></div>
                            </div>
                            
                            <div class="form-group">
                                <label for="email">Email Address</label>
                                <input type="email" id="email" name="email" required placeholder="Enter your email address">
                                <div class="validation-feedback"></div>
                            </div>
                            
                            <div class="form-group">
                                <label for="phone">Phone Number</label>
                                <input type="tel" id="phone" name="phone" required placeholder="Enter your phone number">
                                <div class="validation-feedback"></div>
                            </div>
                            
                            <div class="form-group">
                                <label for="birthdate">Date of Birth</label>
                                <input type="date" id="birthdate" name="birthdate" required>
                                <div class="validation-feedback"></div>
                            </div>
                        </div>
                        
                        <div class="form-section">
                            <h4>Employment Information</h4>
                            <div class="form-group">
                                <label for="employment-status">Employment Status</label>
                                <select id="employment-status" name="employment-status" required>
                                    <option value="" disabled selected>Select status</option>
                                    <option value="employed">Employed</option>
                                    <option value="self-employed">Self-Employed</option>
                                    <option value="business-owner">Business Owner</option>
                                    <option value="retired">Retired</option>
                                    <option value="student">Student</option>
                                    <option value="unemployed">Unemployed</option>
                                </select>
                                <div class="validation-feedback"></div>
                            </div>
                            
                            <div class="form-group">
                                <label for="monthly-income">Monthly Income (₱)</label>
                                <input type="number" id="monthly-income" name="monthly-income" required placeholder="Enter your monthly income">
                                <div class="validation-feedback"></div>
                            </div>
                        </div>
                        
                        <div class="form-section">
                            <h4>Document Upload (Optional)</h4>
                            <p class="form-note">You can upload now or after pre-approval</p>
                            
                            <div class="form-group">
                                <label for="id-proof">ID Proof</label>
                                <input type="file" id="id-proof" name="id-proof">
                            </div>
                            
                            <div class="form-group">
                                <label for="income-proof">Proof of Income</label>
                                <input type="file" id="income-proof" name="income-proof">
                            </div>
                        </div>
                        
                        <div class="form-section">
                            <div class="form-group checkbox-group">
                                <input type="checkbox" id="terms-accept" name="terms-accept" required>
                                <label for="terms-accept">I accept the terms and conditions</label>
                                <div class="validation-feedback"></div>
                            </div>
                            
                            <div class="form-group checkbox-group">
                                <input type="checkbox" id="privacy-accept" name="privacy-accept" required>
                                <label for="privacy-accept">I consent to the privacy policy</label>
                                <div class="validation-feedback"></div>
                            </div>
                        </div>
                        
                        <div class="form-actions">
                            <button type="submit" class="primary-button" id="submit-application">
                                <i class="fas fa-paper-plane"></i> Submit Application
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        
        // Create modal element
        const modal = document.createElement('div');
        modal.className = 'loan-modal';
        modal.style.position = 'fixed';
        modal.style.top = '0';
        modal.style.left = '0';
        modal.style.width = '100%';
        modal.style.height = '100%';
        modal.style.backgroundColor = 'rgba(0, 0, 0, 0.85)';
        modal.style.display = 'flex';
        modal.style.alignItems = 'center';
        modal.style.justifyContent = 'center';
        modal.style.zIndex = '9999';
        modal.innerHTML = modalContent;
        document.body.appendChild(modal);
        
        // Style the application modal
        const applicationModal = modal.querySelector('.loan-application-modal');
        applicationModal.style.backgroundColor = 'var(--surface-ground, #1a1a1a)';
        applicationModal.style.color = 'var(--text-color, #f0f0f0)';
        applicationModal.style.borderRadius = '16px';
        applicationModal.style.width = '90%';
        applicationModal.style.maxWidth = '900px';
        applicationModal.style.maxHeight = '90vh';
        applicationModal.style.overflowY = 'auto';
        applicationModal.style.position = 'relative';
        
        const applicationHeader = modal.querySelector('.loan-application-header');
        applicationHeader.style.display = 'flex';
        applicationHeader.style.justifyContent = 'space-between';
        applicationHeader.style.alignItems = 'center';
        applicationHeader.style.padding = '20px 24px';
        applicationHeader.style.borderBottom = '1px solid rgba(255, 255, 255, 0.1)';
        
        const applicationTitle = applicationHeader.querySelector('h3');
        applicationTitle.style.margin = '0';
        applicationTitle.style.fontSize = '1.5rem';
        applicationTitle.style.color = 'var(--text-color, #f0f0f0)';
        
        const closeButton = applicationHeader.querySelector('.close-application-btn');
        closeButton.style.background = 'none';
        closeButton.style.border = 'none';
        closeButton.style.color = 'rgba(255, 255, 255, 0.7)';
        closeButton.style.fontSize = '2rem';
        closeButton.style.cursor = 'pointer';
        closeButton.style.padding = '0';
        closeButton.style.lineHeight = '1';
        
        const applicationContent = modal.querySelector('.loan-application-content');
        applicationContent.style.padding = '24px';
        
        // Style the form elements
        const formSections = modal.querySelectorAll('.form-section');
        formSections.forEach(section => {
            section.style.marginBottom = '24px';
            section.style.padding = '20px';
            section.style.backgroundColor = 'var(--surface-card, #242424)';
            section.style.borderRadius = '12px';
        });
        
        const sectionTitles = modal.querySelectorAll('.form-section h4');
        sectionTitles.forEach(title => {
            title.style.margin = '0 0 16px 0';
            title.style.fontSize = '1.2rem';
            title.style.color = 'var(--text-color, #f0f0f0)';
            title.style.borderBottom = '1px solid rgba(255, 255, 255, 0.1)';
            title.style.paddingBottom = '10px';
        });
        
        const formGroups = modal.querySelectorAll('.form-group');
        formGroups.forEach(group => {
            group.style.marginBottom = '16px';
        });
        
        const formLabels = modal.querySelectorAll('.form-group label');
        formLabels.forEach(label => {
            label.style.display = 'block';
            label.style.marginBottom = '6px';
            label.style.color = 'rgba(255, 255, 255, 0.8)';
            label.style.fontSize = '0.95rem';
        });
        
        const formInputs = modal.querySelectorAll('.form-group input:not([type="checkbox"]), .form-group select');
        formInputs.forEach(input => {
            input.style.width = '100%';
            input.style.padding = '10px 12px';
            input.style.backgroundColor = 'var(--surface-hover, #2a2a2a)';
            input.style.border = '1px solid rgba(255, 255, 255, 0.2)';
            input.style.borderRadius = '8px';
            input.style.color = 'var(--text-color, #f0f0f0)';
            input.style.fontSize = '1rem';
        });
        
        const checkboxGroups = modal.querySelectorAll('.checkbox-group');
        checkboxGroups.forEach(group => {
            group.style.display = 'flex';
            group.style.alignItems = 'center';
            group.style.gap = '8px';
        });
        
        const checkboxLabels = modal.querySelectorAll('.checkbox-group label');
        checkboxLabels.forEach(label => {
            label.style.display = 'inline';
            label.style.margin = '0';
        });
        
        const formNote = modal.querySelector('.form-note');
        if (formNote) {
            formNote.style.fontSize = '0.9rem';
            formNote.style.color = 'rgba(255, 255, 255, 0.6)';
            formNote.style.marginBottom = '16px';
        }
        
        const formActions = modal.querySelector('.form-actions');
        formActions.style.marginTop = '24px';
        formActions.style.display = 'flex';
        formActions.style.justifyContent = 'center';
        
        // Add event listeners
        modal.querySelector('.close-application-btn').addEventListener('click', () => {
            document.body.removeChild(modal);
        });
        
        // Purpose dropdown logic
        const purposeDropdown = modal.querySelector('#loan-purpose');
        const otherPurposeGroup = modal.querySelector('#other-purpose-group');
        
        purposeDropdown.addEventListener('change', function() {
            if (this.value === 'other') {
                otherPurposeGroup.style.display = 'block';
            } else {
                otherPurposeGroup.style.display = 'none';
            }
        });
        
        // Form submission
        const form = modal.querySelector('#loan-application-form');
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            
            // Clear any previous validation errors
            clearAllValidationErrors();
            
            // Validate fields
            let isValid = true;
            
            // Validate loan amount
            const loanAmount = document.getElementById('loan-amount');
            if (!validateAmount(loanAmount.value, minAmount, maxAmount)) {
                showValidationError(loanAmount, `Amount must be between ₱${minAmount.toLocaleString()} and ₱${maxAmount.toLocaleString()}`);
                isValid = false;
            }
            
            // Validate name
            const fullName = document.getElementById('full-name');
            if (!validateName(fullName.value)) {
                showValidationError(fullName, 'Please enter a valid name');
                isValid = false;
            }
            
            // Validate email
            const email = document.getElementById('email');
            if (!validateEmail(email.value)) {
                showValidationError(email, 'Please enter a valid email address');
                isValid = false;
            }
            
            // Validate birth date
            const birthdate = document.getElementById('birthdate');
            if (!validateDate(birthdate.value)) {
                showValidationError(birthdate, 'Please enter a valid date');
                isValid = false;
            }
            
            // Validate terms acceptance
            const termsAccept = document.getElementById('terms-accept');
            if (!termsAccept.checked) {
                showValidationError(termsAccept, 'You must accept the terms and conditions');
                isValid = false;
            }
            
            // Validate privacy acceptance
            const privacyAccept = document.getElementById('privacy-accept');
            if (!privacyAccept.checked) {
                showValidationError(privacyAccept, 'You must consent to the privacy policy');
                isValid = false;
            }
            
            // If form is valid, submit application
            if (isValid) {
                // Close the application modal
                document.body.removeChild(modal);
                
                // Show success message
                showApplicationSuccessMessage(loanName);
            }
        });
        
        // Close when clicking outside
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });
    }).catch(error => {
        console.error('Error loading helper functions:', error);
        alert('An error occurred while loading the application form. Please try again later.');
    });
}

// Show application success message
function showApplicationSuccessMessage(loanName) {
    const successModal = document.createElement('div');
    successModal.className = 'loan-modal';
    successModal.innerHTML = `
        <div class="application-success">
            <div class="success-icon">
                <i class="fas fa-check-circle"></i>
            </div>
            <h3>Application Submitted Successfully</h3>
            <p>Your application for <strong>${loanName}</strong> has been received and is being processed.</p>
            <p>You will receive updates on your application status via email and in the Notifications section of your account.</p>
            <div class="success-next-steps">
                <h4>Next Steps:</h4>
                <ol>
                    <li>Our team will review your application within 1-2 business days</li>
                    <li>You may be contacted for additional information or documentation</li>
                    <li>Once pre-approved, you'll be guided through document submission</li>
                </ol>
            </div>
            <div class="success-actions">
                <button class="primary-button close-success-btn">
                    <i class="fas fa-check"></i> Got It
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(successModal);
    
    // Add event listener to close button
    successModal.querySelector('.close-success-btn').addEventListener('click', () => {
        document.body.removeChild(successModal);
    });
    
    // Close when clicking outside
    successModal.addEventListener('click', (e) => {
        if (e.target === successModal) {
            document.body.removeChild(successModal);
        }
    });
}

// Function to generate loan recommendations using Gemini API
async function generateLoanRecommendations(financialData) {
    try {
        const analyzer = new FinancialMetricsAnalyzer(
            financialData.transactions,
            financialData.accounts
        );
        const analysis = await analyzer.analyzeAll();

        // Prepare enhanced context for Gemini API
        const prompt = `
You are Pera Partner, an advanced AI loan advisor specializing in personalized financial solutions.

Detailed Financial Analysis:
${JSON.stringify(analysis, null, 2)}

Based on this comprehensive analysis:
1. Evaluate loan eligibility using advanced risk metrics
2. Generate personalized loan products with dynamic terms
3. Provide detailed financial insights and recommendations
4. Create a customized financial improvement roadmap
5. Suggest alternative financial products if traditional loans aren't suitable

Respond with a structured recommendation including:
- Risk assessment and eligibility analysis
- Customized loan products with dynamic terms
- Alternative financial solutions
- Detailed improvement roadmap
- Investment and savings recommendations
`;

        // Call Gemini API with generated prompt
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
                    temperature: 0.3,
                    maxOutputTokens: 1000,
                    topP: 0.8,
                    topK: 40
                },
                safetySettings: [
                    {
                        category: "HARM_CATEGORY_DEROGATORY",
                        threshold: "BLOCK_MEDIUM_AND_ABOVE"
                    },
                    {
                        category: "HARM_CATEGORY_TOXICITY",
                        threshold: "BLOCK_MEDIUM_AND_ABOVE"
                    }
                ]
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('API response error:', errorData);
            return generateFallbackRecommendations(financialData);
        }

        const data = await response.json();

        if (data.error) {
            console.error('API Error:', data.error);
            return generateFallbackRecommendations(financialData);
        }

        // Extract response text from Gemini API format
        if (data && data.candidates && data.candidates.length > 0 &&
            data.candidates[0].content && data.candidates[0].content.parts &&
            data.candidates[0].content.parts.length > 0) {

            const responseText = data.candidates[0].content.parts[0].text;

            try {
                // Extract JSON from response text (handling potential text before/after JSON)
                const jsonStart = responseText.indexOf('{');
                const jsonEnd = responseText.lastIndexOf('}') + 1;
                const jsonString = responseText.substring(jsonStart, jsonEnd);

                const recommendations = JSON.parse(jsonString);

                // Ensure the response has the required structure
                if (!recommendations.loanOptions) recommendations.loanOptions = [];
                if (!recommendations.financialGuidance) recommendations.financialGuidance = [];

                return recommendations;
            } catch (parseError) {
                console.error('Error parsing Gemini response:', parseError);
                return generateFallbackRecommendations(financialData);
            }
        } else {
            console.warn('Unexpected API response structure:', data);
            return generateFallbackRecommendations(financialData);
        }
    } catch (error) {
        console.error('Error in advanced loan recommendations:', error);
        return generateFallbackRecommendations(financialData);
    }
}

// Fallback recommendations when API call fails
function generateFallbackRecommendations(financialData) {
    const loanOptions = [];
    const financialGuidance = [];

    // Only add loan options if the user's financial situation allows
    if (financialData.debtToIncomeRatio < 0.5 && financialData.estimatedCreditScore > 600) {
        // Personal Loan
        if (financialData.availableCredit >= 50000) {
            const interestRate = financialData.estimatedCreditScore > 700 ? 6.5 : 8.5;
            loanOptions.push({
                title: 'Personal Loan',
                icon: 'fa-user',
                suitabilityScore: 85,
                details: [
                    { label: 'Interest Rate', value: `${interestRate}%` },
                    { label: 'Term', value: '24 months' },
                    { label: 'Processing Fee', value: '₱2,500' },
                    { label: 'Requirements', value: 'ID, Proof of Income' }
                ],
                features: ['Quick Approval', 'No Collateral', 'Flexible Use'],
                paymentBreakdown: {
                    principal: '₱100,000',
                    interest: '₱6,500',
                    totalRepayment: '₱106,500',
                    monthlyPayment: '₱4,437'
                }
            });
        }

        // Business Loan
        if (financialData.availableCredit >= 100000 && financialData.monthlyIncome > 50000) {
            const interestRate = financialData.estimatedCreditScore > 720 ? 7.2 : 9.0;
            loanOptions.push({
                title: 'Business Loan',
                icon: 'fa-store',
                suitabilityScore: 70,
                details: [
                    { label: 'Interest Rate', value: `${interestRate}%` },
                    { label: 'Term', value: '36 months' },
                    { label: 'Processing Fee', value: '₱3,500' },
                    { label: 'Requirements', value: 'Business Docs, Income Proof' }
                ],
                features: ['Higher Amount', 'Business Support', 'Growth Focus'],
                paymentBreakdown: {
                    principal: '₱200,000',
                    interest: '₱21,600',
                    totalRepayment: '₱221,600',
                    monthlyPayment: '₱6,155'
                }
            });
        }

        // Home Loan
        if (financialData.availableCredit >= 500000 && financialData.monthlyIncome > 80000 && financialData.estimatedCreditScore > 680) {
            loanOptions.push({
                title: 'Home Loan',
                icon: 'fa-home',
                suitabilityScore: 65,
                details: [
                    { label: 'Interest Rate', value: '5.8%' },
                    { label: 'Term', value: '240 months' },
                    { label: 'Processing Fee', value: '₱5,000' },
                    { label: 'Requirements', value: 'Property Docs, Credit Check' }
                ],
                features: ['Lowest Rate', 'Long Term', 'Property Collateral'],
                paymentBreakdown: {
                    principal: '₱1,000,000',
                    interest: '₱580,000',
                    totalRepayment: '₱1,580,000',
                    monthlyPayment: '₱6,583'
                }
            });
        }

        // Secured Loan
        if (financialData.estimatedCreditScore < 650 && financialData.totalBalance > 50000) {
            loanOptions.push({
                title: 'Secured Loan',
                icon: 'fa-shield-alt',
                suitabilityScore: 90,
                details: [
                    { label: 'Interest Rate', value: '10.5%' },
                    { label: 'Term', value: '12 months' },
                    { label: 'Processing Fee', value: '₱1,500' },
                    { label: 'Requirements', value: 'Collateral Document, ID' }
                ],
                features: ['Accessible for Low Credit', 'Collateral-Based', 'Credit-Building'],
                paymentBreakdown: {
                    principal: '₱50,000',
                    interest: '₱5,250',
                    totalRepayment: '₱55,250',
                    monthlyPayment: '₱4,604'
                }
            });
        }
    }

    // Add financial guidance based on user's situation

    // Credit Score Guidance
    if (financialData.estimatedCreditScore < 680) {
        financialGuidance.push({
            title: 'Credit Score Improvement',
            description: 'Your estimated credit score could be improved to qualify for better loan rates and terms.',
            icon: 'fa-chart-line',
            type: 'neutral',
            actionSteps: [
                'Pay all bills and existing loans on time',
                'Reduce credit card balances below 30% of their limits',
                'Avoid applying for multiple new credit accounts'
            ]
        });
    }

    // Debt Management
    if (financialData.debtToIncomeRatio > 0.4) {
        financialGuidance.push({
            title: 'Debt Management',
            description: 'Your debt-to-income ratio is high. Consider managing your existing debt before taking on new loans.',
            icon: 'fa-balance-scale',
            type: 'negative',
            actionSteps: [
                'Focus on paying off high-interest debt first',
                'Consider debt consolidation to simplify payments',
                'Create a monthly budget to reduce expenses'
            ]
        });
    } else if (financialData.debtToIncomeRatio < 0.2 && financialData.monthlyIncome > 30000) {
        financialGuidance.push({
            title: 'Strong Financial Position',
            description: 'Your low debt-to-income ratio puts you in an excellent position for loan qualification.',
            icon: 'fa-thumbs-up',
            type: 'positive',
            actionSteps: [
                'Consider strategic investments like real estate',
                'Maintain your excellent payment history',
                'Build an emergency fund of 3-6 months of expenses'
            ]
        });
    }

    // Emergency Fund
    if (financialData.totalBalance < financialData.monthlyExpenses * 3) {
        financialGuidance.push({
            title: 'Emergency Fund',
            description: 'Your total balance is lower than the recommended emergency fund of 3-6 months of expenses.',
            icon: 'fa-piggy-bank',
            type: 'negative',
            actionSteps: [
                'Aim to save at least 10% of monthly income',
                'Set up automatic transfers to a savings account',
                'Build to 3-6 months of expenses before taking on new debt'
            ]
        });
    }

    // Income Improvement
    if (financialData.monthlyIncome < 30000 && loanOptions.length === 0) {
        financialGuidance.push({
            title: 'Income Improvement',
            description: 'Increasing your income could help improve your loan eligibility and financial stability.',
            icon: 'fa-money-bill-wave',
            type: 'neutral',
            actionSteps: [
                'Explore side income opportunities',
                'Consider skills development for job advancement',
                'Look into passive income sources like small investments'
            ]
        });
    }

    return { loanOptions, financialGuidance };
}

// Add new function for real-time monitoring and alerts
// Function removed to disconnect from financialHealth.js

// Add styles for the income level indicator
document.addEventListener('DOMContentLoaded', () => {
    const styleEl = document.createElement('style');
    styleEl.textContent = `
        .income-level {
            display: inline-block;
            padding: 3px 8px;
            border-radius: 4px;
            font-size: 0.9em;
            font-weight: 500;
        }
        .income-level.low {
            background-color: rgba(255, 99, 132, 0.2);
            color: #ff6384;
        }
        .income-level.lower-middle {
            background-color: rgba(255, 159, 64, 0.2);
            color: #ff9f40;
        }
        .income-level.middle {
            background-color: rgba(255, 205, 86, 0.2);
            color: #ffcd56;
        }
        .income-level.upper-middle {
            background-color: rgba(75, 192, 192, 0.2);
            color: #4bc0c0;
        }
        .income-level.high {
            background-color: rgba(54, 162, 235, 0.2);
            color: #36a2eb;
        }
        .income-level.unknown {
            background-color: rgba(201, 203, 207, 0.2);
            color: #c9cbcf;
        }
    `;
    document.head.appendChild(styleEl);
}); 