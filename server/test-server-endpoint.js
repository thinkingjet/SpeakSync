// Simple test script to check if the server API endpoint is accessible
const fetch = require('node-fetch');

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:5001';

async function testWithSimpleGet() {
  console.log(`Testing server with simple GET to ${SERVER_URL}`);
  
  try {
    // Simple GET request first
    const getResponse = await fetch(`${SERVER_URL}`);
    console.log(`GET / response status: ${getResponse.status}`);
    
    if (getResponse.ok) {
      const data = await getResponse.json();
      console.log('Response data:', data);
    }
  } catch (error) {
    console.error('Error with GET request:', error.message);
  }
}

async function testApiEndpointVerbose() {
  console.log(`\nTesting API endpoint with POST to ${SERVER_URL}/api/meeting-notes`);
  
  try {
    // Set up a simple payload
    const testPayload = {
      roomId: "test-room",
      messages: [
        {
          userId: "test-user-1",
          username: "TestUser",
          text: "This is a test message",
          language: "en-US",
          languageDisplay: "English (US)",
          timestamp: new Date().toISOString(),
          isFinal: true
        }
      ]
    };
    
    // Log request details
    console.log('Sending POST with payload:', JSON.stringify(testPayload, null, 2));
    
    // Make the request to the API endpoint with verbose error logging
    const response = await fetch(`${SERVER_URL}/api/meeting-notes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testPayload)
    });
    
    console.log(`API endpoint response status: ${response.status}`);
    console.log('Response headers:', response.headers.raw());
    
    // Get the response text
    const responseText = await response.text();
    
    if (response.ok) {
      try {
        // Try to parse as JSON
        const responseData = JSON.parse(responseText);
        console.log('API endpoint responded successfully!');
        console.log('Response data:', responseData);
      } catch (e) {
        console.log('API endpoint responded with non-JSON data:');
        console.log(responseText);
      }
    } else {
      console.log('API endpoint responded with an error');
      console.log(responseText);
    }
  } catch (error) {
    console.error('Error connecting to API endpoint:', error);
  }
}

// Run both tests
async function runTests() {
  await testWithSimpleGet();
  await testApiEndpointVerbose();
}

runTests(); 