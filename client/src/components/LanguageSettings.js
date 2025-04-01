import React from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  FormControl, 
  InputLabel, 
  Select, 
  MenuItem,
  Divider,
  IconButton,
  alpha,
  useTheme
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import LanguageIcon from '@mui/icons-material/Language';

// List of common languages with their codes
export const LANGUAGES = [
  { code: 'multi', name: 'Multilingual (English + Spanish only)' },
  { code: 'bg', name: 'Bulgarian' },
  { code: 'ca', name: 'Catalan' },
  { code: 'zh', name: 'Chinese (General)' },
  { code: 'zh-CN', name: 'Chinese (Simplified)' },
  { code: 'zh-Hans', name: 'Chinese (Simplified, Alternate)' },
  { code: 'zh-TW', name: 'Chinese (Traditional)' },
  { code: 'zh-Hant', name: 'Chinese (Traditional, Alternate)' },
  { code: 'zh-HK', name: 'Chinese (Cantonese)' },
  { code: 'cs', name: 'Czech' },
  { code: 'da', name: 'Danish (General)' },
  { code: 'da-DK', name: 'Danish (Denmark)' },
  { code: 'nl', name: 'Dutch' },
  { code: 'nl-BE', name: 'Flemish (Belgium)' },
  { code: 'en', name: 'English (General)' },
  { code: 'en-AU', name: 'English (Australia)' },
  { code: 'en-IN', name: 'English (India)' },
  { code: 'en-NZ', name: 'English (New Zealand)' },
  { code: 'en-GB', name: 'English (UK)' },
  { code: 'en-US', name: 'English (US)' },
  { code: 'et', name: 'Estonian' },
  { code: 'fi', name: 'Finnish' },
  { code: 'fr', name: 'French (General)' },
  { code: 'fr-CA', name: 'French (Canada)' },
  { code: 'de', name: 'German (General)' },
  { code: 'de-CH', name: 'German (Switzerland)' },
  { code: 'el', name: 'Greek' },
  { code: 'hi', name: 'Hindi' },
  { code: 'hu', name: 'Hungarian' },
  { code: 'id', name: 'Indonesian' },
  { code: 'it', name: 'Italian' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean (General)' },
  { code: 'ko-KR', name: 'Korean (South Korea)' },
  { code: 'lv', name: 'Latvian' },
  { code: 'lt', name: 'Lithuanian' },
  { code: 'ms', name: 'Malay' },
  { code: 'no', name: 'Norwegian' },
  { code: 'pl', name: 'Polish' },
  { code: 'pt', name: 'Portuguese (General)' },
  { code: 'pt-BR', name: 'Portuguese (Brazil)' },
  { code: 'pt-PT', name: 'Portuguese (Portugal)' },
  { code: 'ro', name: 'Romanian' },
  { code: 'ru', name: 'Russian' },
  { code: 'sk', name: 'Slovak' },
  { code: 'es', name: 'Spanish (General)' },
  { code: 'es-419', name: 'Spanish (Latin America)' },
  { code: 'sv', name: 'Swedish (General)' },
  { code: 'sv-SE', name: 'Swedish (Sweden)' },
  { code: 'th', name: 'Thai (General)' },
  { code: 'th-TH', name: 'Thai (Thailand)' },
  { code: 'tr', name: 'Turkish' },
  { code: 'uk', name: 'Ukrainian' },
  { code: 'vi', name: 'Vietnamese' }
];

function LanguageSettings({ 
  selectedLanguage, 
  onLanguageChange, 
  onClose, 
  meetingNotesLanguage, 
  onMeetingNotesLanguageChange,
  transcriptLanguage,
  onTranscriptLanguageChange
}) {
  const theme = useTheme();
  
  const handleChange = (event) => {
    onLanguageChange(event.target.value);
  };

  const handleMeetingNotesLanguageChange = (event) => {
    onMeetingNotesLanguageChange(event.target.value);
  };
  
  const handleTranscriptLanguageChange = (event) => {
    onTranscriptLanguageChange(event.target.value);
  };

  return (
    <Paper 
      elevation={3} 
      sx={{ 
        p: 3, 
        height: '100%', 
        display: 'flex', 
        flexDirection: 'column',
        gap: 2,
        bgcolor: 'background.paper',
        borderRadius: 2,
        boxShadow: `0 4px 16px ${alpha(theme.palette.common.black, 0.2)}`,
        border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
        position: 'relative'
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
        <LanguageIcon sx={{ color: 'primary.main', mr: 1 }} />
        <Typography variant="h6" component="h2" sx={{ fontWeight: 'bold', color: 'primary.main', flexGrow: 1 }}>
          Language Settings
        </Typography>
        {onClose && (
          <IconButton onClick={onClose} size="small" edge="end" sx={{ color: 'text.secondary' }}>
            <CloseIcon />
          </IconButton>
        )}
      </Box>
      
      <Divider sx={{ borderColor: alpha(theme.palette.divider, 0.6) }} />
      
      <Box sx={{ mt: 2, px: 1 }}>
        <Typography variant="subtitle2" gutterBottom sx={{ color: 'primary.light', fontWeight: 'bold' }}>
          Your Preferred Language
        </Typography>
        
        <Typography variant="body2" color="text.secondary" paragraph>
          Select the language you'll be speaking in and the language you want to see other users' messages in
        </Typography>
        
        <FormControl fullWidth size="small" sx={{ mt: 1 }}>
          <InputLabel id="speech-language-label">Preferred Language</InputLabel>
          <Select
            labelId="speech-language-label"
            id="speech-language"
            value={selectedLanguage}
            label="Preferred Language"
            onChange={handleChange}
            sx={{
              '&.MuiOutlinedInput-root': {
                '& fieldset': {
                  borderColor: alpha(theme.palette.primary.main, 0.3),
                },
                '&:hover fieldset': {
                  borderColor: alpha(theme.palette.primary.main, 0.5),
                },
                '&.Mui-focused fieldset': {
                  borderColor: theme.palette.primary.main,
                },
              },
              borderRadius: 1
            }}
          >
            {LANGUAGES.map((lang) => (
              <MenuItem key={lang.code} value={lang.code} sx={{
                '&.Mui-selected': {
                  bgcolor: alpha(theme.palette.primary.main, 0.1),
                  '&:hover': {
                    bgcolor: alpha(theme.palette.primary.main, 0.15),
                  }
                }
              }}>
                {lang.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>
      
      <Box sx={{ mt: 2, px: 1 }}>
        <Typography variant="subtitle2" gutterBottom sx={{ color: 'primary.light', fontWeight: 'bold' }}>
          Meeting Notes Language
        </Typography>
        
        <Typography variant="body2" color="text.secondary" paragraph>
          Select the language you want to see meeting notes in (defaults to your preferred language)
        </Typography>
        
        <FormControl fullWidth size="small" sx={{ mt: 1 }}>
          <InputLabel id="meeting-notes-language-label">Meeting Notes Language</InputLabel>
          <Select
            labelId="meeting-notes-language-label"
            id="meeting-notes-language"
            value={meetingNotesLanguage || selectedLanguage}
            label="Meeting Notes Language"
            onChange={handleMeetingNotesLanguageChange}
            sx={{
              '&.MuiOutlinedInput-root': {
                '& fieldset': {
                  borderColor: alpha(theme.palette.primary.main, 0.3),
                },
                '&:hover fieldset': {
                  borderColor: alpha(theme.palette.primary.main, 0.5),
                },
                '&.Mui-focused fieldset': {
                  borderColor: theme.palette.primary.main,
                },
              },
              borderRadius: 1
            }}
          >
            {LANGUAGES.map((lang) => (
              <MenuItem key={lang.code} value={lang.code} sx={{
                '&.Mui-selected': {
                  bgcolor: alpha(theme.palette.primary.main, 0.1),
                  '&:hover': {
                    bgcolor: alpha(theme.palette.primary.main, 0.15),
                  }
                }
              }}>
                {lang.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>
      
      {/* <Box sx={{ mt: 2, px: 1 }}>
        <Typography variant="subtitle2" gutterBottom sx={{ color: 'primary.light', fontWeight: 'bold' }}>
          Transcript Export Language
        </Typography>
        
        <Typography variant="body2" color="text.secondary" paragraph>
          Select the language you want to export conversation transcripts in (defaults to your preferred language)
        </Typography>
        
        <FormControl fullWidth size="small" sx={{ mt: 1 }}>
          <InputLabel id="transcript-language-label">Transcript Language</InputLabel>
          <Select
            labelId="transcript-language-label"
            id="transcript-language"
            value={transcriptLanguage || selectedLanguage}
            label="Transcript Language"
            onChange={handleTranscriptLanguageChange}
            sx={{
              '&.MuiOutlinedInput-root': {
                '& fieldset': {
                  borderColor: alpha(theme.palette.primary.main, 0.3),
                },
                '&:hover fieldset': {
                  borderColor: alpha(theme.palette.primary.main, 0.5),
                },
                '&.Mui-focused fieldset': {
                  borderColor: theme.palette.primary.main,
                },
              },
              borderRadius: 1
            }}
          >
            {LANGUAGES.map((lang) => (
              <MenuItem key={lang.code} value={lang.code} sx={{
                '&.Mui-selected': {
                  bgcolor: alpha(theme.palette.primary.main, 0.1),
                  '&:hover': {
                    bgcolor: alpha(theme.palette.primary.main, 0.15),
                  }
                }
              }}>
                {lang.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box> */}
      
      <Box sx={{ 
        mt: 2, 
        px: 2,
        py: 1, 
        bgcolor: alpha(theme.palette.background.default, 0.5), 
        borderRadius: 2,
        borderLeft: `4px solid ${alpha(theme.palette.primary.main, 0.6)}`,
        boxShadow: `0 2px 8px ${alpha(theme.palette.common.black, 0.05)}`,
        mx: 1,
        maxWidth: '100%',
        position: 'relative',
        zIndex: 1,
        marginBottom: 6,
        '&::before': {
          content: '""',
          position: 'absolute',
          top: '-10px',
          left: 0,
          right: 0,
          height: '10px',
          backgroundColor: 'background.paper',
          zIndex: 0
        }
      }}>
        <Typography 
          variant="subtitle2" 
          gutterBottom 
          sx={{ 
            color: theme.palette.mode === 'light' ? '#c99840' : 'primary.main',
            fontWeight: 'bold',
            fontSize: '0.95rem',
            mb: 0.5,
            display: 'flex',
            alignItems: 'center',
            position: 'relative',
            zIndex: 2
          }}
        >
          About Speech Recognition
        </Typography>
        
        <Typography 
          variant="body2" 
          color="text.primary" 
          sx={{ 
            mb: 1,
            lineHeight: 1.4,
            fontSize: '0.85rem',
            position: 'relative',
            zIndex: 2
          }}
        >
          Speech recognition works best in a quiet environment. Speak clearly 
          and at a normal pace for the best results.
        </Typography>
        
        <Typography 
          variant="body2" 
          sx={{ 
            py: 0.75,
            px: 1.5,
            borderRadius: 1,
            bgcolor: alpha(theme.palette.info.main, 0.08),
            border: `1px solid ${alpha(theme.palette.info.main, 0.15)}`,
            color: theme.palette.mode === 'light' ? '#537186' : theme.palette.info.dark,
            fontWeight: 500,
            lineHeight: 1.4,
            fontSize: '0.8rem',
            position: 'relative',
            zIndex: 2
          }}
        >
          <strong>Note:</strong> Multilingual auto-detection currently only works for English and Spanish. 
          For other languages, please select the specific language option.
        </Typography>
      </Box>
      
      <Box sx={{ 
        mt: 1,
        pt: 1.5, 
        pb: 1,
        px: 2,
        borderTop: `1px dashed ${alpha(theme.palette.divider, 0.3)}`,
        display: 'flex',
        alignItems: 'center',
        mx: 1,
        position: 'relative',
        zIndex: 1,
        marginTop: 4
      }}>
        <Box 
          sx={{ 
            width: 3, 
            height: 3, 
            borderRadius: '50%', 
            bgcolor: theme.palette.mode === 'light' ? '#c99840' : 'primary.main',
            mr: 1.5,
            boxShadow: `0 0 0 2px ${alpha(theme.palette.primary.main, 0.15)}`
          }} 
        />
        <Typography 
          variant="body2" 
          color="text.secondary" 
          sx={{ 
            fontStyle: 'italic',
            lineHeight: 1.5,
            fontSize: '0.85rem',
            letterSpacing: '0.01em'
          }}
        >
          Your language selection affects both what you speak in and how you receive messages. 
          Messages from other users will be translated to your preferred language automatically.
        </Typography>
      </Box>
    </Paper>
  );
}

export default LanguageSettings; 