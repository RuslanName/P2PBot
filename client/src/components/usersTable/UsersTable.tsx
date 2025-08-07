import { useEffect, useState } from 'react';
import axios from 'axios';
import { useStore } from '../../store/store';
import type { User } from '../../types';
import UsersTableBody from './UsersTableBody';

const UsersTable: React.FC = () => {
    const { role } = useStore();
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const response = await axios.get('/api/users');
                setUsers(response.data);
                setLoading(false);
            } catch (error: any) {
                console.error('Error loading users:', error);
                setError('Ошибка при загрузке пользователей');
                setLoading(false);
            }
        };
        fetchUsers();
    }, []);

    if (loading) return <p>Загрузка...</p>;

    return (
        <>
            <h2 className="text-xl font-bold mb-4">Пользователи</h2>
            <table className="w-full border-collapse">
                <thead>
                <tr className="bg-gray-200">
                    <th className="border p-2">ID</th>
                    <th className="border p-2">Chat ID</th>
                    <th className="border p-2">Имя пользователя</th>
                    <th className="border p-2">ФИО</th>
                    <th className="border p-2">Кошельки</th>
                    <th className="border p-2">Реферер</th>
                    <th className="border p-2">Кол-во рефералов</th>
                    <th className="border p-2">Заблокирован</th>
                    {role === 'admin' && <th className="border p-2">Действия</th>}
                </tr>
                </thead>
                <UsersTableBody
                    users={users}
                    role={role}
                    setUsers={setUsers}
                    setError={setError}
                />
            </table>
            {error && <p className="text-red-500 mt-2">{error}</p>}
        </>
    );
};

export default UsersTable;