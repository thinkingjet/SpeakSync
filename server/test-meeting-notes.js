// Test script for meeting notes generation with OpenRouter API
const fetch = require('node-fetch');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// OpenRouter API key from environment or use the hardcoded value
const openRouterApiKey = process.env.OPENROUTER_API_KEY || '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';

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
  { username: "Sarah", text: "Let's go through the customer feedback from last month's survey." },
  { username: "David", text: "The main complaint was about the connection stability in poor network conditions." },
  { username: "Kevin", text: "We could implement better error handling and reconnection logic." },
  { username: "Sarah", text: "That's a good point. How long would that take?" },
  { username: "Kevin", text: "Probably about a week to implement and test thoroughly." },
  { username: "Lisa", text: "Several users also mentioned they want a way to save transcripts of their conversations." },
  { username: "David", text: "That should be fairly straightforward. We already have the data, just need a way to export it." },
  { username: "Sarah", text: "Let's prioritize both features. Kevin, can you start on the connection stability?" },
  { username: "Kevin", text: "Yes, I'll create a detailed plan by tomorrow." },
  { username: "Sarah", text: "And David, please work on the transcript export feature." },
  { username: "David", text: "Will do. I'll aim to have it ready by next Wednesday." },
  { username: "Lisa", text: "I'll create a mock-up of how the export feature should look in the UI." },
  { username: "Sarah", text: "Perfect. Let's also plan for another survey after these features are released." },
  { username: "David", text: "Good idea. We should see if these changes address the main concerns." },
  { username: "Kevin", text: "I suggest we also add analytics to measure how often the reconnection logic is triggered." },
  { username: "Sarah", text: "Excellent suggestion. Please include that in your implementation." }
];

// Function to create a dynamic prompt for the test
function createTestPrompt(conversation, roomId = "test-room-123") {
  // Count messages per user to identify main participants
  const messagesByUser = {};
  let totalMessages = 0;
  const usernames = [];
  
  conversation.forEach(msg => {
    totalMessages++;
    if (!messagesByUser[msg.username]) {
      messagesByUser[msg.username] = 0;
      usernames.push(msg.username);
    }
    messagesByUser[msg.username]++;
  });
  
  // Format the active participants information
  const participantsInfo = Object.entries(messagesByUser)
    .sort((a, b) => b[1] - a[1]) // Sort by message count, highest first
    .map(([username, count]) => `${username} (${count} messages, ${Math.round(count/totalMessages*100)}% participation)`)
    .join(', ');
  
  // Format messages in chronological order with usernames
  const formattedMessages = conversation
    .map(msg => `${msg.username}: ${msg.text}`)
    .join('\n');
  
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

  // User prompt is simple - just asking to generate meeting notes for the transcript
  const userPrompt = `Please generate meeting notes from the following conversation transcript:\n\n${formattedMessages}`;
  
  return { systemPrompt, userPrompt };
}

// Function to test meeting notes generation with OpenRouter API
async function testOpenRouterMeetingNotes(conversation, testName) {
  console.log(`\n===== Testing Meeting Notes Generation: ${testName} =====\n`);
  
  try {
    // Generate dynamic prompt
    const prompt = createTestPrompt(conversation);
    
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
    
    console.log(`Making request to OpenRouter API with model: ${data.model}`);
    console.log(`System prompt (preview): ${prompt.systemPrompt.substring(0, 150)}...`);
    console.log(`User prompt (preview): ${prompt.userPrompt.substring(0, 150)}...`);
    
    // Make the request to OpenRouter API
    const startTime = Date.now();
    const openRouterResponse = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(data)
    });
    
    const responseTime = Date.now() - startTime;
    
    if (!openRouterResponse.ok) {
      console.error(`ERROR: OpenRouter API error (${openRouterResponse.status})`);
      
      let errorDetails = {};
      try {
        errorDetails = await openRouterResponse.json();
        console.error('Error details:', JSON.stringify(errorDetails, null, 2));
      } catch (e) {
        console.error('Error parsing error response:', e);
      }
      
      return;
    }
    
    // Get the response
    const responseData = await openRouterResponse.json();
    console.log(`Response received in ${responseTime}ms`);
    
    // Extract the generated notes
    const generatedNotes = responseData.choices[0].message.content;
    
    console.log("\n----- Generated Meeting Notes -----\n");
    console.log(generatedNotes);
    console.log("\n----- End of Generated Notes -----\n");
    
    // Print response metadata
    console.log("Response metadata:");
    console.log(`- Model: ${responseData.model}`);
    console.log(`- Response time: ${responseTime}ms`);
    console.log(`- Token usage: ${JSON.stringify(responseData.usage || {})}`);
    
    return generatedNotes;
  } catch (error) {
    console.error(`Error testing meeting notes generation: ${error.message}`);
    console.error(error);
  }
}

// Run the tests
async function runTests() {
  console.log("Starting meeting notes API tests...");
  
  // Test with project planning conversation
  await testOpenRouterMeetingNotes(projectPlanningConversation, "Project Planning Meeting");
  
  // Test with customer feedback conversation
  await testOpenRouterMeetingNotes(customerFeedbackConversation, "Customer Feedback Discussion");
  
  console.log("\nAll tests completed.");
}

// Execute the tests
runTests(); 