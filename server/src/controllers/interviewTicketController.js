// import { z } from 'zod';
// import InterviewBoard from '../models/InterviewBoard.js';
// import InterviewStage from '../models/InterviewStage.js';
// import InterviewTicket from '../models/InterviewTicket.js';
// import InterviewActivityLog from '../models/InterviewActivityLog.js';
// import { createErrorResponse, createSuccessResponse } from '../utils/errors.js';
// import { log as auditLog, getRequestMeta } from '../utils/audit.js';
// import { normalizeRole, ROLES } from '../constants/roles.js';

// /* --------------------------------------------------
//  Helpers
// -------------------------------------------------- */

// const toDayString = (date) =>
//   new Date(date).toISOString().split('T')[0];

// const normalizeDates = (dates = []) =>
//   dates.map(d => ({
//     ...d,
//     scheduledAt: new Date(d.scheduledAt),
//     scheduledDay: toDayString(d.scheduledAt)
//   }));

// const canAccessBoard = async (user, board) => {
//   const role = normalizeRole(user.role);
//   if (role === ROLES.SUPER_ADMIN) return true;
//   if (board.ownerUserId.equals(user._id)) return true;

//   if (board.visibility === 'team') {
//     return [ROLES.ADMIN, ROLES.MEMBER].includes(role);
//   }

//   if (board.visibility === 'shared') {
//     return board.sharedWith?.some(id => id.equals(user._id));
//   }

//   return false;
// };

// const canEditTicket = async (user, board) => {
//   if (normalizeRole(user.role) === ROLES.SUPER_ADMIN) return true;
//   if (board.ownerUserId.equals(user._id)) return true;
//   return canAccessBoard(user, board);
// };

// const loadBoard = async (req) => {
//   const board = await InterviewBoard.findById(req.params.boardId);
//   if (!board) {
//     throw createErrorResponse('NOT_FOUND', 'Interview board not found', 404);
//   }
//   if (!(await canAccessBoard(req.user, board))) {
//     throw createErrorResponse('ACCESS_DENIED', 'Access denied', 403);
//   }
//   return board;
// };

// const logActivity = async (req, ticket, actionType, diff, description) => {
//   try {
//     await InterviewActivityLog.create({
//       ticketId: ticket._id,
//       boardId: ticket.boardId,
//       actorUserId: req.user._id,
//       actionType,
//       diff,
//       description
//     });
//   } catch (err) {
//     console.error('Activity log failed:', err);
//   }
// };

// /* --------------------------------------------------
//  Validation
// -------------------------------------------------- */

// const dateSchema = z.object({
//   scheduledAt: z.union([z.string().datetime(), z.date()]),
//   durationMinutes: z.number().int().positive().optional(),
//   interviewType: z.enum(['phone', 'video', 'onsite', 'assessment', 'other']).optional(),
//   meetingLink: z.string().optional(),
//   platform: z.string().optional(),
//   participants: z.string().optional(),
//   status: z.enum(['scheduled', 'completed', 'cancelled', 'rescheduled']).optional(),
//   notes: z.string().optional(),
//   outcome: z.enum(['pending', 'passed', 'failed', 'cancelled']).optional()
// });

// const ticketSchema = z.object({
//   stageId: z.string(),
//   jobProfileId: z.string().optional(),
//   companyName: z.string().min(1),
//   position: z.string().min(1),
//   candidateName: z.string().optional(),
//   dates: z.array(dateSchema).optional(),
//   notes: z.string().optional(),
//   attachments: z.array(z.string()).optional(),
//   tags: z.array(z.string()).optional(),
//   priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
//   status: z.enum(['active', 'completed', 'cancelled', 'on_hold']).optional(),
//   dueDate: z.union([z.string().datetime(), z.date()]).optional(),
//   metadata: z.any().optional()
// });

// /* --------------------------------------------------
//  Controllers
// -------------------------------------------------- */

// export const listTickets = async (req, res, next) => {
//   try {
//     await loadBoard(req);

