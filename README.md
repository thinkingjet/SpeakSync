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
- Translation services

## License

MIT

## Acknowledgements

- [Deepgram](https://deepgram.com/) for their speech-to-text API
- [ElevenLabs](https://elevenlabs.io/) for voice cloning technology
- [Socket.IO](https://socket.io/) for real-time communication
- [Material UI](https://mui.com/) for the UI components 