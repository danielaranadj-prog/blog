const admin = require('firebase-admin');

// Initialize Firebase Admin (Singleton pattern)
if (!admin.apps.length) {
    try {
        // Vercel Environment Variable: FIREBASE_SERVICE_ACCOUNT
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
    } catch (e) {
        console.error('Failed to initialize Firebase Admin:', e);
    }
}

const db = admin.firestore();

// Vercel Serverless Function Handler (Node.js)
module.exports = async (req, res) => {
    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const data = req.body;

        // Basic Validation
        if (!data.type || !data.path) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Write to Firestore securely
        await db.collection('analytics_events').add({
            type: data.type,
            path: data.path,
            title: data.title || 'Unknown',
            referrer: data.referrer || '',
            userAgent: req.headers['user-agent'] || 'Unknown',
            ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'Unknown',
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            screenSize: data.screenSize || 'Unknown'
        });

        return res.status(200).json({ message: "Event logged successfully" });

    } catch (error) {
        console.error('Analytics Error:', error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
};
