import mongoose from "mongoose";
const TransactionSchema = new mongoose.Schema({
  orderId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Order', 
    required: true,
    unique: true 
  },
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  amount: { 
    type: Number, 
    required: true, 
    min: 0 
  },
  currency: { 
    type: String, 
    default: 'VND' 
  },
  paymentMethod: { 
    type: String, 
    enum: ['vnpay', 'momo', 'stripe', 'cod', 'wallet'], 
    required: true 
  },
  status: { 
    type: String, 
    enum: ['pending', 'processing', 'completed', 'failed', 'refunded'], 
    default: 'pending' 
  },
  gatewayDetails: {
    transactionId: String, 
    responseCode: String,  
    payDate: Date,
    bankCode: String,
    rawLog: Object      
  },
  description: String,
  ipAddress: String,
}, { timestamps: true });

TransactionSchema.index({ 'gatewayDetails.transactionId': 1 });
TransactionSchema.index({ status: 1 });

export const Transaction = mongoose.model('Transaction', TransactionSchema);