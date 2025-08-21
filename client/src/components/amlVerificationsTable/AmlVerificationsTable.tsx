import { useState } from 'react';
import axios from 'axios';
import { useStore } from '../../store/store';
import type { AmlVerification, FilterField, SearchFilterParams } from '../../types';
import SearchFilter from '../SearchFilter';
import TableWrapper from '../TableWrapper';
import AmlVerificationsTableBody from './AmlVerificationsTableBody';

const AmlVerificationsTable: React.FC = () => {
    const { role } = useStore();
    const [verifications, setVerifications] = useState<AmlVerification[]>([]);
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
                { value: 'completed', label: 'Завершённые' },
                { value: 'rejected', label: 'Отклонённые' },
            ],
        },
        { field: 'createdAt', label: 'Дата создания', type: 'dateRange' },
    ];

    const fetchVerifications = async (pageNum: number, append: boolean = false, params: SearchFilterParams = {}) => {
        setLoading(true);
        try {
            const response = await axios.get('/api/aml-verifications', {
                params: {
                    page: pageNum,
                    pageSize,
                    ...params,
                    status: params.status === 'all' ? undefined : params.status,
                },
            });
            const { data, total } = response.data;
            setVerifications((prev) => (append ? [...prev, ...data] : data));
            setHasMore(pageNum * pageSize < total);
            setLoading(false);
        } catch (error) {
            console.error('Ошибка загрузки AML-проверок:', error);
            setError('Ошибка при загрузке AML-проверок');
            setLoading(false);
        }
    };

    const handleSearch = (params: SearchFilterParams) => {
        setStatusFilter(params.status || 'all');
        setSearchParams(params);
        fetchVerifications(1, false, params);
    };

    const handleApproveVerification = async (id: number) => {
        setError('');
        try {
            const response = await axios.put(`/api/aml-verifications/${id}`, { status: 'completed' });
            setVerifications(verifications.map((verification) =>
                verification.id === id ? response.data : verification
            ));
        } catch (error) {
            setError('Ошибка при подтверждении AML-проверки');
            console.error('Ошибка подтверждения AML-проверки:', error);
        }
    };

    const handleRejectVerification = async (id: number) => {
        setError('');
        try {
            const response = await axios.put(`/api/aml-verifications/${id}`, { status: 'rejected' });
            setVerifications(verifications.map((verification) =>
                verification.id === id ? response.data : verification
            ));
        } catch (error) {
            setError('Ошибка при отклонении AML-проверки');
            console.error('Ошибка отклонения AML-проверки:', error);
        }
    };

    return (
        <div>
            {role === 'admin' && (
                <SearchFilter filterFields={filterFields} onSearch={handleSearch} />
            )}
            <TableWrapper
                items={verifications}
                fetchItems={fetchVerifications}
                searchParams={searchParams}
                renderTableBody={(items, isMobile) => (
                    <table className="w-full border-collapse">
                        {!isMobile && (
                            <thead>
                            <tr className="bg-gray-200">
                                <th className="border p-2">ID</th>
                                <th className="border p-2">Пользователь</th>
                                <th className="border p-2">Причина</th>
                                <th className="border p-2">Документы</th>
                                {statusFilter === 'all' && <th className="border p-2">Статус</th>}
                                <th className="border p-2">Создано</th>
                                {role === 'admin' && (statusFilter === 'open' || statusFilter === 'rejected' || statusFilter === 'all') && (
                                    <th className="border p-2">Действия</th>
                                )}
                            </tr>
                            </thead>
                        )}
                        <AmlVerificationsTableBody
                            verifications={items}
                            role={role}
                            statusFilter={statusFilter}
                            onApprove={handleApproveVerification}
                            onReject={handleRejectVerification}
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

export default AmlVerificationsTable;