import { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { useStore } from '../../store/store';
import type { User } from '../../types';
import UsersTableBody from './UsersTableBody';

const UsersTable: React.FC = () => {
    const { role } = useStore();
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const [, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const pageSize = 10;
    const observer = useRef<IntersectionObserver | null>(null);

    const fetchUsers = async (pageNum: number, append: boolean = false) => {
        setLoading(true);
        try {
            const response = await axios.get('/api/users', {
                params: { page: pageNum, pageSize }
            });
            const { data, total } = response.data;
            setUsers(prev => append ? [...prev, ...data] : data);
            setHasMore(pageNum * pageSize < total);
            setLoading(false);
        } catch (error: any) {
            console.error('Error loading users:', error);
            setError('Ошибка при загрузке пользователей');
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers(1);
    }, []);

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth < 768);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        if (observer.current) observer.current.disconnect();

        observer.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && hasMore && !loading) {
                setPage(prev => {
                    const nextPage = prev + 1;
                    fetchUsers(nextPage, true);
                    return nextPage;
                });
            }
        });

        // Наблюдаем за последним элементом в списке пользователей
        if (users.length > 0) {
            const lastUserElement = document.querySelector(`.user-item-${users[users.length - 1].id}`);
            if (lastUserElement) {
                observer.current.observe(lastUserElement);
            }
        }

        return () => {
            if (observer.current) observer.current.disconnect();
        };
    }, [hasMore, loading, users]);

    return (
        <div className="table-responsive">
            {users.length === 0 && !loading && (
                <p className="text-center text-gray-500 mt-4">На данный момент тут ничего нет</p>
            )}
            {isMobile ? (
                <div className="card-stack">
                    <UsersTableBody
                        users={users}
                        role={role}
                        setUsers={setUsers}
                        setError={setError}
                        isMobile={isMobile}
                    />
                </div>
            ) : (
                <table className="w-full border-collapse">
                    <thead>
                    <tr className="bg-gray-200">
                        <th className="border p-2">ID</th>
                        <th className="border p-2">Chat ID</th>
                        <th className="border p-2">Имя пользователя</th>
                        <th className="border p-2">ФИО</th>
                        <th className="border p-2">Кошельки</th>
                        <th className="border p-2">Фиатная валюта</th>
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
                        isMobile={isMobile}
                    />
                </table>
            )}
            {loading && <p className="text-center">Загрузка...</p>}
            {error && <p className="text-red-500 mt-2">{error}</p>}
        </div>
    );
};

export default UsersTable;