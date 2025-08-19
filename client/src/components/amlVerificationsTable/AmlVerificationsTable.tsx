import { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { useStore } from '../../store/store';
import type { AmlVerification } from '../../types';
import AmlVerificationsTableBody from './AmlVerificationsTableBody';

const AmlVerificationsTable: React.FC = () => {
    const { role } = useStore();
    const [verifications, setVerifications] = useState<AmlVerification[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('open');
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const [, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const pageSize = 10;
    const observer = useRef<IntersectionObserver | null>(null);
    const lastVerificationRef = useRef<HTMLDivElement | null>(null);

    const fetchVerifications = async (pageNum: number, append: boolean = false) => {
        setLoading(true);
        try {
            const response = await axios.get('/api/aml-verifications', {
                params: { page: pageNum, pageSize }
            });
            const { data, total } = response.data;
            setVerifications(prev => append ? [...prev, ...data] : data);
            setHasMore(pageNum * pageSize < total);
            setLoading(false);
        } catch (error) {
            console.error('Ошибка загрузки AML-проверок:', error);
            setError('Ошибка при загрузке AML-проверок');
            setLoading(false);
        }
    };

    useEffect(() => {
        setPage(1);
        fetchVerifications(1);
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
                    fetchVerifications(nextPage, true);
                    return nextPage;
                });
            }
        });

        if (lastVerificationRef.current) {
            observer.current.observe(lastVerificationRef.current);
        }

        return () => {
            if (observer.current) observer.current.disconnect();
        };
    }, [hasMore, loading, isMobile]);

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

    const filteredVerifications = verifications.filter(
        verification => statusFilter === 'all' || verification.status === statusFilter
    );

    return (
        <div className="table-responsive">
            {role === 'admin' && (
                <div className="mb-4">
                    <label className="block text-gray-700">Фильтр по статусу</label>
                    <select
                        value={statusFilter}
                        onChange={(e) => {
                            setStatusFilter(e.target.value);
                            setPage(1);
                            setVerifications([]);
                        }}
                        className="w-full p-2 border rounded"
                    >
                        <option value="all">Все</option>
                        <option value="open">Открытые</option>
                        <option value="rejected">Отклонённые</option>
                        <option value="completed">Завершённые</option>
                    </select>
                </div>
            )}
            {filteredVerifications.length === 0 && !loading && (
                <p className="text-center text-gray-500 mt-4">На данный момент тут ничего нет</p>
            )}
            {isMobile ? (
                <div className="card-stack">
                    <AmlVerificationsTableBody
                        verifications={filteredVerifications}
                        role={role}
                        statusFilter={statusFilter}
                        onApprove={handleApproveVerification}
                        onReject={handleRejectVerification}
                        isMobile={isMobile}
                    />
                </div>
            ) : (
                <table className="w-full border-collapse">
                    <thead>
                    <tr className="bg-gray-200">
                        <th className="border p-2">ID</th>
                        <th className="border p-2">Пользователь</th>
                        <th className="border p-2">Причина</th>
                        <th className="border p-2">Документы</th>
                        {statusFilter === 'all' && <th className="border p-2">Статус</th>}
                        <th className="border p-2">Создано</th>
                        {role === 'admin' && (statusFilter === 'rejected' || statusFilter === 'all') && (
                            <th className="border p-2">Действия</th>
                        )}
                    </tr>
                    </thead>
                    <AmlVerificationsTableBody
                        verifications={filteredVerifications}
                        role={role}
                        statusFilter={statusFilter}
                        onApprove={handleApproveVerification}
                        onReject={handleRejectVerification}
                        isMobile={isMobile}
                    />
                    {hasMore && (
                        <tbody>
                        <tr>
                            <td colSpan={7} className="text-center">
                                <div ref={lastVerificationRef} className="h-10" />
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

export default AmlVerificationsTable;