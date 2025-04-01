// Comprehensive test script for meeting notes generation using our test server
const fetch = require('node-fetch');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Test server configuration
const TEST_SERVER_URL = process.env.TEST_SERVER_URL || 'http://localhost:5001';

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

// Function to test meeting notes generation via the test server API
async function testMeetingNotesAPI(roomId) {
  console.log(`\n===== Testing Meeting Notes API for room: ${roomId} =====\n`);
  
  try {
    console.log(`Making request to test server API endpoint: ${TEST_SERVER_URL}/api/meeting-notes`);
    console.log(`Room ID: ${roomId}`);
    console.log(`Message count: ${simulatedRooms[roomId].messages.length}`);
    
    // API endpoint for test server
    const url = `${TEST_SERVER_URL}/api/meeting-notes`;
    
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
      console.error(`ERROR: API error (${apiResponse.status})`);
      
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
    
    console.log("\n----- Generated Meeting Notes -----\n");
    console.log(generatedNotes);
    console.log("\n----- End of Generated Notes -----\n");
    
    return generatedNotes;
  } catch (error) {
    console.error(`Error testing meeting notes API: ${error.message}`);
    console.error(error);
  }
}

// Run the tests
async function runTests() {
  console.log("Starting comprehensive meeting notes tests...");
  
  // Test scenarios
  const testScenarios = [
    { roomId: "test-room-planning", description: "Project Planning Meeting" },
    { roomId: "test-room-feedback", description: "Customer Feedback Discussion" }
  ];
  
  // Make sure the test server is running
  console.log("\nIMPORTANT: Ensure the test server is running at " + TEST_SERVER_URL);
  console.log("Press Ctrl+C to cancel if the server is not running.");
  
  // Wait 3 seconds before starting tests to give time to cancel if needed
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Test if the server is reachable with a simple GET request
  try {
    const healthCheck = await fetch(TEST_SERVER_URL);
    if (healthCheck.ok) {
      console.log(`Test server is online and ready for testing!`);
    } else {
      console.error(`Test server returned status ${healthCheck.status}`);
      return;
    }
  } catch (error) {
    console.error(`Cannot connect to test server at ${TEST_SERVER_URL}`);
    console.error(`Error: ${error.message}`);
    console.error(`Please make sure the test server is running with: node server/test-server.js`);
    return;
  }
  
  for (const scenario of testScenarios) {
    console.log(`\n\n=========================================`);
    console.log(`TESTING SCENARIO: ${scenario.description}`);
    console.log(`=========================================\n`);
    
    // Test with the current scenario
    await testMeetingNotesAPI(scenario.roomId);
  }
  
  console.log("\nAll tests completed.");
}

// Execute the tests
runTests(); 