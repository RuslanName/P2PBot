import { useState } from 'react';
import axios from 'axios';
import { useStore } from '../../store/store';
import type { User, FilterField, SearchFilterParams } from '../../types';
import SearchFilter from '../SearchFilter';
import TableWrapper from '../TableWrapper';
import UsersTableBody from './UsersTableBody';

const UsersTable: React.FC = () => {
    const { role } = useStore();
    const [users, setUsers] = useState<User[]>([]);
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
        { field: 'createdAt', label: 'Дата регистрации', type: 'dateRange' },
    ];

    const fetchUsers = async (pageNum: number, append: boolean = false, query: SearchFilterParams = {}) => {
        setLoading(true);
        try {
            const response = await axios.get('/api/users', {
                params: { page: pageNum, pageSize, ...query },
            });
            const { data, total } = response.data;
            setUsers((prev) => (append ? [...prev, ...data] : data));
            setHasMore(pageNum * pageSize < total);
            setLoading(false);
        } catch (error: any) {
            console.error('Error loading users:', error);
            setError('Ошибка при загрузке пользователей');
            setLoading(false);
        }
    };

    const handleSearch = (params: SearchFilterParams) => {
        setSearchParams(params);
        fetchUsers(1, false, params);
    };

    return (
        <div>
            <SearchFilter filterFields={filterFields} onSearch={handleSearch} />
            <TableWrapper
                items={users}
                fetchItems={fetchUsers}
                searchParams={searchParams}
                renderTableBody={(items, isMobile) => (
                    <table className="w-full border-collapse">
                        {!isMobile && (
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
                        )}
                        <UsersTableBody users={items} role={role} setUsers={setUsers} setError={setError} isMobile={isMobile} />
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

export default UsersTable;