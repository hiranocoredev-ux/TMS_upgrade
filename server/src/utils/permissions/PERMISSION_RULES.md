# Permission Rules Documentation

This document describes the ownership-first permission rules for each entity type in the system.

## Permission Philosophy

**Ownership-First Approach:**
1. **Owner** always has full access (view, edit, delete)
2. **Role-based permissions** grant additional access beyond ownership
3. **SUPER_ADMIN** bypasses all checks (can access everything)
4. **Assignment/Collaboration** grants limited access based on entity type

---

## Entity Permission Rules

### 1. JobProfile (Client Profile)

| Permission | Owner | Assigned Member (Editor) | Assigned Member (Non-Editor) | ADMIN | SUPER_ADMIN |
|------------|-------|--------------------------|------------------------------|-------|-------------|
| **View** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Edit** | ✅ | ✅ (if editor flag) | ❌ | ✅ | ✅ |
| **Delete** | ❌ | ❌ | ❌ | ✅ | ✅ |
| **Create** | ✅ | ✅ (if editor flag) | ❌ | ✅ | ✅ |

**Special Rules:**
- Only ADMIN/SUPER_ADMIN can delete job profiles (ownership doesn't grant delete)
- Editor flag required for members to create/edit (if assigned)
- Assigned members can always view

---

### 2. JobTicket (Bid Ticket)

| Permission | Assigned Member | ADMIN | SUPER_ADMIN |
|------------|-----------------|-------|-------------|
| **View** | ✅ | ✅ | ✅ |
| **Edit** | ✅ | ✅ | ✅ |
| **Delete** | ❌ | ✅ | ✅ |
| **Create** | ✅ | ✅ | ✅ |

**Special Rules:**
- No owner field - access based on assignment
- Assigned members can view and edit
- Only ADMIN/SUPER_ADMIN can delete

---

### 3. Project

| Permission | Owner | Collaborator | ADMIN | SUPER_ADMIN |
|------------|-------|--------------|-------|-------------|
| **View** | ✅ | ✅ | ✅ | ✅ |
| **Edit** | ✅ | ❌ | ✅ (if BOSS_CAN_EDIT_PROJECTS=true) | ✅ |
| **Delete** | ✅ | ❌ | ❌ | ✅ |
| **Create** | ✅ | ❌ | ✅ | ✅ |

**Special Rules:**
- Owner has full control (view, edit, delete)
- Collaborators can view and comment (but not edit)
- ADMIN can edit if `BOSS_CAN_EDIT_PROJECTS` env var is true
- `clientContacts` field hidden from non-owners and non-admins

---

### 4. Task

| Permission | Project Owner | Project Collaborator | ADMIN | SUPER_ADMIN |
|------------|---------------|----------------------|-------|-------------|
| **View** | ✅ | ✅ | ✅ | ✅ |
| **Edit** | ✅ | ❌ | ✅ (if BOSS_CAN_EDIT_PROJECTS=true) | ✅ |
| **Delete** | ✅ | ❌ | ✅ (if BOSS_CAN_EDIT_PROJECTS=true) | ✅ |
| **Create** | ✅ | ❌ | ✅ (if BOSS_CAN_EDIT_PROJECTS=true) | ✅ |

**Special Rules:**
- Task permissions inherit from parent Project
- Same rules as Project (via project context)

---

### 5. Interview

| Permission | Creator | Assigned (via JobTicket) | ADMIN | SUPER_ADMIN |
|------------|---------|--------------------------|-------|-------------|
| **View** | ✅ | ✅ (TODO: via ticket) | ✅ | ✅ |
| **Edit** | ✅ | ❌ | ✅ | ✅ |
| **Delete** | ✅ | ❌ | ✅ | ✅ |
| **Create** | ✅ | ✅ | ✅ | ✅ |

**Special Rules:**
- Creator has full control
- Access linked to JobTicket assignment (TODO: implement fully)
- Any authenticated user can create

---

### 6. FinanceTransaction

| Permission | Owner (userId) | ADMIN | SUPER_ADMIN |
|------------|----------------|-------|-------------|
| **View** | ✅ | ✅ | ✅ |
| **Edit** | ✅ | ✅ | ✅ |
| **Delete** | ✅ | ✅ | ✅ |
| **Create** | ✅ | ✅ | ✅ |
| **Approve** | ❌ | ✅ | ✅ |

**Special Rules:**
- Owner can view/edit/delete their own transactions
- ADMIN can view all transactions (team oversight)
- Only ADMIN/SUPER_ADMIN can approve transactions
- Outcomes above threshold require approval

---

### 7. FreelancerAccount

| Permission | Owner | Allowed (via accessScope) | ADMIN | SUPER_ADMIN |
|------------|-------|---------------------------|-------|-------------|
| **View** | ✅ | ✅ (secrets masked) | ✅ | ✅ |
| **Edit** | ✅ | ❌ | ✅ | ✅ |
| **Delete** | ✅ | ❌ | ✅ | ✅ |
| **Create** | ✅ | ❌ | ✅ | ✅ |
| **Reveal Password** | ❌ | ❌ | ✅ | ✅ |

**Special Rules:**
- Owner can view/edit/delete
- Access scope grants view-only access (secrets always masked)
- Only ADMIN/SUPER_ADMIN can reveal passwords
- Passwords never returned in normal responses (always masked)

---

### 8. PersonalProfile

| Permission | Owner | ADMIN | SUPER_ADMIN |
|------------|-------|-------|-------------|
| **View** | ✅ | ❌ | ✅ |
| **Edit** | ✅ | ❌ | ✅ |
| **Delete** | ✅ | ❌ | ✅ |
| **Create** | ✅ | ❌ | ✅ |

**Special Rules:**
- **Strict ownership-only access** - no role-based access except SUPER_ADMIN
- ADMIN cannot view/edit other users' personal profiles
- SUPER_ADMIN can access any profile (for system administration)
- Most private entity type

---

## Permission Helper Functions

All permission checks use centralized helpers from `server/src/utils/permissions.js`:

### Base Functions

- `isOwner(user, entity, ownerField)` - Check ownership
- `canView(user, entity, options)` - Ownership-first view check
- `canEdit(user, entity, options)` - Ownership-first edit check
- `canDelete(user, entity, options)` - Ownership-first delete check
- `canCreate(user, options)` - Create permission check
- `getPermissions(user, entity, options)` - Get full permission summary

### Entity-Specific Helpers

Located in `server/src/utils/permissions/entityPermissions.js`:

- `jobProfilePermissions.*`
- `jobTicketPermissions.*`
- `projectPermissions.*`
- `taskPermissions.*`
- `interviewPermissions.*`
- `financeTransactionPermissions.*`
- `freelancerAccountPermissions.*`
- `personalProfilePermissions.*`

---

## Usage Examples

### In Route Handlers

```javascript
import { jobProfilePermissions } from '../utils/permissions/entityPermissions.js';

// GET /job-profiles/:id
if (!jobProfilePermissions.canView(req.user, profile)) {
  return res.status(403).json(createErrorResponse(...));
}

// PUT /job-profiles/:id
const editPermission = jobProfilePermissions.canEdit(req.user, profile);
if (!editPermission.canEdit) {
  return res.status(403).json(createErrorResponse(
    'ACCESS_DENIED',
    editPermission.reason || 'Insufficient permissions',
    403
  ));
}

// DELETE /job-profiles/:id
if (!jobProfilePermissions.canDelete(req.user, profile)) {
  return res.status(403).json(createErrorResponse(...));
}
```

### Get Full Permission Summary

```javascript
const perms = jobProfilePermissions.getPermissions(user, profile);
// Returns: { canView: true, canEdit: true, canDelete: false, isOwner: true, reason: null }
```

---

## Migration Notes

- All route handlers now use centralized permission helpers
- Old ad-hoc permission checks replaced with ownership-first pattern
- SUPER_ADMIN role bypasses all permission checks
- BOSS role mapped to ADMIN for backward compatibility

---

## Security Considerations

1. **Ownership is Primary**: All checks start with ownership verification
2. **Role-Based Access is Secondary**: Roles grant additional permissions, not replace ownership
3. **Explicit Denial**: If no permission rule matches, access is denied
4. **SUPER_ADMIN Override**: System admin can always access (for administration)
5. **Audit Logging**: All permission checks should be logged for sensitive operations

---

**Last Updated:** 2026-01-11  
**Version:** 1.0 (PRD v3.0)

