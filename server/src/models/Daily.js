import mongoose from "mongoose";
import { DEFAULT_USER_GROUP } from "../constants/groups.js";
import { SectionSchema } from "../schemas/reportSection.schema.js";

const DailySchema = new mongoose.Schema({
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

    /** `report` = work result for this period; `plan` = plan for this period anchor date. */
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

DailySchema.index({ userId: 1, date: 1, kind: 1 }, { unique: true });

const Daily = mongoose.models.Daily || mongoose.model("Daily", DailySchema);
export default Daily;
