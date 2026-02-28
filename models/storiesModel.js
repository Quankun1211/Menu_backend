import mongoose from "mongoose";

const storiesSchema = new mongoose.Schema({
    title: {
        type: String,
        require: true
    },
    slug: {
        type: String,
        require: true
    },
    content: {
        type: String,
        require: true,
        minlength: 6
    },
    images: {
        type: String,
        require: true
    },
    region: {
        type: String,
        default: "user"
    }, 
    relatedProducts: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product"
    },
}, {timestamps: true})

export const Story = mongoose.model("Story", storiesSchema)