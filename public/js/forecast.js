// Financial Forecasting Module
import { getAuth } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-auth.js";
import { getUserTransactions, getUserBankAccounts, getUserData } from "./firestoredb.js";

document.addEventListener('DOMContentLoaded', () => {
    const forecastSection = document.getElementById('forecast-section');
    if (!forecastSection) return;
    
    const auth = getAuth();
    let forecastData = null;
    
    // Initialize the forecast
    initForecast();
    
    // Listen for refresh events
    document.addEventListener('refreshFinancialHealth', () => {
        const user = auth.currentUser;
        if (user) generateForecast(user);
    });
    
    // Listen for dedicated forecast refresh events
    document.addEventListener('refreshForecast', () => {
        console.log('Forecast refresh event received');
        const user = auth.currentUser;
        if (user) generateForecast(user);
    });
    
    async function initForecast() {
        try {
            // Get the current user
            const user = auth.currentUser;
            if (!user) {
                // Wait for auth state to change
                const unsubscribe = auth.onAuthStateChanged(async (user) => {
                    if (user) {
                        unsubscribe();
                        await generateForecast(user);
                    }
                });
                return;
            }
            
            await generateForecast(user);
        } catch (error) {
            console.error('Error initializing forecast:', error);
            showError('Failed to initialize financial forecast');
        }
    }
    
    async function generateForecast(user) {
        try {
            showLoading();
            
            // Get transaction data
            const transactions = await getUserTransactions(user.uid) || [];
            const accounts = await getUserBankAccounts(user.uid) || [];
            
            // Get user profile data to access monthly income
            const userData = await getUserData(user.uid);
            const profileMonthlyIncome = userData?.financialProfile?.monthlyIncome || null;
            
            if (transactions.length === 0 || accounts.length === 0) {
                showEmpty();
                return;
            }
            
            // Analyze transaction patterns
            const analysis = analyzeTransactions(transactions, profileMonthlyIncome);
            
            // Generate 6-month forecast
            forecastData = generateSixMonthForecast(analysis, accounts);
            
            // Render the forecast
            renderForecast(forecastData, analysis);
        } catch (error) {
            console.error('Error generating forecast:', error);
            showError('Failed to generate financial forecast');
        }
    }
    
    function analyzeTransactions(transactions, profileMonthlyIncome) {
        // Group transactions by month
        const transactionsByMonth = {};
        const incomeByMonth = {};
        const expensesByMonth = {};
        const expenseCategories = {};
        
        transactions.forEach(t => {
            const date = new Date(t.date);
            const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`;
            
            // Initialize arrays if they don't exist
            if (!transactionsByMonth[monthKey]) transactionsByMonth[monthKey] = [];
            if (!incomeByMonth[monthKey]) incomeByMonth[monthKey] = 0;
            if (!expensesByMonth[monthKey]) expensesByMonth[monthKey] = 0;
            
            // Add transaction to month
            transactionsByMonth[monthKey].push(t);
            
            // Track income vs expense
            const amount = parseFloat(t.amount || 0);
            if (t.type === 'income') {
                incomeByMonth[monthKey] += amount;
            } else {
                expensesByMonth[monthKey] += Math.abs(amount);
                
                // Track expense by category
                const category = t.category || 'other';
                if (!expenseCategories[category]) expenseCategories[category] = 0;
                expenseCategories[category] += Math.abs(amount);
            }
        });
        
        // Calculate averages and trends
        const months = Object.keys(transactionsByMonth).sort();
        
        // If profile monthly income is available and there's no sufficient transaction data,
        // use the profile monthly income
        if (profileMonthlyIncome && (months.length < 2 || calculateAverageIncome(incomeByMonth, months) === 0)) {
            console.log('Using profile monthly income:', profileMonthlyIncome);
            
            // If there's at least one month of expense data, use it
            let avgExpenses = 0;
            if (months.length > 0) {
                const lastMonth = months[months.length - 1];
                avgExpenses = expensesByMonth[lastMonth] || 0;
            }
            
            return {
                avgIncome: parseFloat(profileMonthlyIncome),
                avgExpenses: avgExpenses,
                incomeTrend: 0,
                expenseTrend: 0,
                categories: expenseCategories,
                usingProfileIncome: true
            };
        }
        
        // Need at least 2 months of data for forecasting
        if (months.length < 2) {
            const lastMonth = months[months.length - 1];
            return {
                avgIncome: incomeByMonth[lastMonth] || 0,
                avgExpenses: expensesByMonth[lastMonth] || 0,
                incomeTrend: 0,
                expenseTrend: 0,
                categories: expenseCategories
            };
        }
        
        // Calculate average monthly income and expenses
        let totalIncome = 0;
        let totalExpenses = 0;
        months.forEach(month => {
            totalIncome += incomeByMonth[month] || 0;
            totalExpenses += expensesByMonth[month] || 0;
        });
        
        const avgIncome = totalIncome / months.length;
        const avgExpenses = totalExpenses / months.length;
        
        // If profile monthly income is higher than calculated average, prefer it
        // as it's likely more accurate (user might not record all income transactions)
        const finalAvgIncome = profileMonthlyIncome && profileMonthlyIncome > avgIncome ? 
            parseFloat(profileMonthlyIncome) : avgIncome;
        
        // Calculate trends (month-over-month change)
        const firstMonth = months[0];
        const lastMonth = months[months.length - 1];
        
        const incomeTrend = months.length > 1 
            ? ((incomeByMonth[lastMonth] || 0) - (incomeByMonth[firstMonth] || 0)) / (months.length - 1) 
            : 0;
            
        const expenseTrend = months.length > 1
            ? ((expensesByMonth[lastMonth] || 0) - (expensesByMonth[firstMonth] || 0)) / (months.length - 1)
            : 0;
        
        return {
            avgIncome: finalAvgIncome,
            avgExpenses,
            incomeTrend,
            expenseTrend,
            categories: expenseCategories,
            usingProfileIncome: profileMonthlyIncome && profileMonthlyIncome > avgIncome
        };
    }
    
    // Helper function to calculate average income
    function calculateAverageIncome(incomeByMonth, months) {
        if (!months || months.length === 0) return 0;
        
        let totalIncome = 0;
        months.forEach(month => {
            totalIncome += incomeByMonth[month] || 0;
        });
        
        return totalIncome / months.length;
    }
    
    function generateSixMonthForecast(analysis, accounts) {
        const currentBalance = accounts.reduce((sum, acc) => sum + parseFloat(acc.balance || 0), 0);
        const forecast = [];
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        
        let runningBalance = currentBalance;
        const today = new Date();
        const currentMonth = today.getMonth();
        const currentYear = today.getFullYear();
        
        // Generate forecast for the next 6 months
        for (let i = 0; i < 6; i++) {
            const month = (currentMonth + i) % 12;
            const year = currentYear + Math.floor((currentMonth + i) / 12);
            
            // Apply trends to calculate projected income and expenses
            const projectedIncome = analysis.avgIncome + (analysis.incomeTrend * i);
            const projectedExpenses = analysis.avgExpenses + (analysis.expenseTrend * i);
            const savings = projectedIncome - projectedExpenses;
            
            runningBalance += savings;
            
            forecast.push({
                month: months[month],
                year: year,
                income: projectedIncome,
                expenses: projectedExpenses,
                savings: savings,
                balance: runningBalance
            });
        }
        
        return forecast;
    }
    
    function renderForecast(forecast, analysis) {
        if (!forecastSection) return;
        
        // Create the forecast DOM
        const html = `
            <div class="forecast-container">
                <h3>6-Month Financial Forecast</h3>
                <div class="forecast-description">
                    <p>Based on your financial data, here's your projected financial situation for the next 6 months:</p>
                    ${analysis.usingProfileIncome ? 
                        `<p class="data-source-note"><i class="fas fa-info-circle"></i> This forecast includes your monthly income from your financial profile.</p>` : ''}
                </div>
                
                <div class="forecast-chart-container">
                    <canvas id="forecast-chart"></canvas>
                </div>
                
                <div class="forecast-table">
                    <table>
                        <thead>
                            <tr>
                                <th>Month</th>
                                <th>Income</th>
                                <th>Expenses</th>
                                <th>Savings</th>
                                <th>Balance</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${forecast.map(f => `
                                <tr>
                                    <td>${f.month} ${f.year}</td>
                                    <td class="value positive">₱${f.income.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                                    <td class="value negative">₱${f.expenses.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                                    <td class="value ${f.savings >= 0 ? 'positive' : 'negative'}">₱${f.savings.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                                    <td class="value ${f.balance >= 0 ? 'positive' : 'negative'}">₱${f.balance.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                
                <div class="forecast-insights">
                    <h4>Forecast Insights</h4>
                    <ul>
                        ${getForecastInsights(forecast)}
                    </ul>
                </div>
                
                <div class="forecast-actions">
                    <button id="refresh-forecast" class="action-button">
                        <i class="fas fa-sync-alt"></i> Refresh Forecast
                    </button>
                </div>
            </div>
        `;
        
        forecastSection.innerHTML = html;
        
        // Initialize chart
        initChart(forecast);
        
        // Add event listener for refresh button
        document.getElementById('refresh-forecast').addEventListener('click', () => {
            const user = auth.currentUser;
            if (user) generateForecast(user);
        });
    }
    
    function initChart(forecast) {
        const ctx = document.getElementById('forecast-chart');
        if (!ctx) return;
        
        const labels = forecast.map(f => `${f.month} ${f.year}`);
        const incomeData = forecast.map(f => f.income);
        const expensesData = forecast.map(f => f.expenses);
        const balanceData = forecast.map(f => f.balance);
        
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Balance',
                        data: balanceData,
                        backgroundColor: 'rgba(33, 150, 243, 0.1)',
                        borderColor: 'rgba(33, 150, 243, 1)',
                        tension: 0.4,
                        fill: true,
                        yAxisID: 'y1'
                    },
                    {
                        label: 'Income',
                        data: incomeData,
                        backgroundColor: 'transparent',
                        borderColor: 'rgba(16, 223, 111, 1)',
                        borderWidth: 2,
                        tension: 0.4,
                        fill: false
                    },
                    {
                        label: 'Expenses',
                        data: expensesData,
                        backgroundColor: 'transparent',
                        borderColor: 'rgba(233, 109, 31, 1)',
                        borderWidth: 2,
                        tension: 0.4,
                        fill: false
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                scales: {
                    y: {
                        beginAtZero: false,
                        grid: {
                            color: 'rgba(255, 255, 255, 0.05)'
                        },
                        ticks: {
                            color: 'rgba(255, 255, 255, 0.7)',
                            callback: value => '₱' + value.toLocaleString('en-US', {maximumFractionDigits: 0})
                        }
                    },
                    y1: {
                        position: 'right',
                        beginAtZero: false,
                        grid: {
                            display: false
                        },
                        ticks: {
                            color: 'rgba(33, 150, 243, 0.7)',
                            callback: value => '₱' + value.toLocaleString('en-US', {maximumFractionDigits: 0})
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
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            color: 'rgba(255, 255, 255, 0.7)',
                            usePointStyle: true,
                            pointStyle: 'circle'
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: context => {
                                const label = context.dataset.label || '';
                                const value = context.parsed.y;
                                return `${label}: ₱${value.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
                            }
                        }
                    }
                }
            }
        });
    }
    
    function getForecastInsights(forecast) {
        if (!forecast || forecast.length === 0) return '';
        
        const insights = [];
        
        // Balance trend
        const startBalance = forecast[0].balance;
        const endBalance = forecast[forecast.length - 1].balance;
        const balanceChange = endBalance - startBalance;
        const balanceChangePercent = (balanceChange / Math.abs(startBalance)) * 100;
        
        if (balanceChange > 0) {
            insights.push(`<li class="positive">
                <i class="fas fa-arrow-up"></i> 
                Your balance is projected to increase by ₱${balanceChange.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} (${balanceChangePercent.toFixed(1)}%) over the next 6 months.
            </li>`);
        } else {
            insights.push(`<li class="negative">
                <i class="fas fa-arrow-down"></i> 
                Your balance is projected to decrease by ₱${Math.abs(balanceChange).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} (${Math.abs(balanceChangePercent).toFixed(1)}%) over the next 6 months.
            </li>`);
        }
        
        // Savings trend
        const totalSavings = forecast.reduce((sum, f) => sum + f.savings, 0);
        if (totalSavings > 0) {
            insights.push(`<li class="positive">
                <i class="fas fa-piggy-bank"></i> 
                You're on track to save ₱${totalSavings.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} over the next 6 months.
            </li>`);
        } else {
            insights.push(`<li class="negative">
                <i class="fas fa-exclamation-triangle"></i> 
                You're projected to spend ₱${Math.abs(totalSavings).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} more than you earn over the next 6 months.
            </li>`);
        }
        
        // Monthly savings ratio
        const avgSavings = totalSavings / forecast.length;
        const lastMonthIncome = forecast[forecast.length - 1].income;
        const savingsRatio = (avgSavings / lastMonthIncome) * 100;
        
        if (savingsRatio > 20) {
            insights.push(`<li class="positive">
                <i class="fas fa-chart-pie"></i> 
                Your projected savings rate of ${savingsRatio.toFixed(1)}% is excellent.
            </li>`);
        } else if (savingsRatio > 0) {
            insights.push(`<li class="neutral">
                <i class="fas fa-chart-pie"></i> 
                Your projected savings rate of ${savingsRatio.toFixed(1)}% could be improved. Aim for 20% or higher.
            </li>`);
        } else {
            insights.push(`<li class="negative">
                <i class="fas fa-chart-pie"></i> 
                You're projected to have a negative savings rate. Try to reduce expenses or increase income.
            </li>`);
        }
        
        return insights.join('');
    }
    
    function showLoading() {
        if (!forecastSection) return;
        
        forecastSection.innerHTML = `
            <div class="loading-state">
                <div class="pulse-loader"></div>
                <p>Calculating your financial forecast...</p>
            </div>
        `;
    }
    
    function showEmpty() {
        if (!forecastSection) return;
        
        forecastSection.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-chart-line"></i>
                <h3>Insufficient Data for Forecast</h3>
                <p>We need more transaction history to create an accurate financial forecast.</p>
                <p>Please add transactions and check back later.</p>
            </div>
        `;
    }
    
    function showError(message) {
        if (!forecastSection) return;
        
        forecastSection.innerHTML = `
            <div class="error-state">
                <i class="fas fa-exclamation-circle"></i>
                <h3>Forecast Error</h3>
                <p>${message}</p>
                <button id="retry-forecast" class="action-button">
                    <i class="fas fa-redo"></i> Try Again
                </button>
            </div>
        `;
        
        document.getElementById('retry-forecast').addEventListener('click', () => {
            const user = auth.currentUser;
            if (user) generateForecast(user);
        });
    }
});

// Add CSS for the financial forecast section
const styles = `
    #forecast-section {
        padding: 1.5rem;
    }
    
    .forecast-container {
        background: rgba(255, 255, 255, 0.05);
        border-radius: 12px;
        padding: 1.5rem;
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.1);
    }
    
    .forecast-container h3 {
        font-size: 1.5rem;
        margin-bottom: 1rem;
        color: #ffffff;
    }
    
    .forecast-description {
        margin-bottom: 1.5rem;
        color: rgba(255, 255, 255, 0.7);
    }
    
    .data-source-note {
        background: rgba(33, 150, 243, 0.1);
        border-left: 3px solid rgba(33, 150, 243, 0.7);
        padding: 0.5rem 0.75rem;
        margin-top: 0.5rem;
        font-size: 0.9rem;
        border-radius: 0 4px 4px 0;
    }
    
    .data-source-note i {
        color: rgba(33, 150, 243, 1);
        margin-right: 0.5rem;
    }
    
    .forecast-chart-container {
        margin-bottom: 2rem;
        height: 300px;
    }
    
    .forecast-table {
        width: 100%;
        overflow-x: auto;
        margin-bottom: 1.5rem;
    }
    
    .forecast-table table {
        width: 100%;
        border-collapse: collapse;
    }
    
    .forecast-table th {
        background: rgba(255, 255, 255, 0.1);
        padding: 0.75rem;
        text-align: left;
        font-weight: 500;
        color: rgba(255, 255, 255, 0.9);
    }
    
    .forecast-table td {
        padding: 0.75rem;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        color: rgba(255, 255, 255, 0.7);
    }
    
    .forecast-table .value {
        font-family: monospace;
        font-weight: 600;
    }
    
    .forecast-table .positive {
        color: #10df6f;
    }
    
    .forecast-table .negative {
        color: #e96d1f;
    }
    
    .forecast-insights {
        background: rgba(255, 255, 255, 0.05);
        border-radius: 8px;
        padding: 1rem;
        margin-bottom: 1.5rem;
    }
    
    .forecast-insights h4 {
        margin-bottom: 0.75rem;
        color: #ffffff;
    }
    
    .forecast-insights ul {
        list-style-type: none;
        padding: 0;
    }
    
    .forecast-insights li {
        padding: 0.5rem 0;
        display: flex;
        align-items: center;
    }
    
    .forecast-insights li i {
        margin-right: 0.5rem;
    }
    
    .forecast-insights .positive {
        color: #10df6f;
    }
    
    .forecast-insights .negative {
        color: #e96d1f;
    }
    
    .forecast-insights .neutral {
        color: #ffcc00;
    }
    
    .forecast-actions {
        display: flex;
        justify-content: flex-end;
    }
    
    .loading-state,
    .empty-state,
    .error-state {
        text-align: center;
        padding: 3rem 1rem;
        background: rgba(255, 255, 255, 0.02);
        border-radius: 12px;
        color: rgba(255, 255, 255, 0.7);
    }
    
    .loading-state i,
    .empty-state i,
    .error-state i {
        font-size: 3rem;
        margin-bottom: 1rem;
        opacity: 0.5;
    }
    
    .empty-state h3,
    .error-state h3 {
        margin-bottom: 1rem;
        color: #ffffff;
    }
    
    .pulse-loader {
        width: 60px;
        height: 60px;
        border-radius: 50%;
        background: rgba(33, 150, 243, 0.2);
        margin: 0 auto 1rem;
        position: relative;
    }
    
    .pulse-loader:after {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        border-radius: 50%;
        box-shadow: 0 0 0 0 rgba(33, 150, 243, 1);
        animation: pulse 1.5s infinite;
    }
    
    @keyframes pulse {
        0% {
            box-shadow: 0 0 0 0 rgba(33, 150, 243, 0.7);
        }
        70% {
            box-shadow: 0 0 0 15px rgba(33, 150, 243, 0);
        }
        100% {
            box-shadow: 0 0 0 0 rgba(33, 150, 243, 0);
        }
    }
`;

// Add styles to document
const styleSheet = document.createElement("style");
styleSheet.type = "text/css";
styleSheet.textContent = styles;
document.head.appendChild(styleSheet);
