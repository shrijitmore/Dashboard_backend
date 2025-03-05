import mongoose from 'mongoose';

const DailyPFTrendSchema = new mongoose.Schema({
    Date: {
        type: String,
        required: true
    },
    Departments: {
        type: Map,
        of: {
            type: Map,
            of: {
                type: Map,
                of: {
                    PowerFactor: Number,
                    consumption: Number
                }
            }
        }
    }
});

const DailyPFTrend = mongoose.model('DailyPFTrend', DailyPFTrendSchema);

export default DailyPFTrend;
