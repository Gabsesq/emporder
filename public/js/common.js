// Card validation functions
function validateCardNumber(number) {
    // Remove spaces and non-digits
    number = number.replace(/\D/g, '');
    
    // Check length
    if (number.length < 13 || number.length > 16) {
        return false;
    }

    // Check prefix
    const firstDigit = number.charAt(0);
    if (!['3', '4', '5', '6'].includes(firstDigit)) {
        return false;
    }

    return luhnCheck(number);
}

function validateCVV(cvv) {
    return /^[0-9]{3,4}$/.test(cvv);
}

function validateExpiryDate(expiry) {
    // Check format
    if (!/^\d{2}\/\d{2}$/.test(expiry)) {
        return false;
    }

    const [month, year] = expiry.split('/');
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear() % 100;
    const currentMonth = currentDate.getMonth() + 1;

    // Convert to numbers
    const expiryMonth = parseInt(month, 10);
    const expiryYear = parseInt(year, 10);

    // Validate month
    if (expiryMonth < 1 || expiryMonth > 12) {
        return false;
    }

    // Check if card is expired
    if (expiryYear < currentYear || 
        (expiryYear === currentYear && expiryMonth < currentMonth)) {
        return false;
    }

    return true;
}

function luhnCheck(val) {
    let sum = 0;
    let isEven = false;
    
    // Loop through values starting from the rightmost side
    for (let i = val.length - 1; i >= 0; i--) {
        let digit = parseInt(val[i], 10);

        if (isEven) {
            digit *= 2;
            if (digit > 9) {
                digit -= 9;
            }
        }

        sum += digit;
        isEven = !isEven;
    }
    
    return (sum % 10) === 0;
}

// Input formatting functions
function formatCardNumber(input) {
    let value = input.value.replace(/\D/g, '');
    let formatted = '';
    for (let i = 0; i < value.length; i++) {
        if (i > 0 && i % 4 === 0) {
            formatted += ' ';
        }
        formatted += value[i];
    }
    input.value = formatted.slice(0, 19);
}

function formatExpiryDate(input) {
    let value = input.value.replace(/\D/g, '');
    if (value.length >= 2) {
        value = value.slice(0, 2) + '/' + value.slice(2);
    }
    input.value = value.slice(0, 5);
}

function formatPhoneNumber(input) {
    let value = input.value.replace(/\D/g, '');
    if (value.length > 0) {
        if (value.length <= 3) {
            value = '(' + value;
        } else if (value.length <= 6) {
            value = '(' + value.slice(0, 3) + ') ' + value.slice(3);
        } else {
            value = '(' + value.slice(0, 3) + ') ' + value.slice(3, 6) + '-' + value.slice(6, 10);
        }
    }
    input.value = value;
}

// Message display function
function showMessage(type, message, formElement) {
    const existingMessage = formElement.querySelector(`.${type}-message`);
    if (existingMessage) {
        existingMessage.remove();
    }

    const messageDiv = document.createElement('div');
    messageDiv.className = `${type}-message`;
    messageDiv.innerHTML = `<p>${message}</p>`;
    formElement.insertBefore(messageDiv, formElement.firstChild);

    setTimeout(() => {
        messageDiv.remove();
    }, 5000);
} 