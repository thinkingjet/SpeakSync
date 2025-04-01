const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { createClient, LiveTranscriptionEvents } = require('@deepgram/sdk');
const cors = require('cors');
const dotenv = require('dotenv');
const { translate } = require('@vitalets/google-translate-api');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const multer = require('multer');
const FormData = require('form-data');
const axios = require('axios');

// Load environment variables
dotenv.config();

// Get ElevenLabs API key
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;

// Initialize Express app
const app = express();

// Configure CORS for all routes
const corsOptions = {
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  credentials: true,
  exposedHeaders: ['Access-Control-Allow-Credentials']
};

app.use(cors(corsOptions));
app.use(express.json());

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.IO
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    credentials: true
  }
});

// Store active rooms
const rooms = {};
// Store active Deepgram connections
const deepgramConnections = {};

// Initialize Deepgram client
const deepgramApiKey = process.env.DEEPGRAM_API_KEY;
if (!deepgramApiKey) {
  console.error('DEEPGRAM_API_KEY is not defined. Please check your .env file.');
  process.exit(1);
}

// Track translation requests for rate limiting
const translationRequests = {
  count: 0,
  resetTime: Date.now() + 60000, // Reset after 1 minute
  lastRequest: Date.now(),
};

// Helper function to get human-readable language name from language code
function getLanguageDisplayName(languageCode) {
  // Convert to lowercase for comparison
  const code = languageCode.toLowerCase();
  
  // Direct mapping for known language codes
  const languageMap = {
    'multi': 'Multilingual',
    'ar': 'Arabic',
    'bg': 'Bulgarian',
    'zh': 'Chinese',
    'cs': 'Czech',
    'da': 'Danish',
    'nl': 'Dutch',
    'en': 'English',
    'et': 'Estonian',
    'fi': 'Finnish',
    'fr': 'French',
    'de': 'German',
    'el': 'Greek',
    'hi': 'Hindi',
    'hu': 'Hungarian',
    'id': 'Indonesian',
    'it': 'Italian',
    'ja': 'Japanese',
    'ko': 'Korean',
    'lv': 'Latvian',
    'lt': 'Lithuanian',
    'ms': 'Malay',
    'no': 'Norwegian',
    'pl': 'Polish',
    'pt': 'Portuguese',
    'ro': 'Romanian',
    'ru': 'Russian',
    'sk': 'Slovak',
    'es': 'Spanish',
    'sv': 'Swedish',
    'th': 'Thai',
    'tr': 'Turkish',
    'uk': 'Ukrainian',
    'vi': 'Vietnamese'
  };
  
  // Check for direct match
  if (languageMap[code]) {
    return languageMap[code];
  }
  
  // For language names like "French (General)" - already in display format
  if (code.includes('(') && code.includes(')')) {
    return languageCode; // Return as is, it's already a display name
  }
  
  // If we can't determine a nice name, return the code as is
  return languageCode;
}

// Helper function to extract language codes for translation
function extractLanguageCode(langString) {
  // Convert to lowercase for comparison
  const code = langString.toLowerCase();
  
  // Direct mapping for known language formats
  const languageMap = {
    // Default
    'multi': 'en',
    
    // Language codes
    'ar': 'ar',
    'de': 'de',
    'en': 'en',
    'es': 'es',
    'fr': 'fr',
    'hi': 'hi',
    'it': 'it',
    'ja': 'ja',
    'ko': 'ko',
    'pt': 'pt',
    'ru': 'ru',
    'zh': 'zh',
    
    // Hyphenated codes
    'en-au': 'en',
    'en-ca': 'en',
    'en-gb': 'en',
    'en-us': 'en',
    'es-es': 'es',
    'es-mx': 'es',
    'fr-ca': 'fr',
    'fr-fr': 'fr',
    'pt-br': 'pt',
    'zh-cn': 'zh',
    
    // Full names
    'arabic': 'ar',
    'chinese': 'zh',
    'english': 'en',
    'french': 'fr',
    'german': 'de',
    'hindi': 'hi',
    'italian': 'it',
    'japanese': 'ja',
    'korean': 'ko',
    'portuguese': 'pt',
    'russian': 'ru',
    'spanish': 'es'
  };
  
  // Check for direct match in our mapping
  if (languageMap[code]) {
    return languageMap[code];
  }
  
  // For hyphenated codes not in our mapping, take first part: en-XYZ -> en
  if (code.includes('-')) {
    const base = code.split('-')[0];
    return languageMap[base] || base;
  }
  
  // For language names with parentheses: "French (General)" -> extract "french"
  if (code.includes('(')) {
    const base = code.split('(')[0].trim().toLowerCase();
    return languageMap[base] || base;
  }
  
  // If nothing matched, return as is
  return code;
}

// Translation helper function using Google Translate's public API endpoint
async function translateTextUnofficial(text, sourceLanguage, targetLanguage) {
  // Skip if text is empty
  if (!text || !text.trim()) {
    return text;
  }
  
  console.log(`[TRANSLATION] Request: from ${sourceLanguage} to ${targetLanguage}`, {
    text: text.substring(0, 50) + (text.length > 50 ? '...' : ''), // Log shortened text for readability
  });
  
  // If source and target languages are the same, no need to translate
  if (sourceLanguage === targetLanguage) {
    console.log('[TRANSLATION] Same language, skipping translation');
    return text;
  }
  
  // Reset counter if time has elapsed
  if (Date.now() > translationRequests.resetTime) {
    translationRequests.count = 0;
    translationRequests.resetTime = Date.now() + 60000;
  }
  
  // Basic rate limiting - add delay if too many requests
  const timeSinceLastRequest = Date.now() - translationRequests.lastRequest;
  if (translationRequests.count > 50 && timeSinceLastRequest < 1000) {
    // If we've made many requests recently, add a delay
    console.log(`[TRANSLATION] Rate limiting - adding delay before translation`);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Update rate limiting tracking
  translationRequests.count++;
  translationRequests.lastRequest = Date.now();
  
  // Extract base language codes (removing region codes)
  const sourceShortCode = extractLanguageCode(sourceLanguage);
  const targetShortCode = extractLanguageCode(targetLanguage);
  
  console.log(`[TRANSLATION] Using API with: from=${sourceShortCode}, to=${targetShortCode}`);

  // Maximum retries
  const MAX_RETRIES = 2;
  let retries = 0;
  
  while (retries <= MAX_RETRIES) {
    try {
      // Use Google Translate's API with proper URL encoding
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceShortCode}&tl=${targetShortCode}&dt=t&q=${encodeURIComponent(text)}`;
      
      console.log(`[TRANSLATION] Fetching from URL: ${url.substring(0, 100)}...`);
      
      // Create an AbortController for timeout handling
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/94.0.4606.81 Safari/537.36',
          'Accept': 'application/json',
          'Referer': 'https://translate.googleapis.com/',
          'Content-Type': 'application/json'
        },
        signal: controller.signal
      });
      
      // Clear the timeout
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`Translation API returned status ${response.status}`);
      }
      
      const data = await response.json();
      
      // Process the translation response
      // Google's response format: [[["translated text","original text",""],...],...]
      if (!data || !data[0]) {
        throw new Error('Invalid response format from translation API');
      }
      
      const translatedText = data[0]
        ?.map(item => item[0])
        .filter(Boolean)
        .join(' ');
      
      if (!translatedText) {
        throw new Error('Translation failed - empty response');
      }

      console.log(`[TRANSLATION] Result: "${translatedText.substring(0, 50) + (translatedText.length > 50 ? '...' : '')}"`);
      return translatedText;
    } catch (error) {
      console.error(`[TRANSLATION ERROR] ${error.message}`, error);
      retries++;
      
      if (retries <= MAX_RETRIES) {
        // Exponential backoff: wait 1s, then 2s, then 4s, etc.
        const delay = 1000 * Math.pow(2, retries - 1);
        console.log(`[TRANSLATION] Retry ${retries}/${MAX_RETRIES} after ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        console.error(`[TRANSLATION] Failed after ${MAX_RETRIES} retries. Using original text as fallback.`);
        // On error after retries, return the original text as fallback
        return text;
      }
    }
  }
  
  // This should never be reached due to the return in the final else block above,
  // but including as a safeguard
  return text;
}

// Function to create a Deepgram WebSocket connection with explicit parameters
function createDeepgramConnection(language) {
  console.log(`Creating connection with language: ${language}`);
  
  // Create a fresh Deepgram client for each connection
  const deepgram = createClient(deepgramApiKey);
  
  // Define connection options explicitly to ensure we use nova-2
  const connectionOptions = {
    model: "nova-2",
    language: language || "multi",
    smart_format: false,
    interim_results: true,
    utterance_end_ms: 1000,
    vad_events: true,
    endpointing: 300,
    punctuate: false,
    diarize: false,
  };
  
  console.log(`Connection options:`, connectionOptions);
  
  // Create a Deepgram WebSocket connection
  const dgConnection = deepgram.listen.live(connectionOptions);
  
  // Log the underlying WebSocket URL created by the SDK to debug
  console.log(`SDK WebSocket URL: ${dgConnection.conn?.url || 'Unknown'}`);
  
  return dgConnection;
}

// Function to get options for pre-recorded audio
function getDeepgramPrerecordedOptions(language) {
  return {
    model: "nova-2",
    language: language || "multi",
    smart_format: false
  };
}

// Add the translate transcript endpoint to the Express routes
// Find a good spot like where other API endpoints are defined

