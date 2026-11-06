import express from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import dotenv from 'dotenv';
import User from '../models/User.js';
import { createErrorResponse, createSuccessResponse } from '../utils/errors.js';

dotenv.config();

const router = express.Router();

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required')
});

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email format')
});

// Login
router.post('/login', async (req, res, next) => {
  try {
    const validatedData = loginSchema.parse(req.body);
    
    console.log(`[LOGIN] Attempting login for email: ${validatedData.email}`);
    
    const user = await User.findOne({ email: validatedData.email.toLowerCase() });
    if (!user) {
      console.log(`[LOGIN] User not found: ${validatedData.email}`);
      return res.status(401).json(createErrorResponse(
        'INVALID_CREDENTIALS',
        'Invalid email or password'
      ));
    }

    // Check if account is disabled
    if (user.status === 'disabled') {
      console.log(`[LOGIN] Account disabled: ${validatedData.email}`);
      return res.status(403).json(createErrorResponse(
        'ACCOUNT_DISABLED',
        'Account is disabled'
      ));
    }

    const isPasswordValid = await user.comparePassword(validatedData.password);
    if (!isPasswordValid) {
      console.log(`[LOGIN] Invalid password for: ${validatedData.email}`);
      return res.status(401).json(createErrorResponse(
        'INVALID_CREDENTIALS',
        'Invalid email or password'
      ));
    }

    const token = jwt.sign(
      { userId: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    console.log(`[LOGIN] Successful login for: ${validatedData.email}, role: ${user.role}`);
    
    res.json(createSuccessResponse({
      token,
      user: user.toSummary()
    }, 'Login successful'));
  } catch (error) {
    console.error('[LOGIN] Error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json(createErrorResponse(
        'VALIDATION_ERROR',
        error.errors[0]?.message || 'Validation error',
        400,
        error.errors
      ));
    }
    next(error);
  }
});

// Logout (stateless, just return ok)
router.post('/logout', (req, res) => {
  res.json(createSuccessResponse(null, 'Logout successful'));
});

// Forgot Password (stub for v1)
router.post('/forgot-password', async (req, res, next) => {
  try {
    const validatedData = forgotPasswordSchema.parse(req.body);
    
    const user = await User.findOne({ email: validatedData.email.toLowerCase() });
    // Always return ok even if user doesn't exist (security best practice)
    
    // TODO: Generate reset token and send email in future version
    // For v1, just return ok
    
    res.json(createSuccessResponse(null, 'If the email exists, a password reset link has been sent'));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json(createErrorResponse(
        'VALIDATION_ERROR',
        'Invalid email format',
        400
      ));
    }
    next(error);
  }
});

export default router;
