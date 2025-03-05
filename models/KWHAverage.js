import mongoose from 'mongoose';

const KWHAverageSchema = new mongoose.Schema({
    Date: {
        type: String, // Store date as a string in YYYY-MM-DD format
        required: true
    },
    avg_of_IF1: {
        type: Number, // Average KWH for Machine ID IF1
        required: false // Optional, as it may not be needed for all entries
    },
    avg_of_IF2: {
        type: Number, // Average KWH for Machine ID IF2
        required: false // Optional, as it may not be needed for all entries
    }
}, {
    timestamps: true // Automatically manage createdAt and updatedAt fields
});

// If you need an index, use only one method:
KWHAverageSchema.index({ Date: 1 });

const KWHAverage = mongoose.model('KWHAverage', KWHAverageSchema);

export default KWHAverage;