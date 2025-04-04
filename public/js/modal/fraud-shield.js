// Fraud Shield Tool (Bantay Seguridad) - AI-powered fraud detection and prevention
import { getAuth } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-auth.js";
import { getUserTransactions, getUserData, getLoginHistory } from "../firestoredb.js";

// Constants for fraud detection
const FRAUD_DETECTION_CONFIG = {
    // Transaction Pattern Analysis
    VELOCITY_CHECK: {
        TIME_WINDOW: 24, // hours
        MAX_TRANSACTIONS: 10,
        AMOUNT_THRESHOLD: 50000 // ₱50,000
    },
    
    // Location-based Rules
    LOCATION_CHECK: {
        MAX_DISTANCE: 100, // km
        TIME_WINDOW: 2 // hours
    },
    
    // Amount Thresholds
    AMOUNT_THRESHOLDS: {
        SUSPICIOUS_MULTIPLIER: 3,
        HIGH_VALUE_THRESHOLD: 100000 // ₱100,000
    },
    
    // Merchant Category Rules
    MERCHANT_RULES: {
        HIGH_RISK_CATEGORIES: [
            'gambling',
            'cryptocurrency',
            'foreign_exchange',
            'unregistered_business'
        ],
        NEW_MERCHANT_MONITORING_DAYS: 30
    },
    
    // Device and Session Rules
    DEVICE_RULES: {
        MAX_DEVICES: 3,
        SESSION_TIMEOUT: 30, // minutes
        LOCATION_CHANGE_THRESHOLD: 500 // km
    },
    
    // Risk Scoring
    RISK_WEIGHTS: {
        AMOUNT: 0.3,
        LOCATION: 0.25,
        MERCHANT: 0.2,
        DEVICE: 0.15,
        TIME: 0.1
    }
};

document.addEventListener('DOMContentLoaded', function() {
    // Get the Bantay Seguridad (Fraud Shield) tool element and add click event listener
    const fraudShieldTool = document.getElementById('fraud-shield-tool');
    if (fraudShieldTool) {
        fraudShieldTool.addEventListener('click', function() {
            document.getElementById('fraud-shield-modal').style.display = 'flex';
            loadFraudShieldContent();
        });
    }

    // Close modal when user clicks X
    const closeButtons = document.querySelectorAll('.modal-close-btn[data-modal="fraud-shield-modal"]');
    closeButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            document.getElementById('fraud-shield-modal').style.display = 'none';
        });
    });

    // Close modal when clicking outside
    window.addEventListener('click', function(e) {
        if (e.target.classList.contains('modal')) {
            e.target.style.display = 'none';
        }
    });
});

// Function to analyze transactions for fraud patterns
async function analyzeFraudPatterns(transactions) {
    const analysis = {
        riskScore: 0,
        alerts: [],
        patterns: {
            locations: new Set(),
            merchants: new Set(),
            timeDistribution: Array(24).fill(0),
            amounts: []
        }
    };

    if (!transactions || transactions.length === 0) {
        return {
            riskScore: 100, // Default score for new accounts
            alerts: [],
            patterns: {
                locations: new Set(),
                merchants: new Set(),
                timeDistribution: Array(24).fill(0),
                amounts: []
            }
        };
    }

    // Sort transactions by date
    const sortedTransactions = [...transactions].sort((a, b) => 
        new Date(b.date) - new Date(a.date)
    );

    // Analyze each transaction
    sortedTransactions.forEach(transaction => {
        // Track locations
        if (transaction.location) {
            analysis.patterns.locations.add(transaction.location);
        }

        // Track merchants
        if (transaction.merchant) {
            analysis.patterns.merchants.add(transaction.merchant);
        }

        // Track time distribution
        const hour = new Date(transaction.date).getHours();
        analysis.patterns.timeDistribution[hour]++;

        // Track amounts
        analysis.patterns.amounts.push(parseFloat(transaction.amount));

        // Check for high-risk patterns
        if (FRAUD_DETECTION_CONFIG.MERCHANT_RULES.HIGH_RISK_CATEGORIES
            .includes(transaction.category?.toLowerCase())) {
            analysis.alerts.push({
                date: transaction.date,
                description: `High-risk merchant category: ${transaction.category}`,
                risk: 'High',
                amount: transaction.amount,
                status: 'Flagged'
            });
        }

        // Check for unusual amounts
        const avg = analysis.patterns.amounts.reduce((a, b) => a + b, 0) / analysis.patterns.amounts.length;
        if (parseFloat(transaction.amount) > avg * FRAUD_DETECTION_CONFIG.AMOUNT_THRESHOLDS.SUSPICIOUS_MULTIPLIER) {
            analysis.alerts.push({
                date: transaction.date,
                description: 'Unusually large transaction amount',
                risk: 'Medium',
                amount: transaction.amount,
                status: 'Reviewed'
            });
        }
    });

    // Calculate risk score
    const locationDiversity = analysis.patterns.locations.size;
    const merchantDiversity = analysis.patterns.merchants.size;
    const timeVariance = calculateTimeVariance(analysis.patterns.timeDistribution);
    const amountVariance = calculateAmountVariance(analysis.patterns.amounts);

    analysis.riskScore = calculateRiskScore({
        locationDiversity,
        merchantDiversity,
        timeVariance,
        amountVariance,
        alertCount: analysis.alerts.length
    });

    return analysis;
}

