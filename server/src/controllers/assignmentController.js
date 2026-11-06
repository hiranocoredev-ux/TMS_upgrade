import { z } from 'zod';
import Assignment from '../models/Assignment.js';
import { createErrorResponse, createSuccessResponse } from '../utils/errors.js';
import { log as auditLog, getRequestMeta } from '../utils/audit.js';
import { normalizeRole, ROLES } from '../utils/roleMapper.js';
import { ENTITY_GROUP_VALUES } from '../constants/groups.js';

/* ------------------ Validation Schemas ------------------ */

const createAssignmentSchema = z.object({
    title: z.string().min(1).max(200),
    description: z.string().optional(),
    collaborator: z.string().optional(),
    performanceType: z.string().optional(),
    currencyAmount: z.number().optional(),
    currencyCode: z.string().optional(),
    payMethod: z.string().optional(),
    note: z.string().optional(),
    group: z.enum(ENTITY_GROUP_VALUES).optional()
});

const updateAssignmentSchema = createAssignmentSchema.partial().extend({
    status: z.enum(['progressing', 'completed']).optional(),
    group: z.enum(ENTITY_GROUP_VALUES).optional()
});

/* ------------------ Helpers ------------------ */

const isAdminOrBoss = (user) => {
    const role = normalizeRole(user.role);
    return role === ROLES.ADMIN || role === ROLES.BOSS || role === ROLES.SUPER_ADMIN;
};

const isOwner = (user, assignment) =>
    assignment.ownerUserId.toString() === user._id.toString();

const pushActivityLog = (assignment, action, summary, oldValue, newValue) => {
    assignment.activityLogs.push({
        action,
        summary,
        oldValue,
        newValue
    });
};

/* ------------------ Controllers ------------------ */

// GET /assignments
// export const listAssignments = async (req, res, next) => {
//     try {
//         const user = req.user;

//         const query = isAdminOrBoss(user)
//             ? {}
//             : { ownerUserId: user._id };

//         const assignments = await Assignment.find(query)
//             .populate('ownerUserId', 'name email')
//             .sort({ createdAt: -1 })
//             .lean();

//         res.json(createSuccessResponse({ assignments }));
//     } catch (error) {
//         next(error);
//     }
// };
// GET /assignments
// export const listAssignments = async (req, res, next) => {
//     try {
//         const user = req.user;
//         const role = normalizeRole(user.role);

//         const {
//             search,
//             status,
//             currency,
//             payMethod,
//             user: userId,
//             from,
//             to
//         } = req.query;

//         const query = {};

//         // 🔐 Ownership rule
//         if (!isAdminOrBoss(user)) {
//             query.ownerUserId = user._id;
//         } else if (userId) {
//             query.ownerUserId = userId;
//         }

//         // 🔍 Search (title + description)
//         if (search) {
//             query.$or = [
//                 { title: { $regex: search, $options: 'i' } },
//                 { description: { $regex: search, $options: 'i' } }
//             ];
//         }

//         // 🎛 Status filter
//         if (status) {
//             query.status = status;
//         }

//         // 🎛 Admin-only filters
//         if (isAdminOrBoss(user)) {
//             if (currency) query.currencyCode = currency;
//             if (payMethod) query.payMethod = payMethod;
//         }

//         // 📅 completedAt date range
//         if (from || to) {
//             query.completedAt = {};
//             if (from) query.completedAt.$gte = new Date(from);
//             if (to) query.completedAt.$lte = new Date(to);
//         }

//         const assignments = await Assignment.find(query)
//             .populate('ownerUserId', 'name email')
//             .sort({ createdAt: -1 })
//             .lean();