//     const tickets = await InterviewTicket.find({
//       boardId: req.params.boardId
//     })
//       .populate('stageId', 'name order color')
//       .populate('ownerUserId', 'name email')
//       .populate('jobProfileId', 'name email')
//       .sort({ createdAt: -1 })
//       .lean();

//     res.json(createSuccessResponse({ tickets }));
//   } catch (err) {
//     next(err);
//   }
// };

// export const getTicket = async (req, res, next) => {
//   try {
//     await loadBoard(req);

//     const ticket = await InterviewTicket.findOne({
//       _id: req.params.id,
//       boardId: req.params.boardId
//     })
//       .populate('stageId', 'name order color')
//       .populate('ownerUserId', 'email name')
//       .populate('jobProfileId', 'name email')
//       .populate('attachments');

//     if (!ticket) {
//       return res.status(404).json(createErrorResponse(
//         'NOT_FOUND',
//         'Ticket not found',
//         404
//       ));
//     }

//     res.json(createSuccessResponse({ ticket }));
//   } catch (err) {
//     next(err);
//   }
// };

// export const createTicket = async (req, res, next) => {
//   try {
//     const board = await loadBoard(req);
//     if (!(await canEditTicket(req.user, board))) {
//       return res.status(403).json(createErrorResponse(
//         'ACCESS_DENIED',
//         'No permission',
//         403
//       ));
//     }

//     const data = ticketSchema.parse(req.body);

//     const stage = await InterviewStage.findOne({
//       _id: data.stageId,
//       boardId: board._id
//     });

//     if (!stage) {
//       return res.status(404).json(createErrorResponse(
//         'NOT_FOUND',
//         'Stage not found',
//         404
//       ));
//     }

//     const ticket = await InterviewTicket.create({
//       ...data,
//       boardId: board._id,
//       ownerUserId: req.user._id,
//       dates: normalizeDates(data.dates || []),
//       primaryDateIndex: 0
//     });

//     await logActivity(req, ticket, 'TICKET_CREATE', {}, 'Ticket created');

//     res.status(201).json(createSuccessResponse({ ticket }));
//   } catch (err) {
//     if (err instanceof z.ZodError) {
//       return res.status(400).json(createErrorResponse(
//         'VALIDATION_ERROR',
//         err.errors[0].message,
//         400
//       ));
//     }
//     next(err);
//   }
// };

// export const updateTicket = async (req, res, next) => {
//   try {
//     const board = await loadBoard(req);
//     if (!(await canEditTicket(req.user, board))) {
//       return res.status(403).json(createErrorResponse(
//         'ACCESS_DENIED',
//         'No permission',
//         403
//       ));
//     }

//     const ticket = await InterviewTicket.findById(req.params.id);
//     if (!ticket) {
//       return res.status(404).json(createErrorResponse(
//         'NOT_FOUND',
//         'Ticket not found',
//         404
//       ));
//     }

//     const data = ticketSchema.partial().parse(req.body);
//     if (data.dates) data.dates = normalizeDates(data.dates);

//     Object.assign(ticket, data);
//     await ticket.save();

//     await logActivity(req, ticket, 'TICKET_UPDATE', data, 'Ticket updated');

//     res.json(createSuccessResponse({ ticket }));
//   } catch (err) {
//     next(err);
//   }
// };

// export const moveTicketStage = async (req, res, next) => {
//   try {
//     const board = await loadBoard(req);
//     if (!(await canEditTicket(req.user, board))) {
//       return res.status(403).json(createErrorResponse(
//         'ACCESS_DENIED',
//         'No permission',
//         403
//       ));
//     }

//     const { stageId } = req.body;
//     if (!stageId) {
//       return res.status(400).json(createErrorResponse(
//         'VALIDATION_ERROR',
//         'stageId required',
//         400
//       ));
//     }

