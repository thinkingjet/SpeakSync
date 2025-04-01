import React, { useRef, useEffect, useState } from 'react';
import { 
  Box, 
  Typography, 
  TextField, 
  Button, 
  Paper, 
  List, 
  ListItem, 
  ListItemText, 
  Avatar, 
  alpha, 
  useTheme, 
  Popover,
  IconButton,
  Tooltip,
  ClickAwayListener
} from '@mui/material';
import { Send as SendIcon } from '@mui/icons-material';
import AddReactionIcon from '@mui/icons-material/AddReaction';

// Common emoji reactions
const EMOJI_REACTIONS = [
  { emoji: '👍', label: 'thumbs up' },
  { emoji: '👎', label: 'thumbs down' },
  { emoji: '❤️', label: 'heart' },
  { emoji: '😂', label: 'laugh' },
  { emoji: '😮', label: 'wow' },
  { emoji: '👏', label: 'clap' },
  { emoji: '🎉', label: 'celebrate' },
  { emoji: '🔥', label: 'fire' }
];

function ConversationDisplay({ messages, interimMessage, currentUser, onSendMessage, onAddReaction }) {
  const messagesEndRef = useRef(null);
  const [messageInput, setMessageInput] = useState('');
  const listRef = useRef(null);
  const theme = useTheme();
  const [reactionMenuAnchor, setReactionMenuAnchor] = useState(null);
  const [selectedMessageId, setSelectedMessageId] = useState(null);

  // Scroll to bottom when messages update
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, interimMessage]);

  // Handle sending a message
  const handleSendMessage = (e) => {
    e.preventDefault();
    if (messageInput.trim()) {
      onSendMessage(messageInput.trim());
      setMessageInput('');
    }
  };

  // Open reaction menu
  const handleOpenReactionMenu = (event, messageId) => {
    event.stopPropagation();
    // Find the message to determine if it's from current user
    const message = messages.find(msg => msg.id === messageId);
    const isCurrentUser = message && message.userId === currentUser.socketId;
    
    setReactionMenuAnchor(event.currentTarget);
    setSelectedMessageId({
      id: messageId,
      isFromCurrentUser: isCurrentUser
    });
  };

  // Close reaction menu
  const handleCloseReactionMenu = () => {
    setReactionMenuAnchor(null);
    setSelectedMessageId(null);
  };

  // Handle adding a reaction
  const handleReaction = (emoji) => {
    console.log('handleReaction called with emoji:', emoji);
    console.log('selectedMessageId:', selectedMessageId);
    
    if (selectedMessageId && onAddReaction) {
      console.log('Calling onAddReaction with:', selectedMessageId.id, emoji);
      onAddReaction(selectedMessageId.id, emoji);
    } else {
      console.log('Cannot add reaction, missing selectedMessageId or onAddReaction');
    }
    handleCloseReactionMenu();
  };

  // Generate message bubble styles based on whether it's from the current user
  const getMessageStyle = (userId) => {
    const isCurrentUser = userId === currentUser.socketId;
    return {
      display: 'flex',
      flexDirection: 'column',
      alignItems: isCurrentUser ? 'flex-end' : 'flex-start',
      mb: 2
    };
  };

  // Generate bubble style for the message content
  const getBubbleStyle = (userId, isSystem = false, isInterim = false) => {
    const isCurrentUser = userId === currentUser.socketId;
    
    if (isSystem) {
      return {
        backgroundColor: 'transparent',
        color: theme.palette.text.secondary,
        borderRadius: '8px',
        py: 1,
        px: 2,
        maxWidth: '80%',
        textAlign: 'center',
        mx: 'auto',
      };
    }
    
    if (isInterim) {
      return {
        backgroundColor: isCurrentUser 
          ? alpha(theme.palette.primary.main, 0.7) 
          : alpha(theme.palette.primary.dark, 0.3),
        color: isCurrentUser ? theme.palette.primary.contrastText : theme.palette.text.primary,
        borderRadius: '16px',
        py: 1,
        px: 2,
        maxWidth: '70%',
        opacity: 0.9,
      };
    }
    
    return {
      backgroundColor: isCurrentUser 
        ? theme.palette.primary.main 
        : theme.palette.background.paper,
      color: isCurrentUser ? theme.palette.primary.contrastText : theme.palette.text.primary,
      borderRadius: '16px',
      py: 1.5,
      px: 2.5,
      maxWidth: '70%',
      boxShadow: 'none',
      border: !isCurrentUser ? `1px solid ${theme.palette.divider}` : 'none',
      position: 'relative', // Added for reaction hover button
    };
  };

  // Format timestamp for display
  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Render reactions for a message
  const renderReactions = (reactions, messageId) => {
    if (!reactions || Object.keys(reactions).length === 0) {
      return null;
    }

    return (
      <Box 
        sx={{ 
          display: 'flex', 
          flexWrap: 'wrap', 
          mt: 0.5, 
          gap: 0.5 
        }}
      >
        {Object.entries(reactions).map(([emoji, users]) => (
          <Tooltip
            key={emoji}
            title={users.map(user => user.username).join(', ')}
            arrow
          >
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                backgroundColor: alpha(theme.palette.primary.main, 0.1),
                borderRadius: '12px',
                px: 1,
                py: 0.3,
                border: '1px solid',
                borderColor: alpha(theme.palette.primary.main, 0.2),
                cursor: 'pointer',
                '&:hover': {
                  backgroundColor: alpha(theme.palette.primary.main, 0.2),
                },
                // Highlight if current user reacted
                ...(users.some(user => user.userId === currentUser.socketId) && {
                  backgroundColor: alpha(theme.palette.primary.main, 0.3),
                  borderColor: alpha(theme.palette.primary.main, 0.4),
                }),
              }}
              onClick={() => {
                console.log('Clicking on existing reaction:', messageId, emoji);
                onAddReaction(messageId, emoji);
              }}
            >
              <Typography mr={0.5}>{emoji}</Typography>
              <Typography variant="caption" fontWeight="bold">{users.length}</Typography>
            </Box>
          </Tooltip>
        ))}
      </Box>
    );
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Messages List */}
      <Box 
        sx={{ 
          flex: '1 1 auto',
          overflow: 'auto', 
          mb: 0,
          pr: 1,
          display: 'flex',
          flexDirection: 'column',
          '&::-webkit-scrollbar': {
            width: '4px'
          },
          '&::-webkit-scrollbar-track': {
            backgroundColor: 'transparent'
          },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: alpha(theme.palette.primary.main, 0.2),
            borderRadius: '4px'
          }
        }} 
        ref={listRef}
      >
        <List sx={{ width: '100%', padding: 2, flex: '0 0 auto' }}>
          {messages.map((message, index) => (
            <ListItem 
              key={message.id || index} 
              sx={{
                ...getMessageStyle(message.userId),
                animation: 'none'
              }} 
              disablePadding
            >
              {/* Message content */}
              <Box 
                sx={{
                  position: 'relative',
                  '&:hover .reaction-button': {
                    display: 'flex'
                  }
                }}
              >
                <Box sx={getBubbleStyle(message.userId, message.isSystem)}>
                  {/* Reaction button (shown on hover) */}
                  {!message.isSystem && (
                    <IconButton
                      className="reaction-button"
                      size="small"
                      onClick={(e) => handleOpenReactionMenu(e, message.id)}
                      sx={{
                        position: 'absolute',
                        top: '50%',
                        right: message.userId === currentUser.socketId ? 'auto' : '-28px',
                        left: message.userId === currentUser.socketId ? '-28px' : 'auto',
                        transform: 'translateY(-50%)',
                        bgcolor: 'background.paper',
                        boxShadow: 1,
                        border: '1px solid',
                        borderColor: 'divider',
                        display: 'none',
                        p: 0.5,
                        '&:hover': {
                          bgcolor: alpha(theme.palette.primary.main, 0.1)
                        }
                      }}
                    >
                      <AddReactionIcon fontSize="small" />
                    </IconButton>
                  )}
                  <Typography variant="body2">
                    {message.text}
                  </Typography>
                  {/* Show original language if message was translated */}
                  {message.isTranslated && (
                    <Typography variant="caption" sx={{ display: 'block', mt: 0.5, opacity: 0.7, fontStyle: 'italic', fontSize: '0.7rem' }}>
                      Translated from {message.originalLanguageDisplay || message.originalLanguage || 'another language'}
                    </Typography>
                  )}
                  {message.language && !message.isSystem && message.languageDisplay !== 'Multilingual' && (
                    <Typography variant="caption" sx={{ display: 'block', opacity: 0.7, fontSize: '0.7rem' }}>
                      Language: {message.languageDisplay || message.language}
                    </Typography>
                  )}
                </Box>

                {/* Render reactions */}
                {!message.isSystem && message.reactions && renderReactions(message.reactions, message.id)}
              </Box>
              
              {/* Username and timestamp */}
              <Box sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                mt: 0.5, 
                mb: message === messages[messages.length - 1] ? 2 : 1.5, 
                width: '100%', 
                justifyContent: message.isSystem ? 'center' : (message.userId === currentUser.socketId ? 'flex-end' : 'flex-start'),
                opacity: 0.7
              }}>
                {!message.isSystem && (
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                    {message.userId === currentUser.socketId ? 'You' : message.username} · {formatTime(message.timestamp)}
                  </Typography>
                )}
              </Box>
            </ListItem>
          ))}
          
          {/* Interim message (showing someone typing) */}
          {interimMessage && (
            <ListItem sx={getMessageStyle(interimMessage.userId)} disablePadding>
              {/* Interim message content */}
              <Box sx={getBubbleStyle(interimMessage.userId, false, true)}>
                <Typography variant="body2">
                  {interimMessage.text}
                </Typography>
                {/* Show translation indicator for translated interim messages */}
                {interimMessage.isTranslated && (
                  <Typography variant="caption" sx={{ display: 'block', mt: 0.5, opacity: 0.7, fontStyle: 'italic', fontSize: '0.7rem' }}>
                    Translated from {interimMessage.originalLanguageDisplay || interimMessage.originalLanguage || 'another language'}
                  </Typography>
                )}
              </Box>
              
              {/* Username for interim message */}
              <Box sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                mt: 0.5, 
                width: '100%',
                opacity: 0.7,
                justifyContent: interimMessage.userId === currentUser.socketId ? 'flex-end' : 'flex-start' 
              }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic', fontSize: '0.7rem' }}>
                  {interimMessage.userId === currentUser.socketId ? 'You' : interimMessage.username} is speaking...
                </Typography>
              </Box>
            </ListItem>
          )}
          
          <div ref={messagesEndRef} />
        </List>
      </Box>
      
      {/* Message Input */}
      <Box 
        sx={{ 
          p: 1.5, 
          flexShrink: 0, 
          bgcolor: 'background.default',
          borderRadius: 0,
          display: 'flex',
          justifyContent: 'flex-start',
          pl: 6
        }}
      >
        <form onSubmit={handleSendMessage} style={{ width: '100%', maxWidth: '800px' }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <TextField
              fullWidth
              placeholder="Type a message..."
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              variant="outlined"
              size="small"
              sx={{ 
                mr: 1,
                '& .MuiOutlinedInput-root': {
                  borderRadius: 99,
                  fontSize: '0.9rem'
                }
              }}
            />
            <Button 
              type="submit" 
              variant="contained" 
              color="primary" 
              disabled={!messageInput.trim()}
              sx={{
                minWidth: 0,
                width: 40,
                height: 40,
                borderRadius: '50%',
                p: 0,
                bgcolor: '#ffffff',
                color: '#9c27b0',
                '&:hover': {
                  bgcolor: '#f5f5f5',
                  color: '#7b1fa2'
                }
              }}
            >
              <SendIcon fontSize="small" />
            </Button>
          </Box>
        </form>
      </Box>

      {/* Reaction Menu Popover */}
      <Popover
        open={Boolean(reactionMenuAnchor)}
        anchorEl={reactionMenuAnchor}
        onClose={handleCloseReactionMenu}
        anchorOrigin={{
          vertical: 'center',
          horizontal: selectedMessageId?.isFromCurrentUser ? 'right' : 'left',
        }}
        transformOrigin={{
          vertical: 'center',
          horizontal: selectedMessageId?.isFromCurrentUser ? 'left' : 'right',
        }}
        sx={{ 
          '& .MuiPopover-paper': { 
            borderRadius: '24px',
            boxShadow: 3 
          } 
        }}
      >
        <Box sx={{ 
          display: 'flex', 
          p: 1,
          bgcolor: 'background.paper',
          borderRadius: '24px'
        }}>
          {EMOJI_REACTIONS.map((emojiObj) => (
            <IconButton
              key={emojiObj.emoji}
              onClick={() => handleReaction(emojiObj.emoji)}
              size="small"
              sx={{ 
                fontSize: '1.2rem',
                mx: 0.3,
                transition: 'transform 0.2s',
                '&:hover': {
                  transform: 'scale(1.2)',
                  bgcolor: alpha(theme.palette.primary.main, 0.1),
                }
              }}
            >
              {emojiObj.emoji}
            </IconButton>
          ))}
        </Box>
      </Popover>
    </Box>
  );
}

export default ConversationDisplay; 