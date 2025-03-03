const twilio = require('twilio');

// Initialize Twilio client with your credentials
const client = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
);

// Send test message
client.messages.create({
    body: 'This is a test message from your Twilio number!',
    to: '+17198591558',  // Your personal number
    from: '+17194092100'  // Your Twilio number
})
.then(message => console.log('Message sent! SID:', message.sid))
.catch(error => console.error('Error sending message:', error));