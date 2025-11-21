/**
 * Professional Gemini API Client Wrapper
 * Handles API communication with error handling and message sanitization
 */

class GeminiClient {
  constructor(apiKey) {
    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim() === '') {
      throw new Error('Invalid Gemini API key provided');
    }
    
    this.apiKey = apiKey.trim();
    this.baseURL = 'https://generativelanguage.googleapis.com/v1beta/models';
    this.model = 'gemini-2.0-flash-exp'; // Using the stable flash model
  }

  /**
   * Sanitize user messages to prevent prompt injection and API errors
   */
  sanitizeMessage(message) {
    if (typeof message !== 'string') {
      return '';
    }

    // Trim and limit length to prevent abuse
    let sanitized = message.trim().slice(0, 4000);

    // Remove potentially harmful characters while preserving most text
    sanitized = sanitized.replace(/[<>{}[\]]/g, '');

    // Normalize whitespace
    sanitized = sanitized.replace(/\s+/g, ' ');

    return sanitized;
  }

  /**
   * Validate and prepare messages for the API
   */
  prepareMessages(messages) {
    if (!Array.isArray(messages)) {
      throw new Error('Messages must be an array');
    }

    return messages.map(msg => {
      if (!msg || typeof msg !== 'object') {
        throw new Error('Each message must be an object');
      }

      if (msg.role !== 'user' && msg.role !== 'assistant') {
        throw new Error('Message role must be "user" or "assistant"');
      }

      const content = this.sanitizeMessage(msg.content);
      if (!content) {
        throw new Error('Message content cannot be empty after sanitization');
      }

      return {
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: content }]
      };
    });
  }

  /**
   * Main method to generate chat completion
   */
  async generateContent(messages, options = {}) {
    try {
      const preparedMessages = this.prepareMessages(messages);
      
      const requestBody = {
        contents: preparedMessages,
        generationConfig: {
          temperature: typeof options.temperature === 'number' 
            ? Math.max(0, Math.min(1, options.temperature)) 
            : 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: options.maxTokens || 1024,
        },
        safetySettings: [
          {
            category: "HARM_CATEGORY_HARASSMENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_HATE_SPEECH",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_DANGEROUS_CONTENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          }
        ]
      };

      const response = await fetch(
        `${this.baseURL}/${this.model}:generateContent?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `Gemini API error: ${response.status} ${response.statusText} - ${errorData.error?.message || 'Unknown error'}`
        );
      }

      const data = await response.json();

      if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
        throw new Error('Invalid response format from Gemini API');
      }

      const candidate = data.candidates[0];
      
      // Check for safety blocks
      if (candidate.finishReason === 'SAFETY') {
        throw new Error('Response blocked due to safety concerns');
      }

      return {
        content: candidate.content.parts[0]?.text || '',
        finishReason: candidate.finishReason,
        usage: data.usageMetadata || {},
        safetyRatings: candidate.safetyRatings || []
      };

    } catch (error) {
      // Re-throw with more context if it's already our error
      if (error.message.startsWith('Gemini API error') || 
          error.message.startsWith('Invalid') ||
          error.message.startsWith('Message') ||
          error.message.startsWith('Response blocked')) {
        throw error;
      }
      
      // Network or unknown errors
      throw new Error(`Gemini service unavailable: ${error.message}`);
    }
  }
}

// Create and export a singleton instance
let geminiInstance = null;

function getGeminiClient(apiKey) {
  if (!geminiInstance) {
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is required');
    }
    geminiInstance = new GeminiClient(apiKey);
  }
  return geminiInstance;
}

module.exports = { getGeminiClient, GeminiClient };