const mongoose = require('mongoose');

const timeZoneCostSchema = new mongoose.Schema({
    date: {
        type: Date,
        required: true,
        unique: true
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

// Create an index on the date field for faster queries
timeZoneCostSchema.index({ date: 1 });

const TimeZoneCost = mongoose.model('TimeZoneCost', timeZoneCostSchema);

module.exports = TimeZoneCost;
