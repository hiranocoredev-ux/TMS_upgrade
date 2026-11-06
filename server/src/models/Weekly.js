import mongoose from "mongoose";
import { DEFAULT_USER_GROUP } from "../constants/groups.js";
import { SectionSchema } from "../schemas/reportSection.schema.js";

const WeeklySchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    username: {
        type: String,
        required: true
    },
    group: {
        type: String,
        default: DEFAULT_USER_GROUP,
        required: true
    },
    date: {
        type: Date,
        required: true
    },
    kind: {
        type: String,
        enum: ['report', 'plan'],
        default: 'report',
        required: true
    },
    sections: {
        type: [SectionSchema],
        default: []
    },
    state: {
        type: Number,
        default: 1
    },
    rejectReason: {
        type: String,
        default: '',
        maxlength: 2000
    }
}, { timestamps: true });

WeeklySchema.index({ userId: 1, date: 1, kind: 1 }, { unique: true });

const Weekly = mongoose.models.Weekly || mongoose.model("Weekly", WeeklySchema);
export default Weekly;
