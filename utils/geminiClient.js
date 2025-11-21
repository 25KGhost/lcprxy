/**
 * Professional Gemini API Client Wrapper
 * Optimized for free Gemini API tier
 */

class GeminiClient {
  constructor(apiKey) {
    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim() === '') {
      throw new Error('Invalid Gemini API key provided');
    }
    
    this.apiKey = apiKey.trim();
    this.baseURL = 'https://generativelanguage.googleapis.com/v1beta/models';
    this.model = 'gemini-1.5-flash'; // FREE model
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

    // Filter out system messages and format for Gemini
    const geminiMessages = messages
      .filter(msg => msg.role !== 'system')
      .map(msg => {
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

    return geminiMessages;
  }

  /**
   * Extract system instruction from messages
   */
  getSystemInstruction(messages) {
    const systemMessage = messages.find(msg => msg.role === 'system');
    return systemMessage ? systemMessage.content : undefined;
  }

  /**
   * Main method to generate chat completion
   */
  async generateContent(messages, options = {}) {
    try {
      const preparedMessages = this.prepareMessages(messages);
      const systemInstruction = this.getSystemInstruction(messages);
      
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
        // UPDATED: More permissive safety settings
        safetySettings: [
          {
            category: "HARM_CATEGORY_HARASSMENT",
            threshold: "BLOCK_ONLY_HIGH"
          },
          {
            category: "HARM_CATEGORY_HATE_SPEECH",
            threshold: "BLOCK_ONLY_HIGH"
          },
          {
            category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
            threshold: "BLOCK_ONLY_HIGH"
          },
          {
            category: "HARM_CATEGORY_DANGEROUS_CONTENT",
            threshold: "BLOCK_ONLY_HIGH"
          }
        ]
      };

      // Add system instruction if present (Gemini 1.5+ feature)
      if (systemInstruction) {
        requestBody.systemInstruction = { parts: [{ text: systemInstruction }] };
      }

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
        const errorMessage = errorData.error?.message || 'Unknown error';
        
        // Handle specific Gemini API errors
        if (response.status === 429) {
          throw new Error('Rate limit exceeded. Please try again in a moment.');
        } else if (response.status === 403) {
          throw new Error('API key invalid or insufficient permissions.');
        } else if (response.status === 400) {
          // More specific error for safety blocks
          if (errorMessage.includes('safety') || errorMessage.includes('blocked')) {
            throw new Error('Response blocked due to safety concerns. Please rephrase your question to be more business-focused.');
          }
          throw new Error(`Invalid request: ${errorMessage}`);
        } else {
          throw new Error(`Gemini API error: ${response.status} - ${errorMessage}`);
        }
      }

      const data = await response.json();

      if (!data.candidates || !data.candidates[0]) {
        throw new Error('No response generated from Gemini API');
      }

      const candidate = data.candidates[0];
      
      // Check for safety blocks
      if (candidate.finishReason === 'SAFETY') {
        throw new Error('Response blocked due to safety concerns. Please try a different business question.');
      }

      if (candidate.finishReason === 'RECITATION') {
        throw new Error('Response contained recitation from training data');
      }

      return {
        content: candidate.content?.parts[0]?.text || 'No response generated.',
        finishReason: candidate.finishReason,
        usage: data.usageMetadata || {},
        safetyRatings: candidate.safetyRatings || []
      };

    } catch (error) {
      // Re-throw with more context if it's already our error
      if (error.message.startsWith('Rate limit') ||
          error.message.startsWith('API key') ||
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
