// Ensure the API key is defined
import { GEMINI_API_KEY, GEMINI_MODEL } from "./config.js";

// Initialize the chatbot
document.addEventListener('DOMContentLoaded', () => {
    const chatbotToggle = document.getElementById('chatbotToggle');
    const chatbotWindow = document.getElementById('chatbotWindow');
    const closeChatbot = document.getElementById('closeChatbot');
    const sendMessage = document.getElementById('sendMessage');
    const userInput = document.getElementById('userInput');
    const chatMessages = document.getElementById('chatMessages');

    // FAQ suggestions to add
    const faqSuggestions = [
        "How can I start investing?",
        "What are your security features?",
        "How does AI improve my banking?",
        "Tell me about savings plans"
    ];

    console.log('Chatbot elements initialized:', {
        chatbotToggle,
        chatbotWindow,
        closeChatbot,
        sendMessage,
        userInput,
        chatMessages
    });

    // Toggle chatbot window with animation
    chatbotToggle.addEventListener('click', () => {
        console.log('Chatbot toggle clicked');
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
        console.log('Chatbot close clicked');
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

    // Add message to chat
    function addMessage(sender, text) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message', `${sender}-message`);
        
        // Always use innerHTML with line break handling to support formatted text
        messageElement.innerHTML = text.replace(/\n/g, '<br>');
        
        chatMessages.appendChild(messageElement);
        messageElement.style.opacity = '0';
        messageElement.style.transform = 'translateY(20px)';
        
        // Apply animations
        setTimeout(() => {
            messageElement.style.opacity = '1';
            messageElement.style.transform = 'translateY(0)';
        }, 10);
    }

    // Add suggestion buttons
    function addSuggestions() {
        const suggestionsContainer = document.createElement('div');
        suggestionsContainer.classList.add('suggestions-container');
        
        faqSuggestions.forEach(suggestion => {
            const button = document.createElement('button');
            button.classList.add('suggestion-button');
            button.textContent = suggestion;
            
            button.addEventListener('click', () => {
                addMessage('user', suggestion);
                getAIResponse(suggestion);
            });
            
            suggestionsContainer.appendChild(button);
        });
        
        chatMessages.appendChild(suggestionsContainer);
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

    // Get AI response
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
            
            // Use the model from config
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ text: message }]
                    }],
                    generationConfig: {
                        temperature: 0.2,
                        maxOutputTokens: 800
                    }
                })
            });
            
            // Remove loading indicator without scrolling
            loadingMessage.remove();
            
            const data = await response.json();
            console.log('API Response:', data); // Log the full response for debugging
            
            // Check for error in response
            if (data.error) {
                console.error('API Error:', data.error);
                addMessage('bot', `Error: ${data.error.message}`);
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
            addMessage('bot', `Error: ${error.message || 'Something went wrong. Please try again later.'}`);
        }
    }

    // Add event listener for Enter key in the input field
    userInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendUserMessage();
        }
    });

    // Welcome message
    setTimeout(() => {
        addMessage('bot', 'Hello! I\'m your AI financial assistant. How can I help with your banking and investment needs today?');
        setTimeout(() => {
            addSuggestions();
        }, 500);
    }, 1000);
});
