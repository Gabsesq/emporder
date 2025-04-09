document.addEventListener('DOMContentLoaded', async () => {
    const ccList = document.querySelector('.cc-list');
    const modal = document.getElementById('detailModal');
    const modalContent = document.getElementById('modalContent');
    const closeBtn = document.querySelector('.close-btn');

    // Close modal when clicking the close button
    closeBtn.onclick = () => {
        modal.style.display = 'none';
    };

    // Close modal when clicking outside
    window.onclick = (event) => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    };

    async function loadCreditCards() {
        try {
            const response = await fetch('/api/admin/cc-auth');
            if (!response.ok) {
                throw new Error('Failed to fetch credit cards');
            }

            const cards = await response.json();
            console.log('Received cards from server:', cards);
            
            ccList.innerHTML = cards.map(card => {
                console.log('Processing card:', card);
                
                // Format phone number if it exists
                const formatPhone = (phone) => {
                    if (!phone || phone === 'N/A') return 'N/A';
                    const cleaned = phone.replace(/\D/g, '');
                    if (cleaned.length !== 10) return phone;
                    return `(${cleaned.slice(0,3)}) ${cleaned.slice(3,6)}-${cleaned.slice(6)}`;
                };

                // Create a safe card object with default values
                const safeCard = {
                    id: card.id || 'N/A',
                    customer_id: card.customer_id || 'N/A',
                    customer_name: card.customer_name || 'N/A',
                    customer_type: card.customer_type || 'N/A',
                    description: card.description || 'N/A',
                    email: card.email || 'N/A',
                    phone: formatPhone(card.phone),
                    company: card.company || 'N/A',
                    address: card.address || 'N/A',
                    city: card.city || 'N/A',
                    state: card.state || 'N/A',
                    zip_code: card.zip_code || 'N/A',
                    country: card.country || 'N/A',
                    fax: card.fax || 'N/A',
                    card_number: card.card_number || 'N/A',
                    cvv: card.cvv || 'N/A',
                    expiry_date: card.expiry_date || 'N/A',
                    created_at: card.created_at || new Date().toISOString(),
                    shipping: card.shipping || null
                };

                // Preview card in the list
                return `
                    <div class="cc-item" onclick="showCardDetails(${JSON.stringify(safeCard).replace(/"/g, '&quot;')})">
                        <div class="cc-item-preview">
                            <div class="customer-info">
                                <h3>${safeCard.customer_name}</h3>
                                <p>${safeCard.email}</p>
                            </div>
                            <button class="view-details-btn" onclick="event.stopPropagation(); showCardDetails(${JSON.stringify(safeCard).replace(/"/g, '&quot;')})">
                                View
                            </button>
                        </div>
                    </div>`;
            }).join('');

        } catch (err) {
            console.error('Error loading credit cards:', err);
            ccList.innerHTML = '<p>Error loading credit card authorizations.</p>';
        }
    }

    // Load credit cards on page load
    await loadCreditCards();
});

// Function to show card details in modal
window.showCardDetails = async (card) => {
    const modalContent = document.getElementById('modalContent');
    const modal = document.getElementById('detailModal');

    // First, request verification code
    try {
        const response = await fetch('/api/request-verification', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                cardId: card.id,
                email: 'gabbye@petreleaf.com'
            })
        });

        if (!response.ok) {
            throw new Error('Failed to send verification code');
        }

        // Show verification input modal
        modalContent.innerHTML = `
            <div class="modal-section">
                <h3>Security Verification Required</h3>
                <p>A verification code has been sent to gabbye@petreleaf.com</p>
                <div class="form-group">
                    <label for="verificationCode">Enter Verification Code:</label>
                    <input type="text" id="verificationCode" maxlength="6" placeholder="Enter 6-digit code">
                </div>
                <button onclick="verifyAndShowDetails(${JSON.stringify(card).replace(/"/g, '&quot;')})" class="submit-btn">
                    Verify
                </button>
            </div>
        `;

        modal.style.display = 'block';

    } catch (error) {
        console.error('Error requesting verification:', error);
        alert('Failed to initiate verification. Please try again.');
    }
};

