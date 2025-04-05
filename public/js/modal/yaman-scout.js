// Yaman Scout Tool - AI-powered investment analysis
import { getAuth } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-auth.js";
import { getUserTransactions, getUserBankAccounts } from "../firestoredb.js";
import { GEMINI_API_KEY, GEMINI_MODEL } from "../config.js";
import { handleAPIError } from '../helpers.js';

document.addEventListener('DOMContentLoaded', function() {
    // Get the yaman-scout tool element and add click event listener
    const yamanScoutTool = document.getElementById('yaman-scout-tool');
    if (yamanScoutTool) {
        yamanScoutTool.addEventListener('click', function() {
            document.getElementById('yaman-scout-modal').style.display = 'flex';
            loadYamanScoutContent();
        });
    }

    // Close modal when user clicks X
    const closeButtons = document.querySelectorAll('.modal-close-btn[data-modal="yaman-scout-modal"]');
    closeButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            document.getElementById('yaman-scout-modal').style.display = 'none';
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
        #yaman-scout-modal {
            background: rgba(0, 0, 0, 0.85);
        }

        #yaman-scout-modal-content {
            background: var(--surface-ground, #1a1a1a);
            color: var(--text-color, #f0f0f0);
            max-width: 1200px;
            margin: 20px auto;
            border-radius: 16px;
            padding: 24px;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
        }

        .yaman-scout-container {
            display: grid;
            gap: 24px;
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
            color: #10df6f;
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

        .portfolio-overview {
            background: var(--surface-card, #242424);
            padding: 24px;
            border-radius: 12px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }

        .portfolio-stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-top: 20px;
        }

        .stat-card {
            background: var(--surface-hover, #2a2a2a);
            padding: 20px;
            border-radius: 12px;
            display: flex;
            align-items: center;
            gap: 16px;
            transition: transform 0.2s, box-shadow 0.2s;
        }

        .stat-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        }

        .stat-icon {
            width: 48px;
            height: 48px;
            border-radius: 12px;
            background: rgba(16, 223, 111, 0.1);
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .stat-icon i {
            font-size: 1.5rem;
            color: #10df6f;
        }

        .stat-info {
            flex: 1;
        }

        .stat-value {
            font-size: 1.5rem;
            font-weight: 600;
            color: var(--text-color, #f0f0f0);
            margin-bottom: 4px;
        }

        .stat-label {
            font-size: 0.9rem;
            color: rgba(255, 255, 255, 0.6);
        }

        .trends-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
        }

        .trend-card {
            background: var(--surface-card, #242424);
            padding: 20px;
            border-radius: 12px;
            transition: transform 0.2s;
        }

        .trend-card:hover {
            transform: translateY(-2px);
        }

        .trend-sector {
            display: flex;
            align-items: center;
            gap: 12px;
            font-size: 1.2rem;
            font-weight: 600;
            color: #10df6f;
            margin-bottom: 12px;
        }

        .trend-sector i {
            font-size: 1.2rem;
        }

        .trend-outlook {
            color: rgba(255, 255, 255, 0.9);
            line-height: 1.5;
            margin-bottom: 16px;
        }

        .trend-relevance {
            font-size: 0.9rem;
            color: rgba(255, 255, 255, 0.7);
            display: flex;
            align-items: flex-start;
            gap: 8px;
            padding-top: 12px;
            border-top: 1px solid rgba(255, 255, 255, 0.1);
        }

        .trend-relevance i {
            color: #e96d1f;
            margin-top: 4px;
        }

        .opportunities-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
            gap: 20px;
        }

        .opportunity-card {
            background: var(--surface-card, #242424);
            border-radius: 12px;
            padding: 20px;
            position: relative;
            overflow: hidden;
            transition: transform 0.2s;
        }

        .opportunity-card:hover {
            transform: translateY(-2px);
        }

        .opportunity-card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 4px;
            background: linear-gradient(90deg, #10df6f, #e96d1f);
            opacity: 0.7;
        }

        .opportunity-card.future-high::before {
            background: #10df6f;
        }

        .opportunity-card.future-medium::before {
            background: #e96d1f;
        }

        .opportunity-card.future-low::before {
            background: #dc3545;
        }

        .opportunity-header {
            display: flex;
            align-items: flex-start;
            gap: 16px;
            margin-bottom: 20px;
        }

        .opportunity-icon {
            width: 48px;
            height: 48px;
            border-radius: 12px;
            background: rgba(16, 223, 111, 0.1);
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .opportunity-icon i {
            font-size: 1.5rem;
            color: #10df6f;
        }

        .opportunity-info {
            flex: 1;
        }

        .opportunity-title {
            font-size: 1.2rem;
            font-weight: 600;
            color: var(--text-color, #f0f0f0);
            margin-bottom: 8px;
        }

        .growth-potential {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 0.8rem;
            font-weight: 500;
        }

        .growth-potential.high {
            background: rgba(16, 223, 111, 0.1);
            color: #10df6f;
        }

        .growth-potential.medium {
            background: rgba(233, 109, 31, 0.1);
            color: #e96d1f;
        }

        .growth-potential.low {
            background: rgba(220, 53, 69, 0.1);
            color: #dc3545;
        }

        .opportunity-details {
            margin-bottom: 20px;
        }

        .detail-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 0;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .detail-row:last-child {
            border-bottom: none;
        }

        .detail-label {
            color: rgba(255, 255, 255, 0.6);
            font-size: 0.9rem;
        }

        .detail-value {
            color: var(--text-color, #f0f0f0);
            font-weight: 500;
        }

        .future-outlook {
            background: rgba(16, 223, 111, 0.05);
            border-radius: 8px;
            padding: 12px;
            margin: 8px 0;
        }

        .opportunity-tags {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin-bottom: 20px;
        }

        .tag {
            background: rgba(255, 255, 255, 0.1);
            color: rgba(255, 255, 255, 0.9);
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 0.8rem;
        }

        .insights-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
        }

        .insight-card {
            background: var(--surface-card, #242424);
            padding: 20px;
            border-radius: 12px;
            transition: transform 0.2s;
        }

        .insight-card:hover {
            transform: translateY(-2px);
        }

        .insight-card.positive {
            border-left: 4px solid #10df6f;
        }

        .insight-card.negative {
            border-left: 4px solid #dc3545;
        }

        .insight-card.neutral {
            border-left: 4px solid #e96d1f;
        }

        .insight-header {
            display: flex;
            align-items: flex-start;
            gap: 16px;
            margin-bottom: 16px;
        }

        .insight-icon {
            width: 40px;
            height: 40px;
            border-radius: 10px;
            background: rgba(16, 223, 111, 0.1);
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .insight-icon i {
            font-size: 1.2rem;
            color: #10df6f;
        }

        .insight-info {
            flex: 1;
        }

        .insight-title {
            font-size: 1.1rem;
            font-weight: 600;
            color: var(--text-color, #f0f0f0);
            margin-bottom: 4px;
        }

        .time-horizon {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 0.9rem;
            color: rgba(255, 255, 255, 0.6);
        }

        .insight-description {
            color: rgba(255, 255, 255, 0.9);
            line-height: 1.5;
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
            border: 4px solid rgba(16, 223, 111, 0.1);
            border-top-color: #10df6f;
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

        .retry-button {
            background: #10df6f;
            color: #000;
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

        .retry-button:hover {
            background: #0fc962;
        }

        @media (max-width: 768px) {
            #yaman-scout-modal-content {
                margin: 10px;
                padding: 16px;
            }

            .portfolio-stats,
            .trends-grid,
            .opportunities-grid,
            .insights-grid {
                grid-template-columns: 1fr;
            }

            .section-header {
                flex-direction: column;
                align-items: flex-start;
                gap: 8px;
            }

            .section-header .subtitle {
                position: static;
            }

            .opportunity-card {
                padding: 16px;
            }
        }
    `;
    
    const styleSheet = document.createElement('style');
    styleSheet.textContent = styles;
    document.head.appendChild(styleSheet);
});

// Helper function to format currency amounts
function formatAmount(amount) {
    // Convert to number if it's a string
    const value = typeof amount === 'string' ? parseFloat(amount) : amount;
    
    // Handle invalid numbers
    if (isNaN(value)) {
        return '0.00';
    }
    
    // Format with thousands separator and 2 decimal places
    return value.toLocaleString('en-PH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

// Function to load the investment analysis content
async function loadYamanScoutContent() {
    console.log("Starting Yaman Scout content load...");
    const contentContainer = document.getElementById('yaman-scout-modal-content');
    
    if (!contentContainer) {
        console.error("Content container not found");
        return;
    }
    
    try {
        const auth = getAuth();
        const user = auth.currentUser;
        
        if (!user) {
            console.log("No user logged in");
            contentContainer.innerHTML = `
                <div class="error-state">
                    <i class="fas fa-exclamation-circle"></i>
                    <p>Please log in to view your investment analysis.</p>
                </div>
            `;
            return;
        }
        
        console.log("User authenticated, fetching data...");
        
        // Show loading state
        contentContainer.innerHTML = `
            <div class="loading-state">
                <div class="pulse-loader"></div>
                <p>Analyzing your financial data and finding personalized investment opportunities...</p>
            </div>
        `;
        
        // Get user's bank accounts and transactions
        console.log("Fetching bank accounts and transactions...");
        const accounts = await getUserBankAccounts(user.uid);
        console.log("Accounts fetched:", accounts?.length || 0);
        
        const transactions = await getUserTransactions(user.uid);
        console.log("Transactions fetched:", transactions?.length || 0);
        
        if (!accounts || accounts.length === 0) {
            console.log("No bank accounts found");
            contentContainer.innerHTML = `
                <div class="error-state">
                    <i class="fas fa-university"></i>
                    <p>No bank accounts found. Please add a bank account to get investment recommendations.</p>
                    <button class="retry-button" onclick="document.getElementById('add-account-modal').style.display='flex'">
                        <i class="fas fa-plus"></i> Add Bank Account
                    </button>
                </div>
            `;
            return;
        }
        
        if (!transactions || transactions.length === 0) {
            console.log("No transactions found");
            contentContainer.innerHTML = `
                <div class="error-state">
                    <i class="fas fa-receipt"></i>
                    <p>No transaction history found. Add some transactions to get personalized investment recommendations.</p>
                    <button class="retry-button" onclick="document.getElementById('add-transaction-modal').style.display='flex'">
                        <i class="fas fa-plus"></i> Add Transaction
                    </button>
                </div>
            `;
            return;
        }
        
        // Calculate financial metrics
        console.log("Calculating financial metrics...");
        
        // Get spending categories from transactions
        const spendingCategories = transactions
            .filter(t => t.type === 'expense')
            .reduce((acc, t) => {
                const category = t.category || 'other';
                acc[category] = (acc[category] || 0) + Math.abs(parseFloat(t.amount || 0));
                return acc;
            }, {});
            
        // Convert to array and sort by amount
        const topCategories = Object.entries(spendingCategories)
            .map(([category, amount]) => ({ category, amount }))
            .sort((a, b) => b.amount - a.amount)
            .slice(0, 5);
        
        // Calculate total balance across all accounts
        const totalBalance = accounts.reduce((total, account) => {
            const balance = parseFloat(account.balance || 0);
            return total + balance;
        }, 0);
        
        const availableCapital = totalBalance * 0.1;
        
        // Analyze monthly transactions
        const today = new Date();
        const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        
        // Filter for this month's transactions
        const monthlyTransactions = transactions.filter(t => {
            const transactionDate = new Date(t.date);
            return transactionDate >= firstDayOfMonth;
        });
        
        console.log("Monthly transactions:", monthlyTransactions.length);
        
        // Calculate monthly income and expenses
        const monthlyIncome = monthlyTransactions
            .filter(t => t.type === 'income')
            .reduce((sum, t) => sum + Math.abs(parseFloat(t.amount || 0)), 0);
            
        const monthlyExpenses = monthlyTransactions
            .filter(t => t.type === 'expense')
            .reduce((sum, t) => sum + Math.abs(parseFloat(t.amount || 0)), 0);
        
        console.log("Monthly income:", monthlyIncome);
        console.log("Monthly expenses:", monthlyExpenses);
        
        // Calculate ROI and other metrics
        const monthlyReturns = monthlyIncome * 0.05;
        const roi = totalBalance > 0 ? ((monthlyReturns / totalBalance) * 100).toFixed(1) : 0;
        const savingsRatio = (monthlyIncome > 0) ? (monthlyIncome - monthlyExpenses) / monthlyIncome : 0;
        
        // Calculate risk assessment score based on savings ratio and transaction patterns
        const riskScore = Math.min(10, Math.max(1, Math.round((savingsRatio * 10) + 2)));
        
        // Calculate investment diversification index
        const diversificationIndex = Math.min(100, Math.max(10, accounts.length * 20 + (transactions.filter(t => t.type === 'investment').length * 5)));
        
        // Prepare financial data
        const financialData = {
            totalBalance,
            availableCapital,
            monthlyIncome,
            monthlyExpenses,
            savingsRatio,
            monthlyTransactions: monthlyTransactions.length,
            totalAccounts: accounts.length,
            roi,
            riskScore,
            diversificationIndex,
            topCategories
        };
        
        console.log("Financial data prepared:", financialData);
        
        // Generate investment recommendations
        console.log("Generating investment recommendations...");
        const recommendations = await generateInvestmentRecommendations(financialData);
        
        // Ensure recommendations object has all required properties
        const safeRecommendations = {
            opportunities: recommendations?.opportunities || [],
            insights: recommendations?.insights || [],
            marketTrends: recommendations?.marketTrends || []
        };
        
        console.log("Recommendations processed:", safeRecommendations);
        
        // Generate content with the analysis results
        contentContainer.innerHTML = `
            <div class="yaman-scout-container">
                <div class="portfolio-overview">
                    <div class="overview-header">
                        <div class="overview-icon">
                            <i class="fas fa-chart-line"></i>
                        </div>
                        <h3>Your Investment Portfolio</h3>
                    </div>
                    <div class="portfolio-stats">
                        <div class="stat-card">
                            <div class="stat-icon">
                                <i class="fas fa-wallet"></i>
                            </div>
                            <div class="stat-info">
                                <div class="stat-value">₱${formatAmount(totalBalance)}</div>
                                <div class="stat-label">Total Portfolio</div>
                            </div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-icon">
                                <i class="fas fa-chart-bar"></i>
                            </div>
                            <div class="stat-info">
                                <div class="stat-value">₱${formatAmount(monthlyReturns)}</div>
                                <div class="stat-label">Monthly Returns</div>
                            </div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-icon">
                                <i class="fas fa-percentage"></i>
                            </div>
                            <div class="stat-info">
                                <div class="stat-value">${roi}%</div>
                                <div class="stat-label">Return on Investment</div>
                            </div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-icon">
                                <i class="fas fa-coins"></i>
                            </div>
                            <div class="stat-info">
                                <div class="stat-value">₱${formatAmount(availableCapital)}</div>
                                <div class="stat-label">Available for Investment</div>
                            </div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-icon">
                                <i class="fas fa-shield-alt"></i>
                            </div>
                            <div class="stat-info">
                                <div class="stat-value">${riskScore}/10</div>
                                <div class="stat-label">Risk Assessment Score</div>
                            </div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-icon">
                                <i class="fas fa-th"></i>
                            </div>
                            <div class="stat-info">
                                <div class="stat-value">${diversificationIndex}%</div>
                                <div class="stat-label">Portfolio Diversification</div>
                            </div>
                        </div>
                    </div>
                </div>

                ${safeRecommendations.marketTrends.length > 0 ? `
                    <div class="market-trends">
                        <div class="section-header">
                            <i class="fas fa-chart-pie"></i>
                            <h3>Market Trends & Opportunities</h3>
                            <span class="subtitle">3-5 Year Market Outlook</span>
                        </div>
                        <div class="trends-grid">
                            ${safeRecommendations.marketTrends.map(trend => `
                                <div class="trend-card">
                                    <div class="trend-sector">
                                        <i class="fas ${getTrendIcon(trend.sector)}"></i>
                                        ${trend.sector}
                                    </div>
                                    <div class="trend-outlook">${trend.outlook}</div>
                                    <div class="trend-relevance">
                                        <i class="fas fa-user-check"></i>
                                        <span>${trend.relevanceToUser}</span>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}

                ${safeRecommendations.opportunities.length > 0 ? `
                    <div class="investment-opportunities">
                        <div class="section-header">
                            <i class="fas fa-bullseye"></i>
                            <h3>Personalized Investment Opportunities</h3>
                            <span class="subtitle">Tailored to Your Financial Profile</span>
                        </div>
                        <div class="opportunities-grid">
                            ${safeRecommendations.opportunities.map(opportunity => `
                                <div class="opportunity-card ${opportunity.futureGrowthPotential ? 'future-' + opportunity.futureGrowthPotential.toLowerCase() : ''}">
                                    <div class="opportunity-header">
                                        <div class="opportunity-icon">
                                            <i class="fas ${opportunity.icon}"></i>
                                        </div>
                                        <div class="opportunity-info">
                                            <div class="opportunity-title">${opportunity.title}</div>
                                            ${opportunity.futureGrowthPotential ? 
                                                `<div class="growth-potential ${opportunity.futureGrowthPotential.toLowerCase()}">
                                                    ${opportunity.futureGrowthPotential} Growth Potential
                                                </div>` : ''
                                            }
                                        </div>
                                    </div>
                                    <div class="opportunity-details">
                                        ${opportunity.details.map(detail => `
                                            <div class="detail-row ${detail.label === 'Future Outlook' ? 'future-outlook' : ''}">
                                                <span class="detail-label">${detail.label}</span>
                                                <span class="detail-value">${detail.value}</span>
                                            </div>
                                        `).join('')}
                                    </div>
                                    ${opportunity.tags ? `
                                        <div class="opportunity-tags">
                                            ${opportunity.tags.map(tag => `
                                                <span class="tag">${tag}</span>
                                            `).join('')}
                                        </div>
                                    ` : ''}
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}

                ${safeRecommendations.insights.length > 0 ? `
                    <div class="market-insights">
                        <div class="section-header">
                            <i class="fas fa-brain"></i>
                            <h3>AI-Powered Market Insights</h3>
                            <span class="subtitle">Based on Your Financial Behavior</span>
                        </div>
                        <div class="insights-grid">
                            ${safeRecommendations.insights.map(insight => `
                                <div class="insight-card ${insight.type}">
                                    <div class="insight-header">
                                        <div class="insight-icon">
                                            <i class="fas ${insight.icon}"></i>
                                        </div>
                                        <div class="insight-info">
                                            <div class="insight-title">${insight.title}</div>
                                            ${insight.timeHorizon ? 
                                                `<div class="time-horizon">
                                                    <i class="fas fa-clock"></i>
                                                    ${insight.timeHorizon}
                                                </div>` : ''
                                            }
                                        </div>
                                    </div>
                                    <div class="insight-description">${insight.description}</div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
        
        // No more event listeners for button actions since buttons are removed

    } catch (error) {
        console.error('Error in Yaman Scout:', error);
        contentContainer.innerHTML = `
            <div class="error-state">
                <i class="fas fa-exclamation-circle"></i>
                <p>Error: ${error.message || 'An error occurred while analyzing your financial data'}.</p>
                <button class="retry-button" onclick="loadYamanScoutContent()">
                    <i class="fas fa-redo"></i> Retry
                </button>
            </div>
        `;
    }
}

// Helper function to get appropriate icon for market trend sectors
function getTrendIcon(sector) {
    const sectorLower = sector.toLowerCase();
    if (sectorLower.includes('digital') || sectorLower.includes('tech')) return 'fa-microchip';
    if (sectorLower.includes('energy') || sectorLower.includes('green')) return 'fa-leaf';
    if (sectorLower.includes('fintech') || sectorLower.includes('financial')) return 'fa-coins';
    if (sectorLower.includes('health') || sectorLower.includes('medical')) return 'fa-heartbeat';
    if (sectorLower.includes('real estate') || sectorLower.includes('property')) return 'fa-building';
    if (sectorLower.includes('retail') || sectorLower.includes('commerce')) return 'fa-shopping-cart';
    return 'fa-chart-line';
}

// Function to generate investment recommendations using Gemini API
async function generateInvestmentRecommendations(financialData) {
    try {
        // If we're running in a demo or test environment without API key
        if (!GEMINI_API_KEY) {
            console.warn('Missing Gemini API key, using fallback recommendations');
            return generateFallbackRecommendations(financialData);
        }
        
        // Construct prompt for Gemini API that asks for structured output
        const prompt = `
You are Yaman Scout, an AI investment advisor for a personal finance app called Loan Wolves. Your specialty is identifying future market trends and connecting them to the user's current financial situation.

The user has the following financial data:
- Total Balance: ₱${financialData.totalBalance.toLocaleString()}
- Available Capital for Investment: ₱${financialData.availableCapital.toLocaleString()}
- Monthly Income: ₱${financialData.monthlyIncome.toLocaleString()}
- Monthly Expenses: ₱${financialData.monthlyExpenses.toLocaleString()}
- Savings Ratio: ${(financialData.savingsRatio * 100).toFixed(1)}%
- ROI: ${financialData.roi}%
- Top Spending Categories: ${financialData.topCategories.map(c => c.category).join(', ')}
- Number of Accounts: ${financialData.totalAccounts}
- Number of Monthly Transactions: ${financialData.monthlyTransactions}

Your task is to provide FUTURE-FOCUSED investment recommendations based on:
1. Current emerging market trends for the next 3-5 years
2. Technological and economic developments likely to grow in importance
3. The user's financial capacity and spending patterns
4. Sectors with strong growth potential that align with the user's interests (based on spending)

Respond ONLY with a JSON object in the following format:
{
  "opportunities": [
    {
      "title": "Investment Name",
      "icon": "fa-icon-name",
      "details": [
        { "label": "Expected Return", "value": "X%" },
        { "label": "Risk Level", "value": "Low/Medium/High" },
        { "label": "Min Investment", "value": "₱X,XXX" },
        { "label": "Lock Period", "value": "X months" },
        { "label": "Future Outlook", "value": "Brief future outlook for this investment" }
      ],
      "tags": ["tag1", "tag2", "tag3"],
      "futureGrowthPotential": "High/Medium/Low"
    }
  ],
  "insights": [
    {
      "title": "Insight Title",
      "description": "Detailed description of the insight with focus on future trends...",
      "icon": "fa-icon-name",
      "type": "positive/negative/neutral",
      "timeHorizon": "Short-term/Medium-term/Long-term"
    }
  ],
  "marketTrends": [
    {
      "sector": "Sector name",
      "outlook": "Brief description of 3-5 year outlook for this sector",
      "relevanceToUser": "Why this trend matters to this specific user"
    }
  ]
}

Rules for recommendations:
1. Provide 3-4 future-focused investment opportunities tailored to the user's available capital.
2. Prioritize emerging sectors and technologies with strong growth potential.
3. For users with low capital (under ₱3,000), recommend appropriate starter investments that still have future growth potential.
4. Consider the user's risk profile based on savings ratio and spending patterns.
5. For icons, use appropriate Font Awesome icon names (fa-xxxx format).
6. Include 2-3 insights specifically focused on future economic/market trends relevant to the user.
7. Add a "marketTrends" section with 2-3 key market trends expected over the next 3-5 years.
8. Explain why each recommendation is particularly well-positioned for future growth.
9. For all recommendations, include a "Future Outlook" detail that briefly explains the 3-5 year projection.
`;

        // Call Gemini AI API
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
                if (!recommendations.opportunities) recommendations.opportunities = [];
                if (!recommendations.insights) recommendations.insights = [];
                
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
        console.error('Error generating recommendations:', error);
        const errorMessage = handleAPIError(error);
        return {
            opportunities: [],
            insights: [{
                type: 'error',
                title: 'Error Generating Recommendations',
                description: errorMessage,
                action: 'Please try again later or contact support if the problem persists.'
            }]
        };
    }
}

// Fallback recommendations when API call fails
function generateFallbackRecommendations(financialData) {
    const opportunities = [];
    const insights = [];
    const marketTrends = [];
    
    // Add market trends
    marketTrends.push({
        sector: "Digital Transformation",
        outlook: "Companies focusing on digitalization solutions are projected to experience substantial growth over the next 5 years as businesses continue to modernize their operations.",
        relevanceToUser: "Investing in this sector provides exposure to the ongoing global digital shift."
    });
    
    marketTrends.push({
        sector: "Sustainable Energy",
        outlook: "Green energy initiatives are gaining momentum with strong policy support and decreasing costs, making this sector poised for long-term growth.",
        relevanceToUser: "A growing sector that offers both financial returns and environmental impact."
    });
    
    marketTrends.push({
        sector: "Financial Technology",
        outlook: "Fintech innovation continues to disrupt traditional banking and financial services, with high growth expected in digital payments and financial inclusivity solutions.",
        relevanceToUser: "Technologies that are reshaping how we handle money and financial services."
    });
    
    // Add appropriate investment opportunities based on available capital
    if (financialData.availableCapital >= 10000) {
        opportunities.push({
            title: 'Tech Startups Fund',
            icon: 'fa-microchip',
            details: [
                { label: 'Expected Return', value: '15-20%' },
                { label: 'Risk Level', value: 'Medium' },
                { label: 'Min Investment', value: '₱10,000' },
                { label: 'Lock Period', value: '12 months' },
                { label: 'Future Outlook', value: 'Strong growth potential as technology continues to transform industries globally' }
            ],
            tags: ['High Growth', 'Tech Sector', 'Diversified'],
            futureGrowthPotential: 'High'
        });
    }
    
    if (financialData.availableCapital >= 5000) {
        opportunities.push({
            title: 'Real Estate REIT',
            icon: 'fa-building',
            details: [
                { label: 'Expected Return', value: '8-12%' },
                { label: 'Risk Level', value: 'Low' },
                { label: 'Min Investment', value: '₱5,000' },
                { label: 'Lock Period', value: '6 months' },
                { label: 'Future Outlook', value: 'Steady returns in sectors like industrial and data center real estate with urban development' }
            ],
            tags: ['Stable', 'Property', 'Dividend'],
            futureGrowthPotential: 'Medium'
        });
    }
    
    if (financialData.availableCapital >= 3000) {
        opportunities.push({
            title: 'Green Energy Bonds',
            icon: 'fa-leaf',
            details: [
                { label: 'Expected Return', value: '6-8%' },
                { label: 'Risk Level', value: 'Low' },
                { label: 'Min Investment', value: '₱3,000' },
                { label: 'Lock Period', value: '3 months' },
                { label: 'Future Outlook', value: 'Growing investor interest in sustainable finance with strong policy support globally' }
            ],
            tags: ['Sustainable', 'Fixed Income', 'ESG'],
            futureGrowthPotential: 'Medium'
        });
    }
    
    // For very small portfolios, add a savings option
    if (financialData.availableCapital < 3000) {
        opportunities.push({
            title: 'High-Yield Savings',
            icon: 'fa-piggy-bank',
            details: [
                { label: 'Expected Return', value: '3-4%' },
                { label: 'Risk Level', value: 'Very Low' },
                { label: 'Min Investment', value: '₱500' },
                { label: 'Lock Period', value: 'None' },
                { label: 'Future Outlook', value: 'Safe foundation to build capital for higher-return investments in the future' }
            ],
            tags: ['Beginner', 'Liquid', 'No Risk'],
            futureGrowthPotential: 'Low'
        });
    }
    
    // Add basic insights
    insights.push({
        title: 'Tech Sector Growth',
        description: 'The tech sector continues to show strong growth potential with increasing digital adoption rates. Companies focused on AI, cloud computing, and automation are particularly well-positioned for the next 3-5 years of digital transformation.',
        icon: 'fa-chart-line',
        type: 'positive',
        timeHorizon: 'Medium-term'
    });
    
    // Add personalized insights based on savings ratio
    if (financialData.savingsRatio < 0.1) {
        insights.push({
            title: 'Budget Management Alert',
            description: 'Your current savings rate is low. Focus on improving your emergency fund before making higher-risk investments. Future market uncertainty requires a solid financial foundation.',
            icon: 'fa-exclamation-triangle',
            type: 'negative',
            timeHorizon: 'Short-term'
        });
    } else if (financialData.savingsRatio > 0.3) {
        insights.push({
            title: 'Strong Savings Position',
            description: 'Your excellent savings rate gives you flexibility to diversify your portfolio across different risk levels. This strong financial foundation positions you well for investment opportunities that may arise from emerging market trends.',
            icon: 'fa-shield-alt',
            type: 'positive',
            timeHorizon: 'Long-term'
        });
    }
    
    // Add future-focused insight
    insights.push({
        title: 'Emerging Markets Potential',
        description: 'Emerging markets in Southeast Asia are showing strong growth potential over the next 5 years. As economies recover and digital infrastructure improves, these markets offer diversification opportunities for investors looking beyond traditional investments.',
        icon: 'fa-globe-asia',
        type: 'neutral',
        timeHorizon: 'Long-term'
    });
    
    return { opportunities, insights, marketTrends };
} 