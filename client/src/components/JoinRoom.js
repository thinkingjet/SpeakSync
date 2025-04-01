import React, { useState, useRef, useEffect } from 'react';
import { Box, Typography, TextField, Button, Paper, FormControl, InputLabel, Select, MenuItem, alpha, IconButton, Tooltip, useTheme, Checkbox, FormControlLabel, CircularProgress } from '@mui/material';
import LanguageSettings, { LANGUAGES } from './LanguageSettings';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';

function JoinRoom({ onJoin, isConnected, connectionError, retryCount, themeMode, toggleTheme }) {
  const [username, setUsername] = useState('');
  const [room, setRoom] = useState('');
  const [language, setLanguage] = useState('multi'); // Default to multilingual auto-detect
  const [error, setError] = useState('');
  const [cloneVoice, setCloneVoice] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingComplete, setRecordingComplete] = useState(false);
  const [audioBlobs, setAudioBlobs] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkingVoiceClone, setCheckingVoiceClone] = useState(false);
  const [existingVoiceId, setExistingVoiceId] = useState(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const theme = useTheme();
  const isDark = themeMode === 'dark';

  // Sample sentences for the user to read (30 seconds of audio)
  const sampleSentences = [
    "Hello, I'm using this real-time meeting room for seamless communication across languages. Natural language processing makes it easy to communicate effectively with colleagues around the world. Voice cloning technology preserves my voice characteristics when my speech is translated. I appreciate how this platform breaks down language barriers in international meetings."
  ];

  // Recording timer state
  const [recordingTime, setRecordingTime] = useState(0);
  const recordingTimerRef = useRef(null);
  
  // Cleanup timer when component unmounts or when voice cloning is toggled off
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    };
  }, []);
  
  // Clean up timer and recording when voice cloning is toggled off
  useEffect(() => {
    if (!cloneVoice) {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        const tracks = mediaRecorderRef.current.stream.getTracks();
        tracks.forEach(track => track.stop());
        mediaRecorderRef.current = null;
      }
    }
  }, [cloneVoice]);

  // Add a state for tracking the voice ID after cloning
  const [clonedVoiceId, setClonedVoiceId] = useState(null);

  // Add effect to check if user has a cloned voice when username changes
  useEffect(() => {
    const checkForExistingVoice = async () => {
      // Only check if username is not empty and has at least 3 characters
      if (!username || username.trim().length < 3) {
        setExistingVoiceId(null);
        return;
      }
      
      try {
        setCheckingVoiceClone(true);
        console.log(`[VOICE CHECK] Checking if user "${username}" has a cloned voice`);
        
        const response = await fetch(`http://localhost:5000/api/check-voice-clone?username=${encodeURIComponent(username.trim())}`, {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Accept': 'application/json',
            'Origin': 'http://localhost:3000'
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log(`[VOICE CHECK] Response from server:`, data);
          
          if (data.voiceId) {
            console.log(`[VOICE CHECK] Found existing voice clone for user ${username}: ${data.voiceId}`);
            setExistingVoiceId(data.voiceId);
            // Auto-enable the voice clone checkbox if there's an existing voice
            setCloneVoice(true);
            setRecordingComplete(true);
          } else {
            console.log(`[VOICE CHECK] No existing voice clone found for user ${username}`);
            setExistingVoiceId(null);
          }
        } else {
          // Try to get detailed error information
          let errorMessage;
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || `HTTP error: ${response.status}`;
          } catch (e) {
            errorMessage = `HTTP error: ${response.status}`;
          }
          
          console.error(`[VOICE CHECK] Error checking for voice clone: ${errorMessage}`);
          console.log(`[VOICE CHECK] Full response:`, response);
          setExistingVoiceId(null);
        }
      } catch (error) {
        console.error('[VOICE CHECK] Error checking for existing voice clone:', error);
        setExistingVoiceId(null);
      } finally {
        setCheckingVoiceClone(false);
      }
    };
    
    const timeoutId = setTimeout(() => {
      checkForExistingVoice();
    }, 500); // Add a small delay to avoid too many API calls while typing
    
    return () => clearTimeout(timeoutId);
  }, [username]);

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate input
    if (!username.trim()) {
      setError('Please enter a username');
      return;
    }
    
    if (!room.trim()) {
      setError('Please enter a room name');
      return;
    }

    // If voice cloning is selected but recording not complete and user doesn't have an existing voice
    if (cloneVoice && !recordingComplete && !existingVoiceId) {
      setError('Please complete the voice recording process before joining');
      return;
    }
    
    // Clear any error
    setError('');
    
    // Process voice cloning if needed
    let voiceId = null;
    
    // If user has existing voice ID, use that
    if (existingVoiceId) {
      console.log(`Using existing voice clone ID: ${existingVoiceId}`);
      voiceId = existingVoiceId;
    } 
    // Otherwise, if voice cloning is enabled and there are audio blobs, process them
    else if (cloneVoice && audioBlobs.length > 0) {
      try {
        setIsSubmitting(true);
        voiceId = await handleVoiceCloning();
        setIsSubmitting(false);
      } catch (err) {
        console.error('Voice cloning failed:', err);
        setIsSubmitting(false);
        setError('Voice cloning failed. You can still join without voice cloning.');
        // Continue without voice cloning if it fails
      }
    }
    
    // Join the room
    onJoin({
      username: username.trim(),
      room: room.trim(),
      language,
      voiceId
    });
  };

  // Function to start recording user's voice
  const startRecording = async () => {
    try {
      console.log('Requesting microphone access for voice cloning...');
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          channelCount: 1,
          sampleRate: 44100,
          echoCancellation: true,
          noiseSuppression: true
        } 
      });
      
      console.log('Microphone access granted, configuring recorder...');
      const options = { mimeType: 'audio/webm' }; // Better compatibility than WAV
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          console.log(`Audio chunk received: ${event.data.size} bytes`);
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        console.log('Recording stopped, processing audio...');
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        console.log(`Final audio size: ${audioBlob.size} bytes`);
        setAudioBlobs([audioBlob]);
        audioChunksRef.current = [];
        
        // Complete the recording process
        setRecordingComplete(true);
        setIsRecording(false);
        
        // Clear timer
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
        
        console.log('Recording processed and ready for cloning');
      };
      
      // Reset recording time
      setRecordingTime(0);
      
      // Start the timer
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      
      // Start recording
      console.log('Starting voice recording...');
      mediaRecorder.start(1000); // Collect data every second
      setIsRecording(true);
    } catch (err) {
      console.error('Error accessing microphone:', err);
      setError(`Error accessing microphone: ${err.message}. Please check your permissions and try again.`);
    }
  };
  
  // Function to stop recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      // Stream cleanup
      const tracks = mediaRecorderRef.current.stream.getTracks();
      tracks.forEach(track => track.stop());
      
      // Clear timer
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  };
  
  // Function to send voice recording to server for cloning
  const handleVoiceCloning = async () => {
    try {
      // If the user already has a cloned voice, just return the existing ID
      if (existingVoiceId) {
        console.log(`Using existing voice ID for user ${username}: ${existingVoiceId}`);
        return existingVoiceId;
      }
      
      console.log('=== VOICE CLONING PROCESS STARTED ===');
      console.log(`Username: ${username.trim()}`);
      console.log(`Audio blobs: ${audioBlobs.length}`);
      console.log(`First blob size: ${audioBlobs[0]?.size || 0} bytes`);
      
      const formData = new FormData();
      formData.append('name', username.trim());
      formData.append('remove_background_noise', 'true');
      
      // Append all audio blobs as files
      audioBlobs.forEach((blob, index) => {
        console.log(`Adding blob ${index} to request: ${blob.size} bytes, type: ${blob.type}`);
        formData.append('files', blob, `recording-${index}.webm`);
      });
      
      // Log the FormData contents (for debugging)
      console.log('FormData created with the following entries:');
      for (const pair of formData.entries()) {
        console.log(`- ${pair[0]}: ${pair[1] instanceof Blob ? `Blob (${pair[1].size} bytes)` : pair[1]}`);
      }
      
      // Send to server
      console.log('Sending voice cloning request to server...');
      const response = await fetch('http://localhost:5000/api/voice-clone', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Origin': 'http://localhost:3000'
        },
        body: formData
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Voice cloning failed:', errorData);
        throw new Error(errorData.error || 'Failed to clone voice');
      }
      
      const data = await response.json();
      console.log('Voice cloning successful:', data);
      
      // Store the voice ID
      const voiceId = data.voice_id;
      
      // Store the voice ID in state for UI display
      setClonedVoiceId(voiceId);
      
      return voiceId;
    } catch (err) {
      console.error('=== VOICE CLONING FAILED ===');
      console.error(`Error: ${err.message}`);
      console.error('Error details:', err);
      throw err;
    }
  };
  
  // Content for voice recording section
  const renderVoiceRecordingSection = () => {
    if (!cloneVoice) return null;
    
    // Show a loading indicator while checking for existing voice clone
    if (checkingVoiceClone) {
      return (
        <Box sx={{ 
          mt: 2, 
          p: 2, 
          borderRadius: 1, 
          bgcolor: isDark ? 'rgba(138, 43, 226, 0.1)' : 'rgba(231, 183, 94, 0.1)',
          border: `1px solid ${isDark ? 'rgba(138, 43, 226, 0.3)' : 'rgba(231, 183, 94, 0.3)'}`,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          flexDirection: 'column',
          gap: 1
        }}>
          <CircularProgress size={24} />
          <Typography variant="body2">Checking for existing voice clone...</Typography>
        </Box>
      );
    }
    
    // If user already has a cloned voice, show that information
    if (existingVoiceId) {
      return (
        <Box sx={{ 
          mt: 2, 
          p: 2, 
          borderRadius: 1, 
          bgcolor: isDark ? 'rgba(138, 43, 226, 0.1)' : 'rgba(231, 183, 94, 0.1)',
          border: `1px solid ${isDark ? 'rgba(138, 43, 226, 0.3)' : 'rgba(231, 183, 94, 0.3)'}` 
        }}>
          <Typography variant="body1" sx={{ color: 'text.primary', fontWeight: 'medium', display: 'flex', alignItems: 'center' }}>
            Existing voice clone found! ✓
            <Box component="span" sx={{ 
              ml: 1, 
              fontSize: '0.75rem', 
              bgcolor: isDark ? 'rgba(138, 43, 226, 0.2)' : 'rgba(231, 183, 94, 0.2)', 
              color: 'primary.main',
              py: 0.5,
              px: 1,
              borderRadius: 1
            }}>
              Voice ready
            </Box>
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>
            Your voice has been previously cloned (ID: {existingVoiceId.substring(0, 8)}...)
            and will be used automatically when you join the room.
          </Typography>
          <Typography variant="caption" sx={{ color: 'success.main', display: 'block', mt: 1 }}>
            There's no need to record your voice again. Your existing voice clone will be used.
          </Typography>
        </Box>
      );
    }
    
    if (recordingComplete) {
      return (
        <Box sx={{ 
          mt: 2, 
          p: 2, 
          borderRadius: 1, 
          bgcolor: isDark ? 'rgba(138, 43, 226, 0.1)' : 'rgba(231, 183, 94, 0.1)',
          border: `1px solid ${isDark ? 'rgba(138, 43, 226, 0.3)' : 'rgba(231, 183, 94, 0.3)'}` 
        }}>
          <Typography variant="body1" sx={{ color: 'text.primary', fontWeight: 'medium', display: 'flex', alignItems: 'center' }}>
            Voice recording complete! ✓
            {clonedVoiceId && (
              <Box component="span" sx={{ 
                ml: 1, 
                fontSize: '0.75rem', 
                bgcolor: isDark ? 'rgba(138, 43, 226, 0.2)' : 'rgba(231, 183, 94, 0.2)', 
                color: 'primary.main',
                py: 0.5,
                px: 1,
                borderRadius: 1
              }}>
                Voice cloned
              </Box>
            )}
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>
            {clonedVoiceId 
              ? `Your voice has been successfully cloned with ID: ${clonedVoiceId.substring(0, 8)}...`
              : 'Your voice will be cloned when you join the room.'}
          </Typography>
        </Box>
      );
    }
    
    return (
      <Box sx={{ 
        mt: 2, 
        p: 2, 
        borderRadius: 1, 
        bgcolor: isDark ? 'rgba(138, 43, 226, 0.1)' : 'rgba(231, 183, 94, 0.1)',
        border: `1px solid ${isDark ? 'rgba(138, 43, 226, 0.3)' : 'rgba(231, 183, 94, 0.3)'}` 
      }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1, color: 'primary.main' }}>
          Voice Cloning Setup
        </Typography>
        
        <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
          Please read the following paragraph clearly. We need 20-30 seconds of your voice for effective cloning.
        </Typography>
        
        <Box sx={{ 
          p: 2, 
          borderRadius: 1, 
          bgcolor: 'background.paper',
          boxShadow: 1,
          mb: 2
        }}>
          <Typography variant="body1" sx={{ 
            fontWeight: 'medium', 
            fontStyle: 'italic',
            color: 'text.primary'
          }}>
            "{sampleSentences[0]}"
          </Typography>
        </Box>
        
        {isRecording && (
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center',
            mb: 2
          }}>
            <Typography 
              variant="body2" 
              sx={{ 
                color: recordingTime < 10 ? 'text.secondary' : (recordingTime > 30 ? 'error.main' : 'success.main'),
                fontWeight: 'medium'
              }}
            >
              Recording: {Math.floor(recordingTime / 60)}:{String(recordingTime % 60).padStart(2, '0')}
              {recordingTime < 10 && ' (Keep going...)'}
              {recordingTime >= 10 && recordingTime < 20 && ' (Almost there...)'}
              {recordingTime >= 20 && recordingTime < 30 && ' (Good length!)'}
              {recordingTime >= 30 && ' (You can stop now)'}
            </Typography>
          </Box>
        )}
        
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 1 }}>
          {isRecording ? (
            <Button 
              variant="outlined" 
              color="error" 
              onClick={stopRecording}
              sx={{ 
                borderRadius: 6,
                px: 3,
                py: 1
              }}
            >
              Stop Recording
            </Button>
          ) : (
            <Button 
              variant="contained" 
              color="primary" 
              onClick={startRecording}
              sx={{ 
                borderRadius: 6,
                px: 3,
                py: 1,
                background: isDark 
                  ? 'linear-gradient(45deg, #8a2be2 30%, #bc13fe 90%)'
                  : 'linear-gradient(45deg, #e7b75e 30%, #f1ca7e 90%)',
              }}
            >
              Start Recording
            </Button>
          )}
        </Box>
      </Box>
    );
  };

  return (
    <Box 
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        p: 2,
        bgcolor: 'background.default'
      }}
    >
      <Paper 
        elevation={6} 
        sx={{ 
          p: 4, 
          width: '100%', 
          maxWidth: 500,
          borderRadius: 2,
          bgcolor: 'background.paper',
          position: 'relative'
        }}
      >
        {/* Theme toggle button in the top-right corner */}
        <Tooltip title={`Switch to ${themeMode === 'dark' ? 'light' : 'dark'} mode`}>
          <IconButton 
            color="primary" 
            onClick={toggleTheme}
            sx={{ 
              position: 'absolute', 
              top: 16, 
              right: 16 
            }}
          >
            {themeMode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
          </IconButton>
        </Tooltip>

        <Typography variant="h4" component="h1" align="center" gutterBottom 
          sx={{ 
            color: 'primary.main',
            fontWeight: 600,
            mb: 2
          }}
        >
          Real-Time Meeting Room
        </Typography>
        
        <Typography variant="body1" align="center" sx={{ 
          mb: 4, 
          color: 'text.primary' 
        }}>
          Join a room to start conversing with real-time speech transcription
        </Typography>
        
        <form onSubmit={handleSubmit}>
          <TextField
            label="Your Name"
            fullWidth
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            margin="normal"
            variant="outlined"
            placeholder="Enter your name"
            error={error.includes('username')}
            required
            sx={{
              '& .MuiOutlinedInput-root': {
                backgroundColor: isDark ? 'rgba(30, 30, 30, 0.7)' : 'rgba(255, 255, 255, 0.9)',
                '& fieldset': {
                  borderColor: isDark ? 'rgba(138, 43, 226, 0.3)' : 'rgba(231, 183, 94, 0.5)',
                },
                '&:hover fieldset': {
                  borderColor: isDark ? 'rgba(138, 43, 226, 0.5)' : 'rgba(231, 183, 94, 0.7)',
                },
                '&.Mui-focused fieldset': {
                  borderColor: 'primary.main',
                }
              },
              '& .MuiInputBase-input': {
                color: 'text.primary',
              },
              '& .MuiInputLabel-root': {
                color: 'text.secondary',
              }
            }}
          />
          
          <TextField
            label="Room Name"
            fullWidth
            value={room}
            onChange={(e) => setRoom(e.target.value)}
            margin="normal"
            variant="outlined"
            placeholder="Enter a room name"
            helperText="Create a new room or join an existing one"
            error={error.includes('room')}
            required
            sx={{
              '& .MuiOutlinedInput-root': {
                backgroundColor: isDark ? 'rgba(30, 30, 30, 0.7)' : 'rgba(255, 255, 255, 0.9)',
                '& fieldset': {
                  borderColor: isDark ? 'rgba(138, 43, 226, 0.3)' : 'rgba(231, 183, 94, 0.5)',
                },
                '&:hover fieldset': {
                  borderColor: isDark ? 'rgba(138, 43, 226, 0.5)' : 'rgba(231, 183, 94, 0.7)',
                },
                '&.Mui-focused fieldset': {
                  borderColor: 'primary.main',
                }
              },
              '& .MuiInputBase-input': {
                color: 'text.primary',
              },
              '& .MuiInputLabel-root': {
                color: 'text.secondary',
              },
              '& .MuiFormHelperText-root': {
                color: 'text.secondary',
              }
            }}
          />
          
          <FormControl fullWidth margin="normal">
            <InputLabel id="language-select-label" sx={{ color: 'text.secondary' }}>Language</InputLabel>
            <Select
              labelId="language-select-label"
              value={language}
              label="Language"
              onChange={(e) => setLanguage(e.target.value)}
              sx={{
                backgroundColor: isDark ? 'rgba(30, 30, 30, 0.7)' : 'rgba(255, 255, 255, 0.9)',
                color: 'text.primary',
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: isDark ? 'rgba(138, 43, 226, 0.3)' : 'rgba(231, 183, 94, 0.5)',
                },
                '&:hover .MuiOutlinedInput-notchedOutline': {
                  borderColor: isDark ? 'rgba(138, 43, 226, 0.5)' : 'rgba(231, 183, 94, 0.7)',
                },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'primary.main',
                },
                '& .MuiSvgIcon-root': {
                  color: 'text.secondary',
                }
              }}
              MenuProps={{
                PaperProps: {
                  sx: {
                    bgcolor: 'background.paper',
                    boxShadow: '0 8px 16px rgba(0, 0, 0, 0.2)',
                    '& .MuiMenuItem-root': {
                      color: 'text.primary',
                      '&:hover': {
                        backgroundColor: isDark ? 'rgba(138, 43, 226, 0.2)' : 'rgba(231, 183, 94, 0.2)',
                      },
                      '&.Mui-selected': {
                        backgroundColor: isDark ? 'rgba(138, 43, 226, 0.3)' : 'rgba(231, 183, 94, 0.3)',
                        '&:hover': {
                          backgroundColor: isDark ? 'rgba(138, 43, 226, 0.4)' : 'rgba(231, 183, 94, 0.4)',
                        }
                      }
                    }
                  }
                }
              }}
            >
              {LANGUAGES.map((lang) => (
                <MenuItem key={lang.code} value={lang.code}>
                  {lang.name}
                </MenuItem>
              ))}
            </Select>
            <Typography variant="caption" sx={{ mt: 0.5, ml: 1.5, color: 'text.secondary' }}>
              Select your preferred language. Multilingual auto-detection only works for English and Spanish.
            </Typography>
          </FormControl>
          
          <FormControlLabel
            control={
              <Checkbox 
                checked={cloneVoice} 
                onChange={(e) => {
                  // If user already has a voice, don't allow unchecking
                  if (existingVoiceId) {
                    return;
                  }
                  
                  setCloneVoice(e.target.checked);
                  if (!e.target.checked) {
                    // Reset voice recording state if unchecked
                    setRecordingComplete(false);
                    setAudioBlobs([]);
                    if (isRecording) {
                      stopRecording();
                      setIsRecording(false);
                    }
                  }
                }}
                sx={{
                  color: isDark ? 'rgba(138, 43, 226, 0.5)' : 'rgba(231, 183, 94, 0.5)',
                  '&.Mui-checked': {
                    color: isDark ? 'rgba(138, 43, 226, 0.8)' : 'rgba(231, 183, 94, 0.8)',
                  }
                }}
                disabled={checkingVoiceClone || existingVoiceId !== null}
              />
            }
            label={
              <Box>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  Clone my voice so others hear my translated messages in my voice
                </Typography>
                {existingVoiceId && (
                  <Typography variant="caption" sx={{ 
                    display: 'block', 
                    color: isDark ? 'rgba(138, 43, 226, 0.8)' : 'rgba(231, 183, 94, 0.8)', 
                    fontWeight: 'medium',
                    mt: 0.5
                  }}>
                    Your voice has already been cloned and will be used automatically.
                  </Typography>
                )}
              </Box>
            }
            sx={{ 
              my: 2,
              alignItems: 'flex-start' 
            }}
          />
          
          {renderVoiceRecordingSection()}
          
          {error && (
            <Typography color="error" variant="body2" sx={{ mt: 2 }}>
              {error}
            </Typography>
          )}
          
          <Button 
            type="submit" 
            variant="contained" 
            color="primary" 
            fullWidth 
            size="large"
            disabled={isSubmitting || (cloneVoice && !recordingComplete && !existingVoiceId)}
            sx={{ 
              mt: 3,
              py: 1.5,
              borderRadius: 2,
              fontWeight: 'bold',
              textTransform: 'none',
              background: isDark 
                ? 'linear-gradient(45deg, #8a2be2 30%, #bc13fe 90%)'
                : 'linear-gradient(45deg, #e7b75e 30%, #f1ca7e 90%)',
              boxShadow: isDark
                ? '0 4px 10px rgba(138, 43, 226, 0.3), 0 0 5px rgba(138, 43, 226, 0.2)'
                : '0 4px 10px rgba(231, 183, 94, 0.3), 0 0 5px rgba(231, 183, 94, 0.2)',
              transition: 'all 0.2s ease-in-out',
              '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: isDark
                  ? '0 6px 15px rgba(138, 43, 226, 0.5), 0 0 10px rgba(138, 43, 226, 0.3)'
                  : '0 6px 15px rgba(231, 183, 94, 0.5), 0 0 10px rgba(231, 183, 94, 0.3)',
                background: isDark
                  ? 'linear-gradient(45deg, #7928ca 30%, #a913fe 90%)'
                  : 'linear-gradient(45deg, #d6a84c 30%, #e1ba6e 90%)',
              },
              opacity: (isSubmitting || (cloneVoice && !recordingComplete && !existingVoiceId)) ? 0.7 : 1
            }}
          >
            {isSubmitting ? (
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <CircularProgress size={24} sx={{ mr: 1, color: 'white' }} />
                Processing...
              </Box>
            ) : (
              'Join Room'
            )}
          </Button>
        </form>
      </Paper>
    </Box>
  );
}

export default JoinRoom; 