// Add this API endpoint before the Socket.IO setup
app.post('/api/translate-transcript', async (req, res) => {
  try {
    console.log('[TRANSCRIPT] Received request to translate transcript');
    const { messages, targetLanguage } = req.body;
    
    if (!messages || !Array.isArray(messages) || !targetLanguage) {
      console.error('[TRANSCRIPT] Invalid request parameters', { 
        hasMessages: !!messages,
        isArray: Array.isArray(messages),
        targetLanguage 
      });
      return res.status(400).json({ error: 'Invalid request parameters' });
    }
    
    console.log(`[TRANSCRIPT] Translating ${messages.length} messages to ${targetLanguage}`);
    
    // Process each message and translate if needed
    const translatedMessages = await Promise.all(messages.map(async (message, index) => {
      // Skip system messages
      if (message.isSystem) {
        return message;
      }
      
      try {
        // Extract source language from message or default to 'en'
        const sourceLanguage = message.language || 'en';
        
        // Skip translation if source and target are the same
        if (sourceLanguage === targetLanguage) {
          console.log(`[TRANSCRIPT] Message ${index+1}/${messages.length}: Same language, skipping translation`);
          return message;
        }
        
        console.log(`[TRANSCRIPT] Message ${index+1}/${messages.length}: Translating from ${sourceLanguage} to ${targetLanguage}`);
        
        // Translate the message text
        const translatedText = await translateTextUnofficial(message.text, sourceLanguage, targetLanguage);
        
        // Return translated message with original data
        return {
          ...message,
          text: translatedText,
          originalText: message.text,
          isTranslated: true
        };
      } catch (error) {
        console.error(`[TRANSCRIPT] Error translating message ${index+1}/${messages.length}:`, error);
        // Return original message if translation fails
        return message;
      }
    }));
    
    console.log(`[TRANSCRIPT] Successfully translated ${translatedMessages.length} messages`);
    return res.json({ success: true, messages: translatedMessages });
  } catch (error) {
    console.error('[TRANSCRIPT] Error translating transcript:', error);
    return res.status(500).json({ error: 'Error translating transcript' });
  }
});