//     const ticket = await InterviewTicket.findById(req.params.id);
//     if (!ticket) {
//       return res.status(404).json(createErrorResponse(
//         'NOT_FOUND',
//         'Ticket not found',
//         404
//       ));
//     }

//     ticket.stageId = stageId;
//     await ticket.save();

//     await logActivity(req, ticket, 'STAGE_MOVE', { stageId }, 'Stage moved');

//     res.json(createSuccessResponse({ ticket }));
//   } catch (err) {
//     next(err);
//   }
// };

// export const deleteTicket = async (req, res, next) => {
//   try {
//     const board = await loadBoard(req);
//     if (!(await canEditTicket(req.user, board))) {
//       return res.status(403).json(createErrorResponse(
//         'ACCESS_DENIED',
//         'No permission',
//         403
//       ));
//     }

//     const ticket = await InterviewTicket.findById(req.params.id);
//     if (!ticket) {
//       return res.status(404).json(createErrorResponse(
//         'NOT_FOUND',
//         'Ticket not found',
//         404
//       ));
//     }

//     await InterviewActivityLog.deleteMany({ ticketId: ticket._id });
//     await ticket.deleteOne();

//     res.json(createSuccessResponse(null, 'Ticket deleted'));
//   } catch (err) {
//     next(err);
//   }
// };

// export const getTicketActivity = async (req, res, next) => {
//   try {
//     const ticket = await InterviewTicket.findById(req.params.id);
//     if (!ticket) {
//       return res.status(404).json(createErrorResponse(
//         'NOT_FOUND',
//         'Ticket not found',
//         404
//       ));
//     }

//     const activities = await InterviewActivityLog.find({
//       ticketId: ticket._id
//     })
//       .populate('actorUserId', 'name email')
//       .sort({ createdAt: -1 })
//       .lean();

//     res.json(createSuccessResponse({ activities }));
//   } catch (err) {
//     next(err);
//   }
// };

// export const getTicketsTimeView = async (req, res, next) => {
//   try {
//     await loadBoard(req);

//     const { from, to } = req.query;
//     if (!from || !to) {
//       return res.status(400).json(createErrorResponse(
//         'VALIDATION_ERROR',
//         'from and to are required',
//         400
//       ));
//     }

//     const tickets = await InterviewTicket.find({
//       boardId: req.params.boardId,
//       'dates.scheduledDay': { $gte: from, $lte: to }
//     })
//       .populate('ownerUserId', 'email name')
//       .populate('stageId', 'name order color')
//       .populate('jobProfileId', 'name email')
//       .populate('attachments')
//       .lean();

//     const grouped = {};
//     for (const ticket of tickets) {
//       const date = ticket.dates[ticket.primaryDateIndex];
//       if (!date) continue;
//       if (!grouped[date.scheduledDay]) {
//         grouped[date.scheduledDay] = [];
//       }
//       grouped[date.scheduledDay].push(ticket);
//     }

//     res.json(createSuccessResponse({ days: grouped }));
//   } catch (err) {
//     next(err);
//   }
// };
import { z } from 'zod';
import InterviewBoard from '../models/InterviewBoard.js';
import InterviewStage from '../models/InterviewStage.js';
import InterviewTicket from '../models/InterviewTicket.js';
import InterviewActivityLog from '../models/InterviewActivityLog.js';
import { createErrorResponse, createSuccessResponse } from '../utils/errors.js';
import { normalizeRole, ROLES } from '../constants/roles.js';

/* --------------------------------------------------
 Helpers
-------------------------------------------------- */

const toDayString = (date) =>
  new Date(date).toISOString().split('T')[0];

const normalizeDates = (dates = []) =>
  dates.map(d => ({
    ...d,
    scheduledAt: new Date(d.scheduledAt),
    scheduledDay: toDayString(d.scheduledAt)
  }));

