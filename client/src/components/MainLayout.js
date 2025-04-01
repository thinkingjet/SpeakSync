import React, { useState, useRef, useEffect } from 'react';
import { 
  Box, 
  Container, 
  Typography, 
  Paper, 
  Button, 
  IconButton,
  Grid,
  Divider,
  Avatar,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  AppBar,
  Toolbar,
  Tooltip,
  CircularProgress,
  Badge,
  Chip,
  Switch,
  FormControlLabel,
  alpha,
  useTheme,
  Slide
} from '@mui/material';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import LogoutIcon from '@mui/icons-material/Logout';
import SettingsIcon from '@mui/icons-material/Settings';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import VolumeOffIcon from '@mui/icons-material/VolumeOff';
import RecordVoiceOverIcon from '@mui/icons-material/RecordVoiceOver';
import VoiceOverOffIcon from '@mui/icons-material/VoiceOverOff';
import RadioButtonCheckedIcon from '@mui/icons-material/RadioButtonChecked';
import PeopleIcon from '@mui/icons-material/People';
import ConversationDisplay from './ConversationDisplay';
import LanguageSettings from './LanguageSettings';
import SpeechPopup from './SpeechPopup';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import ForumIcon from '@mui/icons-material/Forum';
import AssignmentIcon from '@mui/icons-material/Assignment';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import DoneIcon from '@mui/icons-material/Done';
import MeetingNotesPanel from './MeetingNotesPanel';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import DownloadIcon from '@mui/icons-material/Download';

