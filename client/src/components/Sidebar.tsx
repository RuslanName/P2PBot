import { useEffect, useState } from 'react';
import { useStore } from '../store/store';
import type { SidebarProps } from "../types";
import { Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText, IconButton, Box, Typography } from '@mui/material';
import {
    People,
    MonetizationOn,
    Handshake,
    SupportAgent,
    Gavel,
    ExitToApp,
    ChevronLeft,
    ChevronRight,
    Verified,
    Menu
} from '@mui/icons-material';

interface ExtendedSidebarProps extends SidebarProps {
    isCollapsed: boolean;
    setIsCollapsed: (value: boolean) => void;
    isOpen: boolean;
    setIsOpen: (value: boolean) => void;
}

const Sidebar: React.FC<ExtendedSidebarProps> = ({ activeTab, setActiveTab, role, isCollapsed, setIsCollapsed, isOpen, setIsOpen }) => {
    const { logout } = useStore();
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    useEffect(() => {
        const handleResize = () => {
            const mobile = window.innerWidth < 768;
            setIsMobile(mobile);
            if (!mobile) {
                setIsOpen(true);
                setIsCollapsed(false);
            } else {
                setIsOpen(false);
                setIsCollapsed(false);
            }
        };
        window.addEventListener('resize', handleResize);
        handleResize();
        return () => window.removeEventListener('resize', handleResize);
    }, [setIsOpen, setIsCollapsed]);

    return (
        <>
            {isMobile && !isOpen && (
                <IconButton
                    onClick={() => setIsOpen(true)}
                    sx={{
                        position: 'fixed',
                        bottom: 16,
                        right: 16,
                        zIndex: 1300,
                        color: '#ffffff',
                        backgroundColor: '#1a1b2e',
                        '&:hover': { backgroundColor: '#2e2f4f' },
                        width: 56,
                        height: 56,
                        '& .MuiSvgIcon-root': {
                            fontSize: 32,
                        },
                    }}
                >
                    <Menu />
                </IconButton>
            )}
            <Drawer
                variant={isMobile ? 'temporary' : 'permanent'}
                open={isMobile ? isOpen : true}
                onClose={() => setIsOpen(false)}
                sx={{
                    width: isCollapsed ? 72 : 260,
                    flexShrink: 0,
                    '& .MuiDrawer-paper': {
                        width: isCollapsed ? 72 : 260,
                        boxSizing: 'border-box',
                        backgroundColor: '#1a1b2e',
                        color: '#ffffff',
                        transition: 'width 0.3s ease',
                        borderRight: '1px solid #2e2f4f',
                        overflowX: 'hidden',
                        display: 'flex',
                        flexDirection: 'column',
                        zIndex: 1200,
                    },
                }}
            >
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 2, borderBottom: '1px solid #2e2f4f' }}>
                    {!isCollapsed && (
                        <Typography variant="h6" sx={{ fontWeight: 600, color: '#ffffff' }}>
                            P2P панель
                        </Typography>
                    )}
                    <IconButton
                        onClick={() => isMobile ? setIsOpen(false) : setIsCollapsed(!isCollapsed)}
                        sx={{ color: '#ffffff', '&:hover': { backgroundColor: '#2e2f4f' } }}
                    >
                        {!isMobile && (isCollapsed ? <ChevronRight /> : <ChevronLeft />)}
                    </IconButton>
                </Box>

                <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <List sx={{ flex: 1 }}>
                        {role === 'admin' && (
                            <ListItem disablePadding>
                                <ListItemButton
                                    selected={activeTab === 'users'}
                                    onClick={() => {
                                        setActiveTab('users');
                                        if (isMobile) setIsOpen(false);
                                    }}
                                    sx={{
                                        height: isCollapsed ? 48 : 56,
                                        width: isCollapsed ? 48 : '100%',
                                        mx: isCollapsed ? 1.5 : 0,
                                        border: '1px solid #2e2f4f',
                                        borderRadius: 2,
                                        mb: 0.5,
                                        '&.Mui-selected': {
                                            backgroundColor: '#3f51b5',
                                            '&:hover': { backgroundColor: '#2e2f4f' },
                                        },
                                        '&:focus': {
                                            outline: 'none',
                                        },
                                        '&:hover': { backgroundColor: '#2e2f4f' },
                                        display: 'flex',
                                        justifyContent: isCollapsed ? 'center' : 'flex-start',
                                    }}
                                >
                                    <ListItemIcon sx={{ color: '#ffffff', minWidth: isCollapsed ? 40 : 56, display: 'flex', justifyContent: 'center' }}>
                                        <People />
                                    </ListItemIcon>
                                    {!isCollapsed && <ListItemText primary="Пользователи" />}
                                </ListItemButton>
                            </ListItem>
                        )}

                        <ListItem disablePadding>
                            <ListItemButton
                                selected={activeTab === 'offers'}
                                onClick={() => {
                                    setActiveTab('offers');
                                    if (isMobile) setIsOpen(false);
                                }}
                                sx={{
                                    height: isCollapsed ? 48 : 56,
                                    width: isCollapsed ? 48 : '100%',
                                    mx: isCollapsed ? 1.5 : 0,
                                    border: '1px solid #2e2f4f',
                                    borderRadius: 2,
                                    mb: 0.5,
                                    '&.Mui-selected': {
                                        backgroundColor: '#3f51b5',
                                        '&:hover': { backgroundColor: '#2e2f4f' },
                                    },
                                    '&:focus': {
                                        outline: 'none',
                                    },
                                    '&:hover': { backgroundColor: '#2e2f4f' },
                                    display: 'flex',
                                    justifyContent: isCollapsed ? 'center' : 'flex-start',
                                }}
                            >
                                <ListItemIcon sx={{ color: '#ffffff', minWidth: isCollapsed ? 40 : 56, display: 'flex', justifyContent: 'center' }}>
                                    <MonetizationOn />
                                </ListItemIcon>
                                {!isCollapsed && <ListItemText primary="Офферы" />}
                            </ListItemButton>
                        </ListItem>

                        <ListItem disablePadding>
                            <ListItemButton
                                selected={activeTab === 'deals'}
                                onClick={() => {
                                    setActiveTab('deals');
                                    if (isMobile) setIsOpen(false);
                                }}
                                sx={{
                                    height: isCollapsed ? 48 : 56,
                                    width: isCollapsed ? 48 : '100%',
                                    mx: isCollapsed ? 1.5 : 0,
                                    border: '1px solid #2e2f4f',
                                    borderRadius: 2,
                                    mb: 0.5,
                                    '&.Mui-selected': {
                                        backgroundColor: '#3f51b5',
                                        '&:hover': { backgroundColor: '#2e2f4f' },
                                    },
                                    '&:focus': {
                                        outline: 'none',
                                    },
                                    '&:hover': { backgroundColor: '#2e2f4f' },
                                    display: 'flex',
                                    justifyContent: isCollapsed ? 'center' : 'flex-start',
                                }}
                            >
                                <ListItemIcon sx={{ color: '#ffffff', minWidth: isCollapsed ? 40 : 56, display: 'flex', justifyContent: 'center' }}>
                                    <Handshake />
                                </ListItemIcon>
                                {!isCollapsed && <ListItemText primary="Обмен" />}
                            </ListItemButton>
                        </ListItem>

                        {role === 'admin' && (
                            <ListItem disablePadding>
                                <ListItemButton
                                    selected={activeTab === 'warrant-holders'}
                                    onClick={() => {
                                        setActiveTab('warrant-holders');
                                        if (isMobile) setIsOpen(false);
                                    }}
                                    sx={{
                                        height: isCollapsed ? 48 : 56,
                                        width: isCollapsed ? 48 : '100%',
                                        mx: isCollapsed ? 1.5 : 0,
                                        border: '1px solid #2e2f4f',
                                        borderRadius: 2,
                                        mb: 0.5,
                                        '&.Mui-selected': {
                                            backgroundColor: '#3f51b5',
                                            '&:hover': { backgroundColor: '#2e2f4f' },
                                        },
                                        '&:focus': {
                                            outline: 'none',
                                        },
                                        '&:hover': { backgroundColor: '#2e2f4f' },
                                        display: 'flex',
                                        justifyContent: isCollapsed ? 'center' : 'flex-start',
                                    }}
                                >
                                    <ListItemIcon sx={{ color: '#ffffff', minWidth: isCollapsed ? 40 : 56, display: 'flex', justifyContent: 'center' }}>
                                        <Gavel />
                                    </ListItemIcon>
                                    {!isCollapsed && <ListItemText primary="Ордеродержатели" />}
                                </ListItemButton>
                            </ListItem>
                        )}

                        {role === 'admin' && (
                            <ListItem disablePadding>
                                <ListItemButton
                                    selected={activeTab === 'aml-verifications'}
                                    onClick={() => {
                                        setActiveTab('aml-verifications');
                                        if (isMobile) setIsOpen(false);
                                    }}
                                    sx={{
                                        height: isCollapsed ? 48 : 56,
                                        width: isCollapsed ? 48 : '100%',
                                        mx: isCollapsed ? 1.5 : 0,
                                        border: '1px solid #2e2f4f',
                                        borderRadius: 2,
                                        mb: 0.5,
                                        '&.Mui-selected': {
                                            backgroundColor: '#3f51b5',
                                            '&:hover': { backgroundColor: '#2e2f4f' },
                                        },
                                        '&:focus': {
                                            outline: 'none',
                                        },
                                        '&:hover': { backgroundColor: '#2e2f4f' },
                                        display: 'flex',
                                        justifyContent: isCollapsed ? 'center' : 'flex-start',
                                    }}
                                >
                                    <ListItemIcon sx={{ color: '#ffffff', minWidth: isCollapsed ? 40 : 56, display: 'flex', justifyContent: 'center' }}>
                                        <Verified />
                                    </ListItemIcon>
                                    {!isCollapsed && <ListItemText primary="AML проверки" />}
                                </ListItemButton>
                            </ListItem>
                        )}

                        {role === 'admin' && (
                            <ListItem disablePadding>
                                <ListItemButton
                                    selected={activeTab === 'support-tickets'}
                                    onClick={() => {
                                        setActiveTab('support-tickets');
                                        if (isMobile) setIsOpen(false);
                                    }}
                                    sx={{
                                        height: isCollapsed ? 48 : 56,
                                        width: isCollapsed ? 48 : '100%',
                                        mx: isCollapsed ? 1.5 : 0,
                                        border: '1px solid #2e2f4f',
                                        borderRadius: 2,
                                        mb: 0.5,
                                        '&.Mui-selected': {
                                            backgroundColor: '#3f51b5',
                                            '&:hover': { backgroundColor: '#2e2f4f' },
                                        },
                                        '&:focus': {
                                            outline: 'none',
                                        },
                                        '&:hover': { backgroundColor: '#2e2f4f' },
                                        display: 'flex',
                                        justifyContent: isCollapsed ? 'center' : 'flex-start',
                                    }}
                                >
                                    <ListItemIcon sx={{ color: '#ffffff', minWidth: isCollapsed ? 40 : 56, display: 'flex', justifyContent: 'center' }}>
                                        <SupportAgent />
                                    </ListItemIcon>
                                    {!isCollapsed && <ListItemText primary="Тех. поддержка" />}
                                </ListItemButton>
                            </ListItem>
                        )}
                    </List>

                    <Box sx={{ mt: 'auto' }}>
                        <ListItem disablePadding>
                            <ListItemButton
                                onClick={() => {
                                    logout();
                                    if (isMobile) setIsOpen(false);
                                }}
                                sx={{
                                    height: isCollapsed ? 48 : 56,
                                    width: isCollapsed ? 48 : '100%',
                                    mx: isCollapsed ? 1.5 : 0,
                                    border: '1px solid #2e2f4f',
                                    borderRadius: 2,
                                    mb: 0.5,
                                    backgroundColor: '#d32f2f',
                                    '&:hover': { backgroundColor: '#b71c1c' },
                                    '&:focus': { outline: 'none' },
                                    display: 'flex',
                                    justifyContent: isCollapsed ? 'center' : 'flex-start',
                                }}
                            >
                                <ListItemIcon sx={{ color: '#ffffff', minWidth: isCollapsed ? 40 : 56, display: 'flex', justifyContent: 'center' }}>
                                    <ExitToApp />
                                </ListItemIcon>
                                {!isCollapsed && <ListItemText primary="Выйти" />}
                            </ListItemButton>
                        </ListItem>
                    </Box>
                </Box>
            </Drawer>
        </>
    );
};

export default Sidebar;