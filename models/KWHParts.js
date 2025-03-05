import mongoose from 'mongoose';

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

const KWHParts = mongoose.model('KWHParts', KWHPartsSchema);

export default KWHParts;
