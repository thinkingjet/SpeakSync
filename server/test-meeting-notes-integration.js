// Comprehensive test script for meeting notes generation
// Tests both direct OpenRouter API calls and server API integration
const fetch = require('node-fetch');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Server configuration
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:5000';
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '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';

// Example meeting transcript 1: Project planning meeting
const projectPlanningConversation = [
  { username: "Alex", text: "Good morning everyone. Let's discuss our next steps for the translation app." },
  { username: "Emma", text: "I've been working on the UI improvements. The dark mode is almost ready." },
  { username: "Alex", text: "Great! What's the timeline for completion?" },
  { username: "Emma", text: "I should be done by Friday. Need about 2 more days for testing." },
  { username: "John", text: "I've been focusing on the translation API. We're having some rate limiting issues." },
  { username: "Alex", text: "What solutions have you considered?" },
  { username: "John", text: "We could implement caching for common phrases or switch to a paid API." },
  { username: "Emma", text: "Caching sounds good. We could start with that and see if it helps." },
  { username: "Alex", text: "Agreed. John, can you implement basic caching this week?" },
  { username: "John", text: "Yes, I'll have a prototype ready by Thursday." },
  { username: "Maya", text: "I've completed the user testing for the speech recognition. Users are happy with the accuracy but want faster response times." },
  { username: "Alex", text: "That's valuable feedback. Can we optimize the audio processing?" },
  { username: "John", text: "We could reduce audio quality slightly to improve speed." },
  { username: "Maya", text: "I'll test different quality settings and find the optimal balance." },
  { username: "Alex", text: "Perfect. Let's meet again next Monday to review progress." },
  { username: "Emma", text: "Sounds good to me." },
  { username: "John", text: "I'll prepare a demo of the caching implementation." },
  { username: "Maya", text: "And I'll have the optimization results ready." }
];

// Example meeting transcript 2: Customer feedback discussion
const customerFeedbackConversation = [
  { username: "Sarah", text: "Welcome everyone. Today we're discussing recent customer feedback on our translation app." },
  { username: "David", text: "Thanks Sarah. I've compiled the feedback from our last ten customer interviews." },
  { username: "Sarah", text: "Great, what are the main issues customers are reporting?" },
  { username: "David", text: "The number one concern is connection stability in low bandwidth scenarios." },
  { username: "Lisa", text: "That aligns with what we're seeing in the support tickets too." },
  { username: "Michael", text: "I think we should prioritize offline mode capabilities to address this." },
  { username: "Sarah", text: "Good point. What other feedback do we have?" },
  { username: "David", text: "Many users are requesting the ability to export meeting transcripts in different formats." },
  { username: "Lisa", text: "Yes, particularly PDF and Word formats for business users." },
  { username: "Michael", text: "We could implement export functionality in the next sprint." },
  { username: "Sarah", text: "Let's prioritize these issues. Connection stability seems most urgent." },
  { username: "David", text: "Agreed. I can draft a proposal for offline capabilities by tomorrow." },
  { username: "Lisa", text: "I'll work on the design for transcript export options." },
  { username: "Michael", text: "I'll estimate the development effort required for both features." },
  { username: "Sarah", text: "Perfect. Any other critical feedback we should discuss?" },
  { username: "David", text: "Some users mentioned they'd like better integration with video conferencing platforms." },
  { username: "Lisa", text: "That's a good future direction, but maybe for next quarter." },
  { username: "Sarah", text: "I agree. Let's keep that in mind for our roadmap discussion next month." }
];

