import { useEffect, useState } from 'react';
import axios from 'axios';
import { Tooltip } from './Tooltip';

interface Wallet {
    id: number;
    coin: string;
    balance: number;
    address: string;
}

interface WarrantHolder {
    id: number;
    userId: number;
    username: string;
    password: string;
    wallets: Wallet[];
}

const WarrantHoldersTable: React.FC = () => {
    const [warrantHolders, setWarrantHolders] = useState<WarrantHolder[]>([]);
    const [loading, setLoading] = useState(true);
    const [newHolderInput, setNewHolderInput] = useState('');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchWarrantHolders = async () => {
            try {
                const response = await axios.get('/api/warrant-holders');
                setWarrantHolders(response.data);
                setLoading(false);
            } catch (error) {
                console.error('Error loading warrant holders:', error);
                setLoading(false);
            }
        };
        fetchWarrantHolders();
    }, []);

    const handleNewHolderChange = (value: string) => {
        setNewHolderInput(value);
        setError(null);
    };

    const handleAddWarrantHolder = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (!newHolderInput) {
                setError('Username or Chat ID is required');
                return;
            }

            const response = await axios.post('/api/warrant-holders', {
                username: newHolderInput,
                chatId: newHolderInput
            });
            setWarrantHolders([...warrantHolders, response.data]);
            setNewHolderInput('');
            setError(null);
        } catch (error: any) {
            console.error('Error creating warrant holder:', error);
            setError(error.response?.data?.error || 'Failed to create warrant holder');
        }
    };

    const handleUpdatePassword = async (id: number) => {
        try {
            const response = await axios.put(`/api/warrant-holders/${id}/password`);
            setWarrantHolders(warrantHolders.map(holder =>
                holder.id === id ? { ...holder, password: response.data.password } : holder
            ));
        } catch (error) {
            console.error('Error updating password:', error);
        }
    };

    if (loading) return <p>Загрузка...</p>;

    return (
        <>
            <div className="mb-4">
                <form onSubmit={handleAddWarrantHolder} className="flex flex-col gap-2 max-w-md">
                    <input
                        type="text"
                        value={newHolderInput}
                        onChange={(e) => handleNewHolderChange(e.target.value)}
                        placeholder="Введите имя пользователя или Chat ID..."
                        className="border p-2 rounded"
                    />
                    <button
                        type="submit"
                        className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
                    >
                        Добавить
                    </button>
                    {error && <p className="text-red-500">{error}</p>}
                </form>
            </div>

            <table className="w-full border-collapse">
                <thead>
                <tr className="bg-gray-200">
                    <th className="border p-2">ID</th>
                    <th className="border p-2">ID ордеродержателя</th>
                    <th className="border p-2">Имя пользователя</th>
                    <th className="border p-2">Пароль</th>
                    <th className="border p-2">Кошельки</th>
                    <th className="border p-2">Действия</th>
                </tr>
                </thead>
                <tbody>
                {warrantHolders.map((holder) => (
                    <tr key={holder.id}>
                        <td className="border p-2">{holder.id}</td>
                        <td className="border p-2">{holder.userId}</td>
                        <td className="border p-2">{holder.username}</td>
                        <td className="border p-2">
                            <span className="truncate max-w-[150px]">{holder.password}</span>
                        </td>
                        <td className="border p-2">
                            <div className="flex flex-wrap justify-evenly gap-2">
                                {holder.wallets.map((wallet) => (
                                    <Tooltip
                                        key={wallet.id}
                                        content={
                                            `Адрес: ${wallet.address}\n` +
                                            `Баланс: ${wallet.balance}\n` +
                                            `На обработке: 0\n` +
                                            `На удержании: 0`
                                        }
                                    >
                                        <div className="bg-gray-100 px-2 py-1 rounded">
                                            {wallet.coin}
                                        </div>
                                    </Tooltip>
                                ))}
                            </div>
                        </td>
                        <td className="border p-2">
                            <button
                                onClick={() => handleUpdatePassword(holder.id)}
                                className="bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600"
                            >
                                Обновить пароль
                            </button>
                        </td>
                    </tr>
                ))}
                </tbody>
            </table>
        </>
    );
};

export default WarrantHoldersTable;