// Socket.IO connection handler
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);
  
  let currentRoom = null;
  let deepgramStream = null;
  
  // Join Room event
  socket.on('join-room', async (data) => {
    const { room, username, language, voiceId } = data;
    currentRoom = room;
    
    console.log(`User ${username} joined room ${room} with language ${language || 'default'}`);
    
    // Create room if it doesn't exist
    if (!rooms[room]) {
      rooms[room] = {
        users: {},
        messages: [],
        lastActivity: Date.now()
      };
    }
    
    // Check if user has a cloned voice even if they don't provide a voice ID
    let userVoiceId = voiceId;
    if (!userVoiceId) {
      try {
        console.log(`Checking if user ${username} has a previously cloned voice...`);
        userVoiceId = await getUserVoiceId(username);
        if (userVoiceId) {
          console.log(`Found existing voice clone for user ${username}: ${userVoiceId}`);
        } else {
          console.log(`No existing voice clone found for user ${username}`);
        }
      } catch (error) {
        console.error(`Error checking for voice clone for user ${username}:`, error);
      }
    }
    
    // Add user to room
    rooms[room].users[socket.id] = {
      username,
      language,
      voiceId: userVoiceId, // Use the discovered voice ID or the provided one
      isActive: true,
      lastActivity: Date.now()
    };
    
    // Update room last activity
    rooms[room].lastActivity = Date.now();
    
    // Join socket room
    socket.join(room);
    
    // Notify all users in room of the new user
    io.to(room).emit('user-joined', {
      users: Object.entries(rooms[room].users).map(([id, user]) => {
        const hasVoiceClone = !!user.voiceId;
        console.log(`[USER JOINED] User ${user.username} (${id}) has voice clone: ${hasVoiceClone}${hasVoiceClone ? `, voiceId: ${user.voiceId}` : ''}`);
        return {
          id,
          username: user.username,
          language: user.language,
          hasVoiceClone
        }
      }),
      joinedUser: {
        id: socket.id,
        username,
        language,
        hasVoiceClone: !!userVoiceId
      }
    });
    
    // Send room state to the new user
    socket.emit('room-state', {
      users: Object.entries(rooms[room].users).map(([id, user]) => {
        const hasVoiceClone = !!user.voiceId;
        console.log(`[ROOM STATE] User ${user.username} (${id}) has voice clone: ${hasVoiceClone}${hasVoiceClone ? `, voiceId: ${user.voiceId}` : ''}`);
        return {
          id,
          username: user.username,
          language: user.language,
          hasVoiceClone
        }
      }),
      messages: rooms[room].messages
    });
    
    // Send system message about the new user
    const message = {
      id: generateMessageId(),
      userId: 'system',
      username: 'System',
      text: `${username} has joined the room.`,
      timestamp: new Date().toISOString(),
      language: 'en',
      languageDisplay: 'English',
      isSystem: true,
      isFinal: true
    };
    
    // Add message to room history
    rooms[room].messages.push(message);
    
    // Send message to all users in room
    io.to(room).emit('new-message', message);
  });

  // Handle language update
  socket.on('update-language', ({ room, language }) => {
    if (rooms[room] && rooms[room].users && rooms[room].users[socket.id]) {
      console.log(`User ${rooms[room].users[socket.id].username} updated language to ${language}`);
      
      // Update user's language in the room
      rooms[room].users[socket.id].language = language;
      
      // Stop any existing stream to recreate with new language
      const existingConnection = deepgramConnections[socket.id]?.connection;
      if (existingConnection) {
        try {
          console.log(`Stopping stream for ${socket.id} to update language`);
          existingConnection.finish();
          delete deepgramConnections[socket.id];
        } catch (error) {
          console.error(`Error stopping stream for ${socket.id}:`, error);
        }
      }
    }
  });

  // Handle meeting notes language update
  socket.on('update-meeting-notes-language', ({ room, meetingNotesLanguage }) => {
    if (rooms[room] && rooms[room].users && rooms[room].users[socket.id]) {
      console.log(`User ${rooms[room].users[socket.id].username} updated meeting notes language to ${meetingNotesLanguage}`);
      
      // Update user's meeting notes language preference in the room
      rooms[room].users[socket.id].meetingNotesLanguage = meetingNotesLanguage;
    }
  });

  // Handle user mute event
  socket.on('user-muted', ({ room }) => {
    console.log(`User ${socket.id} muted microphone in room ${room}`);
    
    // Clear speaking state if user was previously speaking
    const userConnection = deepgramConnections[socket.id];
    if (userConnection && userConnection.isSpeaking) {
      userConnection.isSpeaking = false;
      
      // Emit speaking stopped event to all clients in the room
      io.to(room).emit('user-speaking-stopped', { 
        userId: socket.id, 
        username: rooms[room].users[socket.id].username
      });
      
      console.log(`Cleared speaking state for user ${socket.id} after mute`);
    }
  });

  // Handle audio stream start
  socket.on('start-stream', async ({ room }) => {
    if (!rooms[room]) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }

    console.log(`Starting stream for user ${socket.id} in room ${room}`);

    try {
      // Get user's preferred language
      const userLanguage = rooms[room].users[socket.id].language;
      console.log(`Using language: ${userLanguage} for user ${socket.id}`);
      
      // Create a connection using our helper function, which ensures consistent parameters
      const connection = createDeepgramConnection(userLanguage);
      
      // Log the URL that was actually created to verify it uses nova-2
      console.log(`Created connection with URL: ${connection.conn?.url}`);
      if (connection.conn?.url.includes("nova-3")) {
        console.error("ERROR: SDK is using nova-3 despite our configurations!");
        // Force-close this connection so we don't use it with the wrong model
        connection.finish();
        socket.emit('stream-error', { message: 'Transcription service configuration error' });
        return;
      }

      // Store the connection
      deepgramConnections[socket.id] = {
        connection,
        currentTranscript: "",
        accumulatedTranscript: "", 
        room,
        processing: false,
        isSpeaking: false,
        speechSegments: [],
        hasEmittedSpeakingStarted: false
      };

      // Handle connection open
      connection.addListener(LiveTranscriptionEvents.Open, () => {
        console.log(`Deepgram connection opened for ${socket.id}`);
        socket.emit('stream-ready');
      });

      // Handle transcription results
      connection.addListener(LiveTranscriptionEvents.Transcript, async (data) => {
        if (!data || !data.channel || !data.channel.alternatives || !data.channel.alternatives[0]) {
          return;
        }

        const transcript = data.channel.alternatives[0].transcript;
        const isFinal = data.is_final;
        const userConnection = deepgramConnections[socket.id];
        
        if (!userConnection) return;
        
        // Only process non-empty transcripts
        if (transcript.trim()) {
          // Store the current transcript part
          userConnection.currentTranscript = transcript;
          
          if (userConnection.isSpeaking) {
            // If this is a final segment, add to the accumulated transcript
            if (isFinal) {
              // For the first segment, just set it
              if (userConnection.accumulatedTranscript === "") {
                userConnection.accumulatedTranscript = transcript;
              } else {
                // For subsequent segments, append with a space
                // Only append if this isn't a duplicate (Deepgram sometimes sends duplicate finals)
                if (!userConnection.accumulatedTranscript.endsWith(transcript)) {
                  userConnection.accumulatedTranscript += " " + transcript;
                }
              }
            }
            
            // Prepare the current complete text to send
            // For non-final, combine accumulated + current
            // For final, just use accumulated
            let currentText = isFinal 
              ? userConnection.accumulatedTranscript 
              : userConnection.accumulatedTranscript + " " + transcript;
            
            currentText = currentText.trim();
            
            // Count words
            const wordCount = currentText.split(/\s+/).length;
            
            // Only proceed if we have at least 2 words
            if (wordCount >= 2) {
              const senderLanguage = rooms[room].users[socket.id].language;
              
              // If this is the first time reaching 2+ words for this speech segment, emit speaking started
              if (!userConnection.hasEmittedSpeakingStarted) {
                userConnection.hasEmittedSpeakingStarted = true;
                console.log(`Emitting speaking started for ${socket.id} after reaching word threshold of ${wordCount} words`);
                io.to(room).emit('user-speaking-started', { 
                  userId: socket.id, 
                  username: rooms[room].users[socket.id].username,
                  wordCount: wordCount // Include word count in the payload
                });
              }
              
              // For each recipient in the room
              const recipientSocketIds = Object.keys(rooms[room].users);
              
              // Process each recipient
              await Promise.all(recipientSocketIds.map(async (recipientSocketId) => {
                const recipientLanguage = rooms[room].users[recipientSocketId].language;
                
                // If recipient is the sender or has the same language, send original interim
                if (recipientSocketId === socket.id || recipientLanguage === senderLanguage) {
                  // Emit to sender or same language users with original text
                  io.to(recipientSocketId).emit('interim-message', {
                    userId: socket.id,
                    username: rooms[room].users[socket.id].username,
                    text: currentText,
                    language: senderLanguage,
                    languageDisplay: getLanguageDisplayName(senderLanguage),
                    isFinal: false,
                    wordCount: wordCount
                  });
                } else {
                  // Translate for other users
                  try {
                    const translatedText = await translateTextUnofficial(currentText, senderLanguage, recipientLanguage);
                    
                    // Emit translated interim message to this recipient only
                    io.to(recipientSocketId).emit('interim-message', {
                      userId: socket.id,
                      username: rooms[room].users[socket.id].username,
                      text: translatedText,
                      language: senderLanguage,
                      languageDisplay: getLanguageDisplayName(senderLanguage),
                      originalLanguage: senderLanguage,
                      originalLanguageDisplay: getLanguageDisplayName(senderLanguage),
                      isTranslated: true,
                      isFinal: false,
                      wordCount: wordCount
                    });
                  } catch (error) {
                    console.error(`Error translating interim message: ${error.message}`);
                    // Fall back to original text on error
                    io.to(recipientSocketId).emit('interim-message', {
                      userId: socket.id,
                      username: rooms[room].users[socket.id].username,
                      text: currentText,
                      language: senderLanguage,
                      languageDisplay: getLanguageDisplayName(senderLanguage),
                      isFinal: false,
                      wordCount: wordCount
                    });
                  }
                }
              }));
            }
          }
        }
      });

      // Handle speech started event
      connection.addListener(LiveTranscriptionEvents.SpeechStarted, () => {
        // Only log and emit events when speech actually starts (not repeatedly)
        const userConnection = deepgramConnections[socket.id];
        if (userConnection && !userConnection.isSpeaking) {
          console.log(`Speech started for ${socket.id}`);
          userConnection.isSpeaking = true;
          
          // Reset accumulated transcript at the start of new speech
          // (only if the previous one was processed)
          if (!userConnection.processing) {
            userConnection.accumulatedTranscript = "";
          }
          
          // We'll wait for at least 2 words in the transcript before emitting speaking started
          // The actual speaking-started event will be emitted when processing interim transcripts
          // with the wordCount >= 2 condition
        }
      });

      // Handle utterance end (speech end detection)
      connection.addListener(LiveTranscriptionEvents.UtteranceEnd, () => {
        const userConnection = deepgramConnections[socket.id];
        if (!userConnection || userConnection.processing) return;
        
        // Mark as processing to prevent duplicate messages
        userConnection.processing = true;
        // Update speaking state
        userConnection.isSpeaking = false;
        
        // Use the accumulated transcript for the complete utterance
        const finalTranscript = userConnection.accumulatedTranscript.trim();
        
        if (finalTranscript) {
          console.log(`Utterance ended for ${socket.id}: "${finalTranscript}"`);
          
          const senderLanguage = rooms[room].users[socket.id].language;
          
          // Create a message object
          const originalMessage = {
            id: generateMessageId(), // Add unique ID for each message
            userId: socket.id,
            username: rooms[room].users[socket.id].username,
            text: finalTranscript,
            language: senderLanguage,
            languageDisplay: getLanguageDisplayName(senderLanguage),
            timestamp: new Date().toISOString(),
            isFinal: true,
            reactions: {} // Initialize empty reactions object
          };
          
          console.log(`Created speech message for ${socket.id} with language ${originalMessage.language}:`, originalMessage);
          
          // Save this speech segment
          userConnection.speechSegments.push(finalTranscript);
          
          // Initialize messages array if it doesn't exist
          if (!rooms[room].messages) {
            rooms[room].messages = [];
          }
          
          // Add message to room history
          rooms[room].messages.push(originalMessage);
          
          // Send to each user in the room with translation if needed
          const recipientSocketIds = Object.keys(rooms[room].users);
          
          console.log(`Processing speech for ${recipientSocketIds.length} recipients`);
          
          // Process each recipient
          Promise.all(recipientSocketIds.map(async (recipientSocketId) => {
            const recipientLanguage = rooms[room].users[recipientSocketId].language;
            
            console.log(`Processing speech for recipient ${recipientSocketId} with language ${recipientLanguage}`);
            
            // If recipient is the sender or has the same language, send original message
            if (recipientSocketId === socket.id || recipientLanguage === senderLanguage) {
              console.log(`Sending original speech to ${recipientSocketId} (same language or sender)`);
              io.to(recipientSocketId).emit('new-message', originalMessage);
            } else {
              console.log(`Translating speech for recipient ${recipientSocketId} from ${senderLanguage} to ${recipientLanguage}`);
              // Translate message for this recipient
              const translatedText = await translateTextUnofficial(originalMessage.text, senderLanguage, recipientLanguage);
              
              // Create translated message object
              const messageToSend = {
                ...originalMessage,
                text: translatedText,
                originalLanguage: senderLanguage,
                originalLanguageDisplay: getLanguageDisplayName(senderLanguage),
                isTranslated: translatedText !== originalMessage.text
              };
              
              console.log(`Sending translated speech to ${recipientSocketId}:`, messageToSend);
              
              // Send translated message to this recipient only
              io.to(recipientSocketId).emit('new-message', messageToSend);
            }
          })).catch(error => {
            console.error(`Error processing speech translations: ${error.message}`, error);
          });
          
          // Check if we should auto-generate meeting notes (every 10 messages)
          try {
            console.log(`[MEETING-NOTES] Checking if auto-generation should trigger for room ${room} after speech message...`);
            if (shouldGenerateNotes(rooms[room])) {
              console.log(`[MEETING-NOTES] Triggering automatic generation after ${rooms[room].messages.length} messages in room ${room}`);
              // Generate meeting notes in the background, don't await
              generateMeetingNotesAutomatically(room).catch(error => {
                console.error(`[MEETING-NOTES] Failed to auto-generate notes: ${error.message}`);
              });
            } else {
              console.log(`[MEETING-NOTES] Not generating notes this time. (${rooms[room].messageCountSinceLastNotes}/10 messages)`);
            }
          } catch (error) {
            console.error(`[MEETING-NOTES] Error in auto-generation check: ${error.message}`);
          }
          
          // Emit a speaking stopped event to all clients in the room
          io.to(room).emit('user-speaking-stopped', { 
            userId: socket.id, 
            username: rooms[room].users[socket.id].username
          });
          
          // Reset current transcript and accumulated transcript
          userConnection.currentTranscript = "";
          userConnection.accumulatedTranscript = "";
          userConnection.processing = false;
          userConnection.hasEmittedSpeakingStarted = false;
        } else {
          // Even if there's no transcript, emit speaking stopped
          io.to(room).emit('user-speaking-stopped', { 
            userId: socket.id, 
            username: rooms[room].users[socket.id].username
          });
          
          // If there's no transcript, just reset processing flag
          userConnection.processing = false;
          userConnection.hasEmittedSpeakingStarted = false;
        }
      });

      // Handle connection errors
      connection.addListener(LiveTranscriptionEvents.Error, (error) => {
        console.error(`Deepgram error for ${socket.id}:`, error);
        socket.emit('stream-error', { message: 'Transcription error' });
      });

      // Handle connection close
      connection.addListener(LiveTranscriptionEvents.Close, () => {
        console.log(`Deepgram connection closed for ${socket.id}`);
        delete deepgramConnections[socket.id];
      });

    } catch (error) {
      console.error(`Error setting up Deepgram for ${socket.id}:`, error);
      socket.emit('stream-error', { message: 'Failed to start transcription service' });
    }
  });

  // Handle audio data from client
  socket.on('audio-data', (audioData) => {
    const connection = deepgramConnections[socket.id]?.connection;
    if (connection) {
      try {
        // Send audio data to Deepgram
        connection.send(audioData);
      } catch (error) {
        console.error(`Error sending audio data for ${socket.id}:`, error);
      }
    }
  });

  // Handle stop stream
  socket.on('stop-stream', () => {
    const connection = deepgramConnections[socket.id]?.connection;
    if (connection) {
      try {
        console.log(`Stopping stream for ${socket.id}`);
        
        // Explicitly clear the speaking state before finishing connection
        if (deepgramConnections[socket.id]) {
          deepgramConnections[socket.id].isSpeaking = false;
          deepgramConnections[socket.id].hasEmittedSpeakingStarted = false;
          
          // Find which room this user is in
          for (const roomId in rooms) {
            if (rooms[roomId].users && rooms[roomId].users[socket.id]) {
              // Emit speaking stopped event to ensure UI state is cleared
              io.to(roomId).emit('user-speaking-stopped', { 
                userId: socket.id, 
                username: rooms[roomId].users[socket.id].username
              });
              break;
            }
          }
        }
        
        connection.finish();
        delete deepgramConnections[socket.id];
      } catch (error) {
        console.error(`Error stopping stream for ${socket.id}:`, error);
      }
    }
  });

  // Handle push-to-talk audio
  socket.on('push-to-talk', async ({ room, audio }) => {
    if (!rooms[room]) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }

    console.log(`Processing push-to-talk audio for user ${socket.id} in room ${room}`);

    try {
      // Convert base64 to buffer
      const buffer = Buffer.from(audio, 'base64');
      
      // Get user's preferred language
      const userLanguage = rooms[room].users[socket.id].language;
      
      // Get options using our helper function
      const options = getDeepgramPrerecordedOptions(userLanguage);
      console.log('Using pre-recorded options:', options);
      
      // Process the audio directly with Deepgram's pre-recorded API
      // Create a fresh client to ensure we're not using any cached config
      const dgClient = createClient(process.env.DEEPGRAM_API_KEY);
      
      const response = await dgClient.listen.prerecorded({
        buffer,
        mimetype: 'audio/webm',
      }, options);
      
      // Extract the transcript
      if (response?.results?.channels?.length > 0 && 
          response.results.channels[0]?.alternatives?.length > 0) {
        
        const transcript = response.results.channels[0].alternatives[0].transcript;
        
        if (transcript.trim()) {
          console.log(`Push-to-talk transcript for ${socket.id}: "${transcript}"`);
          
          // Create a message object
          const message = {
            id: generateMessageId(), // Add unique ID for each message
            userId: socket.id,
            username: rooms[room].users[socket.id].username,
            text: transcript,
            language: rooms[room].users[socket.id].language,
            timestamp: new Date().toISOString(),
            isFinal: true,
            reactions: {} // Initialize empty reactions object
          };
          
          // Initialize messages array if it doesn't exist
          if (!rooms[room].messages) {
            rooms[room].messages = [];
          }
          
          // Add message to room history
          rooms[room].messages.push(message);
          
          // Broadcast message to all users in the room
          io.to(room).emit('new-message', message);
        }
      } else {
        console.log(`No transcript returned for push-to-talk from ${socket.id}`);
      }
    } catch (error) {
      console.error(`Error processing push-to-talk audio for ${socket.id}:`, error);
      socket.emit('stream-error', { message: 'Failed to process audio' });
    }
  });

  // Handle user disconnect
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    
    // Clean up Deepgram connection
    const connection = deepgramConnections[socket.id]?.connection;
    if (connection) {
      try {
        connection.finish();
        delete deepgramConnections[socket.id];
      } catch (error) {
        console.error(`Error cleaning up Deepgram connection for ${socket.id}:`, error);
      }
    }
    
    // Remove user from rooms
    for (const roomId in rooms) {
      if (rooms[roomId].users && rooms[roomId].users[socket.id]) {
        const username = rooms[roomId].users[socket.id].username;
        delete rooms[roomId].users[socket.id];
        
        // Check if room is empty
        if (Object.keys(rooms[roomId].users).length === 0) {
          delete rooms[roomId];
        } else {
          // Notify other users in the room
          io.to(roomId).emit('user-left', {
            users: Object.values(rooms[roomId].users),
            leftUser: { id: socket.id, username }
          });
        }
      }
    }
  });

  // Handle user leaving a room
  socket.on('leave-room', ({ room }) => {
    if (rooms[room] && rooms[room].users && rooms[room].users[socket.id]) {
      const username = rooms[room].users[socket.id].username;
      socket.leave(room);
      delete rooms[room].users[socket.id];
      
      // Check if room is empty
      if (Object.keys(rooms[room].users).length === 0) {
        delete rooms[room];
      } else {
        // Notify other users in the room
        io.to(room).emit('user-left', {
          users: Object.values(rooms[room].users),
          leftUser: { id: socket.id, username }
        });
      }
    }
  });

  // Handle text message
  socket.on('send-message', async ({ room, message }) => {
    console.log(`User ${socket.id} sending message in room ${room}: "${message}"`);
    
    if (rooms[room]) {
      const user = rooms[room].users[socket.id];
      if (user) {
        console.log(`Found user ${user.username} with language ${user.language}`);
        
        // Create a message object
        const originalMessage = {
          id: generateMessageId(), // Add unique ID for each message
          userId: socket.id,
          username: user.username,
          text: message,
          language: user.language,
          languageDisplay: getLanguageDisplayName(user.language),
          timestamp: new Date().toISOString(),
          isFinal: true,
          reactions: {} // Initialize empty reactions object
        };
        
        console.log('Created original message:', originalMessage);
        
        // Initialize messages array if it doesn't exist
        if (!rooms[room].messages) {
          rooms[room].messages = [];
        }
        
        // Add message to room history
        rooms[room].messages.push(originalMessage);
        
        // Send to each user in the room with translation if needed
        const recipientSocketIds = Object.keys(rooms[room].users);
        const senderLanguage = originalMessage.language;
        
        console.log(`Processing message for ${recipientSocketIds.length} recipients`);
        
        // Process each recipient
        await Promise.all(recipientSocketIds.map(async (recipientSocketId) => {
          const recipientLanguage = rooms[room].users[recipientSocketId].language;
          
          console.log(`Processing for recipient ${recipientSocketId} with language ${recipientLanguage}`);
          
          // If recipient is the sender or has the same language, send original message
          if (recipientSocketId === socket.id || recipientLanguage === senderLanguage) {
            console.log(`Sending original message to ${recipientSocketId} (same language or sender)`);
            io.to(recipientSocketId).emit('new-message', originalMessage);
          } else {
            console.log(`Translating for recipient ${recipientSocketId} from ${senderLanguage} to ${recipientLanguage}`);
            // Translate message for this recipient
            const translatedText = await translateTextUnofficial(originalMessage.text, senderLanguage, recipientLanguage);
            
            // Create translated message object
            const messageToSend = {
              ...originalMessage,
              text: translatedText,
              originalLanguage: senderLanguage,
              originalLanguageDisplay: getLanguageDisplayName(senderLanguage),
              isTranslated: translatedText !== originalMessage.text
            };
            
            console.log(`Sending translated message to ${recipientSocketId}:`, messageToSend);
            
            // Send translated message to this recipient only
            io.to(recipientSocketId).emit('new-message', messageToSend);
          }
        })).catch(error => {
          console.error(`Error processing translations: ${error.message}`);
        });
        
        // Check if we should auto-generate meeting notes (every 10 messages)
        try {
          console.log(`[MEETING-NOTES] Checking if auto-generation should trigger for room ${room}...`);
          if (shouldGenerateNotes(rooms[room])) {
            console.log(`[MEETING-NOTES] Triggering automatic generation after ${rooms[room].messages.length} messages in room ${room}`);
            // Generate meeting notes in the background, don't await
            generateMeetingNotesAutomatically(room).catch(error => {
              console.error(`[MEETING-NOTES] Failed to auto-generate notes: ${error.message}`);
            });
          } else {
            console.log(`[MEETING-NOTES] Not generating notes this time. (${rooms[room].messageCountSinceLastNotes}/10 messages)`);
          }
        } catch (error) {
          console.error(`[MEETING-NOTES] Error in auto-generation check: ${error.message}`);
        }
      } else {
        console.error(`User ${socket.id} not found in room ${room}`);
      }
    } else {
      console.error(`Room ${room} not found for message`);
    }
  });

  // Handle manual meeting notes generation via socket
  socket.on('generate-meeting-notes', async ({ room }) => {
    console.log(`User ${socket.id} requested meeting notes generation for room ${room}`);
    
    if (!rooms[room] || !rooms[room].messages || rooms[room].messages.length === 0) {
      console.log(`No messages in room ${room} to generate notes from`);
      socket.emit('error', { message: 'No messages available to generate meeting notes' });
      return;
    }
    
    try {
      // Generate meeting notes using the same function as auto-generation
      // but pass false for isAutoGenerated
      await generateMeetingNotesManually(room, socket.id);
    } catch (error) {
      console.error(`Error generating meeting notes: ${error.message}`);
      socket.emit('error', { message: 'Failed to generate meeting notes' });
    }
  });

  // Handle message reaction
  socket.on('add-reaction', ({ room, messageId, reaction }) => {
    console.log(`User ${socket.id} reacting to message ${messageId} with ${reaction} in room ${room}`);
    
    if (!rooms[room]) {
      console.error(`Room ${room} not found`);
      return;
    }
    
    // Find the message by its ID
    const messageIndex = rooms[room].messages.findIndex(msg => msg.id === messageId);
    if (messageIndex === -1) {
      console.error(`Message ${messageId} not found in room ${room}`);
      return;
    }
    
    const message = rooms[room].messages[messageIndex];
    const user = rooms[room].users[socket.id];
    
    if (!user) {
      console.error(`User ${socket.id} not found in room ${room}`);
      return;
    }
    
    // Initialize reactions object if it doesn't exist
    if (!message.reactions) {
      message.reactions = {};
    }
    
    // Initialize reaction array if it doesn't exist
    if (!message.reactions[reaction]) {
      message.reactions[reaction] = [];
    }
    
    // Check if user already reacted with this emoji
    const existingReactionIndex = message.reactions[reaction].findIndex(r => r.userId === socket.id);
    
    if (existingReactionIndex !== -1) {
      // User already reacted with this emoji - remove the reaction
      message.reactions[reaction].splice(existingReactionIndex, 1);
      
      // Remove the reaction type if no more users have this reaction
      if (message.reactions[reaction].length === 0) {
        delete message.reactions[reaction];
      }
      
      console.log(`Removed reaction ${reaction} from user ${user.username} on message ${messageId}`);
    } else {
      // Add new reaction
      message.reactions[reaction].push({
        userId: socket.id,
        username: user.username
      });
      console.log(`Added reaction ${reaction} from user ${user.username} on message ${messageId}`);
    }
    
    // Update the message in the room's messages array
    rooms[room].messages[messageIndex] = message;
    
    // Broadcast updated reactions to all users in the room
    io.to(room).emit('message-reaction-updated', {
      messageId,
      reactions: message.reactions
    });
  });

  // Text-to-speech request handler
  socket.on('request-tts', async (data) => {
    try {
      const { text, language, messageId, room, forUserId, speakerId } = data;
      
      if (!room || !rooms[room]) {
        console.log(`[TTS] Room ${room} not found`);
        return;
      }
      
      // Get the speaker's information (the original message sender)
      const speaker = speakerId ? rooms[room].users[speakerId] : null;
      
      // Use speaker's voice ID if they have one, otherwise use default
      const voiceId = speaker?.voiceId || '21m00Tcm4TlvDq8ikWAM'; // Default to Rachel if no cloned voice
      
      console.log(`[TTS] Text-to-speech request for: "${text.substring(0, 50)}..."`, {
        language,
        messageId,
        room,
        forUserId,
        speakerId,
        usingVoiceId: voiceId,
        isClonedVoice: !!speaker?.voiceId
      });
      
      // Send to specific user if specified, otherwise broadcast to room
      const targets = forUserId ? [forUserId] : Object.keys(rooms[room].users);
      
      // For each target user
      for (const targetId of targets) {
        const targetUser = rooms[room].users[targetId];
        if (!targetUser) continue;
        
        // Get the socket for the target user
        const targetSocket = io.sockets.sockets.get(targetId);
        if (!targetSocket) continue;
        
        try {
          // Prepare TTS parameters
          const ttsParams = {
            text,
            language: language || targetUser.language || 'en',
            messageId,
            voiceId // Use the determined voice ID (either cloned or default)
          };
          
          // Send the TTS request to the target user
          targetSocket.emit('play-tts', ttsParams);
          
          console.log(`[TTS] Sent TTS request to user ${targetUser.username}`, {
            language: ttsParams.language,
            voiceId: ttsParams.voiceId,
            isClonedVoice: voiceId !== '21m00Tcm4TlvDq8ikWAM'
          });
        } catch (error) {
          console.error(`[TTS] Error sending TTS to user ${targetId}:`, error);
        }
      }
      
    } catch (error) {
      console.error('[TTS] Error processing TTS request:', error);
    }
  });

  // Handle speech-to-text messages
  socket.on('speech-message', async (data) => {
    const { room, text, isFinal, language } = data;
    
    if (!room || !rooms[room]) return;
    
    // Get the user from the room
    const user = rooms[room].users[socket.id];
    if (!user) return;
    
    // Check if the user is muted
    if (user.isMuted) {
      console.log(`Ignoring speech from muted user ${user.username}`);
      return;
    }
    
    // Create message object
    const message = {
      id: generateMessageId(),
      userId: socket.id,
      username: user.username,
      text,
      language,
      timestamp: Date.now(),
      isFinal,
      reactions: {
        '👍': [],
        '👎': [],
        '❤️': [],
        '😂': [],
        '😮': [],
        '🎉': []
      },
      voiceId: user.voiceId // Include the user's voice ID if they have one
    };
    
    // Add message to room's message history if it's a final message
    if (isFinal) {
      rooms[room].messages.push(message);
      
      // Limit the number of messages stored (keep the last 100)
      if (rooms[room].messages.length > 100) {
        rooms[room].messages.shift();
      }
    }
    
    // Broadcast the message to all users in the room
    io.to(room).emit('new-message', message);
    
    // If it's a final message, translate and send to each user
    if (isFinal) {
      translateAndSendToEachUser(room, message);
    }
  });

  // Handle text messages (chat)
  socket.on('chat-message', async (data) => {
    const { room, text, language } = data;
    
    if (!room || !rooms[room]) return;
    
    // Get the user from the room
    const user = rooms[room].users[socket.id];
    if (!user) return;
    
    // Create message object
    const message = {
      id: generateMessageId(),
      userId: socket.id,
      username: user.username,
      text,
      language,
      timestamp: Date.now(),
      isFinal: true,
      reactions: {
        '👍': [],
        '👎': [],
        '❤️': [],
        '😂': [],
        '😮': [],
        '🎉': []
      },
      voiceId: user.voiceId // Include the user's voice ID if they have one
    };
    
    // Add message to room's message history
    rooms[room].messages.push(message);
    
    // Limit the number of messages stored (keep the last 100)
    if (rooms[room].messages.length > 100) {
      rooms[room].messages.shift();
    }
    
    // Broadcast the message to all users in the room
    io.to(room).emit('new-message', message);
    
    // Translate and send to each user
    translateAndSendToEachUser(room, message);
  });
});

