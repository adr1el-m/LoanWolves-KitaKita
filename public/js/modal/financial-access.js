// Financial Access Tool - AI-powered KYC and Regulatory Compliance
import { getAuth } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-auth.js";
import { 
    getUserData,
    getUserTransactions,
    getUserBankAccounts
} from "../firestoredb.js";
import { getUserMonthlyIncome, determineIncomeLevel } from "../helpers.js";

// Make the function globally accessible
window.loadFinancialAccessContent = loadFinancialAccessContent;

// KYC and Compliance Configuration
const COMPLIANCE_CONFIG = {
    // Document Validity (in days)
    DOCUMENT_VALIDITY: {
        ID: 365,
        PROOF_OF_ADDRESS: 90,
        INCOME_PROOF: 180
    },
    
    // Document Types
    DOCUMENT_TYPES: {
        ID: {
            title: 'Government ID',
            icon: 'fa-id-card',
            priority: 'high'
        },
        PROOF_OF_ADDRESS: {
            title: 'Proof of Address',
            icon: 'fa-home',
            priority: 'medium'
        },
        INCOME_PROOF: {
            title: 'Income Verification',
            icon: 'fa-file-invoice-dollar',
            priority: 'medium'
        },
        TAX_RETURN: {
            title: 'Tax Return',
            icon: 'fa-file-alt',
            priority: 'low'
        }
    }
};

// Initialization
document.addEventListener('DOMContentLoaded', function() {
    console.log("Financial Access Tool loaded");
    
    const financialAccessTool = document.getElementById('financial-access-tool');
    if (financialAccessTool) {
        financialAccessTool.addEventListener('click', function() {
            const modal = document.getElementById('financial-access-modal');
            if (modal) {
                modal.style.display = 'flex';
                loadFinancialAccessContent();
            }
        });
    }

    // Close modal handlers
    const closeButtons = document.querySelectorAll('.modal-close-btn[data-modal="financial-access-modal"]');
    closeButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            document.getElementById('financial-access-modal').style.display = 'none';
        });
    });

    window.addEventListener('click', function(e) {
        if (e.target.classList.contains('modal')) {
            e.target.style.display = 'none';
        }
    });
});