// Helper function to calculate time variance
function calculateTimeVariance(timeDistribution) {
    const mean = timeDistribution.reduce((a, b) => a + b, 0) / 24;
    const variance = timeDistribution.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / 24;
    return Math.sqrt(variance);
}

// Helper function to calculate amount variance
function calculateAmountVariance(amounts) {
    const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const variance = amounts.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / amounts.length;
    return Math.sqrt(variance);
}

// Helper function to calculate overall risk score
function calculateRiskScore({ locationDiversity, merchantDiversity, timeVariance, amountVariance, alertCount }) {
    // Base score of 100
    let score = 100;

    // Deduct points for each risk factor
    score -= alertCount * 5; // Deduct 5 points per alert
    score -= Math.max(0, locationDiversity - 5) * 2; // Deduct points for too many locations
    score -= Math.max(0, amountVariance / 1000); // Deduct points for high amount variance
    
    // Ensure score stays within 0-100 range
    return Math.max(0, Math.min(100, score));
}

// Function to load the fraud shield analysis content
async function loadFraudShieldContent() {
    const contentContainer = document.getElementById('fraud-shield-modal-content');
    
    try {
        const auth = getAuth();
        const user = auth.currentUser;
        
        if (!user) {
            contentContainer.innerHTML = `
                <div class="error-state">
                    <i class="fas fa-exclamation-circle"></i>
                    <p>Please log in to view your fraud protection analysis.</p>
                </div>
            `;
            return;
        }

        // Show loading state
        contentContainer.innerHTML = `
            <div class="loading-state">
                <div class="pulse-loader"></div>
                <p>Analyzing your security data...</p>
            </div>
        `;

        // Get user's transactions and login logs
        const transactions = await getUserTransactions(user.uid);
        const loginHistory = await getLoginHistory(user.uid);
        
        const fraudAnalysis = await analyzeFraudPatterns(transactions);
        
        // Log what we got for debugging
        console.log("Login history:", loginHistory);
        
        // Generate content with the analysis results
        contentContainer.innerHTML = `
            <div class="fraud-shield-container">
                <div class="security-score-section">
                    <h3>Your Security Status</h3>
                    <div class="security-status ${getSecurityStatusClass(fraudAnalysis.riskScore)}">
                        <i class="fas ${getSecurityStatusIcon(fraudAnalysis.riskScore)}"></i>
                        <span>${formatSecurityStatus(fraudAnalysis.riskScore)}</span>
                    </div>
                    <div class="key-metrics">
                        <div class="metric">
                            <label>Security Score</label>
                            <div class="metric-value ${getMetricClass(fraudAnalysis.riskScore, 'score')}">
                                ${Math.round(fraudAnalysis.riskScore)}%
                            </div>
                        </div>
                        <div class="metric">
                            <label>Active Alerts</label>
                            <div class="metric-value ${getMetricClass(fraudAnalysis.alerts.length, 'alerts')}">
                                ${fraudAnalysis.alerts.length}
                            </div>
                        </div>
                        <div class="metric">
                            <label>Monitored Transactions</label>
                            <div class="metric-value">
                                ${transactions ? transactions.length : 0}
                            </div>
                        </div>
                    </div>
                </div>

                ${generateSecurityRecommendations(fraudAnalysis)}
                
                ${generateLoginHistorySection(loginHistory)}
                
                ${generateRecentAlertsSection(fraudAnalysis.alerts)}
                
                ${generateInsightsSection(fraudAnalysis)}
            </div>
        `;
        
        // Add event listeners for interactive elements
        addEventListeners();
        
    } catch (error) {
        console.error('Error loading Fraud Shield content:', error);
        contentContainer.innerHTML = `
            <div class="error-state">
                <i class="fas fa-exclamation-circle"></i>
                <p>Error analyzing security data: ${error.message || 'Unknown error'}</p>
                <button class="action-button" onclick="loadFraudShieldContent()">
                    Retry
                </button>
            </div>
        `;
    }
}

