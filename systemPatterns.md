# System Patterns: Real-time Translation Meeting Room

## Architecture Overview
The real-time translation meeting room is built on a layered architecture that connects users through a central server, enabling seamless cross-language communication. The system is designed to minimize latency while maintaining high accuracy for speech recognition, translation, and voice synthesis.

### Key Components
1. **Client Application**
   - React-based frontend
   - Audio capture and streaming
   - Real-time user interface updates
   - Language preference management
   - Conversation display with translation indicators
   - Text-to-speech playback system
   - User controls (mute, language settings, etc.)
   - Meeting notes display with Markdown rendering

2. **WebSocket Server**
   - Socket.IO for real-time communication
   - User and room management
   - Message routing and broadcast
   - Session state maintenance
   - Translation coordination
   - Text-to-speech API integration
   - Meeting notes generation and distribution

3. **AI Services Layer**
   - Speech recognition via Deepgram API
   - Text translation via Google Translate API
   - Text-to-speech via ElevenLabs API
   - Meeting notes generation via OpenRouter API with DeepSeek model

4. **Media Processing Pipeline**
   - Audio streaming from client to server
   - Speech detection and transcription
   - Translation processing
   - Voice synthesis
   - Delivery to recipients

## Core Communication Patterns

### WebSocket Communication
1. **Event Types**
   - `join-room`: User joins a meeting room
   - `leave-room`: User leaves a meeting room
   - `user-joined`: Broadcast when a new user joins
   - `user-left`: Broadcast when a user leaves
   - `send-message`: User sends a text message
   - `new-message`: Broadcast message to recipients
   - `interim-message`: Real-time speech transcription updates
   - `user-speaking-started`: Notify when a user begins speaking
   - `user-speaking-stopped`: Notify when a user stops speaking
   - `update-language`: User changes language preference
   - `update-meeting-notes-language`: User changes meeting notes language preference
   - `start-stream`: Initialize audio streaming
   - `stream-ready`: Server ready to receive audio
   - `audio-data`: Stream of audio data from client
   - `stop-stream`: End audio streaming session
   - `generate-meeting-notes`: Request to generate meeting notes
   - `meeting-notes-updated`: Broadcast updated meeting notes

2. **Connection Lifecycle**
   ```
   Client                     Server
     |                          |
     |---- connect ------------>|
     |<--- connection success --|
     |                          |
     |---- join-room ---------->|
     |<--- user-joined ---------|
     |<--- load-messages -------|
     |                          |
     |---- start-stream ------->|
     |<--- stream-ready --------|
     |---- audio-data --------->|
     |<--- interim-message -----|
     |<--- new-message ---------|
     |                          |
     |---- stop-stream -------->|
     |                          |
     |---- generate-meeting---->|
     |      notes               |
     |<--- meeting-notes--------|
     |      updated             |
     |                          |
     |---- leave-room --------->|
     |<--- user-left ----------|
     |                          |
     |---- disconnect --------->|
   ```

## Data Models

1. **Room Object**
   ```javascript
   {
     [roomId]: {
       users: {
         [socketId]: {
           username: "User's display name",
           language: "en-US",
           meetingNotesLanguage: "hi"
         }
       },
       messages: [/* message objects */],
       messageCountSinceLastNotes: 7,
       meetingNotes: [/* meeting notes objects */]
     }
   }
   ```

2. **User Object**
   ```javascript
   {
     [socketId]: {
       username: "User's display name",
       language: "en-US",
       meetingNotesLanguage: "en-US"
     }
   }
   ```

3. **Message Object**
   ```javascript
   {
     id: "unique_message_id",
     userId: "socket_id",
     username: "User's display name",
     text: "Message content",
     language: "en-US",
     timestamp: "ISO timestamp",
     isFinal: true,
     reactions: {
       "👍": [
         { userId: "socket_id", username: "User1" },
         { userId: "socket_id", username: "User2" }
       ],
       "❤️": [
         { userId: "socket_id", username: "User3" }
       ]
     }
   }
   ```

4. **System Message Object**
   ```javascript
   {
     isSystem: true,
     text: "System message content",
     timestamp: "ISO timestamp"
   }
   ```

5. **Interim Message Object**
   ```javascript
   {
     userId: "socket_id",
     username: "User's display name",
     text: "Partial transcript",
     language: "en-US",
     isFinal: false,
     wordCount: 5
   }
   ```