// Simulated room data with users
const simulatedRooms = {
  "test-room-planning": {
    users: {
      "socket-alex": { username: "Alex", language: "en-US" },
      "socket-emma": { username: "Emma", language: "en-US" },
      "socket-john": { username: "John", language: "en-US" },
      "socket-maya": { username: "Maya", language: "en-US" }
    },
    messages: projectPlanningConversation.map((msg, index) => ({
      userId: `socket-${msg.username.toLowerCase()}`,
      username: msg.username,
      text: msg.text,
      language: "en-US",
      languageDisplay: "English (US)",
      timestamp: new Date(Date.now() - (projectPlanningConversation.length - index) * 60000).toISOString(),
      isFinal: true
    }))
  },
  "test-room-feedback": {
    users: {
      "socket-sarah": { username: "Sarah", language: "en-US" },
      "socket-david": { username: "David", language: "en-US" },
      "socket-lisa": { username: "Lisa", language: "en-US" },
      "socket-michael": { username: "Michael", language: "en-US" }
    },
    messages: customerFeedbackConversation.map((msg, index) => ({
      userId: `socket-${msg.username.toLowerCase()}`,
      username: msg.username,
      text: msg.text,
      language: "en-US",
      languageDisplay: "English (US)",
      timestamp: new Date(Date.now() - (customerFeedbackConversation.length - index) * 60000).toISOString(),
      isFinal: true
    }))
  }
};

// Function to create a dynamic prompt for direct OpenRouter API testing
function createTestPrompt(roomId) {
  const room = simulatedRooms[roomId];
  if (!room || !room.messages || room.messages.length === 0) {
    return null;
  }
  
  // Get users in the room
  const users = Object.values(room.users);
  const userCount = users.length;
  const usernames = users.map(user => user.username);
  
  // Count messages per user to identify main participants
  const messagesByUser = {};
  let totalMessages = 0;
  
  room.messages.forEach(msg => {
    totalMessages++;
    if (!messagesByUser[msg.username]) {
      messagesByUser[msg.username] = 0;
    }
    messagesByUser[msg.username]++;
  });
  
  // Format the active participants information
  const participantsInfo = Object.entries(messagesByUser)
    .sort((a, b) => b[1] - a[1]) // Sort by message count, highest first
    .map(([username, count]) => `${username} (${count} messages, ${Math.round(count/totalMessages*100)}% participation)`)
    .join(', ');
  
  // Format messages in chronological order with usernames
  const formattedMessages = room.messages
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

  // User prompt is simple - just asking to generate meeting notes for the transcript
  const userPrompt = `Please generate meeting notes from the following conversation transcript:\n\n${formattedMessages}`;
  
  return { systemPrompt, userPrompt };
}

// Function to test OpenRouter API directly
async function testOpenRouterApi(roomId) {
  console.log(`\n===== Testing OpenRouter API directly for room: ${roomId} =====\n`);
  
  try {
    // Generate dynamic prompt
    const prompt = createTestPrompt(roomId);
    if (!prompt) {
      console.error(`Failed to create prompt for room ${roomId}`);
      return;
    }
    
    console.log(`Generated prompt with system (${prompt.systemPrompt.length} chars) and user (${prompt.userPrompt.length} chars) content`);
    
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
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
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
    
    console.log(`Making direct request to OpenRouter API for room ${roomId}`);
    console.log(`Using model: ${data.model}`);
    
    // Make the request to OpenRouter API
    const startTime = Date.now();
    const openRouterResponse = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(data)
    });
    
    const responseTime = Date.now() - startTime;
    
    if (!openRouterResponse.ok) {
      console.error(`OpenRouter API error (${openRouterResponse.status})`);
      
      let errorDetails = {};
      try {
        errorDetails = await openRouterResponse.json();
        console.error('Error details:', errorDetails);
      } catch (e) {
        console.error('Error parsing error response:', e);
      }
      
      return;
    }
    
    // Get the response
    const responseData = await openRouterResponse.json();
    console.log(`Response received in ${responseTime}ms`);
    console.log(`Model used: ${responseData.model || 'Unknown'}`);
    console.log(`Tokens used: ${responseData.usage?.total_tokens || 'Unknown'}`);
    
    // Extract the generated notes
    const generatedNotes = responseData.choices[0].message.content;
    
    console.log("\n----- Generated Meeting Notes from Direct OpenRouter API -----\n");
    console.log(generatedNotes);
    console.log("\n----- End of Generated Notes -----\n");
    
    return generatedNotes;
  } catch (error) {
    console.error(`Error testing OpenRouter API: ${error.message}`);
    console.error(error);
  }
}

