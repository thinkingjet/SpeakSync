// Simple test server with meeting notes API endpoint
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  methods: ["GET", "POST"]
}));
app.use(express.json());

// Root endpoint for health check
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Test server is running' });
});

// Add OpenRouter API integration for meeting notes generation
app.post('/api/meeting-notes', async (req, res) => {
  try {
    const { messages, roomId } = req.body;
    
    if (!roomId) {
      return res.status(400).json({ error: 'Invalid room ID' });
    }
    
    if (!messages || messages.length === 0) {
      return res.status(400).json({ error: 'No messages available to generate notes from' });
    }
    
    // Get the OpenRouter API key from environment
    const openRouterApiKey = process.env.OPENROUTER_API_KEY || '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';
    
    console.log(`[MEETING-NOTES] Generating meeting notes for room ${roomId} with ${messages.length} messages`);
    
    // Format messages in chronological order with usernames for the prompt
    const formattedMessages = messages
      .map(msg => `${msg.username}: ${msg.text}`)
      .join('\n');

    // Create user statistics
    const messagesByUser = {};
    let totalMessages = 0;
    
    messages.forEach(msg => {
      totalMessages++;
      if (!messagesByUser[msg.username]) {
        messagesByUser[msg.username] = 0;
      }
      messagesByUser[msg.username]++;
    });
    
    // Format the active participants information
    const usernames = [...new Set(messages.map(msg => msg.username))];
    const participantsInfo = Object.entries(messagesByUser)
      .sort((a, b) => b[1] - a[1]) // Sort by message count, highest first
      .map(([username, count]) => `${username} (${count} messages, ${Math.round(count/totalMessages*100)}% participation)`)
      .join(', ');
    
    // Create the system prompt
    const systemPrompt = `You are an AI assistant that generates comprehensive, well-organized meeting notes from conversation transcripts. 

Meeting Information:
- Room: ${roomId}
- Number of Participants: ${usernames.length}
- Participants: ${usernames.join(', ')}
- Active Speakers: ${participantsInfo}
- Total Messages: ${totalMessages}
- Timestamp: ${new Date().toISOString()}

Instructions:
1. Organize the notes into clearly labeled sections:
   - Summary (brief 2-3 sentence overview)
   - Key Discussion Points (main topics discussed)
   - Decisions Made (any clear decisions reached)
   - Action Items (tasks mentioned with assigned person if specified)
   - Next Steps (planned follow-ups or future discussions)

2. Focus on extracting meaningful content and eliminating small talk or irrelevant exchanges.
3. Maintain a professional, concise tone.
4. Use bullet points for readability.
5. Include specific details mentioned (dates, numbers, proper nouns).
6. If the discussion is technical, preserve technical terms accurately.
7. Format the notes in a clean, readable structure.

Generate meeting notes that would be immediately useful to participants as a record of the conversation.`;

    // User prompt
    const userPrompt = `Please generate meeting notes from the following conversation transcript:\n\n${formattedMessages}`;
    
    // Prepare conversation history for the model
    const modelMessages = [
      {
        role: "system",
        content: systemPrompt
      },
      {
        role: "user",
        content: userPrompt
      }
    ];
    
    // API endpoint for OpenRouter
    const url = 'https://openrouter.ai/api/v1/chat/completions';
    
    // Set up headers
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${openRouterApiKey}`,
      'HTTP-Referer': 'https://real-time-translation-app.com',
      'X-Title': 'Real-time Translation Meeting Room'
    };
    
    // Set up data payload with the DeepSeek model
    const data = {
      model: 'deepseek/deepseek-chat-v3-0324:free',
      messages: modelMessages,
      max_tokens: 1000,
      temperature: 0.7,
      stream: false
    };
    
    console.log(`[MEETING-NOTES] Making request to OpenRouter API`);
    
    // Make the request to OpenRouter API
    const openRouterResponse = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(data)
    });
    
    if (!openRouterResponse.ok) {
      let errorDetails = {};
      try {
        errorDetails = await openRouterResponse.json();
      } catch (e) {
        console.error('[MEETING-NOTES] Error parsing error response:', e);
      }
      
      console.error(`[MEETING-NOTES] OpenRouter API error (${openRouterResponse.status}):`, errorDetails);
      return res.status(openRouterResponse.status).json({ 
        error: 'Error from OpenRouter API',
        details: errorDetails,
        status: openRouterResponse.status
      });
    }
    
    // Get the response
    const responseData = await openRouterResponse.json();
    console.log(`[MEETING-NOTES] Received response from OpenRouter API`);
    console.log(`[MEETING-NOTES] Model used: ${responseData.model || 'Unknown'}`);
    console.log(`[MEETING-NOTES] Tokens used: ${responseData.usage?.total_tokens || 'Unknown'}`);
    
    // Extract the generated notes
    const generatedNotes = responseData.choices[0].message.content;
    
    return res.json({ notes: generatedNotes });
    
  } catch (error) {
    console.error('[MEETING-NOTES] Error processing request:', error);
    return res.status(500).json({ error: error.message });
  }
});

// Start server
const PORT = 5001;
app.listen(PORT, () => {
  console.log(`Test server running on port ${PORT}`);
}); 