6. **Speaking State Tracking**
   ```javascript
   {
     [userId]: {
       username: "User's display name",
       isSpeaking: true
     }
   }
   ```

7. **Meeting Notes Object**
   ```javascript
   {
     text: "Markdown formatted meeting notes content",
     timestamp: "ISO timestamp",
     messageCount: 30,
     isAutoGenerated: true,
     generatedByUserId: "socket_id",
     generatedByUsername: "User's display name"
   }
   ```

8. **Meeting Notes Prompt Object**
   ```javascript
   {
     systemPrompt: "System instructions for the AI model",
     userPrompt: "User message with conversation transcript"
   }
   ```

## Design Patterns

### Message Translation Pattern
1. **Per-Recipient Translation**
   - Each message is translated specifically for each recipient based on their language preference
   - Original messages are preserved for users who share the sender's language
   - Translation metadata is included for potential UI enhancements

   ```javascript
   // Translation flow for a single message
   socket.on('send-message', async ({ room, message }) => {
     // Create original message object
     const originalMessage = { text: message, language: sender.language, ... };
     
     // Store original message in room history
     rooms[room].messages.push(originalMessage);
     
     // For each recipient in the room
     for (const recipientId of Object.keys(rooms[room].users)) {
       const recipientLanguage = rooms[room].users[recipientId].language;
       
       // If recipient shares sender's language, send original
       if (recipientId === socket.id || recipientLanguage === sender.language) {
         io.to(recipientId).emit('new-message', originalMessage);
       } 
       // Otherwise translate for this specific recipient
       else {
         const translatedText = await translateText(
           message, 
           sender.language, 
           recipientLanguage
         );
         
         io.to(recipientId).emit('new-message', {
           ...originalMessage,
           text: translatedText,
           isTranslated: true,
           originalLanguage: sender.language
         });
       }
     }
   });
   ```

### Speech Recognition Pattern
1. **Streaming Audio Processing**
   - Client captures audio and streams to server
   - Server processes audio through Deepgram API
   - Interim results shown during speech
   - Final transcripts added to conversation history

2. **Speaking State Management**
   - Multi-layered protection against stuck indicators
   - Threshold-based activation (3+ words)
   - Explicit state clearing on mute
   - Safety timers for edge cases

### Meeting Notes Generation Pattern
1. **Dynamic Prompt Construction**
   - System analyzes conversation context:
     - Participant information (number of users, usernames)
     - Message statistics (count per user, participation percentages)
     - Total message count
     - Room information
   - Creates structured prompt with clear instructions
   - Formats messages chronologically with usernames

   ```javascript
   // Dynamic prompt creation
   const createMeetingNotesPrompt = (roomId) => {
     // Get users and messages from the room
     const users = Object.values(rooms[roomId].users);
     const messages = rooms[roomId].messages;
     
     // Calculate message statistics
     const messagesByUser = {};
     messages.forEach(msg => {
       if (!messagesByUser[msg.username]) messagesByUser[msg.username] = 0;
       messagesByUser[msg.username]++;
     });
     
     // Format participants info with statistics
     const participantsInfo = Object.entries(messagesByUser)
       .map(([name, count]) => `${name} (${count} messages, ${Math.round(count/messages.length*100)}%)`)
       .join(', ');
     
     // Create system prompt with detailed instructions
     const systemPrompt = `You are an AI assistant that generates meeting notes.
     Room: ${roomId}
     Participants: ${users.map(u => u.username).join(', ')}
     Active Speakers: ${participantsInfo}
     
     Instructions:
     1. Use Markdown formatting with proper headings
     2. Include a summary section
     3. List key discussion points
     ...`;
     
     // Format messages chronologically for user prompt
     const userPrompt = `Please generate meeting notes for this conversation:
     
     ${messages.map(m => `${m.username}: ${m.text}`).join('\n')}`;
     
     return { systemPrompt, userPrompt };
   };
   ```

2. **Automatic and Manual Triggers**
   - Automatic generation every 10 messages
   - Manual generation via user request
   - Message counting mechanism per room

   ```javascript
   // Check if should generate notes automatically
   const shouldGenerateNotes = (room) => {
     // Initialize counter if needed
     if (room.messageCountSinceLastNotes === undefined) {
       room.messageCountSinceLastNotes = 0;
     }
     
     // Increment counter with each new message
     room.messageCountSinceLastNotes++;
     
     // Check if threshold reached
     if (room.messageCountSinceLastNotes >= 10) {
       room.messageCountSinceLastNotes = 0;
       return true;
     }
     
     return false;
   };
   ```

