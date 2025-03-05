import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import energyMonitoringRoutes from './routes/energyMonitoring.js'; // Import the new routes

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware to parse JSON bodies
app.use(express.json()); // Add this line to parse JSON requests

// Enable CORS for the specified origin
app.use(cors());
// MongoDB Connection with more detailed error logging
mongoose.connect(process.env.MONGODB_URI)
.then(() => {
    console.log('MongoDB connected successfully');
})
.catch(err => {
    console.error('MongoDB connection error details:', {
        name: err.name,
        message: err.message,
        code: err.code,
        stack: err.stack
    });
});

// Use the energy monitoring routes
app.use(energyMonitoringRoutes);

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});