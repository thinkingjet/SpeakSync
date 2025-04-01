import React, { useState, useEffect, useCallback } from 'react';
import { Box, CssBaseline, ThemeProvider } from '@mui/material';
import io from 'socket.io-client';
import MainLayout from './components/MainLayout';
import JoinRoom from './components/JoinRoom';
import { Typography, CircularProgress, Alert } from '@mui/material';
import './App.css';
import { lightTheme, darkTheme } from './theme';

function App() {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [user, setUser] = useState(null);
  const [room, setRoom] = useState(null);
  const [connectionError, setConnectionError] = useState('');
  const [retryCount, setRetryCount] = useState(0);
  const [retryTimeout, setRetryTimeout] = useState(null);
  const [themeMode, setThemeMode] = useState(() => {
    // Get theme from localStorage or default to 'light'
    return localStorage.getItem('themeMode') || 'light';
  });

  // Theme toggle function
  const toggleTheme = useCallback(() => {
    setThemeMode((prevMode) => {
      const newMode = prevMode === 'dark' ? 'light' : 'dark';
      // Save to localStorage
      localStorage.setItem('themeMode', newMode);
      return newMode;
    });
  }, []);

  // Get the current theme based on themeMode
  const theme = themeMode === 'dark' ? darkTheme : lightTheme;

  // Initialize socket connection
  useEffect(() => {
    // Define server URL (use environment variable if available)
    const serverUrl = process.env.REACT_APP_SERVER_URL || 'http://localhost:5000';
    
    console.log('Connecting to server at:', serverUrl);
    
    // Create socket connection
    const newSocket = io(serverUrl, {
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000
    });
    
    // Socket connection event handlers
    newSocket.on('connect', () => {
      console.log('Connected to server:', newSocket.id);
      setConnected(true);
      setConnectionError('');
      setRetryCount(0);
      
      // Clear any retry timeout
      if (retryTimeout) {
        clearTimeout(retryTimeout);
        setRetryTimeout(null);
      }
    });
    
    newSocket.on('connect_error', (error) => {
      console.error('Connection error:', error);
      setConnected(false);
      
      setConnectionError(`Failed to connect to server: ${error.message || 'Unknown error'}`);
      
      // Increment retry count
      setRetryCount((prev) => {
        const newCount = prev + 1;
        
        // If too many retries, stop trying
        if (newCount > 10) {
          newSocket.disconnect();
          return prev;
        }
        
        // Set timeout to reset retry count after 30 seconds of no activity
        if (retryTimeout) clearTimeout(retryTimeout);
        const timeout = setTimeout(() => setRetryCount(0), 30000);
        setRetryTimeout(timeout);
        
        return newCount;
      });
    });
    
    newSocket.on('disconnect', (reason) => {
      console.log('Disconnected from server:', reason);
      setConnected(false);
      
      if (reason === 'io server disconnect') {
        // Server disconnected us, try to reconnect manually
        newSocket.connect();
      }
      
      if (reason === 'transport close' || reason === 'ping timeout') {
        setConnectionError('Lost connection to server. Attempting to reconnect...');
      }
    });
    
    // Save socket to state
    setSocket(newSocket);
    
    // Cleanup function to disconnect socket when component unmounts
    return () => {
      console.log('Disconnecting socket...');
      if (retryTimeout) clearTimeout(retryTimeout);
      if (newSocket) newSocket.disconnect();
    };
  }, []);

  // Handle joining a room
  const handleJoinRoom = (userData) => {
    if (!socket || !connected) {
      setConnectionError('Cannot join room: No connection to server');
      return;
    }
    
    const { username, room: roomName, language, voiceId } = userData;
    
    // Update user state
    setUser({
      username,
      language,
      socketId: socket.id,
      voiceId
    });
    
    // Update room state
    setRoom(roomName);
    
    // Send join event to server
    socket.emit('join-room', {
      username,
      room: roomName,
      language,
      voiceId
    });
    
    console.log(`Joining room ${roomName} as ${username}`);
  };

  // Handle disconnect
  const handleDisconnect = useCallback(() => {
    setUser(null);
    setRoom(null);
    
    // We don't need to emit anything as the MainLayout component
    // will handle leaving the room before calling this
  }, []);

  // Render app content based on current state
  const renderContent = () => {
    // If not connected to the server yet
    if (!connected) {
      return (
        <Box sx={{ textAlign: 'center', mt: 4 }}>
          <CircularProgress />
          <Typography variant="h6" sx={{ mt: 2 }}>
            Connecting to server...
          </Typography>
          {connectionError && (
            <Alert severity="error" sx={{ mt: 2, mx: 'auto', maxWidth: 500 }}>
              {connectionError}
            </Alert>
          )}
        </Box>
      );
    }
    
    // If connected but not joined a room yet
    if (!user || !room) {
      return (
        <JoinRoom 
          onJoin={handleJoinRoom} 
          isConnected={connected}
          connectionError={connectionError}
          retryCount={retryCount}
          themeMode={themeMode}
          toggleTheme={toggleTheme}
        />
      );
    }
    
    // If connected and joined a room
    return (
      <MainLayout 
        socket={socket} 
        user={user} 
        room={room}
        onDisconnect={handleDisconnect}
        themeMode={themeMode}
        toggleTheme={toggleTheme}
      />
    );
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ 
        height: '100vh', 
        display: 'flex', 
        flexDirection: 'column',
        bgcolor: 'background.default'
      }}>
        {renderContent()}
      </Box>
    </ThemeProvider>
  );
}

export default App;
