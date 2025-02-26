require('dotenv').config();
const twilio = require('twilio');

const client = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
);

// List of service SIDs to delete
const servicesToDelete = [
    'MG60fce31de645406c76fed19d2082d207'  // Sole Proprietor service
];

// Keep this one
const keepService = 'MG1aec42797c674cb8a059891a70d5c1'; // OrderVerification

async function cleanup() {
    for (const sid of servicesToDelete) {
        try {
            await client.messaging.services(sid).remove();
            console.log(`Successfully deleted service: ${sid}`);
        } catch (err) {
            console.error(`Error deleting service ${sid}:`, err.message);
        }
    }
}

cleanup().then(() => {
    console.log('Cleanup complete');
    process.exit(0);
}).catch(err => {
    console.error('Cleanup failed:', err);
    process.exit(1);
}); 