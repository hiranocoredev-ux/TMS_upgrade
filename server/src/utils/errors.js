// Custom error class for consistent error handling
export class AppError extends Error {
  constructor(code, message, statusCode = 400) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

// Helper to create error response
export const createErrorResponse = (code, message, statusCode = 400) => {
  return {
    ok: false,
    code,
    message
  };
};

// Helper to create success response
export const createSuccessResponse = (data = null, message = null, status = 200) => {
  const response = { ok: true, status };
  
  if (data !== null) {
    // Always wrap data in a data property
    response.data = data;
  }
  
  if (message) {
    response.message = message;
  }
  
  return response;
};

