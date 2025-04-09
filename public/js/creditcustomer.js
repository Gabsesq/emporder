async function showCardDetails(cardId) {
    try {
        // Request new verification setup
        const response = await fetch('/api/request-verification', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ cardId })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to send verification code');
        }

        const data = await response.json();

        // Show QR code and secret in modal
        const modal = document.getElementById('verificationModal');
        modal.innerHTML = `
            <div class="modal-content">
                <h2>Two-Factor Authentication Required</h2>
                <p>Please scan this QR code with your authenticator app (Google Authenticator, Authy, etc.):</p>
                <img src="https://chart.googleapis.com/chart?chs=200x200&cht=qr&chl=${encodeURIComponent(data.otpauth_url)}" 
                     alt="QR Code"
                     style="margin: 20px auto; display: block;">
                <p class="text-center">Or enter this code manually in your authenticator app:</p>
                <code class="secret-code">${data.secret}</code>
                <div class="form-group">
                    <label for="verificationCode">Enter the 6-digit code from your authenticator app:</label>
                    <input type="text" 
                           id="verificationCode" 
                           maxlength="6" 
                           pattern="[0-9]*" 
                           inputmode="numeric"
                           autocomplete="off"
                           placeholder="Enter 6-digit code">
                </div>
                <div class="button-group">
                    <button onclick="verifyCode('${cardId}')" class="verify-btn">Verify</button>
                    <button onclick="closeVerificationModal()" class="cancel-btn">Cancel</button>
                </div>
            </div>
        `;
        modal.style.display = 'block';

    } catch (error) {
        console.error('Error requesting verification:', error);
        showMessage('error', error.message || 'Failed to setup verification. Please try again.', document.body);
    }
}

async function verifyCode(cardId) {
    const codeInput = document.getElementById('verificationCode');
    const code = codeInput.value.trim();
    
    if (!/^\d{6}$/.test(code)) {
        showMessage('error', 'Please enter a valid 6-digit code', document.body);
        return;
    }
    
    try {
        const response = await fetch('/api/verify-code', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ code, cardId })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Invalid verification code');
        }

        const data = await response.json();

        // Hide modal
        closeVerificationModal();
        
        // Show success message
        showMessage('success', 'Verification successful!', document.body);
        
        // Update the card details in the UI
        const cardDetails = document.querySelector(`[data-card-id="${cardId}"] .card-details`);
        if (cardDetails) {
            cardDetails.innerHTML = `
                <div class="sensitive-info">
                    <p><strong>Card Number:</strong> ${data.card_number}</p>
                    <p><strong>CVV:</strong> ${data.cvv}</p>
                    <p><strong>Expiry Date:</strong> ${data.expiry_date}</p>
                </div>
            `;
        }

    } catch (error) {
        console.error('Verification error:', error);
        showMessage('error', error.message || 'Failed to verify code. Please try again.', document.body);
    }
}

function closeVerificationModal() {
    const modal = document.getElementById('verificationModal');
    modal.style.display = 'none';
}

function showMessage(type, message, container) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `${type}-message`;
    messageDiv.textContent = message;
    
    // Remove any existing messages
    const existingMessages = container.querySelectorAll('.success-message, .error-message');
    existingMessages.forEach(msg => msg.remove());
    
    // Add new message at the top of the container
    container.insertBefore(messageDiv, container.firstChild);
    
    // Remove message after 5 seconds
    setTimeout(() => messageDiv.remove(), 5000);
} 