const canAccessBoard = async (user, board) => {
  const role = normalizeRole(user.role, user.degree);

  if (role === ROLES.SUPER_ADMIN) return true;
  if (board.ownerUserId.equals(user._id)) return true;

  if (board.visibility === 'team') {
    return [ROLES.GROUP_BOSS, ROLES.GROUP_MEMBER].includes(role);
  }

  if (board.visibility === 'shared') {
    return board.sharedWith?.some(id => id.equals(user._id));
  }

  return false;
};

const loadBoard = async (req) => {
  const board = await InterviewBoard.findById(req.params.boardId);
  if (!board) {
    throw createErrorResponse('NOT_FOUND', 'Interview board not found', 404);
  }
  if (!(await canAccessBoard(req.user, board))) {
    throw createErrorResponse('ACCESS_DENIED', 'Access denied', 403);
  }
  return board;
};

const logActivity = async (req, ticket, actionType, diff, description) => {
  try {
    await InterviewActivityLog.create({
      ticketId: ticket._id,
      boardId: ticket.boardId,
      actorUserId: req.user._id,
      actionType,
      diff,
      description
    });
  } catch (err) {
    console.error('Activity log failed:', err);
  }
};

/* --------------------------------------------------
 Validation
-------------------------------------------------- */

const dateSchema = z.object({
  scheduledAt: z.union([z.string().datetime(), z.date()]),
  durationMinutes: z.number().int().positive().optional(),
  interviewType: z.enum(['phone', 'video', 'onsite', 'assessment', 'other']).optional(),
  meetingLink: z.string().optional(),
  platform: z.string().optional(),
  participants: z.string().optional(),
  status: z.enum(['scheduled', 'completed', 'cancelled', 'rescheduled']).optional(),
  notes: z.string().optional(),
  outcome: z.enum(['pending', 'passed', 'failed', 'cancelled']).optional()
});

const ticketSchema = z.object({
  stageId: z.string(),
  jobProfileId: z.string().optional(),
  companyName: z.string().min(1),
  position: z.string().min(1),
  candidateName: z.string().optional(),
  dates: z.array(dateSchema).optional(),
  notes: z.string().optional(),
  attachments: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  status: z.enum(['active', 'completed', 'cancelled', 'on_hold']).optional(),
  dueDate: z.union([z.string().datetime(), z.date()]).optional(),
  metadata: z.any().optional()
});

/* --------------------------------------------------
 Controllers
-------------------------------------------------- */

// LIST
export const listTickets = async (req, res, next) => {
  try {
    await loadBoard(req);

    const tickets = await InterviewTicket.find({
      boardId: req.params.boardId
    })
      .populate('stageId', 'name order color')
      .populate('ownerUserId', 'name email')
      .populate('jobProfileId', 'name email')
      .sort({ createdAt: -1 })
      .lean();

    res.json(createSuccessResponse({ tickets }));
  } catch (err) {
    next(err);
  }
};

// GET ONE
export const getTicket = async (req, res, next) => {
  try {
    await loadBoard(req);

    const ticket = await InterviewTicket.findOne({
      _id: req.params.id,
      boardId: req.params.boardId
    })
      .populate('stageId', 'name order color')
      .populate('ownerUserId', 'email name')
      .populate('jobProfileId', 'name email')
      .populate('attachments');

    if (!ticket) {
      return res.status(404).json(
        createErrorResponse('NOT_FOUND', 'Ticket not found', 404)
      );
    }

    res.json(createSuccessResponse({ ticket }));
  } catch (err) {
    next(err);
  }
};

// CREATE (EVERY USER WITH ACCESS)
export const createTicket = async (req, res, next) => {
  try {
    const board = await loadBoard(req);

    const data = ticketSchema.parse(req.body);

    const stage = await InterviewStage.findOne({
      _id: data.stageId,
      boardId: board._id
    });

    if (!stage) {
      return res.status(404).json(
        createErrorResponse('NOT_FOUND', 'Stage not found', 404)
      );
    }

    const ticket = await InterviewTicket.create({
      ...data,
      boardId: board._id,
      ownerUserId: req.user._id,
      dates: normalizeDates(data.dates || []),
      primaryDateIndex: 0
    });

    await logActivity(req, ticket, 'TICKET_CREATE', {}, 'Ticket created');

    res.status(201).json(createSuccessResponse({ ticket }));
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json(
        createErrorResponse('VALIDATION_ERROR', err.errors[0].message, 400)
      );
    }
    next(err);
  }
};