// Add ElevenLabs language code mapping function
function mapToElevenLabsLanguageCode(language) {
  // Normalize input
  const lang = (language || 'en').toLowerCase();
  
  // Language code mapping for ElevenLabs
  const elevenlabsLanguageMap = {
    // Special cases
    'multi': 'en', // Default to English for "multi" 
    
    // Basic language codes
    'ar': 'ar',
    'bg': 'bg',
    'cs': 'cs',
    'da': 'da',
    'de': 'de',
    'el': 'el',
    'en': 'en',
    'es': 'es',
    'fi': 'fi',
    'fil': 'fil',
    'fr': 'fr',
    'hi': 'hi',
    'hr': 'hr',
    'hu': 'hu',
    'id': 'id',
    'it': 'it',
    'ja': 'ja',
    'ko': 'ko',
    'ms': 'ms',
    'nl': 'nl',
    'no': 'no',
    'pl': 'pl',
    'pt': 'pt',
    'ro': 'ro',
    'ru': 'ru',
    'sk': 'sk',
    'sv': 'sv',
    'ta': 'ta',
    'tr': 'tr',
    'uk': 'uk',
    'vi': 'vi',
    'zh': 'zh-cn',
    
    // Hyphenated codes
    'ar-ae': 'ar',
    'ar-sa': 'ar',
    'en-au': 'en',
    'en-ca': 'en',
    'en-gb': 'en',
    'en-us': 'en',
    'es-es': 'es',
    'es-mx': 'es',
    'fr-ca': 'fr',
    'fr-fr': 'fr',
    'pt-br': 'pt',
    'pt-pt': 'pt',
    'zh-cn': 'zh-cn'
  };
  
  // Check for direct match
  if (elevenlabsLanguageMap[lang]) {
    return elevenlabsLanguageMap[lang];
  }
  
  // For hyphenated codes not in our mapping, take first part (e.g., en-XYZ -> en)
  if (lang.includes('-')) {
    const base = lang.split('-')[0];
    return elevenlabsLanguageMap[base] || 'en'; // Default to English if not found
  }
  
  // Default to English if we can't find a mapping
  return 'en';
}

