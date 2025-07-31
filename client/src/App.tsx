import { useEffect, useState } from 'react';
import { useStore } from './store/store';
import Sidebar from './components/Sidebar';
import UsersTable from './components/UsersTable';
import OffersTable from './components/OffersTable';
import DealsTable from './components/DealsTable';
import WarrantHoldersTable from './components/WarrantHoldersTable';
import Login from './components/Login';

const App: React.FC = () => {
    const { isAuthenticated, role } = useStore();
    const [activeTab, setActiveTab] = useState<'users' | 'offers' | 'deals' | 'warrant-holders'>('offers');

    useEffect(() => {
        if (isAuthenticated) {
            setActiveTab(role === 'admin' ? 'users' : 'offers');
        }
    }, [isAuthenticated, role]);

    if (!isAuthenticated) {
        return <Login />;
    }

    const renderContent = () => {
        if (role === 'admin') {
            switch (activeTab) {
                case 'users':
                    return <UsersTable />;
                case 'offers':
                    return <OffersTable />;
                case 'deals':
                    return <DealsTable />;
                case 'warrant-holders':
                    return <WarrantHoldersTable />;
                default:
                    return <UsersTable />;
            }
        } else {
            switch (activeTab) {
                case 'offers':
                    return <OffersTable />;
                case 'deals':
                    return <DealsTable />;
                default:
                    return <OffersTable />;
            }
        }
    };

    return (
        <div className="flex">
            <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} role={role} />
            <div className="flex-1 p-4">
                {renderContent()}
            </div>
        </div>
    );
};

export default App;