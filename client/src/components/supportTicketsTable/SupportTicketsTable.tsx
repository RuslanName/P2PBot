import { useState } from 'react';
import axios from 'axios';
import { useStore } from '../../store/store';
import type { SupportTicket, FilterField, SearchFilterParams } from '../../types';
import SearchFilter from '../SearchFilter';
import TableWrapper from '../TableWrapper';
import SupportTicketsTableBody from './SupportTicketsTableBody';

const SupportTicketsTable: React.FC = () => {
    const { role } = useStore();
    const [tickets, setTickets] = useState<SupportTicket[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [hasMore, setHasMore] = useState(true);
    const [searchParams, setSearchParams] = useState<SearchFilterParams>({});
    const pageSize = 10;

    const filterFields: FilterField[] = [
        {
            field: 'status',
            label: 'Статус',
            type: 'select',
            options: [
                { value: 'all', label: 'Все' },
                { value: 'open', label: 'Открытые' },
                { value: 'closed', label: 'Закрытые' },
            ],
        },
        { field: 'createdAt', label: 'Дата создания', type: 'dateRange' },
    ];

    const fetchTickets = async (pageNum: number, append: boolean = false, query: SearchFilterParams = {}) => {
        setLoading(true);
        try {
            const response = await axios.get('/api/support-tickets', {
                params: { page: pageNum, pageSize, ...query, status: query.status === 'all' ? undefined : query.status },
            });
            const { data, total } = response.data;
            setTickets((prev) => (append ? [...prev, ...data] : data));
            setHasMore(pageNum * pageSize < total);
            setLoading(false);
        } catch (error) {
            console.error('Error loading support tickets:', error);
            setError('Ошибка при загрузке тикетов');
            setLoading(false);
        }
    };

    const handleSearch = (params: SearchFilterParams) => {
        setStatusFilter(params.status || 'all');
        setSearchParams(params);
        fetchTickets(1, false, params);
    };

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

    return (
        <div>
            {role === 'admin' && (
                <SearchFilter filterFields={filterFields} onSearch={handleSearch} />
            )}
            <TableWrapper
                items={tickets}
                fetchItems={fetchTickets}
                searchParams={searchParams}
                renderTableBody={(items, isMobile) => (
                    <table className="w-full border-collapse">
                        {!isMobile && (
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
                        )}
                        <SupportTicketsTableBody
                            tickets={items}
                            role={role}
                            statusFilter={statusFilter}
                            onComplete={handleCompleteTicket}
                            isMobile={isMobile}
                        />
                    </table>
                )}
                loading={loading}
                error={error}
                hasMore={hasMore}
                pageSize={pageSize}
            />
        </div>
    );
};

export default SupportTicketsTable;