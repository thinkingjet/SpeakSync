import { createTheme } from '@mui/material/styles';

// Create a theme generator function that accepts a mode ('light' or 'dark')
const createAppTheme = (mode) => createTheme({
  palette: {
    mode,
    primary: {
      main: mode === 'dark' ? '#9c27b0' : '#e7b75e', // Purple for dark, Gold for light
      light: mode === 'dark' ? '#bb86fc' : '#f1ca7e',
      dark: mode === 'dark' ? '#7b1fa2' : '#c99840',
      contrastText: mode === 'dark' ? '#ffffff' : '#333333',
    },
    secondary: {
      main: mode === 'dark' ? '#03dac6' : '#8a794e', // Teal for dark, Muted gold for light
      light: mode === 'dark' ? '#66fff9' : '#a59677',
      dark: mode === 'dark' ? '#00a896' : '#6d5e36',
      contrastText: mode === 'dark' ? '#000000' : '#ffffff',
    },
    background: {
      default: mode === 'dark' ? '#121212' : '#f4f1e6', // Dark/cream background
      paper: mode === 'dark' ? '#1e1e1e' : '#ffffff',   // Dark/white paper
    },
    text: {
      primary: mode === 'dark' ? '#e0e0e0' : '#333333',  // Light/dark text
      secondary: mode === 'dark' ? '#b0b0b0' : '#666666', // Medium gray
    },
    error: {
      main: '#f44336', 
      light: '#ff7961',
      dark: '#ba000d',
    },
    warning: {
      main: '#ff9800', 
      light: '#ffc947',
      dark: '#c66900',
    },
    info: {
      main: mode === 'dark' ? '#29b6f6' : '#5b87a3', 
      light: mode === 'dark' ? '#73e8ff' : '#8bb0c7',
      dark: mode === 'dark' ? '#0086c3' : '#3d6680',
    },
    success: {
      main: '#4caf50',
      light: '#80e27e',
      dark: '#087f23',
    },
    divider: mode === 'dark' ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)',
  },
  typography: {
    fontFamily: [
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif',
    ].join(','),
    h1: {
      fontWeight: 500,
    },
    h2: {
      fontWeight: 500,
    },
    h3: {
      fontWeight: 500,
    },
    h4: {
      fontWeight: 500,
    },
    h5: {
      fontWeight: 500,
    },
    h6: {
      fontWeight: 500,
    },
    subtitle1: {
      fontWeight: 400,
    },
    subtitle2: {
      fontWeight: 400,
    },
    body1: {
      fontWeight: 400,
    },
    body2: {
      fontWeight: 400,
    },
    button: {
      fontWeight: 500,
      textTransform: 'none', // More modern look without all caps
    },
  },
  shape: {
    borderRadius: 8, // Slightly larger radius for a modern feel
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          boxShadow: 'none',
          '&:hover': {
            boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.3)',
            transform: 'translateY(-1px)',
          },
          transition: 'all 0.2s ease-in-out',
        },
        containedPrimary: {
          ...(mode === 'light' && {
            color: '#333333', // Darker text on gold button in light mode
          }),
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none', // Remove the default background image
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          boxShadow: '0px 1px 3px rgba(0, 0, 0, 0.2)',
          backgroundImage: 'none',
          ...(mode === 'light' && {
            backgroundColor: '#fcf9ef', // Lighter background for AppBar in light mode
          }),
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          boxShadow: '0px 2px 6px rgba(0, 0, 0, 0.15)',
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            '& fieldset': {
              borderColor: mode === 'dark' ? 'rgba(255, 255, 255, 0.23)' : 'rgba(0, 0, 0, 0.23)',
            },
            '&:hover fieldset': {
              borderColor: mode === 'dark' ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)',
            },
          },
        },
      },
    },
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          ...(mode === 'light' && {
            backgroundColor: '#f4f1e6',
            color: '#333333',
          }),
        },
      },
    },
  },
});

// Create light and dark themes
const lightTheme = createAppTheme('light');
const darkTheme = createAppTheme('dark');

export { lightTheme, darkTheme }; 