// UPDATE (EVERY USER WITH ACCESS)
export const updateTicket = async (req, res, next) => {
  try {
    await loadBoard(req);

    const ticket = await InterviewTicket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json(
        createErrorResponse('NOT_FOUND', 'Ticket not found', 404)
      );
    }

    const data = ticketSchema.partial().parse(req.body);
    if (data.dates) data.dates = normalizeDates(data.dates);

    Object.assign(ticket, data);
    await ticket.save();

    await logActivity(req, ticket, 'TICKET_UPDATE', data, 'Ticket updated');

    res.json(createSuccessResponse({ ticket }));
  } catch (err) {
    next(err);
  }
};

// MOVE STAGE (EVERY USER WITH ACCESS)
export const moveTicketStage = async (req, res, next) => {
  try {
    await loadBoard(req);

    const { stageId } = req.body;
    if (!stageId) {
      return res.status(400).json(
        createErrorResponse('VALIDATION_ERROR', 'stageId required', 400)
      );
    }

    const ticket = await InterviewTicket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json(
        createErrorResponse('NOT_FOUND', 'Ticket not found', 404)
      );
    }

    ticket.stageId = stageId;
    await ticket.save();

    await logActivity(req, ticket, 'STAGE_MOVE', { stageId }, 'Stage moved');

    res.json(createSuccessResponse({ ticket }));
  } catch (err) {
    next(err);
  }
};

// DELETE (ALL MEMBERS WITH BOARD ACCESS)
export const deleteTicket = async (req, res, next) => {
  try {
    // loadBoard already checks canAccessBoard, so if we get here, user has access
    await loadBoard(req);

    const ticket = await InterviewTicket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json(
        createErrorResponse('NOT_FOUND', 'Ticket not found', 404)
      );
    }

    // Log activity before deletion
    await logActivity(req, ticket, 'TICKET_DELETE', {}, 'Ticket deleted');

    await InterviewActivityLog.deleteMany({ ticketId: ticket._id });
    await ticket.deleteOne();

    res.json(createSuccessResponse(null, 'Ticket deleted'));
  } catch (err) {
    next(err);
  }
};

// ACTIVITY LOG
export const getTicketActivity = async (req, res, next) => {
  try {
    const ticket = await InterviewTicket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json(
        createErrorResponse('NOT_FOUND', 'Ticket not found', 404)
      );
    }

    const activities = await InterviewActivityLog.find({
      ticketId: ticket._id
    })
      .populate('actorUserId', 'name email')
      .sort({ createdAt: -1 })
      .lean();

    res.json(createSuccessResponse({ activities }));
  } catch (err) {
    next(err);
  }
};

// TIME VIEW
export const getTicketsTimeView = async (req, res, next) => {
  try {
    await loadBoard(req);

    const { from, to } = req.query;
    if (!from || !to) {
      return res.status(400).json(
        createErrorResponse('VALIDATION_ERROR', 'from and to are required', 400)
      );
    }

    const tickets = await InterviewTicket.find({
      boardId: req.params.boardId,
      'dates.scheduledDay': { $gte: from, $lte: to }
    })
      .populate('ownerUserId', 'email name')
      .populate('stageId', 'name order color')
      .populate('jobProfileId', 'name email')
      .populate('attachments')
      .lean();

    const grouped = {};
    for (const ticket of tickets) {
      const date = ticket.dates[ticket.primaryDateIndex];
      if (!date) continue;
      grouped[date.scheduledDay] ||= [];
      grouped[date.scheduledDay].push(ticket);
    }

    res.json(createSuccessResponse({ days: grouped }));
  } catch (err) {
    next(err);
  }
};
