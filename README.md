# SpeakSync: Real-time Translation Meeting Room

A powerful real-time multilingual meeting application with advanced speech capabilities, built with React, Node.js, Socket.IO, and integration with AI services.

## Key Features

- **Real-time Speech-to-Text**: Instantly convert speech to text using Deepgram's API
- **Multilingual Translation**: Automatic translation between different languages in real-time
- **Voice Cloning**: Optional voice preservation when translating messages using ElevenLabs
- **Text-to-Speech Playback**: Hear messages in your preferred language
- **Meeting Notes Generation**: Automated summary generation of meeting content
- **Dark/Light Themes**: Choose between elegant color schemes with animated transitions
- **Animated UI Components**: Beautiful animations for enhanced user experience
- **Message Reactions**: React to messages with emoji reactions
- **Responsive Design**: Works well on different screen sizes

## Technical Architecture

SpeakSync uses a client-server architecture with real-time communication capabilities:

- **Frontend**: React with Material UI for the interface components
- **Backend**: Node.js with Express for API services
- **Real-time Communication**: Socket.IO for WebSocket connections
- **Speech Processing**: Hybrid approach using browser Web Speech API and Deepgram
- **Translation**: Multi-tier approach using Google Translate API with fallbacks
- **Voice Synthesis**: ElevenLabs for high-quality voice cloning and text-to-speech

The data flow follows this sequence:
1. User speaks into their microphone
2. Speech is converted to text
3. Text is sent via WebSocket to the server
4. Server broadcasts the text to other users based on room membership
5. Recipients' browsers translate the text to their preferred language
6. The translated text is converted to speech and played back

## Project Structure

```
SpeakSync/
├── client/                 # React frontend
│   ├── public/             # Static files
│   └── src/
│       ├── components/     # React components
│       ├── theme.js        # Theme configuration
│       ├── App.js          # Main application
│       └── index.js        # Entry point
├── server/                 # Node.js backend
│   ├── server.js           # Express and Socket.IO server
│   ├── package.json        # Server dependencies
│   └── .env                # Environment variables (create from .env.example)
└── package.json            # Root package.json for running both services together
```

## Prerequisites

- Node.js (v14+ recommended)
- npm or yarn
- Deepgram API key (for speech-to-text)
- ElevenLabs API key (for voice cloning and TTS)
- Google API key (for translation services)
- OpenRouter API key (for AI-powered meeting notes generation)

## Installation

### Quick Setup (All Components)

1. From the root directory:
   ```bash
   npm run install-all
   ```
   This will install dependencies for the root project, server, and client.

### Manual Setup

#### Server Setup

1. Navigate to the server directory:
   ```bash
   cd SpeakSync/server
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file:
   ```bash
   cp .env.example .env
   ```

4. Edit the `.env` file and add your API keys:
   ```
   DEEPGRAM_API_KEY=your_deepgram_api_key_here
   ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
   GOOGLE_API_KEY=your_google_api_key_here
   GOOGLE_PROJECT_ID=your_google_project_id_here
   OPENROUTER_API_KEY=your_openrouter_api_key_here
   ```

#### Client Setup

1. Navigate to the client directory:
   ```bash
   cd SpeakSync/client
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

## Running the Application

### Run Everything with One Command

From the root directory:
```bash
npm start
```
This will start both the client and server concurrently.

### Start Components Separately

#### Start the Server

1. In the server directory:
   ```bash
   npm run dev
   ```
   The server will run on http://localhost:5000

#### Start the Client

1. In the client directory:
   ```bash
   npm start
   ```
   The client will run on http://localhost:3000

## Deployment Options

### Docker Deployment

The client directory includes a Dockerfile and nginx.conf for containerized deployment:

1. Build the client Docker image:
   ```bash
   cd client
   docker build -t speaksync-client .
   ```

2. Run the client container:
   ```bash
   docker run -p 3000:80 speaksync-client
   ```

### Fly.io Deployment

The project includes configuration for deployment to Fly.io in the `.fly` directory.

## Performance Optimizations

SpeakSync implements several strategies to minimize latency while maintaining high translation quality:

- **Early Speech Detection**: Processing begins as soon as speech is detected
- **Streaming Translation**: Translation requests are streamed when supported
- **Connection Pooling**: Persistent connections eliminate handshake overhead 
- **Caching**: Frequent translations are cached to reduce API calls
- **Parallel Processing**: Web Workers offload intensive processing to background threads

## Browser Compatibility

- **Fully Supported**: Chrome, Edge, Firefox on desktop
- **Partially Supported**: Safari (with some limitations on iOS)
- **Not Supported**: Internet Explorer, older browsers

## Troubleshooting

- **Microphone Access Issues**: Ensure your browser has permission to access your microphone
- **Translation Delays**: Check your internet connection speed
- **Missing Audio Playback**: Verify your system audio settings and browser permissions
- **WebSocket Connection Errors**: Try refreshing the page or clearing browser cache

## Known Limitations

- Performance may degrade with more than 25 simultaneous users in a room
- iOS Safari has limitations with WebSpeech API
- Extended sessions (>3 hours) may require a page refresh
- Specialized terminology and idioms may not translate accurately

## Usage

1. Open the application in your browser at http://localhost:3000
2. Enter your username, select a room, and choose your preferred language
3. Optionally record your voice for voice cloning if you want to preserve your voice characteristics
4. Use the microphone button to start and stop speaking
5. Your speech will be transcribed, translated, and displayed in real-time
6. Use the settings panel to change your speech recognition language
7. Toggle dark/light mode using the theme button
8. View and export meeting notes generated from your conversation

## Technologies Used

### Frontend
- React.js
- Material UI
- Socket.IO Client
- Web Speech API (for text-to-speech)
- MediaRecorder API (for capturing audio)
- Custom animation system for enhanced UX

### Backend
- Node.js
- Express
- Socket.IO
- Deepgram SDK (for speech-to-text)
- ElevenLabs API (for voice cloning and TTS)
- Google Translate API
- OpenRouter API (for AI-powered features)

## License

MIT

## Acknowledgements

- [Deepgram](https://deepgram.com/) for their speech-to-text API
- [ElevenLabs](https://elevenlabs.io/) for voice cloning technology
- [Socket.IO](https://socket.io/) for real-time communication
- [Material UI](https://mui.com/) for the UI components 
