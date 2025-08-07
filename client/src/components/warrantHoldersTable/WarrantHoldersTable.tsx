import { useEffect, useState } from 'react';
import axios from 'axios';
import { useStore } from '../../store/store';
import type { WarrantHolder } from '../../types';
import WarrantHoldersTableBody from './WarrantHoldersTableBody';

const WarrantHoldersTable: React.FC = () => {
    const { role } = useStore();
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
            } catch (error: any) {
                console.error('Error loading warrant holders:', error);
                setError('Ошибка при загрузке ордеродержателей');
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
        if (role !== 'admin') {
            setError('Только администратор может добавлять ордеродержателей');
            return;
        }
        try {
            if (!newHolderInput) {
                setError('Требуется имя пользователя или Chat ID');
                return;
            }

            const response = await axios.post('/api/warrant-holders', {
                username: newHolderInput,
                chatId: newHolderInput,
            });
            setWarrantHolders([...warrantHolders, response.data]);
            setNewHolderInput('');
            setError(null);
        } catch (error: any) {
            console.error('Error creating warrant holder:', error);
            setError(error.response?.data?.error || 'Ошибка при создании ордеродержателя');
        }
    };

    if (loading) return <p>Загрузка...</p>;

    return (
        <>
            <h2 className="text-xl font-bold mb-4">Ордеродержатели</h2>
            {role === 'admin' && (
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
            )}
            <table className="w-full border-collapse">
                <thead>
                <tr className="bg-gray-200">
                    <th className="border p-2">ID</th>
                    <th className="border p-2">Пользователь</th>
                    <th className="border p-2">Кошельки</th>
                    <th className="border p-2">Оферты</th>
                    {role === 'admin' && <th className="border p-2">Пароль</th>}
                    <th className="border p-2">Заблокирован</th>
                    {role === 'admin' && <th className="border p-2">Действия</th>}
                </tr>
                </thead>
                <WarrantHoldersTableBody
                    warrantHolders={warrantHolders}
                    role={role}
                    setWarrantHolders={setWarrantHolders}
                />
            </table>
        </>
    );
};

export default WarrantHoldersTable;