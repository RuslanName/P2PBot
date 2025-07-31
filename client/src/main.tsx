import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './App.css';
import { useStore } from './store/store';

const AuthInitializer = () => {
    const initializeAuth = useStore(state => state.initializeAuth);
    const [isInitialized, setIsInitialized] = React.useState(false);

    React.useEffect(() => {
        const init = async () => {
            await initializeAuth();
            setIsInitialized(true);
        };
        init();
    }, [initializeAuth]);

    if (!isInitialized) return <div>Загрузка...</div>;

    return <App />;
};

ReactDOM.createRoot(document.getElementById('root')!).render(
    <AuthInitializer />
);