// Add a route for text-to-speech using ElevenLabs API WebSockets
app.post('/api/tts', async (req, res) => {
  try {
    const { text, language, voiceId: requestedVoiceId, speakerId } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'No text provided' });
    }
    
    // Get the ElevenLabs API key from environment
    const apiKey = process.env.ELEVENLABS_API_KEY;
    
    if (!apiKey) {
      return res.status(500).json({ error: 'ElevenLabs API key not configured' });
    }
    
    // Find the speaker's room
    let speakerRoom = null;
    let speaker = null;
    
    if (speakerId) {
      for (const [roomId, room] of Object.entries(rooms)) {
        if (room.users[speakerId]) {
          speakerRoom = roomId;
          speaker = room.users[speakerId];
          break;
        }
      }
    }
    
    // Map the language to a valid ElevenLabs language code
    const elevenLabsLanguageCode = mapToElevenLabsLanguageCode(language);
    
    // Use the speaker's voice ID if they have one, otherwise use the requested or default voice
    const voiceId = speaker?.voiceId || requestedVoiceId || "21m00Tcm4TlvDq8ikWAM";
    
    console.log(`[TTS] Processing request: lang=${language}, mapped to=${elevenLabsLanguageCode}, voiceId=${voiceId}, text="${text.substring(0, 50)}..."`, {
      speakerId,
      foundSpeaker: !!speaker,
      usingClonedVoice: speaker?.voiceId ? true : false
    });
    
    // This is the standard REST API endpoint
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;
    
    // Set up headers
    const headers = {
      "Accept": "application/json",
      "Content-Type": "application/json",
      "xi-api-key": apiKey
    };
    
    // Set up data payload with model_id
    const data = {
      text: text,
      model_id: "eleven_flash_v2_5",
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.8,
        style: 0.0,
        use_speaker_boost: true
      }
    };
    
    // Add mapped language_code for Flash v2.5 model
    data.language_code = elevenLabsLanguageCode;
    
    console.log(`[TTS] Request to ElevenLabs: voice=${voiceId}, model=${data.model_id}, language=${elevenLabsLanguageCode}`);
    
    // Make the request to ElevenLabs API
    const elevenlabsResponse = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(data)
    });
    
    if (!elevenlabsResponse.ok) {
      let errorDetails = {};
      try {
        errorDetails = await elevenlabsResponse.json();
      } catch (e) {
        console.error('[TTS] Error parsing error response:', e);
      }
      
      console.error(`[TTS] ElevenLabs API error (${elevenlabsResponse.status}):`, errorDetails);
      return res.status(elevenlabsResponse.status).json({ 
        error: 'Error from ElevenLabs API',
        details: errorDetails,
        status: elevenlabsResponse.status
      });
    }
    
    // Get the audio data
    const audioBuffer = await elevenlabsResponse.arrayBuffer();
    console.log(`[TTS] Received audio response: ${audioBuffer.byteLength} bytes`);
    
    // Set appropriate headers for audio response
    res.set('Content-Type', 'audio/mpeg');
    res.set('Content-Length', audioBuffer.byteLength);
    
    // Send the audio data
    return res.send(Buffer.from(audioBuffer));
    
  } catch (error) {
    console.error('[TTS] Error processing request:', error);
    return res.status(500).json({ error: error.message });
  }
});

