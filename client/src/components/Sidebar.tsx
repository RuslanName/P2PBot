import { useState } from 'react';
import { useStore } from '../store/store';

interface SidebarProps {
    activeTab: 'users' | 'offers' | 'deals' | 'warrant-holders';
    setActiveTab: (tab: 'users' | 'offers' | 'deals' | 'warrant-holders') => void;
    role: string;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, role }) => {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const { logout } = useStore();

    return (
        <div className={`flex flex-col h-screen bg-gray-800 text-white ${isCollapsed ? 'w-16' : 'w-64'} transition-all duration-300`}>
            <div className="p-4 flex justify-between items-center border-b border-gray-700">
                {!isCollapsed && <h1 className="text-xl font-bold">P2P</h1>}
                <button
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="p-1 rounded hover:bg-gray-700"
                >
                    {isCollapsed ? '▶️' : '◀️'}
                </button>
            </div>

            <nav className="flex-1 p-2">
                {role === 'admin' && (
                    <button
                        onClick={() => setActiveTab('users')}
                        className={`w-full text-left p-3 rounded-lg mb-2 flex items-center ${activeTab === 'users' ? 'bg-blue-600' : 'hover:bg-gray-700'}`}
                    >
                        <span className="mr-2">🦰</span>
                        {!isCollapsed && <span>Пользователи</span>}
                    </button>
                )}

                <button
                    onClick={() => setActiveTab('offers')}
                    className={`w-full text-left p-3 rounded-lg mb-2 flex items-center ${activeTab === 'offers' ? 'bg-blue-600' : 'hover:bg-gray-700'}`}
                >
                    <span className="mr-2">💰</span>
                    {!isCollapsed && <span>Оферты</span>}
                </button>

                <button
                    onClick={() => setActiveTab('deals')}
                    className={`w-full text-left p-3 rounded-lg mb-2 flex items-center ${activeTab === 'deals' ? 'bg-blue-600' : 'hover:bg-gray-700'}`}
                >
                    <span className="mr-2">🤝</span>
                    {!isCollapsed && <span>Сделки</span>}
                </button>

                {role === 'admin' && (
                    <button
                        onClick={() => setActiveTab('warrant-holders')}
                        className={`w-full text-left p-3 rounded-lg mb-2 flex items-center ${activeTab === 'warrant-holders' ? 'bg-blue-600' : 'hover:bg-gray-700'}`}
                    >
                        <span className="mr-2">👑</span>
                        {!isCollapsed && <span>Ордеродержатели</span>}
                    </button>
                )}
            </nav>

            <div className="p-2 border-t border-gray-700">
                <button
                    onClick={logout}
                    className="w-full p-3 rounded-lg mb-2 flex items-center justify-center bg-red-600 hover:bg-red-700"
                >
                    <span className={isCollapsed ? '' : 'mr-2'}>🔒</span>
                    {!isCollapsed && <span>Выйти</span>}
                </button>
            </div>
        </div>
    );
};

export default Sidebar;