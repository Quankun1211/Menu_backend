import mongoose from "mongoose";

const RefundSchema = new mongoose.Schema({
  transactionId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Transaction', 
    required: true 
  },
  amount: { 
    type: Number, 
    required: true 
  },
  reason: String,
  status: { 
    type: String, 
    enum: ['pending', 'completed', 'failed'], 
    default: 'pending' 
  },
  processedBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User'
  }
}, { timestamps: true });

const Refund = mongoose.model('Refund', RefundSchema);