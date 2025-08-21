import { useState } from 'react';
import axios from 'axios';
import { useStore } from '../../store/store';
import type { WarrantHolder, FilterField, SearchFilterParams } from '../../types';
import SearchFilter from '../SearchFilter';
import TableWrapper from '../TableWrapper';
import WarrantHoldersTableBody from './WarrantHoldersTableBody';
import CreateWarrantHolderForm from './CreateWarrantHolderForm';

const WarrantHoldersTable: React.FC = () => {
    const { role } = useStore();
    const [warrantHolders, setWarrantHolders] = useState<WarrantHolder[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState(true);
    const [searchParams, setSearchParams] = useState<SearchFilterParams>({});
    const pageSize = 10;

    const filterFields: FilterField[] = [
        {
            field: 'isBlocked',
            label: 'Статус блокировки',
            type: 'select',
            options: [
                { value: 'all', label: 'Все' },
                { value: 'true', label: 'Заблокирован' },
                { value: 'false', label: 'Не заблокирован' },
            ],
        },
        { field: 'createdAt', label: 'Дата создания', type: 'dateRange' },
    ];

    const fetchWarrantHolders = async (pageNum: number, append: boolean = false, params: SearchFilterParams = {}) => {
        setLoading(true);
        try {
            const response = await axios.get('/api/warrant-holders', {
                params: { page: pageNum, pageSize, ...params },
            });
            const { data, total } = response.data;
            setWarrantHolders((prev) => (append ? [...prev, ...data] : data));
            setHasMore(pageNum * pageSize < total);
            setLoading(false);
        } catch (error: any) {
            console.error('Error loading warrant holders:', error);
            setError('Ошибка при загрузке ордеродержателей');
            setLoading(false);
        }
    };

    const handleSearch = (params: SearchFilterParams) => {
        setSearchParams(params);
        fetchWarrantHolders(1, false, params);
    };

    const handleAddWarrantHolder = async (input: string) => {
        if (role !== 'admin') {
            setError('Только администратор может добавлять ордеродержателей');
            return;
        }
        try {
            const response = await axios.post('/api/warrant-holders', {
                username: input,
                chatId: input,
            });
            setWarrantHolders([...warrantHolders, response.data]);
            setError(null);
        } catch (error: any) {
            console.error('Error creating warrant holder:', error);
            setError(error.response?.data?.error || 'Ошибка при создании ордеродержателя');
        }
    };

    return (
        <div>
            {role === 'admin' && (
                <>
                    <CreateWarrantHolderForm onSubmit={handleAddWarrantHolder} setError={setError} />
                    <SearchFilter filterFields={filterFields} onSearch={handleSearch} />
                </>
            )}
            <TableWrapper
                items={warrantHolders}
                fetchItems={fetchWarrantHolders}
                searchParams={searchParams}
                renderTableBody={(items, isMobile) => (
                    <table className="w-full border-collapse">
                        {!isMobile && (
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
                        )}
                        <WarrantHoldersTableBody
                            warrantHolders={items}
                            role={role}
                            setWarrantHolders={setWarrantHolders}
                            setError={setError}
                            isMobile={isMobile}
                        />
                    </table>
                )}
                loading={loading}
                error={error || ''}
                hasMore={hasMore}
                pageSize={pageSize}
            />
        </div>
    );
};

export default WarrantHoldersTable;