function MainLayout({ socket, user, onDisconnect, room, themeMode, toggleTheme }) {
  const [messages, setMessages] = useState([]);
  const [interimMessage, setInterimMessage] = useState(null);
  const [userSpeechText, setUserSpeechText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingStatus, setRecordingStatus] = useState('idle'); // idle, recording, processing
  const [isMuted, setIsMuted] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState(user.language || 'multi');
  const [meetingNotesLanguage, setMeetingNotesLanguage] = useState(user.language || 'multi');
  const [roomUsers, setRoomUsers] = useState([]);
  const [isPushToTalk, setIsPushToTalk] = useState(false); // Set to false to disable push-to-talk
  const [speakingUsers, setSpeakingUsers] = useState({}); // Track who's currently speaking
  const [userSpeechInfo, setUserSpeechInfo] = useState({ 
    isTranslated: false, 
    originalLanguage: null,
    originalLanguageDisplay: null 
  });
  const [isTtsEnabled, setIsTtsEnabled] = useState(true); // State to enable/disable TTS
  const [isAudioPlaying, setIsAudioPlaying] = useState(false); // Track if audio is currently playing
  const audioQueueRef = useRef([]); // Queue for audio messages
  const currentAudioRef = useRef(null); // Reference to current audio
  const [sidebarWidth, setSidebarWidth] = useState(200); // Added for the new sidebar width
  const [topSectionHeight, setTopSectionHeight] = useState(50); // Percentage height for top section
  const [meetingNotes, setMeetingNotes] = useState('');
  const [meetingNotesTimestamp, setMeetingNotesTimestamp] = useState(null);
  const [meetingNotesGenInfo, setMeetingNotesGenInfo] = useState(null);
  const [isGeneratingNotes, setIsGeneratingNotes] = useState(false);
  const [transcriptLanguage, setTranscriptLanguage] = useState(user.language || 'multi');

  // References for managing audio recording
  const mediaRecorderRef = useRef(null);
  const audioStreamRef = useRef(null);
  const isStreamingRef = useRef(false);
  const isSpaceDownRef = useRef(false);
  const audioChunksRef = useRef([]);

  // Add loading state for transcript export
  const [isExportingTranscript, setIsExportingTranscript] = useState(false);

  // Start audio streaming
  const startStreaming = async () => {
    try {
      console.log('Starting streaming...');
      setRecordingStatus('recording');
      
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      // Store the stream reference for later cleanup
      audioStreamRef.current = stream;
      
      if (isPushToTalk) {
        // For push-to-talk, create recorder but don't stream
        const options = { mimeType: 'audio/webm' };
        mediaRecorderRef.current = new MediaRecorder(stream, options);
        
        // Reset chunks array
        audioChunksRef.current = [];
        
        // Collect audio chunks while recording
        mediaRecorderRef.current.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };
        
        // Start recording
        mediaRecorderRef.current.start(100);
        setIsRecording(true);
      } else {
        // For continuous mode, create MediaRecorder with WebM/Opus format
        const options = { mimeType: 'audio/webm' };
        mediaRecorderRef.current = new MediaRecorder(stream, options);
        
        // Tell the server we're starting to stream
        socket.emit('start-stream', { room });
        
        // Wait for server confirmation before starting to send audio
        socket.once('stream-ready', () => {
          console.log('Stream ready, starting to send audio');
          isStreamingRef.current = true;
          
          // In continuous mode, send chunks immediately
          mediaRecorderRef.current.ondataavailable = (event) => {
            if (event.data && event.data.size > 0 && isStreamingRef.current) {
              // Convert blob to ArrayBuffer
              event.data.arrayBuffer().then(buffer => {
                if (socket && socket.connected && !isMuted) {
                  socket.emit('audio-data', buffer);
                }
              });
            }
          };
          
          // Start recording in small chunks for better real-time performance
          mediaRecorderRef.current.start(100);
          setIsRecording(true);
        });
      }
      
    } catch (error) {
      console.error("Error accessing microphone:", error);
      setRecordingStatus('idle');
    }
  };

  // Stop audio streaming
  const stopStreaming = () => {
    try {
      console.log('Stopping streaming...');
      isStreamingRef.current = false;
      
      // Stop the MediaRecorder
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      
      if (isPushToTalk && audioChunksRef.current.length > 0) {
        // For push-to-talk, send the complete audio recording
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        
        // Send the audio data as a base64 string rather than a blob
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = function() {
          const base64data = reader.result;
          // Remove the data URL prefix (e.g., "data:audio/webm;base64,")
          const base64Audio = base64data.split(',')[1];
          
          // Send the base64 encoded audio to the server
          socket.emit('push-to-talk', { 
            room,
            audio: base64Audio
          });
        };
        
        // Reset audio chunks
        audioChunksRef.current = [];
      } else if (!isPushToTalk) {
        // For continuous mode, just tell the server to stop streaming
        socket.emit('stop-stream');
      }
      
      // Stop all audio tracks
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => track.stop());
        audioStreamRef.current = null;
      }
      
      // Reset states
      setIsRecording(false);
      setRecordingStatus('idle');
      
    } catch (error) {
      console.error('Error stopping streaming:', error);
      setRecordingStatus('idle');
      setIsRecording(false);
    }
  };

  // Toggle streaming status based on current mode
  const toggleStreaming = () => {
    // Always use continuous mode
    if (isRecording) {
      // When stopping, immediately clear speaking indicator for current user
      setSpeakingUsers(prev => {
        const newState = { ...prev };
        if (socket && socket.id in newState) {
          delete newState[socket.id];
        }
        return newState;
      });
      
      // When stopping, explicitly clear the user speech text
      setUserSpeechText("");
      
      // Clear translation info
      setUserSpeechInfo({ 
        isTranslated: false, 
        originalLanguage: null,
        originalLanguageDisplay: null
      });
      
      stopStreaming();
      
      // Also send muted event to ensure speaking state is cleared on server
      if (socket) {
        socket.emit('user-muted', { room });
      }
    } else {
      startStreaming();
    }
  };

  // Toggle mute status
  const toggleMute = () => {
    const newMutedState = !isMuted;
    setIsMuted(newMutedState);
    
    // If muting, immediately clear speaking indicator for current user
    if (newMutedState) {
      // Immediately clear speaking user state for current user
      setSpeakingUsers(prev => {
        const newState = { ...prev };
        if (socket && socket.id in newState) {
          delete newState[socket.id];
        }
        return newState;
      });
      
      // Clear user speech text
      setUserSpeechText("");
      
      // Clear speech info
      setUserSpeechInfo({ 
        isTranslated: false, 
        originalLanguage: null,
        originalLanguageDisplay: null
      });
      
      // Also notify the server
      if (socket) {
        socket.emit('user-muted', { room });
        
        // Also stop streaming if currently recording
        if (isRecording) {
          stopStreaming();
        }
      }
    }
  };

  // Toggle settings panel
  const toggleSettings = () => {
    setShowSettings(!showSettings);
  };

  // Toggle push-to-talk mode - function kept but not used
  const togglePushToTalk = () => {
    // Function kept for future re-enablement but not used
    return;
  };

  // Handle language change
  const handleLanguageChange = (language) => {
    console.log(`Changing language to: ${language}`);
    setSelectedLanguage(language);
    
    // Inform the server about the language change
    if (socket) {
      socket.emit('update-language', { room, language });
    }
  };

  // Handle meeting notes language change
  const handleMeetingNotesLanguageChange = (language) => {
    console.log(`Changing meeting notes language to: ${language}`);
    setMeetingNotesLanguage(language);
    
    // Inform the server about the meeting notes language change
    if (socket) {
      socket.emit('update-meeting-notes-language', { room, meetingNotesLanguage: language });
    }
  };

  // Handle disconnect
  const handleLeaveRoom = () => {
    // Stop streaming if active
    if (isRecording) {
      stopStreaming();
    }
    
    // Leave the room
    socket.emit('leave-room', { room });
    
    // Call parent disconnect handler
    if (onDisconnect) {
      onDisconnect();
    }
  };

  // Send a text message
  const sendMessage = (message) => {
    if (message.trim() && socket) {
      socket.emit('send-message', { room, message });
    }
  };

  // Add keyboard event handlers for push-to-talk
  useEffect(() => {
    if (!isPushToTalk) return; // Only active in push-to-talk mode
    
    const handleKeyDown = (event) => {
      // Only respond to spacebar (key code 32) when not already recording
      if (event.keyCode === 32 && !isSpaceDownRef.current && !isRecording) {
        event.preventDefault(); // Prevent page scrolling
        isSpaceDownRef.current = true;
        startStreaming();
      }
    };

    const handleKeyUp = (event) => {
      // Only respond to spacebar (key code 32) when it was pressed
      if (event.keyCode === 32 && isSpaceDownRef.current) {
        event.preventDefault();
        isSpaceDownRef.current = false;
        if (isRecording) {
          stopStreaming();
        }
      }
    };

    // Handle page blur (user switches tabs)
    const handleBlur = () => {
      if (isSpaceDownRef.current && isRecording) {
        isSpaceDownRef.current = false;
        stopStreaming();
      }
    };

    // Add event listeners
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    // Clean up
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, [isPushToTalk, isRecording]);

  // Function to convert text to speech using ElevenLabs API
  const speakText = async (text, language, voiceId, speakerId) => {
    // Get caller information for debugging
    const stackTrace = new Error().stack;
    const callerInfo = stackTrace.split('\n')[2].trim(); // Get the line that called this function
    console.log(`[TTS] speakText called from: ${callerInfo}`);
    console.log(`[TTS] Parameters: text="${text?.substring(0, 20)}...", language=${language}, voiceId=${voiceId || 'default'}, speakerId=${speakerId || 'none'}`);
    
    if (!isTtsEnabled || !text) {
      console.log(`[TTS] Skipping TTS: enabled=${isTtsEnabled}, text=${!!text}, isPlaying=${isAudioPlaying}`);
      // If TTS is disabled or text is empty, don't synthesize
      if (isAudioPlaying && text) {
        // If audio is already playing, queue this text for later
        console.log(`[TTS] Queueing message for later playback: "${text.substring(0, 30)}..."${voiceId ? ` with voiceId=${voiceId}` : ''}`);
        audioQueueRef.current.push({ text, language, voiceId, speakerId });
      }
      return;
    }

    try {
      console.log(`[TTS] 🔊 Requesting speech for text: "${text.substring(0, 30)}${text.length > 30 ? '...' : ''}" in ${language}${voiceId ? ` with voice ID ${voiceId}` : ' with default voice'}`);
      
      // Set audio as playing
      setIsAudioPlaying(true);
      
      // Using relative URL with proxy configuration
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text, language, voiceId, speakerId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('[TTS] API error:', errorData);
        throw new Error(`Error: ${response.status} - ${errorData?.error || 'Unknown error'}`);
      }

      console.log('[TTS] Response received successfully, converting to audio...');
      
      // Get the audio data as array buffer
      const audioData = await response.arrayBuffer();
      console.log(`[TTS] Audio data received, size: ${audioData.byteLength} bytes, ${voiceId ? 'using custom voice' : 'using default voice'}`);
      
      if (audioData.byteLength === 0) {
        console.error('[TTS] Received empty audio data');
        setIsAudioPlaying(false);
        return;
      }
      
      // Create a blob from the audio data
      const audioBlob = new Blob([audioData], { type: 'audio/mpeg' });
      
      // Create a URL for the blob
      const audioUrl = URL.createObjectURL(audioBlob);
      console.log('[TTS] Created audio URL:', audioUrl);
      
      // Create an audio element
      const audio = new Audio();
      
      // Configure audio
      audio.preload = 'auto';
      audio.src = audioUrl;
      
      // Set reference to current audio
      currentAudioRef.current = audio;
      
      // Add debugging event listeners
      audio.addEventListener('canplaythrough', () => {
        console.log(`[TTS] Audio loaded and ready to play ${voiceId ? 'with custom voice' : 'with default voice'}`);
        
        // Play audio once it's loaded
        const playPromise = audio.play();
        
        if (playPromise !== undefined) {
          playPromise.then(() => {
            console.log('[TTS] Audio playback started successfully');
          }).catch(error => {
            console.error('[TTS] Play promise error:', error);
            URL.revokeObjectURL(audioUrl);
            setIsAudioPlaying(false);
            currentAudioRef.current = null;
          });
        }
      });
      
      audio.addEventListener('playing', () => {
        console.log('[TTS] Audio playback started');
      });
      
      audio.addEventListener('error', (e) => {
        console.error('[TTS] Audio element error:', e);
        URL.revokeObjectURL(audioUrl);
        setIsAudioPlaying(false);
        currentAudioRef.current = null;
      });
      
      // Listen for when the audio finishes playing
      audio.onended = () => {
        console.log('[TTS] Audio playback completed');
        // Revoke the URL to free up memory
        URL.revokeObjectURL(audioUrl);
        setIsAudioPlaying(false);
        currentAudioRef.current = null;
        
        // Check if there's more audio in the queue
        if (audioQueueRef.current.length > 0) {
          const nextAudio = audioQueueRef.current.shift();
          console.log('[TTS] Playing next audio from queue');
          speakText(nextAudio.text, nextAudio.language, nextAudio.voiceId, nextAudio.speakerId);
        }
      };

    } catch (error) {
      console.error('[TTS] Text-to-speech error:', error);
      setIsAudioPlaying(false);
      currentAudioRef.current = null;
      
      // Try to play the next item in queue if there is one
      if (audioQueueRef.current.length > 0) {
        const nextAudio = audioQueueRef.current.shift();
        console.log('[TTS] Attempting to play next audio from queue after error');
        speakText(nextAudio.text, nextAudio.language, nextAudio.voiceId, nextAudio.speakerId);
      }
    }
  };

  // Toggle TTS
  const toggleTts = () => {
    console.log(`[TTS Debug] Toggling TTS from ${isTtsEnabled ? 'ON' : 'OFF'} to ${!isTtsEnabled ? 'ON' : 'OFF'}`);
    setIsTtsEnabled(!isTtsEnabled);
    
    // If turning off TTS, stop any currently playing audio
    if (isTtsEnabled && currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
      setIsAudioPlaying(false);
      // Clear the audio queue
      audioQueueRef.current = [];
    }
  };

  // Effect to log TTS state changes
  useEffect(() => {
    console.log(`[TTS Debug] TTS state changed to: ${isTtsEnabled ? 'ENABLED' : 'DISABLED'}`);
  }, [isTtsEnabled]);

  // Effect for socket event listeners
  useEffect(() => {
    if (!socket) return;

    console.log('[TTS Debug] Initial TTS state:', isTtsEnabled ? 'ENABLED' : 'DISABLED');

    // Setup a safety timer to clear speaking indicators if they get stuck
    const speakingClearInterval = setInterval(() => {
      // If user is muted or not recording, ensure own speaking indicator is cleared
      if (isMuted || !isRecording) {
        setSpeakingUsers(prev => {
          if (socket.id in prev) {
            // Only update if our own ID is in the speaking users
            const newState = { ...prev };
            delete newState[socket.id];
            return newState;
          }
          return prev;
        });
      }
    }, 3000); // Check every 3 seconds
    
    // Listen for new messages
    socket.on('new-message', (message) => {
      setMessages(prev => [...prev, message]);
      
      // Clear interim message if this is our final message
      if (message.userId === socket.id && message.isFinal) {
        setInterimMessage(null);
        setUserSpeechText(""); // Clear user speech text when a final message is received
      }
      
      // Add more detailed debug logging to understand TTS decision
      console.log(`[TTS Debug] Message received:
        - From user: ${message.username}
        - Message ID: ${message.userId}
        - Current user ID: ${socket.id}
        - Is own message: ${message.userId === socket.id}
        - Is system message: ${!!message.isSystem}
        - TTS enabled: ${isTtsEnabled}
        - Will play TTS: ${message.userId !== socket.id && !message.isSystem && isTtsEnabled}
      `);
      
      // Play text-to-speech for others' messages
      if (message.userId !== socket.id && !message.isSystem) {
        console.log(`[TTS Debug] Playing TTS for message from ${message.username || 'another user'}, Message: "${message.text.substring(0, 30)}${message.text.length > 30 ? '...' : ''}"${message.voiceId ? `, Using voice ID: ${message.voiceId}` : ''}`);
        speakText(message.text, user.language, message.voiceId, message.userId);
      } else {
        console.log(`[TTS Debug] Skipping TTS for message: ${message.userId === socket.id ? 'own message' : 'system message'}`);
      }
    });
    
    // Listen for interim messages (typing indicators)
    socket.on('interim-message', (message) => {
      if (message.userId !== socket.id) {
        setInterimMessage(message);
      } else {
        // This is our own interim message, update the speech text
        setUserSpeechText(message.text || "");
        // Also store translation info for our own speech popup
        if (message.isTranslated) {
          setUserSpeechInfo({
            isTranslated: message.isTranslated,
            originalLanguage: message.originalLanguage,
            originalLanguageDisplay: message.originalLanguageDisplay
          });
        }
      }
    });
    
    // Listen for speaking started
    socket.on('user-speaking-started', ({ userId, username, wordCount }) => {
      // Only update speaking state if:
      // 1. It's not the current user, OR
      // 2. It's the current user and they're not muted
      if (userId !== socket.id || !isMuted) {
        setSpeakingUsers(prev => ({
          ...prev,
          [userId]: { username, isSpeaking: true, wordCount: wordCount || 0 }
        }));
      }
    });
    
    // Listen for speaking stopped
    socket.on('user-speaking-stopped', ({ userId }) => {
      setSpeakingUsers(prev => {
        const newState = { ...prev };
        delete newState[userId];
        return newState;
      });
      
      // Also clear any interim message from this user
      setInterimMessage(prev => {
        if (prev && prev.userId === userId) {
          return null;
        }
        return prev;
      });
      
      // Clear user speech text if it's the current user
      if (userId === socket.id) {
        setUserSpeechText("");
        setUserSpeechInfo({ 
          isTranslated: false, 
          originalLanguage: null,
          originalLanguageDisplay: null
        });
      }
    });
    
    // Listen for room message history
    socket.on('load-messages', (messageHistory) => {
      setMessages(messageHistory || []);
    });

    // Listen for user joined events
    socket.on('user-joined', ({ users, joinedUser }) => {
      setRoomUsers(users || []);
      // Add system message for joined user
      if (joinedUser && joinedUser.id !== socket.id) {
        const systemMessage = {
          isSystem: true,
          text: `${joinedUser.username} has joined the room`,
          timestamp: new Date().toISOString()
        };
        setMessages(prev => [...prev, systemMessage]);
      }
    });

    // Listen for user left events
    socket.on('user-left', ({ users, leftUser }) => {
      setRoomUsers(users || []);
      // Add system message for left user
      if (leftUser) {
        const systemMessage = {
          isSystem: true,
          text: `${leftUser.username} has left the room`,
          timestamp: new Date().toISOString()
        };
        setMessages(prev => [...prev, systemMessage]);
      }
    });

    // Listen for streaming errors
    socket.on('stream-error', (error) => {
      console.error('Streaming error:', error);
      if (isRecording) {
        stopStreaming();
      }
    });

    // Add socket event listener for meeting notes
    socket.on('meeting-notes-updated', (data) => {
      console.log('Received meeting notes update:', data);
      setMeetingNotes(data.notes);
      setMeetingNotesTimestamp(new Date(data.timestamp));
      
      // Update generation info if provided
      const genInfo = data.isAutoGenerated 
        ? { isAuto: true } 
        : { 
            isAuto: false,
            userId: data.generatedByUserId,
            username: data.generatedByUsername
          };
      setMeetingNotesGenInfo(genInfo);
      
      // Clear the generating state if active
      setIsGeneratingNotes(false);
    });

    // Listen for reaction updates
    socket.on('message-reaction-updated', ({ messageId, reactions }) => {
      setMessages(prevMessages => {
        // Find the message and update its reactions
        return prevMessages.map(msg => {
          if (msg.id === messageId) {
            return { ...msg, reactions };
          }
          return msg;
        });
      });
    });

    // Listen for voice clone updates
    socket.on('user-voice-updated', ({ userId, username, hasVoiceClone }) => {
      console.log(`[VOICE] User ${username} voice clone status updated: ${hasVoiceClone ? 'has clone' : 'no clone'}`);
      
      // Update the user in the room users list
      setRoomUsers(prevUsers => {
        return prevUsers.map(user => {
          if (user.id === userId) {
            return { ...user, hasVoiceClone };
          }
          return user;
        });
      });
      
      // If this is the current user, show a notification
      if (userId === socket.id) {
        // Display toast or notification that voice clone is now active
        console.log('[VOICE] Your voice has been cloned successfully! Your cloned voice will now be used when you speak.');
      }
    });

    // Cleanup listeners on unmount
    return () => {
      socket.off('new-message');
      socket.off('interim-message');
      socket.off('user-speaking-started');
      socket.off('user-speaking-stopped');
      socket.off('load-messages');
      socket.off('user-joined');
      socket.off('user-left');
      socket.off('stream-error');
      socket.off('meeting-notes-updated');
      socket.off('message-reaction-updated');
      socket.off('user-voice-updated');
      
      // Clear the safety timer
      clearInterval(speakingClearInterval);
      
      // Stop any playing audio
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }
    };
  }, [socket, isRecording, isMuted, isTtsEnabled, user.language]);

  // Add effect to reset speaking state when muted
  useEffect(() => {
    if (isMuted && socket) {
      // When muted, immediately clear all speaking indicators for ourselves
      setSpeakingUsers(prev => {
        const newState = { ...prev };
        if (socket.id in newState) {
          delete newState[socket.id];
        }
        return newState;
      });
      
      // Also clear user speech text
      setUserSpeechText("");
      
      // And reset speech info
      setUserSpeechInfo({
        isTranslated: false,
        originalLanguage: null,
        originalLanguageDisplay: null
      });
    }
  }, [isMuted, socket]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isRecording) {
        stopStreaming();
      }
    };
  }, []);

  // Effect to initialize audio context on user interaction
  useEffect(() => {
    const handleUserInteraction = () => {
      // Create and play a silent audio to enable future audio playback
      try {
        console.log('[Audio] User interacted with page, initializing audio context');
        const silentAudio = new Audio("data:audio/mp3;base64,SUQzBAAAAAABEVRYWFgAAAAtAAADY29tbWVudABCaWdTb3VuZEJhbmsuY29tIC8gTGFTb25vdGhlcXVlLm9yZwBURU5DAAAAHQAAA1N3aXRjaCBQbHVzIMKpIE5DSCBTb2Z0d2FyZQBUSVQyAAAABgAAAzIyMzUAVFNTRQAAAA8AAANMYXZmNTcuODMuMTAwAAAAAAAAAAAAAAD/80DEAAAAA0gAAAAATEFNRTMuMTAwVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/zQsRbAAADSAAAAABVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/zQMSkAAADSAAAAABVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV");
        silentAudio.play().catch(e => {
          console.log('[Audio] Silent audio play failed, likely waiting for user gesture', e);
        });
      } catch (e) {
        console.error('[Audio] Error initializing audio context:', e);
      }
      
      // Remove event listeners after first interaction
      document.removeEventListener('click', handleUserInteraction);
      document.removeEventListener('touchstart', handleUserInteraction);
      document.removeEventListener('keydown', handleUserInteraction);
    };

    // Add event listeners
    document.addEventListener('click', handleUserInteraction);
    document.addEventListener('touchstart', handleUserInteraction);
    document.addEventListener('keydown', handleUserInteraction);

    return () => {
      // Clean up
      document.removeEventListener('click', handleUserInteraction);
      document.removeEventListener('touchstart', handleUserInteraction);
      document.removeEventListener('keydown', handleUserInteraction);
    };
  }, []);

  // Test TTS on component mount
  useEffect(() => {
    console.log('[TTS Debug] Component mounted, TTS enabled:', isTtsEnabled);
    // Try to use browser TTS if available as a fallback
    if ('speechSynthesis' in window) {
      console.log('[TTS Debug] Browser speechSynthesis is available');
    } else {
      console.log('[TTS Debug] Browser speechSynthesis not available');
    }
  }, []);

  // Effect to update maxWidth on window resize
  useEffect(() => {
    const handleResize = () => {
      // If sidebar is larger than half the window, resize it
      const halfWidth = Math.floor(window.innerWidth / 2);
      if (sidebarWidth > halfWidth) {
        setSidebarWidth(halfWidth);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [sidebarWidth]);

  // Define toggleRecording as alias for toggleStreaming
  const toggleRecording = toggleStreaming;

  // Define language options
  const languageOptions = [
    { code: 'multi', display: 'Auto Detect' },
    { code: 'en', display: 'English' },
    { code: 'es', display: 'Spanish' },
    { code: 'fr', display: 'French' },
    { code: 'de', display: 'German' },
    { code: 'it', display: 'Italian' },
    { code: 'pt', display: 'Portuguese' },
    { code: 'ru', display: 'Russian' },
    { code: 'zh', display: 'Chinese' },
    { code: 'ja', display: 'Japanese' },
    { code: 'ko', display: 'Korean' },
    { code: 'ar', display: 'Arabic' },
    { code: 'hi', display: 'Hindi' }
  ];

  // Function to manually generate meeting notes
  const generateMeetingNotes = () => {
    if (socket && !isGeneratingNotes) {
      setIsGeneratingNotes(true);
      socket.emit('generate-meeting-notes', { room });
      
      // Set a timeout to reset the generating state in case of error
      setTimeout(() => {
        setIsGeneratingNotes(false);
      }, 30000); // 30 seconds timeout
    }
  };

  // Handle adding a reaction to a message
  const handleAddReaction = (messageId, reaction) => {
    console.log('MainLayout.handleAddReaction called with:', messageId, reaction);
    
    if (socket && messageId && reaction) {
      console.log('Emitting add-reaction event:', { room, messageId, reaction });
      socket.emit('add-reaction', { room, messageId, reaction });
    } else {
      console.log('Cannot emit reaction - missing socket, messageId, or reaction:', { 
        hasSocket: !!socket, 
        messageId, 
        reaction 
      });
    }
  };

  // Add handler for transcript language changes
  const handleTranscriptLanguageChange = (language) => {
    console.log(`Updating transcript language preference to: ${language}`);
    setTranscriptLanguage(language);
    
    // We don't need to notify the server about this preference
    // as it's only used client-side for transcript exports
  };

  // Update the handleExportTranscript function
  const handleExportTranscript = async () => {
    try {
      // Set loading state
      setIsExportingTranscript(true);
      
      // Create a timestamp for the filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const roomSlug = room ? room.toLowerCase().replace(/\s+/g, '-') : 'meeting';
      
      // Format date for the header
      const formattedDate = new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString();
      
      // Log the language preferences for debugging
      console.log('Export language preferences:', {
        transcriptLanguage,
        userLanguage: user.language,
        selectedLanguage,
        finalLanguage: transcriptLanguage || selectedLanguage || user.language || 'en'
      });
      
      console.log('Translating transcript...');
      
      // Filter out system messages that shouldn't be translated
      const messagesToTranslate = messages.filter(msg => !msg.isSystem);
      
      // FIXED: Use the selected transcript language, rather than defaulting to initial user language
      // Use the specifically selected transcript language (from settings)
      // If not set, use the current conversation language preference
      // Only fall back to the original user language if nothing else is available
      const targetLanguage = transcriptLanguage || selectedLanguage || user.language || 'en';
      
      // Call the server endpoint to translate all messages to the user's transcript language preference
      const response = await fetch('/api/translate-transcript', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: messagesToTranslate,
          targetLanguage: targetLanguage
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to translate transcript');
      }
      
      const result = await response.json();
      const translatedMessages = result.messages;
      
      console.log(`Successfully translated ${translatedMessages.length} messages to ${targetLanguage}`);
      
      // Create metadata header with rich context
      const metadata = [
        `# Conversation Transcript: ${room || 'Untitled Room'}`,
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
      
      // Add language information
      // Fixed: Use the targetLanguage we calculated above to ensure consistency
      metadata.push(`**Exported in:** ${targetLanguage} language`);
      metadata.push(`**Translated:** Yes - all messages have been translated to ${targetLanguage}`);
      metadata.push('');
      
      // Add separator
      metadata.push('---', '');
      
      // Format messages as a transcript
      const transcript = translatedMessages
        .map(msg => {
          const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const username = msg.userId === socket.id ? 'You' : msg.username;
          return `**${username}** (${time}): ${msg.text}`;
        })
        .join('\n\n');
      
      // Add system messages back in
      const systemTranscript = messages
        .filter(msg => msg.isSystem)
        .map(msg => {
          const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          return `*${time} - ${msg.text}*`;
        })
        .join('\n\n');
      
      // Combine metadata with transcript (system messages + user messages)
      const fullContent = metadata.join('\n') + systemTranscript + (systemTranscript ? '\n\n' : '') + transcript;
      
      // Create file and trigger download
      const blob = new Blob([fullContent], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      
      // Set the filename
      const filename = `${roomSlug}-transcript-${timestamp}.md`;
      
      // Browser download mechanism
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      console.log(`Transcript exported successfully in ${targetLanguage} language`);
    } catch (error) {
      console.error('Error exporting transcript:', error);
      // Show error in the console
      alert(`Error exporting transcript: ${error.message}`);
    } finally {
      // Clear loading state
      setIsExportingTranscript(false);
    }
  };

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', bgcolor: 'background.default' }}>
      {/* Top AppBar - Keep functionality but simplify styling */}
      <AppBar 
        position="static" 
        color="default" 
        elevation={0}
        sx={{ 
          bgcolor: 'background.paper',
          borderBottom: 1,
          borderColor: 'divider',
          '@keyframes fadeInScale': {
            '0%': { 
              opacity: 0,
              transform: 'scale(0.5)'
            },
            '100%': { 
              opacity: 1,
              transform: 'scale(1)'
            },
          },
          '@keyframes pulse': {
            '0%': { opacity: 1 },
            '50%': { opacity: 0.3 },
            '100%': { opacity: 1 }
          },
          '@keyframes float': {
            '0%': { transform: 'translateY(0px)' },
            '50%': { transform: 'translateY(-5px)' },
            '100%': { transform: 'translateY(0px)' }
          },
          '@keyframes spin': {
            '0%': { transform: 'rotate(0deg)' },
            '100%': { transform: 'rotate(360deg)' }
          },
          '@keyframes ripple': {
            '0%': { 
              transform: 'scale(0)',
              opacity: 1
            },
            '100%': { 
              transform: 'scale(10)',
              opacity: 0
            }
          }
        }}
      >
        <Toolbar>
          <Typography 
            variant="h6" 
            component="div" 
            sx={{ 
              flexGrow: 1,
              display: 'flex',
              alignItems: 'center',
              gap: 1
            }}
          >
            <ForumIcon /> Real-time Translation
            {room && (
              <Chip 
                label={room} 
                size="small" 
                color="primary" 
                sx={{ ml: 1 }} 
              />
            )}
          </Typography>
          
          {/* Export Transcript button */}
          <Tooltip title="Export Transcript">
            <IconButton 
              color="inherit" 
              onClick={handleExportTranscript}
              disabled={isExportingTranscript}
              sx={{ 
                mr: 1,
                position: 'relative',
                overflow: 'hidden',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                animation: 'fadeInScale 0.5s ease-out',
                animationDelay: '0.1s',
                '&:hover': {
                  transform: 'scale(1.1)',
                  backgroundColor: 'rgba(231, 183, 94, 0.15)',
                },
                '&:active': {
                  transform: 'scale(0.95)',
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    width: '5px',
                    height: '5px',
                    borderRadius: '50%',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    background: 'rgba(231, 183, 94, 0.5)',
                    animation: 'ripple 0.6s linear',
                  }
                },
                '&::after': {
                  content: '""',
                  position: 'absolute',
                  width: '100%',
                  height: '100%',
                  borderRadius: '50%',
                  top: 0,
                  left: 0,
                  pointerEvents: 'none',
                  background: 'radial-gradient(circle, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0) 70%)',
                  opacity: 0,
                  transition: 'opacity 0.5s',
                },
                '&:hover::after': {
                  opacity: 1,
                },
                ...(isExportingTranscript && {
                  animation: 'pulse 1.5s infinite',
                })
              }}
            >
              {isExportingTranscript ? <CircularProgress size={24} color="inherit" /> : <DownloadIcon />}
            </IconButton>
          </Tooltip>
          
          {/* Theme Toggle Switch */}
          <Tooltip title={`Switch to ${themeMode === 'dark' ? 'light' : 'dark'} mode`}>
            <IconButton 
              color="inherit" 
              onClick={toggleTheme}
              sx={{ 
                mr: 1,
                position: 'relative',
                overflow: 'hidden',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                animation: 'fadeInScale 0.5s ease-out',
                animationDelay: '0.2s',
                '&:hover': {
                  transform: 'rotate(12deg) scale(1.1)',
                  backgroundColor: 'rgba(231, 183, 94, 0.15)',
                },
                '&:active': {
                  transform: 'scale(0.95)',
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    width: '5px',
                    height: '5px',
                    borderRadius: '50%',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    background: themeMode === 'dark' ? 'rgba(255, 255, 130, 0.5)' : 'rgba(111, 66, 193, 0.5)',
                    animation: 'ripple 0.6s linear',
                  }
                },
                '&::after': {
                  content: '""',
                  position: 'absolute',
                  width: '100%',
                  height: '100%',
                  borderRadius: '50%',
                  top: 0,
                  left: 0,
                  pointerEvents: 'none',
                  background: 'radial-gradient(circle, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0) 70%)',
                  opacity: 0,
                  transition: 'opacity 0.5s',
                },
                '&:hover::after': {
                  opacity: 1,
                },
              }}
            >
              {themeMode === 'dark' ? 
                <LightModeIcon sx={{ 
                  '&:hover': { animation: 'spin 1s ease-in-out' } 
                }} /> : 
                <DarkModeIcon sx={{ 
                  '&:hover': { animation: 'spin 1s ease-in-out' } 
                }} />
              }
            </IconButton>
          </Tooltip>
          
          {/* Settings Button */}
          <Tooltip title="Settings">
            <IconButton 
              color="inherit" 
              onClick={() => setShowSettings(!showSettings)}
              sx={{ 
                mr: 1,
                position: 'relative',
                overflow: 'hidden',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                animation: 'fadeInScale 0.5s ease-out',
                animationDelay: '0.3s',
                '&:hover': {
                  transform: 'rotate(30deg) scale(1.1)',
                  backgroundColor: 'rgba(231, 183, 94, 0.15)',
                },
                '&:active': {
                  transform: 'rotate(30deg) scale(0.95)',
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    width: '5px',
                    height: '5px',
                    borderRadius: '50%',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    background: 'rgba(231, 183, 94, 0.5)',
                    animation: 'ripple 0.6s linear',
                  }
                },
                '&::after': {
                  content: '""',
                  position: 'absolute',
                  width: '100%',
                  height: '100%',
                  borderRadius: '50%',
                  top: 0,
                  left: 0,
                  pointerEvents: 'none',
                  background: 'radial-gradient(circle, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0) 70%)',
                  opacity: 0,
                  transition: 'opacity 0.5s',
                },
                '&:hover::after': {
                  opacity: 1,
                },
                ...(showSettings && {
                  backgroundColor: 'primary.main',
                  color: 'primary.contrastText',
                  transform: 'rotate(30deg)',
                  '&:hover': {
                    backgroundColor: 'primary.dark',
                    transform: 'rotate(30deg) scale(1.1)',
                  }
                })
              }}
            >
              <SettingsIcon />
            </IconButton>
          </Tooltip>

          {/* Leave Room Button */}
          <Tooltip title="Leave Room">
            <IconButton 
              color="inherit" 
              onClick={handleLeaveRoom}
              sx={{ 
                position: 'relative',
                overflow: 'hidden',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                animation: 'fadeInScale 0.5s ease-out',
                animationDelay: '0.4s',
                '&:hover': {
                  transform: 'scale(1.1)',
                  backgroundColor: 'rgba(244, 67, 54, 0.15)',
                  color: 'error.main',
                },
                '&:active': {
                  transform: 'scale(0.95)',
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    width: '5px',
                    height: '5px',
                    borderRadius: '50%',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    background: 'rgba(244, 67, 54, 0.5)',
                    animation: 'ripple 0.6s linear',
                  }
                },
                '&::after': {
                  content: '""',
                  position: 'absolute',
                  width: '100%',
                  height: '100%',
                  borderRadius: '50%',
                  top: 0,
                  left: 0,
                  pointerEvents: 'none',
                  background: 'radial-gradient(circle, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0) 70%)',
                  opacity: 0,
                  transition: 'opacity 0.5s',
                },
                '&:hover::after': {
                  opacity: 1,
                },
              }}
            >
              <LogoutIcon />
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>
      
      {/* Speaking indicator banner - Keep functionality but match style */}
      {!isMuted && Object.entries(speakingUsers).filter(([userId, data]) => {
        // For the current user, only show speaking indicator if there's actual speech text
        if (socket && userId === socket.id) {
          return data.isSpeaking && isRecording && userSpeechText.trim().length > 0 && (data.wordCount >= 2);
        }
        // For other users, show indicator if they are marked as speaking
        return data.isSpeaking && (data.wordCount >= 2);
      }).length > 0 && (
        <Box
          sx={{
            bgcolor: 'primary.main',
            color: 'primary.contrastText',
            py: 0.75,
            px: 2,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 1
          }}
        >
          <MicIcon fontSize="small" />
          <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
            {Object.entries(speakingUsers)
              .filter(([userId, data]) => data.isSpeaking && (!socket || userId !== socket.id || isRecording))
              .map(([userId, data]) => userId === socket.id ? 'You' : data.username)
              .join(', ')} {Object.entries(speakingUsers).filter(([userId, data]) => data.isSpeaking && (!socket || userId !== socket.id || isRecording)).length === 1 ? 'is' : 'are'} speaking...
          </Typography>
        </Box>
      )}
      
      {/* Main content area - Keep functionality but clean up styling */}
      <Box sx={{ 
        flex: '1 1 auto', 
        overflow: 'hidden', 
        display: 'flex', 
        flexDirection: 'column',
        px: 0,
        py: 0
      }}>
        <Grid container spacing={0} sx={{ height: '100%', flexWrap: 'nowrap' }}>
          {/* Settings Panel */}
          {showSettings && (
            <Grid item xs={12} md={3} sx={{ height: '100%', overflow: 'auto' }}>
              <LanguageSettings 
                selectedLanguage={selectedLanguage}
                onLanguageChange={handleLanguageChange}
                meetingNotesLanguage={meetingNotesLanguage}
                onMeetingNotesLanguageChange={handleMeetingNotesLanguageChange}
                transcriptLanguage={transcriptLanguage}
                onTranscriptLanguageChange={handleTranscriptLanguageChange}
                onClose={toggleSettings}
              />
            </Grid>
          )}
          
          {/* Conversation Display */}
          <Grid item xs={12} md={showSettings ? 9 : 12} sx={{ height: '100%', minWidth: 0 }}>
            <Box 
              sx={{ 
                height: '100%',
                display: 'flex', 
                flexDirection: 'column',
                overflow: 'hidden',
                borderRadius: 0
              }}
            >
              <Box sx={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
                {/* Main chat area - restore to single area */}
                <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
                  <ConversationDisplay 
                    messages={messages}
                    interimMessage={interimMessage}
                    currentUser={user}
                    onSendMessage={sendMessage}
                    onAddReaction={handleAddReaction}
                  />
                </Box>
                
                {/* Draggable Resizer */}
                <Box
                  sx={{
                    width: '5px',
                    cursor: 'col-resize',
                    backgroundColor: 'divider',
                    '&:hover': {
                      backgroundColor: 'primary.main',
                    },
                    '&:active': {
                      backgroundColor: 'primary.main',
                    },
                    transition: 'background-color 0.2s',
                  }}
                  onMouseDown={(e) => {
                    const startX = e.clientX;
                    const startWidth = sidebarWidth;
                    
                    const onMouseMove = (moveEvent) => {
                      // Get half of window width as max value instead of fixed 400px
                      const maxWidth = Math.floor(window.innerWidth / 2);
                      const newWidth = Math.max(150, Math.min(maxWidth, startWidth - (moveEvent.clientX - startX)));
                      setSidebarWidth(newWidth);
                    };
                    
                    const onMouseUp = () => {
                      document.removeEventListener('mousemove', onMouseMove);
                      document.removeEventListener('mouseup', onMouseUp);
                    };
                    
                    document.addEventListener('mousemove', onMouseMove);
                    document.addEventListener('mouseup', onMouseUp);
                  }}
                />
                
                {/* User list sidebar - Split horizontally into two sections */}
                <Box 
                  sx={{ 
                    width: `${sidebarWidth}px`, 
                    ml: 0, 
                    display: { xs: 'none', md: 'block' }, 
                    borderLeft: 1,
                    borderColor: 'divider',
                    overflow: 'hidden',
                    flexShrink: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    height: '100%'
                  }}
                >
                  {/* Users section - Top section with dynamic height */}
                  <Box 
                    sx={{ 
                      height: `${topSectionHeight}%`, 
                      display: 'flex', 
                      flexDirection: 'column',
                      pl: 2,
                      pr: 2,
                      overflow: 'hidden'
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1, pt: 2, justifyContent: 'center' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <PeopleIcon sx={{ color: 'text.secondary', fontSize: '1rem', mr: 0.5 }} />
                        <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.875rem' }}>
                          Users in Room
                        </Typography>
                        <Avatar 
                          sx={{ 
                            ml: 1,
                            width: 20, 
                            height: 20, 
                            bgcolor: 'background.paper',
                            border: 1,
                            borderColor: 'primary.main',
                            color: 'primary.main',
                            fontSize: '0.625rem',
                            fontWeight: 'bold' 
                          }}
                        >
                          {roomUsers.length}
                        </Avatar>
                      </Box>
                    </Box>
                    
                    <Box sx={{ overflow: 'auto', flex: 1 }}>
                      <ul style={{ 
                        listStyle: 'none', 
                        padding: 0, 
                        margin: 0,
                        marginTop: '8px'
                      }}>
                        {roomUsers.map((roomUser) => (
                          <li key={roomUser.id} style={{ 
                            marginBottom: '12px',
                            display: 'flex',
                            alignItems: 'center'
                          }}>
                            <Avatar sx={{ 
                              width: 24, 
                              height: 24, 
                              mr: 1, 
                              fontSize: '0.75rem',
                              bgcolor: roomUser.username === user.username ? 'primary.main' : (roomUser.username.charAt(0).toLowerCase() === 'd' ? 'background.paper' : 'primary.main'),
                              color: roomUser.username === user.username ? 'primary.contrastText' : (roomUser.username.charAt(0).toLowerCase() === 'd' ? 'text.primary' : 'primary.contrastText'),
                              border: roomUser.username.charAt(0).toLowerCase() === 'd' ? 1 : 0,
                              borderColor: 'primary.main'
                            }}>
                              {roomUser.username.charAt(0).toUpperCase()}
                            </Avatar>
                            <Box>
                              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                <Typography variant="body2" sx={{ 
                                  color: roomUser.username === user.username ? 'text.primary' : 'text.primary',
                                  fontSize: '0.875rem'
                                }}>
                                  {roomUser.username}
                                  {roomUser.username === user.username && ' (You)'}
                                </Typography>
                                {roomUser.hasVoiceClone && (
                                  <Tooltip title="Voice cloned">
                                    <RecordVoiceOverIcon 
                                      sx={{ 
                                        ml: 0.5, 
                                        fontSize: '0.875rem', 
                                        color: themeMode === 'dark' ? 'rgba(138, 43, 226, 0.8)' : 'rgba(231, 183, 94, 0.8)'
                                      }} 
                                    />
                                  </Tooltip>
                                )}
                              </Box>
                              <Typography variant="caption" display="block" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
                                {roomUser.language}
                              </Typography>
                            </Box>
                          </li>
                        ))}
                      </ul>
                    </Box>
                  </Box>
                  
                  {/* Horizontal Draggable Divider */}
                  <Box
                    sx={{
                      height: '5px',
                      cursor: 'row-resize',
                      backgroundColor: 'divider',
                      '&:hover': {
                        backgroundColor: 'primary.main',
                      },
                      '&:active': {
                        backgroundColor: 'primary.main',
                      },
                      transition: 'background-color 0.2s',
                    }}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      const startY = e.clientY;
                      const sidebarRect = e.currentTarget.parentElement.getBoundingClientRect();
                      const startHeight = topSectionHeight;
                      
                      const onMouseMove = (moveEvent) => {
                        const newY = moveEvent.clientY;
                        const deltaY = newY - startY;
                        
                        // Calculate new height as percentage of parent container
                        const sidebarHeight = sidebarRect.height;
                        const deltaPercent = (deltaY / sidebarHeight) * 100;
                        const newTopSectionHeight = Math.max(10, Math.min(90, startHeight + deltaPercent));
                        
                        setTopSectionHeight(newTopSectionHeight);
                      };
                      
                      const onMouseUp = () => {
                        document.removeEventListener('mousemove', onMouseMove);
                        document.removeEventListener('mouseup', onMouseUp);
                      };
                      
                      document.addEventListener('mousemove', onMouseMove);
                      document.addEventListener('mouseup', onMouseUp);
                    }}
                  />
                  
                  {/* Meeting Notes section - Bottom section with dynamic height */}
                  <Box 
                    sx={{ 
                      height: `${100 - topSectionHeight}%`, 
                      display: 'flex', 
                      flexDirection: 'column',
                      pl: 2,
                      pr: 2,
                      overflow: 'hidden'
                    }}
                  >
                    <MeetingNotesPanel
                      meetingNotes={meetingNotes}
                      meetingNotesTimestamp={meetingNotesTimestamp}
                      meetingNotesGenInfo={meetingNotesGenInfo}
                      isGeneratingNotes={isGeneratingNotes}
                      generateMeetingNotes={generateMeetingNotes}
                      room={room}
                      roomUsers={roomUsers}
                    />
                  </Box>
                </Box>
              </Box>
            </Box>
          </Grid>
        </Grid>
      </Box>
      
      {/* Control Footer - Simplified to match screenshot */}
      <Box 
        sx={{ 
          p: 2, 
          display: 'flex',
          justifyContent: 'flex-start',
          alignItems: 'center',
          backgroundColor: 'background.default',
          borderTop: 1,
          borderColor: 'divider',
          pl: 6
        }}
      >
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'flex-start',
            alignItems: 'center',
            gap: 2,
            width: '100%',
            maxWidth: '800px',
          }}
        >
          {/* Mic button - single button with text */}
          <Button
            variant="contained"
            color={isMuted ? "error" : "primary"}
            startIcon={isMuted ? <MicOffIcon /> : (isRecording ? <MicIcon /> : <MicOffIcon />)}
            onClick={isMuted ? toggleMute : toggleRecording}
            sx={{
              borderRadius: 99,
              px: 2,
              py: 1,
              textTransform: 'none',
              bgcolor: isMuted ? 'error.main' : 'primary.main',
              background: themeMode === 'dark' 
                ? (isMuted ? 'error.main' : 'linear-gradient(90deg, #9c27b0 30%, #673ab7 90%)')
                : (isMuted ? 'error.main' : 'linear-gradient(90deg, #e7b75e 30%, #c99840 90%)'),
              color: themeMode === 'dark' ? 'white' : '#333333',
              boxShadow: isMuted 
                ? '0 2px 5px rgba(244, 67, 54, 0.3)' 
                : (themeMode === 'dark' 
                  ? '0 2px 5px rgba(156, 39, 176, 0.3)'
                  : '0 2px 5px rgba(231, 183, 94, 0.3)'),
              '&:hover': {
                bgcolor: isMuted ? 'error.dark' : 'primary.dark',
                background: themeMode === 'dark'
                  ? (isMuted ? 'error.dark' : 'linear-gradient(90deg, #8e24aa 30%, #5e35b1 90%)')
                  : (isMuted ? 'error.dark' : 'linear-gradient(90deg, #d9a84a 30%, #b2872c 90%)'),
              }
            }}
          >
            {isMuted ? "Unmute" : (isRecording ? "Mute" : "Unmute")}
          </Button>
          
          {/* TTS toggle button with text */}
          <Button
            variant="contained"
            color={isTtsEnabled ? "primary" : "inherit"}
            onClick={toggleTts}
            startIcon={isTtsEnabled ? <VolumeUpIcon /> : <VolumeOffIcon />}
            sx={{
              borderRadius: 99,
              px: 2,
              py: 1,
              textTransform: 'none',
              bgcolor: isTtsEnabled ? 'primary.main' : 'background.paper',
              background: isTtsEnabled
                ? (themeMode === 'dark' 
                  ? 'linear-gradient(90deg, #9c27b0 30%, #673ab7 90%)'
                  : 'linear-gradient(90deg, #e7b75e 30%, #c99840 90%)')
                : 'background.paper',
              color: isTtsEnabled 
                ? (themeMode === 'dark' ? 'white' : '#333333')
                : 'text.secondary',
              border: isTtsEnabled ? 0 : 1,
              borderColor: 'divider',
              boxShadow: isTtsEnabled
                ? (themeMode === 'dark' 
                  ? '0 2px 5px rgba(156, 39, 176, 0.3)'
                  : '0 2px 5px rgba(231, 183, 94, 0.3)')
                : 'none',
              '&:hover': {
                background: isTtsEnabled
                  ? (themeMode === 'dark'
                    ? 'linear-gradient(90deg, #8e24aa 30%, #5e35b1 90%)'
                    : 'linear-gradient(90deg, #d9a84a 30%, #b2872c 90%)')
                  : 'background.paper',
              }
            }}
          >
            {isTtsEnabled ? "TTS On" : "TTS Off"}
          </Button>

          {/* Language select button */}
          <Button
            variant="outlined"
            color="primary"
            onClick={() => setShowSettings(true)}
            endIcon={<ArrowDropDownIcon />}
            sx={{
              borderRadius: 99,
              px: 2,
              py: 1,
              textTransform: 'none'
            }}
          >
            {selectedLanguage === 'multi' ? 'Auto Detect' : languageOptions.find(lang => lang.code === selectedLanguage)?.display || selectedLanguage}
          </Button>
          
          {/* Leave room button */}
          <Button
            variant="outlined"
            color="error"
            onClick={handleLeaveRoom}
            sx={{
              borderRadius: 99,
              px: 2,
              py: 1,
              textTransform: 'none'
            }}
          >
            Leave
          </Button>
        </Box>
      </Box>
      
      {/* Speech Popup - Keep functionality */}
      {isRecording && !isMuted && userSpeechText && (
        <SpeechPopup 
          text={userSpeechText} 
          isTranslated={userSpeechInfo.isTranslated} 
          originalLanguage={userSpeechInfo.originalLanguage}
          originalLanguageDisplay={userSpeechInfo.originalLanguageDisplay}
        />
      )}
    </Box>
  );
}

export default MainLayout; 