import mongoose from 'mongoose';

const timeZoneCostSchema = new mongoose.Schema({
    date: {
        type: Date,
        required: true
    },
    zoneA: {
        type: Number,
        required: true,
        default: 0
    },
    zoneB: {
        type: Number,
        required: true,
        default: 0
    },
    zoneC: {
        type: Number,
        required: true,
        default: 0
    },
    zoneD: {
        type: Number,
        required: true,
        default: 0
    }
}, {
    timestamps: true
});

// If you need an index, use only one method:
timeZoneCostSchema.index({ date: 1 });

const TimeZoneCost = mongoose.model('TimeZoneCost', timeZoneCostSchema);

export default TimeZoneCost;
