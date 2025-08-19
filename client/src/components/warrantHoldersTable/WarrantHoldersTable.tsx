import { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { useStore } from '../../store/store';
import type { WarrantHolder } from '../../types';
import WarrantHoldersTableBody from './WarrantHoldersTableBody';

const WarrantHoldersTable: React.FC = () => {
    const { role } = useStore();
    const [warrantHolders, setWarrantHolders] = useState<WarrantHolder[]>([]);
    const [loading, setLoading] = useState(false);
    const [newHolderInput, setNewHolderInput] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const [, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const pageSize = 10;
    const observer = useRef<IntersectionObserver | null>(null);

    const fetchWarrantHolders = async (pageNum: number, append: boolean = false) => {
        setLoading(true);
        try {
            const response = await axios.get('/api/warrant-holders', {
                params: { page: pageNum, pageSize }
            });
            const { data, total } = response.data;
            setWarrantHolders(prev => append ? [...prev, ...data] : data);
            setHasMore(pageNum * pageSize < total);
            setLoading(false);
        } catch (error: any) {
            console.error('Error loading warrant holders:', error);
            setError('Ошибка при загрузке ордеродержателей');
            setLoading(false);
        }
    };

    useEffect(() => {
        setPage(1);
        fetchWarrantHolders(1);
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
                    fetchWarrantHolders(nextPage, true);
                    return nextPage;
                });
            }
        });

        // Наблюдаем за последним элементом в списке ордеродержателей
        if (warrantHolders.length > 0) {
            const lastHolderElement = document.querySelector(`.holder-item-${warrantHolders[warrantHolders.length - 1].id}`);
            if (lastHolderElement) {
                observer.current.observe(lastHolderElement);
            }
        }

        return () => {
            if (observer.current) observer.current.disconnect();
        };
    }, [hasMore, loading, warrantHolders]);

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

    return (
        <div className="table-responsive">
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
                    </form>
                </div>
            )}
            {warrantHolders.length === 0 && !loading && (
                <p className="text-center text-gray-500 mt-4">На данный момент тут ничего нет</p>
            )}
            {isMobile ? (
                <div className="card-stack">
                    <WarrantHoldersTableBody
                        warrantHolders={warrantHolders}
                        role={role}
                        setWarrantHolders={setWarrantHolders}
                        setError={setError}
                        isMobile={isMobile}
                    />
                </div>
            ) : (
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

export default WarrantHoldersTable;