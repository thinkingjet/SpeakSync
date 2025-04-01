import React from 'react';
import { Paper, Typography, Box, alpha, useTheme } from '@mui/material';
import MicIcon from '@mui/icons-material/Mic';
import TranslateIcon from '@mui/icons-material/Translate';

function SpeechPopup({ text, isTranslated, originalLanguage, originalLanguageDisplay }) {
  const theme = useTheme();

  if (!text) return null;

  // Generate a simple sound wave animation
  const generateSoundWave = () => {
    const bars = [];
    for (let i = 0; i < 5; i++) {
      bars.push(
        <Box
          key={i}
          sx={{
            width: '3px',
            mx: '2px',
            bgcolor: alpha(theme.palette.primary.contrastText, 0.8),
            borderRadius: '4px',
            animation: `soundWave 1s infinite ease-in-out ${i * 0.15}s`,
            '@keyframes soundWave': {
              '0%, 100%': { height: '15px' },
              '50%': { height: '25px' }
            }
          }}
        />
      );
    }
    return bars;
  };

  return (
    <Paper
      elevation={5}
      sx={{
        position: 'fixed',
        bottom: '100px',
        left: '50%',
        transform: 'translateX(-50%)',
        minWidth: '300px',
        maxWidth: '80%',
        padding: 2,
        borderRadius: 3,
        bgcolor: alpha(theme.palette.primary.main, 0.9),
        color: theme.palette.primary.contrastText,
        backdropFilter: 'blur(8px)',
        zIndex: 1200,
        boxShadow: `0 8px 32px ${alpha(theme.palette.common.black, 0.3)}`,
        border: `1px solid ${alpha(theme.palette.primary.light, 0.3)}`,
        animation: 'fadeInUp 0.3s ease-out',
        '@keyframes fadeInUp': {
          from: { 
            opacity: 0,
            transform: 'translate(-50%, 20px)'
          },
          to: { 
            opacity: 1,
            transform: 'translate(-50%, 0)'
          }
        }
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1, justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          {isTranslated ? (
            <TranslateIcon
              sx={{
                mr: 1,
                animation: 'pulseTranslate 1.5s infinite ease-in-out',
                '@keyframes pulseTranslate': {
                  '0%': { opacity: 0.7, transform: 'scale(1)' },
                  '50%': { opacity: 1, transform: 'scale(1.1)' },
                  '100%': { opacity: 0.7, transform: 'scale(1)' }
                }
              }}
            />
          ) : (
            <MicIcon
              sx={{
                mr: 1,
                animation: 'pulseMic 1.5s infinite ease-in-out',
                '@keyframes pulseMic': {
                  '0%': { opacity: 0.7, transform: 'scale(1)' },
                  '50%': { opacity: 1, transform: 'scale(1.1)' },
                  '100%': { opacity: 0.7, transform: 'scale(1)' }
                }
              }}
            />
          )}
          <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
            {isTranslated ? 'Translating...' : 'Listening...'}
          </Typography>
        </Box>
        
        {/* Sound wave animation */}
        <Box sx={{ display: 'flex', alignItems: 'flex-end', height: '25px', ml: 2 }}>
          {generateSoundWave()}
        </Box>
      </Box>
      
      <Typography 
        variant="body1" 
        sx={{ 
          fontWeight: 'medium',
          py: 1.5,
          px: 2.5,
          borderRadius: 2,
          bgcolor: alpha(theme.palette.primary.dark, 0.3),
          maxHeight: '150px',
          overflowY: 'auto',
          wordBreak: 'break-word',
          position: 'relative',
          lineHeight: 1.5,
          '&::-webkit-scrollbar': {
            width: '4px'
          },
          '&::-webkit-scrollbar-track': {
            backgroundColor: 'transparent'
          },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: alpha(theme.palette.primary.contrastText, 0.3),
            borderRadius: '4px'
          }
        }}
      >
        "{text}"
      </Typography>
      
      {isTranslated && (originalLanguageDisplay || originalLanguage) && (
        <Typography 
          variant="caption" 
          sx={{ 
            display: 'block', 
            mt: 1, 
            fontStyle: 'italic', 
            textAlign: 'center',
            opacity: 0.8
          }}
        >
          Translated from {originalLanguageDisplay || originalLanguage}
        </Typography>
      )}
    </Paper>
  );
}

export default SpeechPopup; 