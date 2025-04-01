// Test script for server's meeting notes API endpoint
const fetch = require('node-fetch');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Server configuration
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:5000';

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

// Simulated room data with users
const simulatedRoom = {
  "test-room-123": {
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
  }
};

// Function to test meeting notes generation via the server API
async function testServerMeetingNotesAPI() {
  console.log(`\n===== Testing Server Meeting Notes API =====\n`);
  
  try {
    const roomId = "test-room-123";
    
    console.log(`Making request to server API endpoint: ${SERVER_URL}/api/meeting-notes`);
    console.log(`Room ID: ${roomId}`);
    console.log(`Message count: ${simulatedRoom[roomId].messages.length}`);
    
    // API endpoint for server
    const url = `${SERVER_URL}/api/meeting-notes`;
    
    // Set up headers
    const headers = {
      'Content-Type': 'application/json'
    };
    
    // Set up data payload
    const data = {
      roomId: roomId,
      messages: simulatedRoom[roomId].messages
    };
    
    // Before making the request, ensure the server has the simulated room data
    // This would normally be done by socket connections, but we're simulating it for testing
    console.log("NOTE: In a real scenario, the server would already have the room data from socket connections");
    console.log("For this test, we're sending the messages in the request body");
    
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

// Run the tests
async function runTests() {
  console.log("Starting server API tests for meeting notes...");
  
  // Make sure the server is running before testing
  console.log("IMPORTANT: Ensure the server is running at " + SERVER_URL);
  console.log("Press Ctrl+C to cancel if the server is not running.");
  
  // Wait 3 seconds before starting tests to give time to cancel if needed
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Test the server API endpoint
  await testServerMeetingNotesAPI();
  
  console.log("\nAll tests completed.");
}

// Execute the tests
runTests(); 