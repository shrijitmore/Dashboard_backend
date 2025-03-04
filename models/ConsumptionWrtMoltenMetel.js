import mongoose from 'mongoose';

const ConsumptionWrtMoltenMetalSchema = new mongoose.Schema({
    date: {
        type: Date,
        required: true
    },
    sum_of_moltenmetal: {
        type: Number,
        required: true
    },
    sum_of_consumtion: {
        type: Number,
        required: true
    }
});

// Export the model
const ConsumptionWrtMoltenMetal = mongoose.model('ConsumptionWrtMoltenMetal', ConsumptionWrtMoltenMetalSchema);
export default ConsumptionWrtMoltenMetal;