// Add OpenRouter API integration for meeting notes generation
app.post('/api/meeting-notes', async (req, res) => {
  try {
    const { messages, roomId } = req.body;
    
    if (!roomId) {
      return res.status(400).json({ error: 'Invalid room ID' });
    }
    
    // Check if room exists, if not create it temporarily for this request if messages are provided
    if (!rooms[roomId] && messages) {
      console.log(`Creating temporary room ${roomId} for testing with ${messages.length} provided messages`);
      rooms[roomId] = {
        users: {},
        messages: messages
      };
      
      // Extract users from messages for the temporary room
      messages.forEach(msg => {
        if (msg.userId && msg.username) {
          rooms[roomId].users[msg.userId] = { 
            username: msg.username, 
            language: msg.language || 'en-US' 
          };
        }
      });
    }
    
    if (!rooms[roomId] || (!rooms[roomId].messages && !messages) || (rooms[roomId].messages && rooms[roomId].messages.length === 0 && (!messages || messages.length === 0))) {
      return res.status(400).json({ error: 'No messages available to generate notes from' });
    }
    
    // Use provided messages or the room's messages
    const messagesForNotes = messages || rooms[roomId].messages;
    
    // Get the OpenRouter API key from environment
    const openRouterApiKey = process.env.OPENROUTER_API_KEY || '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';
    
    console.log(`[MEETING-NOTES] Generating meeting notes for room ${roomId} with ${messagesForNotes.length} messages`);
    
    // Generate dynamic prompt based on the room state
    const prompt = createMeetingNotesPrompt(roomId);
    if (!prompt) {
      return res.status(500).json({ error: 'Failed to create prompt for meeting notes' });
    }
    
    // Prepare conversation history for the model with the dynamic prompt
    const modelMessages = [
      {
        role: "system",
        content: prompt.systemPrompt
      },
      {
        role: "user",
        content: prompt.userPrompt
      }
    ];
    
    // API endpoint for OpenRouter
    const url = 'https://openrouter.ai/api/v1/chat/completions';
    
    // Set up headers
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${openRouterApiKey}`,
      'HTTP-Referer': 'https://real-time-translation-app.com', // Optional
      'X-Title': 'Real-time Translation Meeting Room' // Optional
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
    
    // Extract the generated notes
    const generatedNotes = responseData.choices[0].message.content;
    
    // Update room's meeting notes if it's a real room (not temporary)
    if (roomId && rooms[roomId] && !req.body.messages) {
      if (!rooms[roomId].meetingNotes) {
        rooms[roomId].meetingNotes = [];
      }
      
      // Store the meeting notes
      rooms[roomId].meetingNotes.push({
        text: generatedNotes,
        timestamp: new Date().toISOString(),
        messageCount: rooms[roomId].messages.length
      });
      
      // Broadcast new meeting notes to all users in the room
      io.to(roomId).emit('meeting-notes-updated', {
        notes: generatedNotes,
        timestamp: new Date().toISOString()
      });
    }
    
    // Clean up temporary room if it was created for testing
    if (req.body.messages && rooms[roomId] && Object.keys(rooms[roomId].users).length === 0) {
      console.log(`Cleaning up temporary test room ${roomId}`);
      delete rooms[roomId];
    }
    
    return res.json({ notes: generatedNotes });
    
  } catch (error) {
    console.error('[MEETING-NOTES] Error processing request:', error);
    return res.status(500).json({ error: error.message });
  }
});

// Helper function to check if meeting notes should be automatically generated
const shouldGenerateNotes = (room) => {
  console.log(`[MEETING-NOTES] Checking if should generate notes. Current counter: ${room.messageCountSinceLastNotes}`);
  
  // Initialize message counter if it doesn't exist
  if (room.messageCountSinceLastNotes === undefined) {
    console.log(`[MEETING-NOTES] Initializing message counter for room`);
    room.messageCountSinceLastNotes = 0;
  }
  
  // Increment counter for each new message in the room (regardless of which user sent it)
  room.messageCountSinceLastNotes++;
  console.log(`[MEETING-NOTES] Incremented room message counter to ${room.messageCountSinceLastNotes}/10`);
  
  // Check if we've reached 10 total messages in the room since last notes generation
  if (room.messageCountSinceLastNotes >= 10) {
    // Reset counter
    console.log(`[MEETING-NOTES] Room has reached 10 messages. Resetting counter and triggering note generation.`);
    room.messageCountSinceLastNotes = 0;
    return true;
  }
  
  return false;
};

// Function to create a dynamic prompt for meeting notes generation
const createMeetingNotesPrompt = (roomId) => {
  if (!rooms[roomId]) {
    return null;
  }
  
  const messagesForNotes = rooms[roomId].messages;
  
  if (!messagesForNotes || messagesForNotes.length === 0) {
    return null;
  }
  
  // Get users in the room
  const users = Object.values(rooms[roomId].users);
  const userCount = users.length;
  const usernames = users.map(user => user.username);
  
  // Count messages per user to identify main participants
  const messagesByUser = {};
  let totalMessages = 0;
  
  messagesForNotes.forEach(msg => {
    if (!msg.isSystem) {
      totalMessages++;
      if (!messagesByUser[msg.username]) {
        messagesByUser[msg.username] = 0;
      }
      messagesByUser[msg.username]++;
    }
  });
  
  // Format the active participants information
  const participantsInfo = Object.entries(messagesByUser)
    .sort((a, b) => b[1] - a[1]) // Sort by message count, highest first
    .map(([username, count]) => `${username} (${count} messages, ${Math.round(count/totalMessages*100)}% participation)`)
    .join(', ');
  
  // Format messages in chronological order with usernames
  const formattedMessages = messagesForNotes
    .filter(msg => !msg.isSystem) // Filter out system messages
    .map(msg => `${msg.username}: ${msg.text}`)
    .join('\n');
  
  // Create the system prompt
  const systemPrompt = `You are an AI assistant that generates comprehensive, well-organized meeting notes from conversation transcripts. 

Meeting Information:
- Room: ${roomId}
- Number of Participants: ${userCount}
- Participants: ${usernames.join(', ')}
- Active Speakers: ${participantsInfo}
- Total Messages: ${totalMessages}
- Timestamp: ${new Date().toISOString()}

Instructions:
1. Organize the notes into clearly labeled sections using proper Markdown formatting:
   - Format section titles as Markdown headings (e.g., "# Summary", "## Key Discussion Points")
   - Use "# Meeting Notes" as the main title
   - Use second-level headings (##) for major sections like "Summary", "Key Discussion Points", etc.
   - Use third-level headings (###) for sub-sections if needed

2. Focus on extracting meaningful content and eliminating small talk or irrelevant exchanges.
3. Maintain a professional, concise tone.
4. Use Markdown bullet points (* or -) for readability.
5. Include specific details mentioned (dates, numbers, proper nouns).
6. If the discussion is technical, preserve technical terms accurately.
7. Format the notes in a clean, readable Markdown structure.
8. Include participant information in the header section.

Generate meeting notes that would be immediately useful to participants as a record of the conversation.`;

  // User prompt is simple - just asking to generate meeting notes for the transcript
  const userPrompt = `Please generate meeting notes from the following conversation transcript:\n\n${formattedMessages}`;
  
  return { systemPrompt, userPrompt };
};

// Function to generate meeting notes automatically
const generateMeetingNotesAutomatically = async (roomId) => {
  if (!rooms[roomId] || !rooms[roomId].messages || rooms[roomId].messages.length === 0) {
    console.log(`[MEETING-NOTES] No messages in room ${roomId} to generate notes from`);
    return;
  }
  
  try {
    console.log(`[MEETING-NOTES] Auto-generating meeting notes for room ${roomId}`);
    
    // Get the OpenRouter API key from environment
    const openRouterApiKey = process.env.OPENROUTER_API_KEY || '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';
    
    // Generate dynamic prompt
    const prompt = createMeetingNotesPrompt(roomId);
    if (!prompt) {
      console.log(`[MEETING-NOTES] Cannot create prompt for room ${roomId}`);
      return;
    }
    
    // Prepare conversation history for the model with the dynamic prompt
    const modelMessages = [
      {
        role: "system",
        content: prompt.systemPrompt
      },
      {
        role: "user",
        content: prompt.userPrompt
      }
    ];
    
    // API endpoint for OpenRouter
    const url = 'https://openrouter.ai/api/v1/chat/completions';
    
    // Set up headers
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${openRouterApiKey}`,
      'HTTP-Referer': 'https://real-time-translation-app.com', // Optional
      'X-Title': 'Real-time Translation Meeting Room' // Optional
    };
    
    // Set up data payload with the DeepSeek model
    const data = {
      model: 'deepseek/deepseek-chat-v3-0324:free',
      messages: modelMessages,
      max_tokens: 1000,
      temperature: 0.7,
      stream: false
    };
    
    // Make the request to OpenRouter API
    const openRouterResponse = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(data)
    });
    
    if (!openRouterResponse.ok) {
      console.error(`[MEETING-NOTES] Auto-generation failed: OpenRouter API error (${openRouterResponse.status})`);
      return;
    }
    
    // Get the response
    const responseData = await openRouterResponse.json();
    
    // Extract the generated notes
    const generatedNotes = responseData.choices[0].message.content;
    
    // Initialize meeting notes array if it doesn't exist
    if (!rooms[roomId].meetingNotes) {
      rooms[roomId].meetingNotes = [];
    }
    
    // Store the meeting notes
    rooms[roomId].meetingNotes.push({
      text: generatedNotes,
      timestamp: new Date().toISOString(),
      messageCount: rooms[roomId].messages.length,
      isAutoGenerated: true
    });
    
    // Use the new function to send translated notes to all users
    await sendMeetingNotesToUsers(
      roomId, 
      generatedNotes, 
      new Date().toISOString(), 
      true
    );
    
    console.log(`[MEETING-NOTES] Successfully auto-generated meeting notes for room ${roomId}`);
  } catch (error) {
    console.error('[MEETING-NOTES] Error auto-generating meeting notes:', error);
  }
};

