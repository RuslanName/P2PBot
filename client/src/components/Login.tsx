import { useState } from 'react';
import { useStore } from '../store/store';
import { Box, Paper, Typography, TextField, Button, Alert } from '@mui/material';
import KeyIcon from '@mui/icons-material/Key';

const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const success = await login(username, password);
    if (!success) {
      setError('Неверное имя пользователя или пароль');
    }
  };

  return (
      <Box
          sx={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#1a1b2e', // Dark background matching Sidebar
          }}
      >
        <Paper
            elevation={3}
            sx={{
              padding: 3,
              width: '100%',
              maxWidth: 400,
              backgroundColor: '#ffffff',
              borderRadius: 2,
              border: '1px solid #2e2f4f', // Border color matching Sidebar
            }}
        >
          <Typography variant="h5" sx={{ fontWeight: 600, color: '#1a1b2e', mb: 2 }}>
            Вход в P2P панель
          </Typography>
          <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
                label="Имя пользователя"
                variant="outlined"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                fullWidth
                required
                sx={{
                  '& .MuiOutlinedInput-root': {
                    '& fieldset': { borderColor: '#2e2f4f' },
                    '&:hover fieldset': { borderColor: '#3f51b5' },
                    '&.Mui-focused fieldset': { borderColor: '#3f51b5' },
                  },
                  '& .MuiInputLabel-root': { color: '#1a1b2e' },
                  '& .MuiInputLabel-root.Mui-focused': { color: '#3f51b5' },
                }}
            />
            <TextField
                label="Пароль"
                type="password"
                variant="outlined"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                fullWidth
                required
                sx={{
                  '& .MuiOutlinedInput-root': {
                    '& fieldset': { borderColor: '#2e2f4f' },
                    '&:hover fieldset': { borderColor: '#3f51b5' },
                    '&.Mui-focused fieldset': { borderColor: '#3f51b5' },
                  },
                  '& .MuiInputLabel-root': { color: '#1a1b2e' },
                  '& .MuiInputLabel-root.Mui-focused': { color: '#3f51b5' },
                }}
            />
            {error && (
                <Alert severity="error" sx={{ mt: 1 }}>
                  {error}
                </Alert>
            )}
            <Button
                type="submit"
                variant="contained"
                startIcon={<KeyIcon />}
                fullWidth
                sx={{
                  backgroundColor: '#3f51b5', // Matching Sidebar's selected button color
                  color: '#ffffff',
                  padding: 1,
                  '&:hover': { backgroundColor: '#2e2f4f' }, // Matching Sidebar's hover color
                  textTransform: 'none',
                  fontWeight: 500,
                }}
            >
              Войти
            </Button>
          </Box>
        </Paper>
      </Box>
  );
};

export default Login;