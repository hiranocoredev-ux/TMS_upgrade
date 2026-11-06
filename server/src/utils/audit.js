import AuditLog from '../models/AuditLog.js';

/**
 * Write an audit log entry
 * 
 * Common actions:
 * - USER_CREATE, USER_UPDATE, USER_RESET_PASSWORD, USER_DELETE (implemented)
 * - TICKET_MOVE_STAGE (to be implemented)
 * - SECRET_VIEW, SECRET_DOWNLOAD (to be implemented for freelancer accounts)
 * 
 * @param {Object} req - Express request object (must have req.user)
 * @param {string} action - Action performed (e.g., "USER_CREATE", "TICKET_MOVE_STAGE")
 * @param {string} entityType - Type of entity affected (e.g., "USER", "TICKET", "SECRET")
 * @param {string} entityId - ID of the entity affected
 * @param {Object} meta - Additional metadata (optional)
 * @returns {Promise<void>}
 */
export const log = async (req, action, entityType, entityId, meta = {}) => {
  try {
    // Only log if user is authenticated
    if (!req.user || !req.user._id) {
      console.warn('Audit log attempted without authenticated user');
      return;
    }

    const auditEntry = new AuditLog({
      actorUserId: req.user._id,
      action,
      entityType,
      entityId: String(entityId),
      meta
    });

    await auditEntry.save();
  } catch (error) {
    // Don't throw - audit logging should never break the main flow
    console.error('Error writing audit log:', error);
  }
};

/**
 * Helper to extract relevant request metadata for audit logs
 * @param {Object} req - Express request object
 * @returns {Object} Metadata object
 */
export const getRequestMeta = (req) => {
  return {
    ip: req.ip || req.connection?.remoteAddress,
    userAgent: req.get('user-agent'),
    method: req.method,
    path: req.path
  };
};

