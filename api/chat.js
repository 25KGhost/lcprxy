/**
 * Vercel Serverless API Endpoint for Gemini Chat
 * Professional error handling and CORS support
 */

const { getGeminiClient } = require('../utils/geminiClient');

// CORS headers for browser requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json; charset=utf-8'
};

/**
 * Standardized error response helper
 */
function createErrorResponse(statusCode, message, details = null) {
  const response = {
    success: false,
    error: {
      message,
      code: statusCode,
      timestamp: new Date().toISOString()
    }
  };
  
  if (details) {
    response.error.details = details;
  }
  
  return response;
}

/**
 * Success response helper
 */
function createSuccessResponse(data) {
  return {
    success: true,
    data: {
      ...data,
      timestamp: new Date().toISOString()
    }
  };
}

module.exports = async (req, res) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(200, corsHeaders);
    res.end();
    return;
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    res.writeHead(405, corsHeaders);
    res.end(JSON.stringify(
      createErrorResponse(405, 'Method Not Allowed', 'Only POST requests are supported')
    ));
    return;
  }

  try {
    // Validate Content-Type
    const contentType = req.headers['content-type'];
    if (!contentType || !contentType.includes('application/json')) {
      res.writeHead(415, corsHeaders);
      res.end(JSON.stringify(
        createErrorResponse(415, 'Unsupported Media Type', 'Content-Type must be application/json')
      ));
      return;
    }

    // Parse request body
    let body;
    try {
      body = JSON.parse(req.body);
    } catch (parseError) {
      res.writeHead(400, corsHeaders);
      res.end(JSON.stringify(
        createErrorResponse(400, 'Invalid JSON in request body')
      ));
      return;
    }

    // Validate required fields
    if (!body || !Array.isArray(body.messages)) {
      res.writeHead(400, corsHeaders);
      res.end(JSON.stringify(
        createErrorResponse(400, 'Missing or invalid messages array')
      ));
      return;
    }

    // Validate at least one message exists
    if (body.messages.length === 0) {
      res.writeHead(400, corsHeaders);
      res.end(JSON.stringify(
        createErrorResponse(400, 'Messages array cannot be empty')
      ));
      return;
    }

    // Get API key from environment
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error('GEMINI_API_KEY environment variable is not set');
      res.writeHead(500, corsHeaders);
      res.end(JSON.stringify(
        createErrorResponse(500, 'Server configuration error', 'API key not configured')
      ));
      return;
    }

    // Initialize Gemini client
    const geminiClient = getGeminiClient(apiKey);

    // Generate response
    const options = {
      temperature: typeof body.temperature === 'number' ? body.temperature : undefined,
      maxTokens: typeof body.maxTokens === 'number' ? body.maxTokens : undefined,
    };

    const result = await geminiClient.generateContent(body.messages, options);

    // Send successful response
    res.writeHead(200, corsHeaders);
    res.end(JSON.stringify(
      createSuccessResponse({
        message: result.content,
        finishReason: result.finishReason,
        usage: result.usage,
        safetyRatings: result.safetyRatings
      })
    ));

  } catch (error) {
    console.error('Chat API error:', error);

    // Determine appropriate status code based on error type
    let statusCode = 500;
    let errorMessage = 'Internal server error';
    let errorDetails = null;

    if (error.message.includes('API key') || error.message.includes('GEMINI_API_KEY')) {
      statusCode = 500;
      errorMessage = 'Server configuration error';
    } else if (error.message.includes('Invalid') || error.message.includes('Message')) {
      statusCode = 400;
      errorMessage = error.message;
    } else if (error.message.includes('Gemini API error')) {
      statusCode = 502;
      errorMessage = 'AI service temporarily unavailable';
      errorDetails = error.message;
    } else if (error.message.includes('unavailable')) {
      statusCode = 503;
      errorMessage = 'AI service temporarily unavailable';
    } else if (error.message.includes('safety')) {
      statusCode = 400;
      errorMessage = 'Request blocked for safety reasons';
    } else {
      // Generic error for production
      errorMessage = 'Service temporarily unavailable';
    }

    res.writeHead(statusCode, corsHeaders);
    res.end(JSON.stringify(
      createErrorResponse(statusCode, errorMessage, errorDetails)
    ));
  }
};