3. **Language-Specific Delivery**
   - Translate generated notes to each user's preferred language
   - Honor separate meeting notes language preference
   - Preserve Markdown formatting during translation

### Markdown-Aware Translation Pattern
1. **Block-based Translation**
   - Split document into logical blocks (paragraphs, lists, headings)
   - Identify block type and apply specialized processing
   - Process each block with appropriate format preservation
   - Reassemble translated blocks maintaining structure

   ```javascript
   // Block-based translation approach
   const translateMeetingNotesForUser = async (notes, targetLanguage) => {
     // Split into blocks by double newlines
     const blocks = notes.split(/\n\n+/);
     const translatedBlocks = [];
     
     for (const block of blocks) {
       // Check if heading
       if (/^#{1,6}\s+.+$/.test(block)) {
         const [prefix, headingText] = block.match(/^(#{1,6})\s+(.+)$/);
         // Translate only the heading text
         const translatedHeading = await translateText(headingText, 'en', targetLanguage);
         translatedBlocks.push(`${prefix} ${translatedHeading}`);
       } 
       // Check if list
       else if (block.split('\n').every(line => /^\s*([*-]|\d+\.)\s+.+/.test(line))) {
         // Process each list item separately
         const lines = block.split('\n');
         const translatedLines = [];
         
         for (const line of lines) {
           const [_, indent, marker, content] = line.match(/^(\s*)([*-]|\d+\.)\s+(.+)$/);
           const translatedContent = await translateText(content, 'en', targetLanguage);
           translatedLines.push(`${indent}${marker} ${translatedContent}`);
         }
         
         translatedBlocks.push(translatedLines.join('\n'));
       } 
       // Normal paragraph
       else {
         const translatedBlock = await translateText(block, 'en', targetLanguage);
         translatedBlocks.push(translatedBlock);
       }
     }
     
     return translatedBlocks.join('\n\n');
   };
   ```

2. **Sentence-by-Sentence Processing**
   - Split long paragraphs into individual sentences
   - Translate each sentence separately
   - Recombine sentences for final result
   - Prevents repetition issues in complex languages

## Text-to-Speech Pattern
1. **Audio Playback Queue**
   - Queue messages for sequential playback
   - Play only messages from other users
   - Handle browser autoplay policies

   ```javascript
   // Client-side audio queue implementation
   const audioQueueRef = useRef([]);
   const currentAudioRef = useRef(null);
   
   const playNextInQueue = () => {
     if (audioQueueRef.current.length === 0 || isAudioPlaying) return;
     
     // Get next message from queue
     const nextMessage = audioQueueRef.current.shift();
     
     // Don't play own messages
     if (nextMessage.userId === myUserId) {
       playNextInQueue();
       return;
     }
     
     // Create audio for this message
     fetchAndPlayAudio(nextMessage.text, nextMessage.language);
   };
   ```

2. **Language Mapping**
   - Comprehensive mapping for API compatibility
   - Handle regional variants and special codes

   ```javascript
   // Server-side language mapping
   function mapToElevenLabsLanguageCode(language) {
     const lang = (language || 'en').toLowerCase();
     
     const elevenlabsLanguageMap = {
       'en': 'en',
       'es': 'es',
       'fr': 'fr',
       // Many more mappings...
       'multi': 'en' // Default for special cases
     };
     
     // Direct match
     if (elevenlabsLanguageMap[lang]) {
       return elevenlabsLanguageMap[lang];
     }
     
     // Handle hyphenated codes: en-US -> en
     if (lang.includes('-')) {
       const base = lang.split('-')[0];
       return elevenlabsLanguageMap[base] || 'en';
     }
     
     // Default to English
     return 'en';
   }
   ```

## UI Patterns

### Responsive Layout Pattern
1. **Flexible Sidebar Design**
   - Split sidebar with draggable divider
   - Percentage-based sizing for responsiveness
   - Independent scrollable sections

2. **Message Display Pattern**
   - Fixed-height container with scroll
   - Distinguish between user and other messages
   - Show translation metadata