// Function to load the financial access analysis content
async function loadFinancialAccessContent() {
    const contentContainer = document.getElementById('financial-access-modal-content');
    
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
                    <p>Please log in to view your compliance status.</p>
                </div>
            `;
            return;
        }

        // Show loading state
        contentContainer.innerHTML = `
            <div class="loading-state">
                <div class="pulse-loader"></div>
                <p>Analyzing your compliance status and KYC requirements...</p>
            </div>
        `;

        // Get user data and transactions
        const userData = await getUserData(user.uid);
        const transactions = await getUserTransactions(user.uid);
        const bankAccounts = await getUserBankAccounts(user.uid);
        
        // Get monthly income for personalized analysis
        const monthlyIncome = await getUserMonthlyIncome();
        const incomeLevel = determineIncomeLevel(monthlyIncome);
        
        if (!userData) {
            contentContainer.innerHTML = `
                <div class="error-state">
                    <i class="fas fa-exclamation-circle"></i>
                    <p>Unable to retrieve your compliance data. Please try again later.</p>
                </div>
            `;
            return;
        }

        // Analyze compliance status with income level consideration
        const complianceAnalysis = analyzeComplianceStatus(userData, transactions, bankAccounts, incomeLevel);
        
        // Generate the content with personalized insights
        contentContainer.innerHTML = `
            <div class="compliance-analysis-container">
                <div class="compliance-status-summary">
                    <h3>Compliance Status Overview</h3>
                    <div class="compliance-status ${complianceAnalysis.status.toLowerCase()}">
                        <i class="fas ${getComplianceStatusIcon(complianceAnalysis.status)}"></i>
                        <span>${formatComplianceStatus(complianceAnalysis.status)}</span>
                    </div>
                    
                    <div class="key-metrics">
                        ${generateComplianceMetrics(complianceAnalysis)}
                    </div>
                </div>

                <div class="required-actions">
                    <h3>Required Actions</h3>
                    <div class="actions-grid">
                        ${generateRequiredActions(complianceAnalysis, incomeLevel)}
                    </div>
                </div>

                <div class="document-status">
                    <h3>Document Verification Status</h3>
                    ${generateDocumentStatus(complianceAnalysis)}
                </div>
            </div>
        `;

        // Add event listeners for action buttons
        addActionListeners();
    } catch (error) {
        console.error("Error in financial access tool:", error);
        if (contentContainer) {
            contentContainer.innerHTML = `
                <div class="error-state">
                    <i class="fas fa-exclamation-circle"></i>
                    <p>An error occurred while analyzing your compliance status. Please try again later.</p>
                </div>
            `;
        }
    }
}

function analyzeComplianceStatus(userData, transactions, bankAccounts, incomeLevel = 'middle') {
    // Calculate scores
    const kycScore = calculateKYCScore(userData);
    const documentValidityScore = calculateDocumentValidityScore(userData);
    
    // Calculate overall compliance score
    const weights = {
        KYC_COMPLETION: 0.7,
        DOCUMENT_VALIDITY: 0.3
    };
    
    const complianceScore = (
        kycScore * weights.KYC_COMPLETION +
        documentValidityScore * weights.DOCUMENT_VALIDITY
    );
    
    // Determine compliance status
    const status = determineComplianceStatus(complianceScore);
    
    // Generate required actions
    const requiredActions = generateRequiredActionsList(userData, transactions, incomeLevel);
    
    // Document status
    const documentStatus = assessDocumentStatus(userData);
    
    return {
        score: complianceScore,
        status: status,
        components: {
            kyc: kycScore,
            documents: documentValidityScore
        },
        documentStatus,
        requiredActions
    };
}

function calculateKYCScore(userData) {
    let score = 0;
    const financialProfile = userData.financialProfile || {};
    const documents = financialProfile.documents || {};
    
    // Check for required profile fields
    const requiredFields = [
        { field: 'fullName', path: '' },
        { field: 'dateOfBirth', path: '' },
        { field: 'address', path: '' },
        { field: 'phoneNumber', path: '' },
        { field: 'occupation', path: 'financialProfile' },
        { field: 'monthlyIncome', path: 'financialProfile' },
        { field: 'employmentStatus', path: 'financialProfile' }
    ];
    
    // Calculate profile completion percentage
    let completedFields = 0;
    requiredFields.forEach(item => {
        const value = item.path ? 
            (userData[item.path] ? userData[item.path][item.field] : null) : 
            userData[item.field];
            
        if (value) completedFields++;
    });
    
    // Profile fields contribute 50% of the KYC score
    score += (completedFields / requiredFields.length) * 0.5;
    
    // Check for required documents
    const requiredDocuments = [
        'ID', 'PROOF_OF_ADDRESS', 'INCOME_PROOF', 'TAX_RETURN'
    ];
    
    // Calculate document submission percentage
    let documentScore = 0;
    requiredDocuments.forEach(docType => {
        if (documents[docType]) {
            documentScore += documents[docType].status === 'valid' ? 1 : 0.5;
        }
    });
    
    // Documents contribute the other 50% of the KYC score
    score += (documentScore / requiredDocuments.length) * 0.5;
    
    return Math.min(1, score);
}

function calculateDocumentValidityScore(userData) {
    const financialProfile = userData.financialProfile || {};
    const documents = financialProfile.documents || {};
    
    if (Object.keys(documents).length === 0) return 0;
    
    // Required document types with weights based on importance
    const requiredDocuments = {
        'ID': 0.4,
        'PROOF_OF_ADDRESS': 0.3,
        'INCOME_PROOF': 0.2,
        'TAX_RETURN': 0.1
    };
    
    let totalScore = 0;
    let totalWeight = 0;
    
    // Check each required document
    Object.entries(requiredDocuments).forEach(([docType, weight]) => {
        const doc = documents[docType];
        totalWeight += weight;
        
        if (!doc) return; // Document missing
        
        // Calculate individual document validity
        let documentScore = 0;
        
        // Check document status
        if (doc.status === 'valid' || doc.status === 'verified') {
            documentScore = 1.0; // Valid document gets full score
        } else if (doc.status === 'pending') {
            documentScore = 0.5; // Pending document gets partial score
        } else if (doc.status === 'rejected') {
            documentScore = 0; // Rejected document gets no score
        }
        
        // Check document expiry if applicable
        if (doc.expiryDate) {
            const now = new Date();
            const expiry = new Date(doc.expiryDate);
            
            // Calculate days until expiry
            const daysUntilExpiry = Math.floor((expiry - now) / (1000 * 60 * 60 * 24));
            
            // If document is expired, override score to 0
            if (daysUntilExpiry < 0) {
                documentScore = 0;
            }
            // If document is close to expiry, reduce score
            else if (daysUntilExpiry < 30) {
                documentScore *= 0.5;
            }
        }
        
        // Add weighted score
        totalScore += documentScore * weight;
    });
    
    // Return normalized score (0-1)
    return totalWeight > 0 ? totalScore / totalWeight : 0;
}

function determineComplianceStatus(score) {
    if (score >= 0.8) return 'COMPLIANT';
    if (score >= 0.6) return 'PARTIAL';
    return 'NON_COMPLIANT';
}

function getComplianceStatusIcon(status) {
    switch (status) {
        case 'NON_COMPLIANT': return 'fa-exclamation-circle';
        case 'PARTIAL': return 'fa-exclamation-triangle';
        case 'COMPLIANT': return 'fa-check-circle';
        default: return 'fa-question-circle';
    }
}

function formatComplianceStatus(status) {
    switch (status) {
        case 'NON_COMPLIANT': return 'Action Required';
        case 'PARTIAL': return 'Additional Documentation Needed';
        case 'COMPLIANT': return 'Fully Compliant';
        default: return 'Unknown';
    }
}

function generateComplianceMetrics(analysis) {
    return `
        <div class="metric">
            <label>Overall Compliance</label>
            <div class="metric-value ${getScoreClass(analysis.score)}">
                ${Math.round(analysis.score * 100)}%
            </div>
            <div class="metric-description">Overall compliance with regulatory requirements</div>
        </div>
        <div class="metric">
            <label>KYC Completion</label>
            <div class="metric-value ${getScoreClass(analysis.components.kyc)}">
                ${Math.round(analysis.components.kyc * 100)}%
            </div>
            <div class="metric-description">Know Your Customer verification status</div>
        </div>
        <div class="metric">
            <label>Document Status</label>
            <div class="metric-value ${getScoreClass(analysis.components.documents)}">
                ${Math.round(analysis.components.documents * 100)}%
            </div>
            <div class="metric-description">Required documentation completeness</div>
        </div>
    `;
}

function generateRequiredActions(analysis, incomeLevel = 'middle') {
    const actions = analysis.requiredActions || [];
    
    return actions.map(action => `
        <div class="action-card ${action.priority}">
            <div class="action-icon">
                <i class="fas ${action.icon}"></i>
            </div>
            <div class="action-details">
                <h4>${action.title}</h4>
                <p>${action.description}</p>
            </div>
            <button class="action-button" data-action="${action.id}" data-income-level="${incomeLevel}">
                ${action.actionText}
            </button>
        </div>
    `).join('');
}

function generateDocumentStatus(analysis) {
    return Object.entries(COMPLIANCE_CONFIG.DOCUMENT_TYPES).map(([type, config]) => {
        const doc = analysis.documentStatus.find(d => d.type === type) || {
            status: 'missing',
            expiryDate: null
        };

        const statusInfo = getDocumentStatusInfo(doc.status, doc.expiryDate);

        return `
            <div class="document-card ${doc.status}">
                <div class="document-header">
                    <div class="document-icon">
                        <i class="fas ${config.icon}"></i>
                    </div>
                    <div class="document-content">
                        <div class="document-title">${config.title}</div>
                        <div class="document-priority">Priority: ${config.priority}</div>
                    </div>
                </div>
                <div class="document-status">
                    <span class="status-badge ${doc.status}">
                        <i class="fas ${statusInfo.icon}"></i>
                        ${statusInfo.text}
                    </span>
                </div>
                ${doc.expiryDate ? `
                    <div class="document-expiry ${statusInfo.expiryClass}">
                        <i class="fas fa-calendar"></i>
                        ${statusInfo.expiryText}
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');
}

function getDocumentStatusInfo(status, expiryDate) {
    const now = new Date();
    const expiry = expiryDate ? new Date(expiryDate) : null;
    const daysUntilExpiry = expiry ? Math.ceil((expiry - now) / (1000 * 60 * 60 * 24)) : null;

    switch (status) {
        case 'valid':
            return {
                icon: 'fa-check-circle',
                text: 'Valid',
                expiryClass: daysUntilExpiry < 30 ? 'warning' : 'good',
                expiryText: `Expires in ${daysUntilExpiry} days`
            };
        case 'expired':
            return {
                icon: 'fa-times-circle',
                text: 'Expired',
                expiryClass: 'critical',
                expiryText: 'Document has expired'
            };
        case 'pending':
            return {
                icon: 'fa-clock',
                text: 'Under Review',
                expiryClass: 'warning',
                expiryText: 'Verification in progress'
            };
        default:
            return {
                icon: 'fa-exclamation-circle',
                text: 'Missing',
                expiryClass: 'critical',
                expiryText: 'Document required'
            };
    }
}

function determineTrend(transactions, field) {
    if (!transactions || transactions.length < 2) return 'stable';
    
    const values = transactions.map(t => Math.abs(parseFloat(t[field])));
    const recentAvg = values.slice(0, Math.floor(values.length / 2)).reduce((a, b) => a + b, 0) / Math.floor(values.length / 2);
    const oldAvg = values.slice(Math.floor(values.length / 2)).reduce((a, b) => a + b, 0) / Math.floor(values.length / 2);
    
    if (recentAvg < oldAvg * 0.9) return 'improving';
    if (recentAvg > oldAvg * 1.1) return 'worsening';
    return 'stable';
}

function analyzeActivityPattern(transactions) {
    const intervals = [];
    const sortedTransactions = [...transactions].sort((a, b) => new Date(a.date) - new Date(b.date));
    
    for (let i = 1; i < sortedTransactions.length; i++) {
        const days = Math.floor((new Date(sortedTransactions[i].date) - new Date(sortedTransactions[i-1].date)) / (1000 * 60 * 60 * 24));
        intervals.push(days);
    }
    
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const variance = intervals.reduce((a, b) => a + Math.pow(b - avgInterval, 2), 0) / intervals.length;
    const regularity = 1 / (1 + Math.sqrt(variance));
    
    return {
        regularity,
        description: regularity > 0.8 ? 'Regular' : regularity > 0.5 ? 'Somewhat Regular' : 'Irregular',
        trend: determineTrend(sortedTransactions, 'amount')
    };
}

function formatAmount(amount) {
    return amount.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function getScoreClass(score) {
    if (score >= 0.8) return 'good';
    if (score >= 0.6) return 'warning';
    return 'critical';
}

// Add CSS styles
document.addEventListener('DOMContentLoaded', function() {
    const styles = `
        #financial-access-modal {
            background: rgba(0, 0, 0, 0.85);
        }

        #financial-access-modal-content {
            background: var(--surface-ground, #1a1a1a);
            color: var(--text-color, #f0f0f0);
            max-width: 1200px;
            margin: 20px auto;
            border-radius: 16px;
            padding: 24px;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
            overflow-x: hidden !important;
        }

        .compliance-analysis-container {
            display: grid;
            gap: 24px;
            max-width: 100% !important;
            width: 100% !important;
            box-sizing: border-box !important;
        }

        .compliance-status-summary,
        .required-actions,
        .document-status,
        .risk-analysis {
            background: var(--surface-card, #242424);
            padding: 24px;
            border-radius: 12px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }

        .compliance-status-summary h3,
        .required-actions h3,
        .document-status h3,
        .risk-analysis h3 {
            color: var(--text-color, #f0f0f0);
            margin: 0 0 20px 0;
            font-size: 1.5rem;
            font-weight: 600;
        }

        .compliance-status {
            display: inline-flex;
            align-items: center;
            padding: 8px 16px;
            border-radius: 24px;
            margin-bottom: 20px;
            font-weight: 500;
        }

        .compliance-status.non_compliant {
            background: rgba(244, 67, 54, 0.15);
            color: #ff6b6b;
        }

        .compliance-status.partial {
            background: rgba(255, 152, 0, 0.15);
            color: #ffd43b;
        }

        .compliance-status.compliant {
            background: rgba(76, 175, 80, 0.15);
            color: #69db7c;
        }

        .compliance-status i {
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
            padding: 20px;
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
            margin-bottom: 8px;
        }

        .metric-description {
            color: var(--text-color-secondary, #adb5bd);
            font-size: 0.9rem;
            line-height: 1.5;
        }

        .metric-value.critical { color: #ff6b6b; }
        .metric-value.warning { color: #ffd43b; }
        .metric-value.good { color: #69db7c; }

        .actions-grid,
        .documents-grid,
        .risk-metrics {
            display: grid;
            grid-template-columns: 1fr;
            gap: 20px;
        }

        .action-card,
        .document-card,
        .risk-metric {
            background: var(--surface-hover, #2a2a2a);
            padding: 20px;
            border-radius: 12px;
            transition: transform 0.2s;
        }

        .action-card:hover,
        .document-card:hover,
        .risk-metric:hover {
            transform: translateY(-2px);
        }

        .action-card.high { border-left: 4px solid #ff6b6b; }
        .action-card.medium { border-left: 4px solid #ffd43b; }
        .action-card.low { border-left: 4px solid #69db7c; }

        .action-header,
        .document-header {
            display: grid;
            grid-template-columns: auto 1fr;
            gap: 16px;
            margin-bottom: 16px;
        }

        .action-icon,
        .document-icon,
        .metric-icon {
            width: 48px;
            height: 48px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 12px;
            background: var(--primary-color-alpha, rgba(33, 150, 243, 0.1));
        }

        .action-icon i,
        .document-icon i,
        .metric-icon i {
            font-size: 24px;
            color: var(--primary-color, #2196F3);
        }

        .action-content,
        .document-content {
            display: flex;
            flex-direction: column;
            gap: 4px;
        }

        .action-title,
        .document-title {
            font-size: 1.1rem;
            font-weight: 500;
            color: var(--text-color, #f0f0f0);
        }

        .action-description,
        .document-priority {
            color: var(--text-color-secondary, #adb5bd);
            font-size: 0.9rem;
            line-height: 1.5;
        }

        .action-details {
            margin: 16px 0;
            padding: 16px 0;
            border-top: 1px solid var(--surface-border, #333);
            border-bottom: 1px solid var(--surface-border, #333);
        }

        .action-steps {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }

        .step-item {
            display: flex;
            align-items: center;
            gap: 8px;
            color: var(--text-color-secondary, #adb5bd);
        }

        .step-item i {
            color: var(--primary-color, #2196F3);
            font-size: 0.9em;
        }

        .action-deadline {
            margin-top: 12px;
            display: flex;
            align-items: center;
            gap: 8px;
            color: #ffd43b;
            font-size: 0.9rem;
        }

        .action-button,
        .document-action {
            width: 100%;
            background: var(--primary-color, #2196F3);
            color: white;
            border: none;
            padding: 12px;
            border-radius: 8px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            font-weight: 500;
            transition: background-color 0.2s;
        }

        .action-button:hover,
        .document-action:hover {
            background: var(--primary-color-darker, #1976D2);
        }

        .status-badge {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 6px 12px;
            border-radius: 12px;
            font-size: 0.9rem;
            font-weight: 500;
        }

        .status-badge.valid {
            background: rgba(76, 175, 80, 0.15);
            color: #69db7c;
        }

        .status-badge.expired {
            background: rgba(244, 67, 54, 0.15);
            color: #ff6b6b;
        }

        .status-badge.pending {
            background: rgba(255, 152, 0, 0.15);
            color: #ffd43b;
        }

        .document-expiry {
            display: flex;
            align-items: center;
            gap: 8px;
            margin: 12px 0;
            font-size: 0.9rem;
        }

        .document-expiry.warning { color: #ffd43b; }
        .document-expiry.critical { color: #ff6b6b; }
        .document-expiry.good { color: #69db7c; }

        .risk-metric {
            display: flex;
            flex-direction: column;
            gap: 16px;
        }

        .metric-trend {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 0.9rem;
        }

        .metric-trend i {
            font-size: 1.1em;
        }

        .risk-metric.low .metric-trend { color: #69db7c; }
        .risk-metric.medium .metric-trend { color: #ffd43b; }
        .risk-metric.high .metric-trend { color: #ff6b6b; }

        .loading-state {
            text-align: center;
            padding: 40px;
        }

        .pulse-loader {
            width: 40px;
            height: 40px;
            background: var(--primary-color, #2196F3);
            border-radius: 50%;
            margin: 0 auto 20px;
            animation: pulse 1.5s infinite;
        }

        .error-state {
            text-align: center;
            padding: 40px;
        }

        .error-state i {
            font-size: 48px;
            color: #ff6b6b;
            margin-bottom: 16px;
        }

        .no-actions {
            text-align: center;
            padding: 40px;
            color: #69db7c;
        }

        .no-actions i {
            font-size: 48px;
            margin-bottom: 16px;
        }

        @keyframes pulse {
            0% { transform: scale(0.8); opacity: 0.5; }
            50% { transform: scale(1); opacity: 1; }
            100% { transform: scale(0.8); opacity: 0.5; }
        }

        @media (max-width: 768px) {
            #financial-access-modal-content {
                margin: 10px;
                padding: 16px;
            }

            .key-metrics,
            .actions-grid,
            .documents-grid,
            .risk-metrics {
                grid-template-columns: 1fr;
            }

            .action-header,
            .document-header {
                grid-template-columns: 1fr;
                text-align: center;
            }

            .action-icon,
            .document-icon {
                margin: 0 auto 12px;
            }
        }
    `;
    
    const styleSheet = document.createElement('style');
    styleSheet.textContent = styles;
    document.head.appendChild(styleSheet);
});

function addActionListeners() {
    // Add event listeners for action buttons
    document.querySelectorAll('.action-button').forEach(button => {
        button.addEventListener('click', function(e) {
            const actionId = this.dataset.action;
            handleComplianceAction(actionId);
        });
    });

    // Add event listeners for document upload buttons
    document.querySelectorAll('.document-action').forEach(button => {
        button.addEventListener('click', function(e) {
            const documentId = this.dataset.document;
            handleDocumentUpload(documentId);
        });
    });
}

function handleComplianceAction(actionId) {
    // Implement action handling logic
    console.log(`Handling compliance action: ${actionId}`);
    // Add your action handling logic here
}

function handleDocumentUpload(documentId) {
    // Implement document upload logic
    console.log(`Handling document upload: ${documentId}`);
    // Add your document upload logic here
}

function generateRequiredActionsList(userData, transactions, incomeLevel = 'middle') {
    const actions = [];
    const documents = userData.financialProfile?.documents || {};
    
    // Check for missing or expired documents
    if (!documents.ID) {
        actions.push({
            id: 'upload_id',
            title: 'Upload Government ID',
            description: 'A valid government ID is required for identity verification.',
            icon: 'fa-id-card',
            priority: 'high',
            actionText: 'Upload ID'
        });
    }
    
    if (!documents.PROOF_OF_ADDRESS) {
        actions.push({
            id: 'upload_address',
            title: 'Submit Proof of Address',
            description: 'A recent utility bill or lease agreement is needed to verify your address.',
            icon: 'fa-home',
            priority: 'medium',
            actionText: 'Upload Document'
        });
    }
    
    // Income-specific document requirements
    if (incomeLevel === 'upper-middle' || incomeLevel === 'high') {
        if (!documents.INCOME_PROOF) {
            actions.push({
                id: 'upload_income',
                title: 'Verify Income Sources',
                description: 'Additional income verification is required for your income level.',
                icon: 'fa-file-invoice-dollar',
                priority: 'high',
                actionText: 'Upload Proof'
            });
        }
        
        if (!documents.TAX_RETURN) {
            actions.push({
                id: 'upload_tax',
                title: 'Submit Tax Return',
                description: 'Your income level requires tax return documentation for compliance.',
                icon: 'fa-file-alt',
                priority: 'medium',
                actionText: 'Upload Tax Return'
            });
        }
    } else if (incomeLevel === 'middle') {
        if (!documents.INCOME_PROOF) {
            actions.push({
                id: 'upload_income',
                title: 'Verify Income',
                description: 'Income verification documents are recommended for enhanced services.',
                icon: 'fa-file-invoice-dollar',
                priority: 'medium',
                actionText: 'Upload Proof'
            });
        }
    }
    
    return actions;
}

function assessDocumentStatus(userData) {
    const documentStatus = [];
    const financialProfile = userData.financialProfile || {};
    const documents = financialProfile.documents || {};
    
    Object.entries(COMPLIANCE_CONFIG.DOCUMENT_TYPES).forEach(([type, config]) => {
        const doc = documents[type];
        let status = 'missing';
        let expiryDate = null;
        
        if (doc) {
            expiryDate = doc.expiryDate ? new Date(doc.expiryDate) : null;
            
            // Determine document status
            if (doc.status === 'valid' || doc.status === 'verified') {
                status = 'valid';
            } else if (doc.status === 'rejected' || 
                      (expiryDate && expiryDate < new Date())) {
                status = 'expired';
            } else {
                status = 'pending';
            }
        }
        
        documentStatus.push({
            type,
            status,
            expiryDate,
            uploadDate: doc ? doc.uploadDate : null,
            url: doc ? doc.url : null
        });
    });
    
    return documentStatus;
}