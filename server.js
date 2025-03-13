import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import energyMonitoringRoutes from './routes/energyMonitoring.js'; // Import the new routes

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json()); 

app.use(cors());

// MongoDB Connection with more detailed error logging
mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log('MongoDB connected successfully');
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
  });

// Use the energy monitoring routes
app.use('/', energyMonitoringRoutes); // Register the energy monitoring routes


// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});