3. **Speaking Feedback Pattern**
   - Show interim transcripts with animation
   - Indicate active speaker in UI
   - Provide visual feedback during speech

4. **Meeting Notes Export Pattern**
   - Markdown file export with comprehensive metadata
   - Filename based on room name and timestamp
   - Visual feedback during export process
   - Client-side file generation and download
   - Preservation of original and translated content
   
```javascript
// Export Meeting Notes to Markdown Pattern
const exportAsMarkdown = () => {
  if (meetingNotes) {
    setIsExporting(true);
    
    // Create metadata header with rich context
    const metadata = [
      `# Meeting Notes: ${room || 'Untitled Room'}`,
      `**Date:** ${formattedDate}`,
      '',
    ];
    
    // Add participants info if available
    if (roomUsers && roomUsers.length > 0) {
      metadata.push('**Participants:**');
      roomUsers.forEach(user => {
        metadata.push(`- ${user.username}${user.language ? ` (${user.language})` : ''}`);
      });
      metadata.push('');
    }
    
    // Add generation metadata
    if (meetingNotesGenInfo) {
      const generationType = meetingNotesGenInfo.isAuto ? 'Automatically generated' : 'Manually generated';
      metadata.push(`**Generation Type:** ${generationType}`);
      
      // Add who generated it if it was manual
      if (!meetingNotesGenInfo.isAuto && meetingNotesGenInfo.username) {
        metadata.push(`**Generated by:** ${meetingNotesGenInfo.username}`);
      }
      
      // Add translation info
      if (meetingNotesGenInfo.isTranslated) {
        metadata.push('**Note:** This content has been translated from the original language.');
      }
      metadata.push('');
    }
    
    // Add separator
    metadata.push('---', '');
    
    // Combine metadata with meeting notes content
    const fullContent = metadata.join('\n') + meetingNotes;
    
    // Create file and trigger download
    const blob = new Blob([fullContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    
    // Include room name in file name
    const roomSlug = room ? room.toLowerCase().replace(/\s+/g, '-') : 'meeting';
    const filename = `${roomSlug}-notes-${timestamp}.md`;
    
    // Browser download mechanism
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
};
```

### Dual Language Preferences Pattern
1. **User Language Management**
   - Main language preference for conversation
   - Separate language preference for meeting notes
   - Fallback mechanisms for compatibility
   - Server-side storage of preferences

   ```javascript
   // Server-side handling of language preferences
   socket.on('update-language', ({ room, language }) => {
     if (rooms[room]?.users?.[socket.id]) {
       rooms[room].users[socket.id].language = language;
       // Other language-specific handling...
     }
   });
   
   socket.on('update-meeting-notes-language', ({ room, meetingNotesLanguage }) => {
     if (rooms[room]?.users?.[socket.id]) {
       rooms[room].users[socket.id].meetingNotesLanguage = meetingNotesLanguage;
     }
   });
   ```

2. **Client-side Preference UI**
   - Clearly labeled language dropdowns
   - Descriptive text explaining each setting
   - Default meeting notes language to conversation language

5. **Message Reactions Pattern**
   - Hover-to-reveal reaction button on each message
   - Emoji picker popover for selecting reactions
   - Visual grouping of reactions by emoji type
   - Count display for each reaction type
   - User highlighting for their own reactions
   - Toggle behavior (clicking an emoji again removes the reaction)
   - Tooltips showing users who reacted with each emoji

   ```javascript
   // Server-side reaction handling
   socket.on('add-reaction', ({ room, messageId, reaction }) => {
     // Find the message in the room
     const message = rooms[room].messages.find(msg => msg.id === messageId);
     
     // Initialize or update reactions
     if (!message.reactions) message.reactions = {};
     if (!message.reactions[reaction]) message.reactions[reaction] = [];
     
     // Check if user already reacted with this emoji
     const existingReactionIndex = message.reactions[reaction]
       .findIndex(r => r.userId === socket.id);
     
     if (existingReactionIndex !== -1) {
       // Remove reaction if already exists (toggle behavior)
       message.reactions[reaction].splice(existingReactionIndex, 1);
       if (message.reactions[reaction].length === 0) {
         delete message.reactions[reaction];
       }
     } else {
       // Add new reaction
       message.reactions[reaction].push({
         userId: socket.id,
         username: rooms[room].users[socket.id].username
       });
     }
     
     // Broadcast updated reactions to all users
     io.to(room).emit('message-reaction-updated', {
       messageId,
       reactions: message.reactions
     });
   });
   
   // Client-side reaction rendering
   const renderReactions = (reactions) => {
     return (
       <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
         {Object.entries(reactions).map(([emoji, users]) => (
           <Tooltip title={users.map(u => u.username).join(', ')}>
             <Box sx={{ 
               display: 'flex',
               backgroundColor: alpha(theme.palette.primary.main, 0.1),
               borderRadius: '12px',
               px: 1,
               cursor: 'pointer',
               ...(userReacted && { 
                 backgroundColor: alpha(theme.palette.primary.main, 0.3),
               }),
             }}>
               <Typography>{emoji}</Typography>
               <Typography variant="caption">{users.length}</Typography>
             </Box>
           </Tooltip>
         ))}
       </Box>
     );
   };
   ```

### Theme System Pattern
1. **Dynamic Theme Switching**
   - Theme generator function that creates themes based on a mode parameter ('light' or 'dark')
   - Complete theme objects for both light and dark modes
   - Consistent component styling across theme modes
   - LocalStorage persistence for user theme preference

   ```javascript
   // Theme generator implementation
   const createAppTheme = (mode) => createTheme({
     palette: {
       mode,
       primary: {
         main: mode === 'dark' ? '#9c27b0' : '#e7b75e', // Purple for dark, Gold for light
         // Other color definitions with mode-specific values
       },
       background: {
         default: mode === 'dark' ? '#121212' : '#f4f1e6', // Dark/cream background
         paper: mode === 'dark' ? '#1e1e1e' : '#ffffff',   // Dark/white paper
       },
       // Other palette properties with conditional values
     },
     // Typography, shapes, and component overrides
   });

   // Theme state management in App component
   const [themeMode, setThemeMode] = useState(localStorage.getItem('themeMode') || 'dark');
   
   const toggleTheme = useCallback(() => {
     const newMode = themeMode === 'dark' ? 'light' : 'dark';
     setThemeMode(newMode);
     localStorage.setItem('themeMode', newMode);
   }, [themeMode]);
   ```

2. **Theme Toggle Components**
   - Toggle buttons in both AppBar and login screen
   - Icon-based indicators (sun/moon) for current theme
   - Tooltips for improved accessibility
   - Consistent placement across application

3. **Component-level Theme Awareness**
   - Conditional styling based on current theme
   - Dynamic color gradients for buttons and controls
   - Proper text contrast in both themes
   - Consistent experience across the application

   ```javascript
   // Component with theme-aware styling
   <Button
     variant="contained"
     sx={{
       background: themeMode === 'dark' 
         ? 'linear-gradient(90deg, #9c27b0 30%, #673ab7 90%)'
         : 'linear-gradient(90deg, #e7b75e 30%, #c99840 90%)',
       color: themeMode === 'dark' ? 'white' : '#333333',
       // Other conditional styles
     }}
   >
     Button Text
   </Button>
   ```

## Future Architecture Extensions
1. **Translation Layer**
   - Integration with translation service
   - Language preference matching
   - Original/translated text display

2. **Text-to-Speech System**
   - Server-side API integration with ElevenLabs for secure handling of API keys
   - Comprehensive language code mapping for all 32 languages supported by ElevenLabs
   - Special handling for non-standard language codes like "multi" (mapped to "en")
   - Message queue system for sequential audio playback
   - Client-side audio handling with play/pause control
   - TTS toggle functionality for user preferences
   - Selective playback logic that only plays TTS for others' messages, not the sender's own
   - Browser autoplay policy handling with silent audio initialization
   - Error logging and debugging throughout the TTS pipeline
   - Client-server proxy configuration in package.json for seamless API communication
   - Test Audio button for verifying TTS functionality
   - Blob-based audio URL creation for memory-efficient playback
   - Queue management for handling multiple incoming messages
   - Event-based audio player with proper resource cleanup

3. **Meeting Notes**
   - Automated summarization
   - Key points extraction
   - Action item detection
   - Export functionality
   - Language-specific delivery
   - Format preservation during translation

4. **Voice Cloning**
   - Speaker voice profile creation
   - Voice synthesis for translations
   - Cross-language voice preservation

## Technical Learnings
1. **ElevenLabs API Integration**:
   - Server-side relay approach provides better security for API keys
   - The eleven_flash_v2.5 model offers a good balance of speed and quality
   - Message queueing is essential for handling multiple incoming messages
   - Setting proper language codes improves pronunciation in different languages
   - Comprehensive language code mapping is critical for multilingual support
   - Selective playback prevents audio echo issues for the speaker

2. **API Integration Management**:
   - Direct API calls offer more control than wrapper libraries
   - Proper headers and timeouts are essential for reliable API usage
   - Retry mechanisms with exponential backoff improve resilience
   - Rate limiting protection is critical for public API endpoints
   - Block-based processing preserves formatting better in complex documents
   - Sentence-by-sentence translation improves quality for long content

3. **Deepgram API Integration**:
   - Explicitly configuring the model parameter is critical for consistent behavior
   - Creating fresh client instances for each connection helps avoid cached configurations
   - Validating WebSocket URLs provides a reliable way to verify the correct model is being used
   - The "nova-2" model provides better multilingual support than "nova-3"

4. **UI Layout Management**:
   - Fixed height containers with proper overflow handling is crucial for scrollable content
   - Nested flex containers provide better control over layout
   - CSS properties like `overflow: hidden` and `flex: 1 1 auto` help maintain layout integrity

5. **Speech Detection Improvements**:
   - Accumulating transcripts during speech leads to more natural, complete sentences
   - Word threshold filtering helps eliminate noise and false starts
   - Tracking speaking state prevents duplicate notifications and UI updates
   - Real-time feedback of interim transcripts improves user experience and confidence
   - Sound wave animations provide intuitive visual feedback for active speaking

6. **Meeting Notes Generation**:
   - Dynamic prompt creation delivers more tailored results
   - Including participant statistics improves context awareness
   - User-specific language preferences enhance accessibility
   - Markdown preservation during translation requires specialized handling
   - Room-wide message counting ensures balanced note generation
   - Block-based translation maintains document structure

## Backlog Items (for future steps)
- Meeting notes export functionality
- Enhanced prompt engineering for better quality
- Voice cloning capabilities
- Fix and re-enable push-to-talk functionality
- Multilingual speaker support
- User interface enhancements
- Private room creation and management
- User authentication and profiles
- Mobile-friendly responsive design optimization
- Accessibility improvements

This architecture document will be updated as we implement additional features and refine existing patterns.

## Voice Cloning Persistence Architecture

The voice cloning system follows a multi-tier architecture with a robust persistence strategy:

```
┌─────────────┐      ┌─────────────┐      ┌───────────────────┐
│ Client-side │      │  Server API │      │ Persistence Layer │
│ Components  │<─────│  Endpoints  │<─────│ (In-memory cache, │
└─────────────┘      └─────────────┘      │  API, JSON file)  │
                                          └───────────────────┘
```

### Key Components:

1. **Frontend (Client-side)**:
   - `JoinRoom.js`: Handles voice recording, clone status checking, and UI adaptation
   - Voice status indicators showing whether a user has an existing voice
   - Adaptive UI that changes based on voice clone status

2. **Backend (Server)**:
   - `/api/voice-clone`: Endpoint for creating new voice clones via ElevenLabs API
   - `/api/check-voice-clone`: Endpoint for checking if a user has an existing voice
   - `getUserVoiceId()`: Function that retrieves voice IDs using a multi-tier lookup strategy

3. **Persistence Layer**:
   - In-memory cache for high-performance lookups (first tier)
   - ElevenLabs API for retrieving voice IDs by name (second tier)
   - Local JSON file (`voiceMapping.json`) for persistent storage (third tier)

### Data Flow:

1. When a user attempts to join a room:
   - Client checks if user has an existing voice clone using `/api/check-voice-clone`
   - Server performs multi-tier lookup (cache → API → file)
   - UI adapts based on response (showing either "Voice Detected" or recording controls)

2. When a user creates a new voice clone:
   - Audio recording is sent to server
   - Server makes API call to ElevenLabs
   - Successful clones are stored in both memory cache and JSON file
   - All users in room are notified of new voice via Socket.IO events

3. During text-to-speech operations:
   - Server includes `speakerId` in TTS requests
   - Voice ID is retrieved using same multi-tier lookup
   - TTS is performed with the user's cloned voice or default voice

## Multi-Level Caching Strategy

The application implements a sophisticated multi-level caching approach for voice ID management:

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ Memory Cache │───>│  API Lookup  │───>│  JSON File  │
│    (RAM)     │    │ (ElevenLabs) │    │  (Disk)     │
└─────────────┘    └─────────────┘    └─────────────┘
```

1. **In-Memory Cache (Level 1)**:
   - Fastest retrieval method (O(1) lookup)
   - Temporary storage with TTL
   - Cleared on server restart
   - Implemented as JavaScript object

2. **API Lookup (Level 2)**:
   - Retrieves voice IDs directly from ElevenLabs
   - More reliable but slower than memory cache
   - Uses username-based voice naming convention
   - Results are cached in memory after retrieval

3. **JSON File Storage (Level 3)**:
   - Persistent across server restarts
   - Simple key-value structure
   - Synchronous file operations for simplicity
   - Automatically updated when new voices are created
   - Serves as final fallback mechanism

### Cache Update Strategy:
- Write-through caching (updates all levels simultaneously)
- New voice clones update both memory cache and JSON file
- Memory cache cleared based on time-to-live or server restart

## Persistence Strategies

The application implements multiple persistence strategies:

1. **Socket.IO Room State**:
   - In-memory user lists
   - Language preferences
   - Speaking state tracking
   
2. **Browser LocalStorage**:
   - User settings (name, language)
   - UI preferences (theme)
   - Audio settings

3. **File-based Persistence**:
   - Voice mapping in JSON file
   - Username to voice ID mapping

4. **API-based Persistence**:
   - ElevenLabs API for voice profile storage
   - Username-based voice retrieval

## Dynamic UI Adaptation Pattern

The application implements UI elements that adapt based on external data state:

```
┌────────────┐    ┌─────────────┐    ┌────────────────┐
│ Data Check │───>│ State Update │───>│ UI Adaptation  │
└────────────┘    └─────────────┘    └────────────────┘
```

1. **Data Status Check**:
   - API call to determine existing voice status
   - Loading state during check
   - Error handling for failed checks

2. **Component State Management**:
   - State variables to track voice status
   - Loading indicators during async operations
   - Error state handling and user feedback

3. **Conditional Rendering**:
   - Different UI components based on voice status
   - Progressive disclosure of recording interface
   - Clear visual indicators for existing voices
   - Disabled controls when appropriate 

## Real-time Communication Patterns

The system uses Socket.IO with multiple event types to enable rich real-time interactions:

```
Client (Socket Emitter) --> Server (Socket Listener) --> Other Clients
```

### Core Events:
- `join`: User joins room with language preference
- `chat message`: Text message sent to room
- `speech-started`/`speech-ended`: Speech state indicators
- `interim-transcript`: Partial speech recognition results
- `final-transcript`: Complete transcribed speech
- `request-tts`: Request for text-to-speech conversion
- `tts-ready`: Notification that TTS audio is ready
- `user-list`: Updated list of room participants
- `mute-user`: User mute state changes
- `generate-notes`: Request to generate meeting notes
- `notes-generated`: Notification that notes are ready
- `add-reaction`: Add reaction to a message
- `voice-cloned`: Notification that a user's voice has been cloned

## Meeting Notes Generation Pattern

```
┌──────────────┐    ┌──────────────┐    ┌───────────────┐    ┌──────────────┐
│ Conversation │───>│ AI Processing│───>│  Translation  │───>│ Display/Export│
│    Data      │    │ (OpenRouter) │    │ (Google API)  │    │   System     │
└──────────────┘    └──────────────┘    └───────────────┘    └──────────────┘
```

1. **Data Collection**: Accumulates conversation messages with metadata
2. **Prompt Construction**: Builds dynamic prompt with conversation context
3. **AI Generation**: Uses OpenRouter API with DeepSeek model
4. **Translation**: Translates to each user's preferred language
5. **Display & Export**: Presents as Markdown with export functionality

## Translation System Pattern

The application uses a hybrid translation system:

1. **Message Translation**:
   - Direct Google Translate API calls
   - Simple text-based translation
   - Language code normalization for API compatibility

2. **Meeting Notes Translation**:
   - Block-based translation approach
   - Preserves Markdown formatting
   - Processes longer content in chunks
   - Handles special characters and formatting 