// Function to translate meeting notes for a specific user
const translateMeetingNotesForUser = async (notes, targetLanguage) => {
  if (targetLanguage === 'en' || targetLanguage === 'multi') {
    // If the target language is English or multilingual, return the original notes
    return notes;
  }

  try {
    console.log(`[MEETING-NOTES] Translating meeting notes to ${targetLanguage}`);
    
    // Advanced block-based translation approach to better preserve formatting
    // and prevent word repetition issues
    
    // Split the document into blocks by double newlines (paragraphs/sections)
    const blocks = notes.split(/\n\n+/);
    const translatedBlocks = [];
    
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i].trim();
      if (!block) {
        translatedBlocks.push('');
        continue;
      }
      
      // Check if this is a Markdown heading
      if (/^#{1,6}\s+.+$/.test(block)) {
        const hashMatch = block.match(/^(#{1,6})\s+(.+)$/);
        if (hashMatch) {
          const prefix = hashMatch[1]; // The #'s
          const headingText = hashMatch[2]; // The heading text
          
          // Translate just the heading text
          const translatedHeading = await translateTextUnofficial(headingText, 'en', targetLanguage);
          translatedBlocks.push(`${prefix} ${translatedHeading}`);
        } else {
          // If regex failed somehow, translate the whole block
          const translatedBlock = await translateTextUnofficial(block, 'en', targetLanguage);
          translatedBlocks.push(translatedBlock);
        }
        continue;
      }
      
      // Check if this is a list (each line starts with * or - or a number followed by a period)
      if (block.split('\n').every(line => /^\s*([*-]|(\d+\.))\s+.+/.test(line.trim()) || !line.trim())) {
        // It's a list block - process line by line
        const lines = block.split('\n');
        const translatedLines = [];
        
        for (const line of lines) {
          if (!line.trim()) {
            translatedLines.push(line); // Keep empty lines as is
            continue;
          }
          
          // Extract the list marker and content
          const listMatch = line.match(/^(\s*)([*-]|\d+\.)\s+(.+)$/);
          if (listMatch) {
            const indentation = listMatch[1];  // Spaces/tabs before marker
            const marker = listMatch[2];       // The * or - or number.
            const content = listMatch[3];      // The content after the marker
            
            // Translate just the content, sending smaller chunks to avoid repetition
            const translatedContent = await translateTextUnofficial(content, 'en', targetLanguage);
            translatedLines.push(`${indentation}${marker} ${translatedContent}`);
          } else {
            // If regex failed, translate the whole line
            const translatedLine = await translateTextUnofficial(line, 'en', targetLanguage);
            translatedLines.push(translatedLine);
          }
        }
        
        translatedBlocks.push(translatedLines.join('\n'));
        continue;
      }
      
      // Check if this is a code block
      if (block.startsWith('```') && block.endsWith('```')) {
        // Code blocks should remain untranslated
        translatedBlocks.push(block);
        continue;
      }
      
      // For regular paragraphs, we break them into shorter sentences to avoid repetition issues
      if (block.length > 200) {
        // Split into sentences (rough approximation)
        const sentences = block.split(/(?<=[.!?])\s+/);
        const translatedSentences = [];
        
        // Translate each sentence separately
        for (const sentence of sentences) {
          if (!sentence.trim()) continue;
          const translatedSentence = await translateTextUnofficial(sentence, 'en', targetLanguage);
          translatedSentences.push(translatedSentence);
        }
        
        translatedBlocks.push(translatedSentences.join(' '));
      } else {
        // Regular paragraph or other content that's short enough - translate as-is
        const translatedBlock = await translateTextUnofficial(block, 'en', targetLanguage);
        translatedBlocks.push(translatedBlock);
      }
    }
    
    // Join all translated blocks back together with double newlines
    const translatedNotes = translatedBlocks.join('\n\n');
    
    console.log(`[MEETING-NOTES] Successfully translated notes to ${targetLanguage} with preserved formatting`);
    return translatedNotes;
  } catch (error) {
    console.error(`[MEETING-NOTES] Error translating notes: ${error.message}`);
    // Return original notes if translation fails
    return notes;
  }
};

// Function to send meeting notes to users with appropriate translations
const sendMeetingNotesToUsers = async (roomId, notes, timestamp, isAutoGenerated, generatedByUserId = null, generatedByUsername = null) => {
  if (!rooms[roomId] || !rooms[roomId].users) {
    console.log(`[MEETING-NOTES] No users in room ${roomId} to send notes to`);
    return;
  }
  
  // Get all users in the room
  const users = rooms[roomId].users;
  
  // Send notes to each user in their preferred language
  for (const [socketId, user] of Object.entries(users)) {
    try {
      // Translate notes for this user
      const userLanguage = user.meetingNotesLanguage || user.language || 'en';
      const translatedNotes = await translateMeetingNotesForUser(notes, userLanguage);
      
      // Create the message object with appropriate metadata
      const notesMessage = {
        notes: translatedNotes,
        timestamp: timestamp,
        isAutoGenerated: isAutoGenerated,
        generatedByUserId: generatedByUserId,
        generatedByUsername: generatedByUsername,
        isTranslated: translatedNotes !== notes
      };
      
      // Send to this specific user
      io.to(socketId).emit('meeting-notes-updated', notesMessage);
      
      console.log(`[MEETING-NOTES] Sent ${isAutoGenerated ? 'auto-generated' : 'manual'} notes to user ${socketId} in language ${userLanguage}`);
    } catch (error) {
      console.error(`[MEETING-NOTES] Error sending notes to user ${socketId}: ${error.message}`);
      // Send original notes as fallback
      io.to(socketId).emit('meeting-notes-updated', {
        notes: notes,
        timestamp: timestamp,
        isAutoGenerated: isAutoGenerated,
        generatedByUserId: generatedByUserId,
        generatedByUsername: generatedByUsername,
        isTranslated: false
      });
    }
  }
};

