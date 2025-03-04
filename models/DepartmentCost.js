import mongoose from 'mongoose';

const departmentCostSchema = new mongoose.Schema({
    department: { type: String, required: true },
    totalCost: { type: Number, required: true }
});

const DepartmentCost = mongoose.model('DepartmentCost', departmentCostSchema);
export default DepartmentCost;
