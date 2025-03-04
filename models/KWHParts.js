const mongoose = require('mongoose');

const KWHPartsSchema = new mongoose.Schema({
    date: {
        type: Date,
        required: true
    },
    machineData: {
        type: Map,
        of: Number // This allows for dynamic keys (machine IDs) with numeric values
    }
});

// Export the model
module.exports = mongoose.model('KWHParts', KWHPartsSchema);