// Function to verify code and show details
window.verifyAndShowDetails = async (card) => {
    const verificationCode = document.getElementById('verificationCode').value.trim();
    
    if (!verificationCode) {
        alert('Please enter the verification code');
        return;
    }

    try {
        const response = await fetch('/api/verify-code', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                code: verificationCode,
                cardId: card.id
            })
        });

        if (!response.ok) {
            throw new Error('Invalid verification code');
        }

        // If verification successful, show card details
        const modalContent = document.getElementById('modalContent');
        modalContent.innerHTML = `
            <div class="modal-section">
                <h3>Customer Profile</h3>
                <p><strong>Business Name:</strong> ${card.business_name || card.company || 'N/A'}</p>
                <p><strong>Customer Name:</strong> ${card.customer_name}</p>
                <p><strong>Customer Type:</strong> ${card.customer_type}</p>
                <p><strong>Description:</strong> ${card.description}</p>
                <p><strong>Email:</strong> ${card.email}</p>
                <p><strong>Phone:</strong> ${card.phone}</p>
            </div>

            <div class="modal-section">
                <h3>Billing Information</h3>
                <p><strong>Address:</strong> ${card.address}</p>
                <p><strong>City:</strong> ${card.city}</p>
                <p><strong>State:</strong> ${card.state}</p>
                <p><strong>Zip Code:</strong> ${card.zip_code}</p>
                <p><strong>Country:</strong> ${card.country}</p>
                <p><strong>Fax:</strong> ${card.fax}</p>
            </div>

            <div class="modal-section">
                <h3>Payment Information</h3>
                <div class="sensitive-info">
                    <button class="reveal-btn" onclick="toggleSensitiveData(this, ${card.id})">
                        Show Hidden Numbers
                    </button>
                    <div class="card-details">
                        <p><strong>Card:</strong> 
                            <span class="masked-number">**** **** **** ${card.card_number.slice(-4)}</span>
                            <span class="full-number" style="display: none">${card.card_number}</span>
                        </p>
                        <p><strong>CVV:</strong> 
                            <span class="masked-cvv">***</span>
                            <span class="full-cvv" style="display: none">${card.cvv}</span>
                        </p>
                    </div>
                </div>
                <p><strong>Expiry:</strong> ${card.expiry_date}</p>
                <p><strong>Added:</strong> ${new Date(card.created_at).toLocaleDateString()}</p>
            </div>
            
            <button onclick="deleteCCAuth(${card.id})" class="delete-btn">Delete</button>
        `;

    } catch (error) {
        console.error('Verification error:', error);
        alert('Verification failed. Please try again.');
    }
};

// Delete CC Auth function
window.deleteCCAuth = async (id) => {
    if (!confirm('Are you sure you want to delete this credit card authorization?')) {
        return;
    }

    try {
        const response = await fetch(`/api/admin/cc-auth/${id}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            document.getElementById('detailModal').style.display = 'none';
            location.reload(); // Refresh the page to update the list
        } else {
            const error = await response.json();
            throw new Error(error.message || 'Failed to delete authorization');
        }
    } catch (err) {
        alert('Error deleting authorization: ' + err.message);
    }
};

// Toggle sensitive data visibility
window.toggleSensitiveData = (button, cardId) => {
    const container = button.closest('.sensitive-info');
    
    if (button.textContent === 'Show Hidden Numbers') {
        // Show the full numbers
        container.querySelectorAll('.masked-number, .masked-cvv').forEach(el => el.style.display = 'none');
        container.querySelectorAll('.full-number, .full-cvv').forEach(el => el.style.display = 'inline');
        button.textContent = 'Hide Numbers';

        // Auto-hide after 30 seconds
        setTimeout(() => {
            if (button.textContent === 'Hide Numbers') {
                container.querySelectorAll('.masked-number, .masked-cvv').forEach(el => el.style.display = 'inline');
                container.querySelectorAll('.full-number, .full-cvv').forEach(el => el.style.display = 'none');
                button.textContent = 'Show Hidden Numbers';
            }
        }, 30000);
    } else {
        // Hide the numbers
        container.querySelectorAll('.masked-number, .masked-cvv').forEach(el => el.style.display = 'inline');
        container.querySelectorAll('.full-number, .full-cvv').forEach(el => el.style.display = 'none');
        button.textContent = 'Show Hidden Numbers';
    }
};