//         res.json(createSuccessResponse({ assignments }));
//     } catch (error) {
//         next(error);
//     }
// };
export const listAssignments = async (req, res, next) => {
    try {
      const user = req.user;
  
      const {
        search,
        status,
        group,
        currency,
        payMethod,
        user: userId,
        from,
        to,
        page = 1,
        limit = 10
      } = req.query;
  
      const pageNum = Math.max(parseInt(page), 1);
      const limitNum = Math.min(parseInt(limit), 50);
      const skip = (pageNum - 1) * limitNum;
  
      const query = {};
  
      // 🔐 ownership
      if (!isAdminOrBoss(user)) {
        query.ownerUserId = user._id;
      } else if (userId) {
        query.ownerUserId = userId;
      }
  
      // 🔍 search
      if (search) {
        query.$or = [
          { title: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } }
        ];
      }
  
      // 🎛 filters
      if (status) query.status = status;
      if (group) query.group = group;
      if (isAdminOrBoss(user)) {
        if (currency) query.currencyCode = currency;
        if (payMethod) query.payMethod = payMethod;
      }
  
      // 📅 completed date
      if (from || to) {
        query.completedAt = {};
        if (from) query.completedAt.$gte = new Date(from);
        if (to) query.completedAt.$lte = new Date(to);
      }
  
      const [assignments, total] = await Promise.all([
        Assignment.find(query)
          .populate('ownerUserId', 'name email')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limitNum)
          .lean(),
  
        Assignment.countDocuments(query)
      ]);
  
      const totalPages = Math.ceil(total / limitNum);
  
      res.json(
        createSuccessResponse({
          assignments,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            totalPages,
            hasNext: pageNum < totalPages,
            hasPrev: pageNum > 1
          }
        })
      );
    } catch (error) {
      next(error);
    }
  };
// GET /assignments/:id
export const getAssignmentById = async (req, res, next) => {
    try {
        const assignment = await Assignment.findById(req.params.id);

        if (!assignment) {
            return res.status(404).json(
                createErrorResponse('NOT_FOUND', 'Assignment not found', 404)
            );
        }

        if (!isOwner(req.user, assignment) && !isAdminOrBoss(req.user)) {
            return res.status(403).json(
                createErrorResponse('ACCESS_DENIED', 'You cannot view this assignment', 403)
            );
        }

        res.json(createSuccessResponse({ assignment }));
    } catch (error) {
        next(error);
    }
};

// POST /assignments
export const createAssignment = async (req, res, next) => {
    try {
        const data = createAssignmentSchema.parse(req.body);

        const assignment = new Assignment({
            ...data,
            ownerUserId: req.user._id
        });

        pushActivityLog(
            assignment,
            'CREATED',
            'Assignment created',
            null,
            { title: data.title }
        );

        await assignment.save();

        await auditLog(req, 'ASSIGNMENT_CREATE', 'ASSIGNMENT', assignment._id.toString(), {
            ...getRequestMeta(req),
            assignment: { title: assignment.title }
        });

        res.status(201).json(
            createSuccessResponse({ assignment }, 'Assignment created')
        );
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json(
                createErrorResponse('VALIDATION_ERROR', error.errors[0].message, 400)
            );
        }
        next(error);
    }
};

// PUT /assignments/:id
export const updateAssignment = async (req, res, next) => {
    try {
        const assignment = await Assignment.findById(req.params.id);

        console.log("this is assignment: ", assignment)
        if (!assignment) {
            return res.status(404).json(
                createErrorResponse('NOT_FOUND', 'Assignment not found', 404)
            );
        }

        if (!isOwner(req.user, assignment)) {
            return res.status(403).json(
                createErrorResponse('ACCESS_DENIED', 'Only owner can edit assignment', 403)
            );
        }

        // inside updateAssignment controller, after ownership check

        const data = updateAssignmentSchema.parse(req.body);

        // Handle status change explicitly
        if (data.status && data.status !== assignment.status) {
            const oldStatus = assignment.status;

            assignment.status = data.status;

            if (data.status === 'completed') {
                assignment.completedAt = new Date();
            }

            if (oldStatus === 'completed' && data.status === 'progressing') {
                assignment.completedAt = null;
            }

            assignment.activityLogs.push({
                action: 'UPDATED_STATUS',
                summary: `Status changed from ${oldStatus} to ${data.status}`,
                oldValue: oldStatus,
                newValue: data.status
            });

            delete data.status;
        }

        Object.entries(data).forEach(([key, value]) => {
            const oldValue = assignment[key];
            assignment[key] = value;

            if (oldValue !== value) {
                pushActivityLog(
                    assignment,
                    'UPDATED',
                    `Updated ${key}`,
                    oldValue,
                    value
                );
            }
        });

        await assignment.save();

        await auditLog(req, 'ASSIGNMENT_UPDATE', 'ASSIGNMENT', assignment._id.toString(), {
            ...getRequestMeta(req)
        });

        res.json(createSuccessResponse({ assignment }, 'Assignment updated'));
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json(
                createErrorResponse('VALIDATION_ERROR', error.errors[0].message, 400)
            );
        }
        next(error);
    }
};