// Function to test meeting notes generation via the server API
async function testServerMeetingNotesAPI(roomId) {
  console.log(`\n===== Testing Server Meeting Notes API for room: ${roomId} =====\n`);
  
  try {
    console.log(`Making request to server API endpoint: ${SERVER_URL}/api/meeting-notes`);
    console.log(`Room ID: ${roomId}`);
    console.log(`Message count: ${simulatedRooms[roomId].messages.length}`);
    
    // API endpoint for server
    const url = `${SERVER_URL}/api/meeting-notes`;
    
    // Set up headers
    const headers = {
      'Content-Type': 'application/json'
    };
    
    // Set up data payload
    const data = {
      roomId: roomId,
      messages: simulatedRooms[roomId].messages
    };
    
    // Make the request to server API
    const startTime = Date.now();
    const apiResponse = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(data)
    });
    
    const responseTime = Date.now() - startTime;
    
    if (!apiResponse.ok) {
      console.error(`ERROR: Server API error (${apiResponse.status})`);
      
      let errorDetails = {};
      try {
        errorDetails = await apiResponse.json();
        console.error('Error details:', JSON.stringify(errorDetails, null, 2));
      } catch (e) {
        console.error('Error parsing error response:', e);
      }
      
      return;
    }
    
    // Get the response
    const responseData = await apiResponse.json();
    console.log(`Response received in ${responseTime}ms`);
    
    // Extract the generated notes
    const generatedNotes = responseData.notes;
    
    console.log("\n----- Generated Meeting Notes from Server API -----\n");
    console.log(generatedNotes);
    console.log("\n----- End of Generated Notes -----\n");
    
    return generatedNotes;
  } catch (error) {
    console.error(`Error testing server meeting notes API: ${error.message}`);
    console.error(error);
  }
}

// Comparison function to highlight differences (simple implementation)
function compareResults(directApiResult, serverApiResult) {
  if (!directApiResult || !serverApiResult) {
    console.log("Cannot compare results: One or both results are missing");
    return;
  }
  
  console.log("\n===== Comparing Direct API and Server API Results =====\n");
  
  // Simple length comparison
  console.log(`Direct API result length: ${directApiResult.length} characters`);
  console.log(`Server API result length: ${serverApiResult.length} characters`);
  
  // Check if results contain similar sections
  const sections = ['Summary', 'Key Discussion Points', 'Decisions', 'Action Items', 'Next Steps'];
  
  console.log("\nSection presence comparison:");
  
  sections.forEach(section => {
    const directHasSection = directApiResult.includes(section);
    const serverHasSection = serverApiResult.includes(section);
    
    console.log(`- ${section}: Direct API: ${directHasSection ? '✓' : '✗'}, Server API: ${serverHasSection ? '✓' : '✗'}`);
  });
  
  console.log("\nBoth APIs should produce well-structured meeting notes with similar sections, though specific wording may vary.");
}

// Run the tests
async function runTests() {
  console.log("Starting comprehensive meeting notes tests...");
  
  // Test scenarios
  const testScenarios = [
    { roomId: "test-room-planning", description: "Project Planning Meeting" },
    { roomId: "test-room-feedback", description: "Customer Feedback Discussion" }
  ];
  
  // Make sure the server is running before testing server API
  console.log("\nIMPORTANT: For server API tests, ensure the server is running at " + SERVER_URL);
  console.log("Press Ctrl+C to cancel if the server is not running.");
  
  // Wait 3 seconds before starting tests to give time to cancel if needed
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  for (const scenario of testScenarios) {
    console.log(`\n\n=========================================`);
    console.log(`TESTING SCENARIO: ${scenario.description}`);
    console.log(`=========================================\n`);
    
    // First test direct API
    const directResult = await testOpenRouterApi(scenario.roomId);
    
    // Then test server API
    const serverResult = await testServerMeetingNotesAPI(scenario.roomId);
    
    // Compare results
    compareResults(directResult, serverResult);
  }
  
  console.log("\nAll tests completed.");
}

// Execute the tests
runTests(); 