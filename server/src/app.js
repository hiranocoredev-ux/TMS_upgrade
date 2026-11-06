import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import routes from './routes/index.js';
dotenv.config();
import path from 'path';

const app = express();

// Security headers
app.use(helmet());

// CORS configuration
// Allow requests from localhost or the configured CLIENT_URL
// For network access, set CLIENT_URL=http://YOUR_IP:5173 in .env
const allowedOrigins = process.env.CLIENT_URL 
  ? process.env.CLIENT_URL.split(',').map(url => url.trim())
  : ['http://localhost:5173'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Check if origin is allowed
    if (allowedOrigins.some(allowed => origin.startsWith(allowed))) {
      callback(null, true);
    } else {
      // In development, be more permissive
      if (process.env.NODE_ENV === 'development') {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    }
  },
  credentials: true
}));

// const allowedOrigins = [
//   "https://management-system-1-kns6.onrender.com",
//   "http://localhost:5173", // if you use local dev
// ];

// app.use(cors({
//   origin: function (origin, callback) {
//     if (!origin || allowedOrigins.includes(origin)) {
//       callback(null, true);
//     } else {
//       callback(new Error("Not allowed by CORS"));
//     }
//   },
//   credentials: true,
// }));

app.use(morgan('dev'));

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.resolve(process.env.UPLOAD_DIR || './uploads')));

// Health check route
app.get('/health', (req, res) => {
  res.json({
    ok: true,
    service: 'team-management-api',
    time: new Date().toISOString()
  });
});

// API Routes
app.use('/api', routes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    ok: false,
    message: 'Route not found' 
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  
  // Handle custom AppError
  if (err.name === 'AppError') {
    return res.status(err.statusCode || 400).json({
      ok: false,
      code: err.code || 'ERROR',
      message: err.message || 'An error occurred'
    });
  }
  
  // Handle Multer errors
  if (err.name === 'MulterError') {
    return res.status(400).json({
      ok: false,
      code: 'FILE_UPLOAD_ERROR',
      message: err.message || 'File upload error'
    });
  }

  // Handle Zod validation errors
  if (err.name === 'ZodError') {
    return res.status(400).json({
      ok: false,
      code: 'VALIDATION_ERROR',
      message: err.errors[0]?.message || 'Validation error'
    });
  }

  // Handle Mongoose validation errors
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(e => e.message);
    return res.status(400).json({
      ok: false,
      code: 'VALIDATION_ERROR',
      message: messages.join(', ')
    });
  }

  // Handle duplicate key errors (single writes and bulkWrite alike)
  if (err.code === 11000 || err.name === 'MongoBulkWriteError' || err.name === 'BulkWriteError') {
    const pattern = err.keyPattern || err.writeErrors?.[0]?.err?.keyPattern || err.result?.result?.writeErrors?.[0]?.err?.keyPattern;
    const field = pattern ? Object.keys(pattern)[0] : 'record';
    return res.status(400).json({
      ok: false,
      code: 'DUPLICATE_ENTRY',
      message: `${field} already exists`
    });
  }

  // Default error response
  res.status(err.status || 500).json({
    ok: false,
    code: 'INTERNAL_ERROR',
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

export default app;