// GET /assignments/earnings/summary
export const getEarningSummary = async (req, res, next) => {
    try {
        const user = req.user;
        const { from, to } = req.query;

        const match = {
            status: 'completed',
            completedAt: { $ne: null },
            currencyAmount: { $gt: 0 }
        };

        if (from || to) {
            match.completedAt = {};
            if (from) match.completedAt.$gte = new Date(from);
            if (to) match.completedAt.$lte = new Date(to);
        }

        // Members: only their own earnings
        if (!isAdminOrBoss(user)) {
            match.ownerUserId = user._id;
        }

        const pipeline = [
            { $match: match },

            {
                $group: {
                    _id: {
                        ownerUserId: '$ownerUserId',
                        currencyCode: '$currencyCode'
                    },
                    totalAmount: { $sum: '$currencyAmount' },
                    taskCount: { $sum: 1 }
                }
            },

            {
                $group: {
                    _id: '$_id.ownerUserId',
                    earnings: {
                        $push: {
                            currencyCode: '$_id.currencyCode',
                            totalAmount: '$totalAmount',
                            taskCount: '$taskCount'
                        }
                    }
                }
            },

            {
                $lookup: {
                    from: 'users',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'user'
                }
            },
            { $unwind: '$user' },

            // final shape
            {
                $project: {
                    _id: 0,
                    ownerUserId: '$_id',
                    user: {
                        name: '$user.name',
                        email: '$user.email'
                    },
                    earnings: 1
                }
            }
        ];

        const summary = await Assignment.aggregate(pipeline);

        res.json(
            createSuccessResponse({
                summary,
                period: {
                    from: from || null,
                    to: to || null
                }
            })
        );
    } catch (error) {
        next(error);
    }
};
// GET /assignments/earnings/trend
export const getEarningTrend = async (req, res, next) => {
    try {
        const user = req.user;
        const { from, to, groupBy = 'month' } = req.query;

        const dateFormatMap = {
            day: '%Y-%m-%d',
            month: '%Y-%m',
            year: '%Y'
        };

        const dateFormat = dateFormatMap[groupBy] || '%Y-%m';

        const match = {
            status: 'completed',
            currencyAmount: { $gt: 0 }
        };

        if (from || to) {
            match.updatedAt = {};
            if (from) match.updatedAt.$gte = new Date(from);
            if (to) match.updatedAt.$lte = new Date(to);
        }

        // Members → only own data
        if (!isAdminOrBoss(user)) {
            match.ownerUserId = user._id;
        }

        const pipeline = [
            { $match: match },

            {
                $group: {
                    _id: {
                        period: {
                            $dateToString: {
                                format: dateFormat,
                                date: '$completedAt'
                            }
                        },
                        ownerUserId: '$ownerUserId',
                        currencyCode: '$currencyCode'
                    },
                    totalAmount: { $sum: '$currencyAmount' },
                    taskCount: { $sum: 1 }
                }
            },

            {
                $group: {
                    _id: {
                        period: '$_id.period',
                        currencyCode: '$_id.currencyCode',
                        ownerUserId: '$_id.ownerUserId'
                    },
                    totalAmount: { $sum: '$totalAmount' },
                    taskCount: { $sum: '$taskCount' }
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: '_id.ownerUserId',
                    foreignField: '_id',
                    as: 'user'
                }
            },
            { $unwind: '$user' },
            {
                $project: {
                    _id: 0,
                    period: '$_id.period',
                    ownerUserId: '$_id.ownerUserId',
                    currencyCode: '$_id.currencyCode',
                    totalAmount: 1,
                    taskCount: 1,
                    user: {
                        name: '$user.name',
                        email: '$user.email'
                    }
                }
            },

            { $sort: { period: 1 } }
        ];

        const trend = await Assignment.aggregate(pipeline);

        res.json(
            createSuccessResponse({
                trend,
                groupBy,
                period: {
                    from: from || null,
                    to: to || null
                }
            })
        );
    } catch (error) {
        next(error);
    }
};


// DELETE /assignments/:id
export const deleteAssignment = async (req, res, next) => {
    try {
        const assignment = await Assignment.findById(req.params.id);

        if (!assignment) {
            return res.status(404).json(
                createErrorResponse('NOT_FOUND', 'Assignment not found', 404)
            );
        }

        if (!isOwner(req.user, assignment)) {
            return res.status(403).json(
                createErrorResponse('ACCESS_DENIED', 'Only owner can delete assignment', 403)
            );
        }

        await assignment.deleteOne();

        await auditLog(req, 'ASSIGNMENT_DELETE', 'ASSIGNMENT', assignment._id.toString(), {
            ...getRequestMeta(req)
        });

        res.json(createSuccessResponse(null, 'Assignment deleted'));
    } catch (error) {
        next(error);
    }
};
