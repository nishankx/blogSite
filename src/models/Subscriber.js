import mongoose from 'mongoose';

const subscriberSchema = new mongoose.Schema(
    {
        email: {
            type: String,
            required: [true, "Email is required"],
            unique: true,
            trim: true,
            lowercase: true,
            match: [
                /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                "Please provide a valid email address",
            ],
        },
        source: {
            type: String,
            default: "blog",
            trim: true,
        },
        status: {
            type: String,
            enum: ["active", "unsubscribed"],
            default: "active",
        },
        resendContactId: {
            type: String,
            default: null,
        },
    },
    { timestamps: true }
);

const Subscriber = mongoose.model("Subscriber", subscriberSchema);
export default Subscriber;