// Function to generate meeting notes manually triggered by a user
const generateMeetingNotesManually = async (roomId, requestingUserId) => {
  if (!rooms[roomId] || !rooms[roomId].messages || rooms[roomId].messages.length === 0) {
    console.log(`[MEETING-NOTES] No messages in room ${roomId} to generate notes from`);
    return;
  }
  
  try {
    console.log(`[MEETING-NOTES] Manually generating meeting notes for room ${roomId} by user ${requestingUserId}`);
    
    // Get the OpenRouter API key from environment
    const openRouterApiKey = process.env.OPENROUTER_API_KEY || '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';
    
    // Generate dynamic prompt
    const prompt = createMeetingNotesPrompt(roomId);
    if (!prompt) {
      console.log(`[MEETING-NOTES] Cannot create prompt for room ${roomId}`);
      return;
    }
    
    // Prepare conversation history for the model with the dynamic prompt
    const modelMessages = [
      {
        role: "system",
        content: prompt.systemPrompt
      },
      {
        role: "user",
        content: prompt.userPrompt
      }
    ];
    
    // API endpoint for OpenRouter
    const url = 'https://openrouter.ai/api/v1/chat/completions';
    
    // Set up headers
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${openRouterApiKey}`,
      'HTTP-Referer': 'https://real-time-translation-app.com', // Optional
      'X-Title': 'Real-time Translation Meeting Room' // Optional
    };
    
    // Set up data payload with the DeepSeek model
    const data = {
      model: 'deepseek/deepseek-chat-v3-0324:free',
      messages: modelMessages,
      max_tokens: 1000,
      temperature: 0.7,
      stream: false
    };
    
    // Make the request to OpenRouter API
    const openRouterResponse = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(data)
    });
    
    if (!openRouterResponse.ok) {
      console.error(`[MEETING-NOTES] Manual generation failed: OpenRouter API error (${openRouterResponse.status})`);
      return;
    }
    
    // Get the response
    const responseData = await openRouterResponse.json();
    
    // Extract the generated notes
    const generatedNotes = responseData.choices[0].message.content;
    
    // Initialize meeting notes array if it doesn't exist
    if (!rooms[roomId].meetingNotes) {
      rooms[roomId].meetingNotes = [];
    }
    
    // Store the meeting notes
    const newNote = {
      text: generatedNotes,
      timestamp: new Date().toISOString(),
      messageCount: rooms[roomId].messages.length,
      isAutoGenerated: false,
      generatedByUserId: requestingUserId,
      generatedByUsername: rooms[roomId].users[requestingUserId]?.username || 'Unknown User'
    };
    
    rooms[roomId].meetingNotes.push(newNote);
    
    // Use the new function to send translated notes to all users
    await sendMeetingNotesToUsers(
      roomId, 
      generatedNotes, 
      new Date().toISOString(), 
      false,
      requestingUserId,
      rooms[roomId].users[requestingUserId]?.username || 'Unknown User'
    );
    
    console.log(`[MEETING-NOTES] Successfully manually generated meeting notes for room ${roomId}`);
    return generatedNotes;
  } catch (error) {
    console.error('[MEETING-NOTES] Error manually generating meeting notes:', error);
    throw error;
  }
};

// Function to generate unique message IDs
function generateMessageId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Voice cloning endpoint that proxies requests to ElevenLabs API
app.options('/api/voice-clone', cors(corsOptions)); // Enable pre-flight for voice clone endpoint

app.post('/api/voice-clone', cors(corsOptions), upload.array('files'), async (req, res) => {
  try {
    console.log('[VOICE CLONE] ========== REQUEST RECEIVED ==========');
    console.log('[VOICE CLONE] Request headers:', JSON.stringify(req.headers, null, 2));
    console.log('[VOICE CLONE] Request origin:', req.get('origin'));

    if (!ELEVENLABS_API_KEY) {
      console.error('[VOICE CLONE] Missing ElevenLabs API key');
      return res.status(500).json({ error: 'ELEVENLABS_API_KEY is not configured' });
    }

    // Extract and validate the name parameter
    const name = req.body.name;
    if (!name) {
      console.error('[VOICE CLONE] Name parameter is missing');
      return res.status(400).json({ error: 'Name is required' });
    }
    console.log(`[VOICE CLONE] Cloning voice for user: ${name}`);

    // Validate files
    if (!req.files || req.files.length === 0) {
      console.error('[VOICE CLONE] No audio files received');
      return res.status(400).json({ error: 'No audio files provided' });
    }

    // Log file information
    let totalSize = 0;
    req.files.forEach((file, index) => {
      console.log(`[VOICE CLONE] File ${index}: ${file.originalname}, ${file.size} bytes, ${file.mimetype}`);
      totalSize += file.size;
    });
    console.log(`[VOICE CLONE] Total audio size: ${totalSize} bytes (${(totalSize / 1024 / 1024).toFixed(2)} MB)`);

    if (totalSize < 250000) { // 250KB minimum recommended size
      console.log('[VOICE CLONE] WARNING: Total audio size is small. Voice cloning may not be effective.');
    }

    // Create FormData for ElevenLabs API
    const FormData = require('form-data');
    const formData = new FormData();
    formData.append('name', name);

    // Add all audio files
    req.files.forEach((file) => {
      formData.append('files', file.buffer, {
        filename: file.originalname,
        contentType: file.mimetype
      });
    });

    // Make request to ElevenLabs API
    console.log('[VOICE CLONE] Sending request to ElevenLabs API...');
    const response = await fetch('https://api.elevenlabs.io/v1/voices/add', {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
        ...formData.getHeaders()
      },
      body: formData
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('[VOICE CLONE] ElevenLabs API error:', errorData);
      return res.status(response.status).json(errorData);
    }

    const data = await response.json();
    console.log('[VOICE CLONE] Voice cloning successful:', data);
    
    // Update voice cache with the new voice ID
    if (data && data.voice_id) {
      // Update in-memory cache
      voiceCacheByUsername.set(name, data.voice_id);
      voiceCacheLastUpdate.set(name, Date.now());
      
      // Update the local mapping file
      const voiceMapping = readVoiceMapping();
      voiceMapping.userVoices[name] = data.voice_id;
      writeVoiceMapping(voiceMapping);
      
      // Find user in rooms and update their voice ID
      let userRoomId = null;
      let userId = null;
      
      // Look through all rooms to find the user by username
      Object.entries(rooms).forEach(([roomId, room]) => {
        Object.entries(room.users).forEach(([socketId, user]) => {
          if (user.username === name) {
            userRoomId = roomId;
            userId = socketId;
            
            // Update the user's voice ID
            room.users[socketId].voiceId = data.voice_id;
            console.log(`[VOICE CLONE] Updated voice ID for user ${name} in room ${roomId}: ${data.voice_id}`);
          }
        });
      });
      
      // Notify room that user now has a cloned voice
      if (userRoomId && userId) {
        io.to(userRoomId).emit('user-voice-updated', {
          userId,
          username: name,
          hasVoiceClone: true
        });
      }
    }
    
    res.json(data);

  } catch (error) {
    console.error('[VOICE CLONE] ========== VOICE CLONING FAILED ==========');
    console.error('[VOICE CLONE] Error type:', error.constructor.name);
    console.error('[VOICE CLONE] Error message:', error.message);
    console.error('[VOICE CLONE] Stack trace:', error.stack);
    res.status(500).json({ error: error.message });
  }
});

// Add pre-flight OPTIONS handler for voice clone endpoint
app.options('/api/check-voice-clone', cors(corsOptions));

// Endpoint to check if a user has a cloned voice
app.get('/api/check-voice-clone', cors(corsOptions), async (req, res) => {
  try {
    const username = req.query.username;
    
    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }
    
    console.log(`[VOICE CHECK] Checking if user ${username} has a cloned voice`);
    
    // Get the voice ID for the user
    const voiceId = await getUserVoiceId(username);
    
    // Return the result
    if (voiceId) {
      console.log(`[VOICE CHECK] Found voice ID for user ${username}: ${voiceId}`);
      return res.json({ found: true, voiceId });
    } else {
      console.log(`[VOICE CHECK] No voice found for user ${username}`);
      return res.json({ found: false });
    }
  } catch (error) {
    console.error(`[VOICE CHECK] Error checking for voice clone:`, error);
    res.status(500).json({ error: 'Failed to check for voice clone' });
  }
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 

// Text-to-Speech using ElevenLabs API
app.post('/api/text-to-speech', async (req, res) => {
  try {
    if (!ELEVENLABS_API_KEY) {
      return res.status(500).json({ error: 'ELEVENLABS_API_KEY is not configured' });
    }

    console.log('[TTS API] Processing text-to-speech request');
    
    // Extract request data
    const { text, voice_id, model_id, voice_settings } = req.body;
    
    // Validate required fields
    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }
    
    // Use default voice ID if none provided
    const voiceId = voice_id || 'EXAVITQu4vr4xnSDxMaL'; // Default voice ID
    
    // Prepare the API request
    const apiUrl = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`;
    
    const payload = {
      text,
      model_id: model_id || 'eleven_multilingual_v2',
      voice_settings: voice_settings || {
        stability: 0.5,
        similarity_boost: 0.75,
        style: 0.0,
        use_speaker_boost: true
      }
    };
    
    console.log(`[TTS API] Sending request to ElevenLabs for voice ID: ${voiceId}`);
    
    // Call the ElevenLabs API
    const elevenlabsResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'xi-api-key': ELEVENLABS_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    // Handle errors from ElevenLabs
    if (!elevenlabsResponse.ok) {
      console.error(`[TTS API] ElevenLabs API error: ${elevenlabsResponse.status}`);
      let errorText = await elevenlabsResponse.text();
      try {
        // Try to parse as JSON
        const errorJson = JSON.parse(errorText);
        return res.status(elevenlabsResponse.status).json({ 
          error: 'Error from ElevenLabs API', 
          details: errorJson 
        });
      } catch (e) {
        // If not JSON, return as text
        return res.status(elevenlabsResponse.status).json({ 
          error: 'Error from ElevenLabs API', 
          details: errorText 
        });
      }
    }
    
    // Get the audio stream from ElevenLabs
    const audioBuffer = await elevenlabsResponse.arrayBuffer();
    
    // Set appropriate headers for audio content
    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': audioBuffer.byteLength
    });
    
    // Send the audio data
    res.send(Buffer.from(audioBuffer));
    
    console.log('[TTS API] Successfully returned audio stream');
    
  } catch (error) {
    console.error('[TTS API] Error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}); 

// Voice cache to avoid repeated API calls
const voiceCacheByUsername = new Map();
const voiceCacheLastUpdate = new Map();
const VOICE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Path to the voice mapping file
const voiceMappingFile = path.join(__dirname, 'voiceMapping.json');

// Function to read the voice mapping file
function readVoiceMapping() {
  try {
    const data = fs.readFileSync(voiceMappingFile, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('[VOICE] Error reading voice mapping file:', error);
    return { userVoices: {} };
  }
}

// Function to write to the voice mapping file
function writeVoiceMapping(mapping) {
  try {
    fs.writeFileSync(voiceMappingFile, JSON.stringify(mapping, null, 2), 'utf8');
  } catch (error) {
    console.error('[VOICE] Error writing voice mapping file:', error);
  }
}

/**
 * Fetch a user's voice ID from ElevenLabs if they have a cloned voice
 * @param {string} username - The username to check for a voice clone
 * @returns {Promise<string|null>} - The voice ID if found, null otherwise
 */
async function getUserVoiceId(username) {
  try {
    // Check cache first
    const now = Date.now();
    if (voiceCacheByUsername.has(username)) {
      const lastUpdate = voiceCacheLastUpdate.get(username) || 0;
      if (now - lastUpdate < VOICE_CACHE_TTL) {
        console.log(`[VOICE] Using cached voice ID for user ${username}`);
        return voiceCacheByUsername.get(username);
      }
    }
    
    // Check local file as a second source
    const voiceMapping = readVoiceMapping();
    if (voiceMapping.userVoices[username]) {
      console.log(`[VOICE] Found voice ID in local mapping for user ${username}: ${voiceMapping.userVoices[username]}`);
      // Update cache
      voiceCacheByUsername.set(username, voiceMapping.userVoices[username]);
      voiceCacheLastUpdate.set(username, now);
      return voiceMapping.userVoices[username];
    }
    
    console.log(`[VOICE] Checking for voice clone for user ${username}`);
    
    // Get the ElevenLabs API key from environment
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      console.error('[VOICE] ElevenLabs API key not configured');
      return null;
    }
    
    // Call the ElevenLabs API to list voices
    const response = await axios.get('https://api.elevenlabs.io/v2/voices', {
      params: {
        voice_type: 'personal'
      },
      headers: {
        'xi-api-key': apiKey
      }
    });
    
    if (!response.data || !response.data.voices) {
      console.error('[VOICE] Invalid response from ElevenLabs API:', response.data);
      return null;
    }
    
    // Look for a voice with the user's name
    const userVoice = response.data.voices.find(voice => 
      voice.name.toLowerCase() === username.toLowerCase()
    );
    
    if (userVoice) {
      console.log(`[VOICE] Found voice clone for user ${username}: ${userVoice.voice_id}`);
      // Update cache
      voiceCacheByUsername.set(username, userVoice.voice_id);
      voiceCacheLastUpdate.set(username, now);
      
      // Update local file
      voiceMapping.userVoices[username] = userVoice.voice_id;
      writeVoiceMapping(voiceMapping);
      
      return userVoice.voice_id;
    } else {
      console.log(`[VOICE] No voice clone found for user ${username}`);
      // Update cache with null to avoid repeated checks
      voiceCacheByUsername.set(username, null);
      voiceCacheLastUpdate.set(username, now);
      return null;
    }
  } catch (error) {
    console.error(`[VOICE] Error checking for voice clone for user ${username}:`, error);
    
    // Fall back to local file if API fails
    const voiceMapping = readVoiceMapping();
    if (voiceMapping.userVoices[username]) {
      console.log(`[VOICE] API failed, using local mapping for user ${username}: ${voiceMapping.userVoices[username]}`);
      return voiceMapping.userVoices[username];
    }
    
    return null;
  }
}