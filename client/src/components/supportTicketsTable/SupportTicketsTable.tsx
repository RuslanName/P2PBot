import { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { useStore } from '../../store/store';
import type { SupportTicket } from '../../types';
import SupportTicketsTableBody from './SupportTicketsTableBody';

const SupportTicketsTable: React.FC = () => {
    const { role } = useStore();
    const [tickets, setTickets] = useState<SupportTicket[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('open');
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const [, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const pageSize = 10;
    const observer = useRef<IntersectionObserver | null>(null);
    const lastTicketRef = useRef<HTMLDivElement | null>(null);

    const fetchTickets = async (pageNum: number, append: boolean = false) => {
        setLoading(true);
        try {
            const response = await axios.get('/api/support-tickets', {
                params: { page: pageNum, pageSize }
            });
            const { data, total } = response.data;
            setTickets(prev => append ? [...prev, ...data] : data);
            setHasMore(pageNum * pageSize < total);
            setLoading(false);
        } catch (error) {
            console.error('Error loading support tickets:', error);
            setError('Ошибка при загрузке тикетов');
            setLoading(false);
        }
    };

    useEffect(() => {
        setPage(1);
        fetchTickets(1);
    }, [statusFilter]);

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth < 768);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        if (isMobile) return;

        if (observer.current) observer.current.disconnect();

        observer.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && hasMore && !loading) {
                setPage(prev => {
                    const nextPage = prev + 1;
                    fetchTickets(nextPage, true);
                    return nextPage;
                });
            }
        });

        if (lastTicketRef.current) {
            observer.current.observe(lastTicketRef.current);
        }

        return () => {
            if (observer.current) observer.current.disconnect();
        };
    }, [hasMore, loading, isMobile]);

    const handleCompleteTicket = async (id: number) => {
        setError('');
        try {
            const response = await axios.put(`/api/support-tickets/${id}`, { status: 'closed' });
            setTickets(tickets.map((ticket) => (ticket.id === id ? response.data : ticket)));
        } catch (error) {
            setError('Ошибка при завершении тикета');
            console.error('Error completing ticket:', error);
        }
    };

    const filteredTickets = tickets.filter(ticket => statusFilter === 'all' || ticket.status === statusFilter);

    return (
        <div className="table-responsive">
            {role === 'admin' && (
                <div className="mb-4">
                    <label className="block text-gray-700">Фильтр по статусу</label>
                    <select
                        value={statusFilter}
                        onChange={(e) => {
                            setStatusFilter(e.target.value);
                            setTickets([]);
                        }}
                        className="w-full p-2 border rounded"
                    >
                        <option value="all">Все</option>
                        <option value="open">Открытые</option>
                        <option value="closed">Закрытые</option>
                    </select>
                </div>
            )}
            {filteredTickets.length === 0 && !loading && (
                <p className="text-center text-gray-500 mt-4">На данный момент тут ничего нет</p>
            )}
            {isMobile ? (
                <div className="card-stack">
                    <SupportTicketsTableBody
                        tickets={filteredTickets}
                        role={role}
                        statusFilter={statusFilter}
                        onComplete={handleCompleteTicket}
                        isMobile={isMobile}
                    />
                </div>
            ) : (
                <table className="w-full border-collapse">
                    <thead>
                    <tr className="bg-gray-200">
                        <th className="border p-2">ID</th>
                        <th className="border p-2">Пользователь</th>
                        <th className="border p-2">Тема</th>
                        <th className="border p-2">Описание</th>
                        <th className="border p-2">Скриншоты</th>
                        <th className="border p-2">Создано</th>
                        {role === 'admin' && statusFilter === 'all' && <th className="border p-2">Статус</th>}
                        {role === 'admin' && (statusFilter === 'open' || statusFilter === 'all') && (
                            <th className="border p-2">Действия</th>
                        )}
                    </tr>
                    </thead>
                    <SupportTicketsTableBody
                        tickets={filteredTickets}
                        role={role}
                        statusFilter={statusFilter}
                        onComplete={handleCompleteTicket}
                        isMobile={isMobile}
                    />
                    {hasMore && (
                        <tbody>
                        <tr>
                            <td colSpan={8} className="text-center">
                                <div ref={lastTicketRef} className="h-10" />
                            </td>
                        </tr>
                        </tbody>
                    )}
                </table>
            )}
            {loading && <p className="text-center">Загрузка...</p>}
            {error && <p className="text-red-500 mt-2">{error}</p>}
        </div>
    );
};

export default SupportTicketsTable;