// Helper functions for UI generation
function getSecurityStatusClass(score) {
    if (score >= 80) return 'healthy';
    if (score >= 60) return 'warning';
    return 'critical';
}

function getSecurityStatusIcon(score) {
    if (score >= 80) return 'fa-shield-check';
    if (score >= 60) return 'fa-shield-exclamation';
    return 'fa-shield-xmark';
}

function formatSecurityStatus(score) {
    if (score >= 80) return 'Strong Security';
    if (score >= 60) return 'Moderate Risk';
    return 'High Risk';
}

function getMetricClass(value, type) {
    if (type === 'score') {
        if (value >= 80) return 'good';
        if (value >= 60) return 'warning';
        return 'critical';
    } else if (type === 'alerts') {
        if (value === 0) return 'good';
        if (value <= 2) return 'warning';
        return 'critical';
    }
    return '';
}

function generateSecurityRecommendations(analysis) {
    const recommendations = [];
    
    if (analysis.riskScore < 80) {
        recommendations.push({
            title: 'Enable Enhanced Security',
            description: 'Activate additional security measures to protect your account.',
            priority: 'high',
            icon: 'fa-shield-alt',
            actions: ['Enable 2FA', 'Set up biometric login', 'Configure alert preferences']
        });
    }

    if (analysis.patterns.locations.size > 3) {
        recommendations.push({
            title: 'Unusual Location Activity',
            description: 'Transactions detected from multiple locations. Verify all activities are authorized.',
            priority: 'medium',
            icon: 'fa-map-marker-alt',
            actions: ['Review recent locations', 'Set up location alerts', 'Configure trusted locations']
        });
    }

    return `
        <div class="recommendations-section">
            <h3>Security Recommendations</h3>
            ${recommendations.map(rec => `
                <div class="recommendation-item ${rec.priority}">
                    <div class="recommendation-header">
                        <i class="fas ${rec.icon}"></i>
                        <div>
                            <h4>${rec.title}</h4>
                            <p>${rec.description}</p>
                        </div>
                    </div>
                    <div class="recommendation-actions">
                        ${rec.actions.map(action => `
                            <button class="action-button secondary">
                                <i class="fas fa-arrow-right"></i> ${action}
                            </button>
                        `).join('')}
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

function generateLoginHistorySection(loginHistory) {
    if (!loginHistory || loginHistory.length === 0) {
        return `
            <div class="login-history-section">
                <h3>Recent Login Activity</h3>
                <div class="no-data">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>No login history found. This might be your first login.</p>
                </div>
            </div>
        `;
    }
    
    // Take only the 10 most recent logins
    const recentLogins = loginHistory.slice(0, 10);
    
    return `
        <div class="login-history-section">
            <h3>Recent Login Activity</h3>
            <div class="table-container">
                <table class="login-table">
                    <thead>
                        <tr>
                            <th>Date & Time</th>
                            <th>Location</th>
                            <th>Device</th>
                            <th>Method</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${recentLogins.map(login => `
                            <tr>
                                <td>${new Date(login.timestamp).toLocaleString()}</td>
                                <td>${formatLoginLocation(login.location)}</td>
                                <td>${formatDeviceInfo(login.deviceInfo)}</td>
                                <td>${formatLoginMethod(login.method)}</td>
                                <td><span class="login-status ${login.successful ? 'success' : 'failed'}">${login.successful ? 'Success' : 'Failed'}</span></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

// Helper function to format login location
function formatLoginLocation(location) {
    if (!location) return 'Unknown';
    
    const city = location.city || 'Unknown';
    const country = location.country || location.country_name || 'Unknown';
    
    if (city === 'Unknown' && country === 'Unknown') return 'Unknown';
    return `${city}, ${country}`;
}

// Helper function to format device info
function formatDeviceInfo(deviceInfo) {
    if (!deviceInfo) return 'Unknown';
    
    let deviceType = 'Unknown';
    let browser = 'Unknown';
    
    const ua = deviceInfo.userAgent || '';
    
    // Detect browser
    if (ua.includes('Chrome')) browser = 'Chrome';
    else if (ua.includes('Firefox')) browser = 'Firefox';
    else if (ua.includes('Safari')) browser = 'Safari';
    else if (ua.includes('Edge')) browser = 'Edge';
    else if (ua.includes('MSIE') || ua.includes('Trident/')) browser = 'Internet Explorer';
    
    // Detect device type
    if (ua.includes('Mobile')) deviceType = 'Mobile';
    else if (ua.includes('Tablet')) deviceType = 'Tablet';
    else deviceType = 'Desktop';
    
    return `${browser} on ${deviceType}`;
}

// Helper function to format login method
function formatLoginMethod(method) {
    if (!method) return 'Unknown';
    
    // Check if method is a string before calling toLowerCase
    if (typeof method !== 'string') return String(method) || 'Unknown';
    
    switch(method.toLowerCase()) {
        case 'google':
            return '<i class="fab fa-google"></i> Google';
        case 'email':
            return '<i class="fas fa-envelope"></i> Email/Password';
        default:
            return method;
    }
}

function generateRecentAlertsSection(alerts) {
    if (!alerts || alerts.length === 0) {
        return `
            <div class="alerts-section">
                <h3>Security Alerts</h3>
                <div class="no-alerts">
                    <i class="fas fa-check-circle"></i>
                    <p>No security alerts detected. Your account is currently secure.</p>
                </div>
            </div>
        `;
    }

    return `
        <div class="alerts-section">
            <h3>Recent Security Alerts</h3>
            <div class="alerts-table-container">
                <table class="alerts-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Description</th>
                            <th>Risk Level</th>
                            <th>Amount</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${alerts.map(alert => `
                            <tr>
                                <td>${new Date(alert.date).toLocaleDateString()}</td>
                                <td>${alert.description}</td>
                                <td><span class="risk-level ${alert.risk.toLowerCase()}">${alert.risk}</span></td>
                                <td>₱${formatAmount(alert.amount)}</td>
                                <td><span class="alert-status ${alert.status.toLowerCase()}">${alert.status}</span></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function generateInsightsSection(analysis) {
    return `
        <div class="insights-section">
            <h3>AI Security Insights</h3>
            <div class="insights-grid">
                <div class="insight-card">
                    <div class="insight-icon"><i class="fas fa-map-marker-alt"></i></div>
                    <div class="insight-content">
                        <h4>Location Analysis</h4>
                        <p>Activity detected in ${analysis.patterns.locations.size} different locations</p>
                    </div>
                </div>
                <div class="insight-card">
                    <div class="insight-icon"><i class="fas fa-store"></i></div>
                    <div class="insight-content">
                        <h4>Merchant Analysis</h4>
                        <p>Transactions with ${analysis.patterns.merchants.size} unique merchants</p>
                    </div>
                </div>
                <div class="insight-card">
                    <div class="insight-icon"><i class="fas fa-chart-line"></i></div>
                    <div class="insight-content">
                        <h4>Transaction Patterns</h4>
                        <p>Most active during ${getActiveHours(analysis.patterns.timeDistribution)}</p>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function getActiveHours(timeDistribution) {
    const maxHour = timeDistribution.indexOf(Math.max(...timeDistribution));
    return `${maxHour}:00 - ${(maxHour + 1) % 24}:00`;
}

function formatAmount(amount) {
    return parseFloat(amount).toLocaleString('en-PH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function addEventListeners() {
    // Add event listeners for buttons and interactive elements
    document.querySelectorAll('.action-button').forEach(button => {
        button.addEventListener('click', function() {
            // Handle button clicks (to be implemented)
            console.log('Action button clicked:', this.textContent);
        });
    });
}

// Add CSS styles for the Fraud Shield UI
document.addEventListener('DOMContentLoaded', function() {
    const styles = `
        #fraud-shield-modal {
            background: rgba(0, 0, 0, 0.85);
        }

        #fraud-shield-modal-content {
            background: var(--surface-ground, #1a1a1a);
            color: var(--text-color, #f0f0f0);
            max-width: 1200px;
            margin: 20px auto;
            border-radius: 16px;
            padding: 24px;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
        }

        .fraud-shield-container {
            display: grid;
            gap: 24px;
        }

        .security-score-section {
            background: var(--surface-card, #242424);
            padding: 24px;
            border-radius: 12px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }

        .security-status {
            display: inline-flex;
            align-items: center;
            padding: 8px 16px;
            border-radius: 24px;
            margin: 12px 0;
            font-weight: 500;
        }

        .security-status.healthy {
            background: rgba(76, 175, 80, 0.15);
            color: #69db7c;
        }

        .security-status.warning {
            background: rgba(255, 152, 0, 0.15);
            color: #ffd43b;
        }

        .security-status.critical {
            background: rgba(244, 67, 54, 0.15);
            color: #ff6b6b;
        }

        .security-status i {
            margin-right: 8px;
            font-size: 1.2em;
        }

        .key-metrics {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-top: 20px;
        }

        .metric {
            background: var(--surface-hover, #2a2a2a);
            padding: 16px;
            border-radius: 12px;
            transition: transform 0.2s;
        }

        .metric:hover {
            transform: translateY(-2px);
        }

        .metric label {
            display: block;
            color: var(--text-color-secondary, #adb5bd);
            margin-bottom: 8px;
            font-size: 0.9rem;
        }

        .metric-value {
            font-size: 1.5rem;
            font-weight: 600;
            color: var(--text-color, #f0f0f0);
        }

        .metric-value.good { color: #69db7c; }
        .metric-value.warning { color: #ffd43b; }
        .metric-value.critical { color: #ff6b6b; }

        .recommendations-section,
        .alerts-section,
        .insights-section {
            background: var(--surface-card, #242424);
            padding: 24px;
            border-radius: 12px;
            margin-top: 24px;
        }

        .recommendation-item {
            background: var(--surface-hover, #2a2a2a);
            border-radius: 12px;
            padding: 20px;
            margin-bottom: 16px;
            transition: transform 0.2s;
        }

        .recommendation-item:hover {
            transform: translateY(-2px);
        }

        .recommendation-item.high {
            border-left: 4px solid #ff6b6b;
        }

        .recommendation-item.medium {
            border-left: 4px solid #ffd43b;
        }

        .recommendation-item.low {
            border-left: 4px solid #69db7c;
        }

        .alerts-table-container {
            overflow-x: auto;
            margin-top: 16px;
        }

        .alerts-table {
            width: 100%;
            border-collapse: collapse;
        }

        .alerts-table th,
        .alerts-table td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid var(--surface-border, #333);
        }

        .alerts-table th {
            background: var(--surface-hover, #2a2a2a);
            color: var(--text-color-secondary, #adb5bd);
            font-weight: 500;
        }

        .risk-level,
        .alert-status {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 0.9rem;
        }

        .risk-level.high,
        .alert-status.flagged {
            background: rgba(244, 67, 54, 0.15);
            color: #ff6b6b;
        }

        .risk-level.medium,
        .alert-status.reviewed {
            background: rgba(255, 152, 0, 0.15);
            color: #ffd43b;
        }

        .risk-level.low,
        .alert-status.permitted {
            background: rgba(76, 175, 80, 0.15);
            color: #69db7c;
        }

        .insights-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin-top: 16px;
        }

        .insight-card {
            background: var(--surface-hover, #2a2a2a);
            padding: 20px;
            border-radius: 12px;
            display: flex;
            align-items: start;
            gap: 16px;
            transition: transform 0.2s;
        }

        .insight-card:hover {
            transform: translateY(-2px);
        }

        .insight-icon {
            background: var(--primary-color-alpha, rgba(33, 150, 243, 0.1));
            color: var(--primary-color, #2196F3);
            padding: 12px;
            border-radius: 50%;
            font-size: 1.2em;
        }

        .insight-content h4 {
            margin: 0 0 8px 0;
            color: var(--text-color, #f0f0f0);
        }

        .insight-content p {
            margin: 0;
            color: var(--text-color-secondary, #adb5bd);
            font-size: 0.9rem;
        }

        .action-button {
            background: var(--primary-color, #2196F3);
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 0.9rem;
            transition: background-color 0.2s;
        }

        .action-button:hover {
            background: var(--primary-color-darker, #1976D2);
        }

        .action-button.secondary {
            background: var(--surface-hover, #2a2a2a);
            border: 1px solid var(--primary-color, #2196F3);
            color: var(--primary-color, #2196F3);
        }

        .action-button.secondary:hover {
            background: var(--primary-color-alpha, rgba(33, 150, 243, 0.1));
        }

        .loading-state,
        .error-state {
            text-align: center;
            padding: 48px;
        }

        .pulse-loader {
            width: 48px;
            height: 48px;
            border: 4px solid var(--surface-hover, #2a2a2a);
            border-radius: 50%;
            border-top-color: var(--primary-color, #2196F3);
            animation: pulse 1s linear infinite;
            margin: 0 auto 24px;
        }

        @keyframes pulse {
            to {
                transform: rotate(360deg);
            }
        }

        @media (max-width: 768px) {
            #fraud-shield-modal-content {
                margin: 10px;
                padding: 16px;
            }

            .key-metrics,
            .insights-grid {
                grid-template-columns: 1fr;
            }

            .alerts-table-container {
                margin: 0 -16px;
            }
        }

        .login-history-section {
            background: var(--surface-card, #242424);
            padding: 24px;
            border-radius: 12px;
            margin-top: 24px;
        }
        
        .login-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 16px;
        }
        
        .login-table th, 
        .login-table td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid var(--surface-border, #333);
        }
        
        .login-table th {
            background: var(--surface-hover, #2a2a2a);
            color: var(--text-color-secondary, #adb5bd);
            font-weight: 500;
        }
        
        .login-table tr:hover {
            background-color: var(--surface-hover, #2a2a2a);
        }
        
        .login-status {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 0.9rem;
        }
        
        .login-status.success {
            background: rgba(76, 175, 80, 0.15);
            color: #69db7c;
        }
        
        .login-status.failed {
            background: rgba(244, 67, 54, 0.15);
            color: #ff6b6b;
        }
        
        .table-container {
            overflow-x: auto;
        }
        
        .no-data {
            text-align: center;
            padding: 24px;
            background: var(--surface-hover, #2a2a2a);
            border-radius: 12px;
        }
        
        .no-data i {
            font-size: 2rem;
            color: #ffd43b;
            margin-bottom: 16px;
            display: block;
        }
    `;
    
    const styleSheet = document.createElement('style');
    styleSheet.textContent = styles;
    document.head.appendChild(styleSheet);
}); 