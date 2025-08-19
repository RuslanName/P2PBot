import { Tooltip } from '../Tooltip';
import type { DealsTableBodyProps } from '../../types';

interface ExtendedDealsTableBodyProps extends DealsTableBodyProps {
    isMobile: boolean;
}

const DealsTableBody: React.FC<ExtendedDealsTableBodyProps> = ({ deals, role, statusFilter, onComplete, isMobile }) => {
    const getStatusName = (status: string) => {
        const statusMap: Record<string, string> = {
            open: 'Открыт',
            pending: 'В обработке',
            completed: 'Завершен',
            closed: 'Закрыт',
            cancelled: 'Отменен',
            blocked: 'Заблокирован',
            expired: 'Просрочен'
        };
        return statusMap[status] || status;
    };

    const getTypeName = (type: string) => {
        return type === 'buy' ? 'Покупка' : 'Продажа';
    };

    const formatCreatedAt = (date: string) => {
        const createdDate = new Date(date);
        createdDate.setHours(createdDate.getHours() + 3);
        return createdDate.toLocaleString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        }).replace(',', '');
    };

    const hasActions = (deal: { status: string }) => {
        return role === 'admin' && (statusFilter === 'blocked' || (statusFilter === 'all' && deal.status === 'blocked'));
    };

    if (isMobile) {
        return (
            <>
                {deals.map((deal) => (
                    <div key={deal.id} className="card-stack-item">
                        <table className="vertical-table">
                            <tbody>
                            <tr>
                                <td className="card-label">ID</td>
                                <td className="card-value">{deal.id}</td>
                            </tr>
                            <tr>
                                <td className="card-label">Клиент</td>
                                <td className="card-value">
                                    {deal.client ? (
                                        <Tooltip content={`ID: ${deal.client.id}\nИмя: ${deal.client.username}\nЗаблокирован: ${deal.client.isBlocked ? 'Да' : 'Нет'}`}>
                                            <div className="bg-gray-100 px-2 py-1 rounded">
                                                {deal.client.username}
                                            </div>
                                        </Tooltip>
                                    ) : (
                                        <div className="bg-gray-100 px-2 py-1 rounded text-red-500">
                                            Клиент не найден
                                        </div>
                                    )}
                                </td>
                            </tr>
                            <tr>
                                <td className="card-label">Оферта</td>
                                <td className="card-value">
                                    {deal.offer ? (
                                        <Tooltip content={`ID: ${deal.offer.id}\nТип: ${getTypeName(deal.offer.type)}\nКриптовалюта: ${deal.offer.coin}\nСтатус: ${getStatusName(deal.offer.status)}`}>
                                            <div className="bg-gray-100 px-2 py-1 rounded">
                                                {deal.offer.id}
                                            </div>
                                        </Tooltip>
                                    ) : (
                                        <div className="bg-gray-100 px-2 py-1 rounded text-red-500">
                                            Оферта не найдена
                                        </div>
                                    )}
                                </td>
                            </tr>
                            <tr>
                                <td className="card-label">Ордеродержатель</td>
                                <td className="card-value">
                                    {deal.offer?.warrantHolder ? (
                                        <Tooltip content={`ID: ${deal.offer.warrantHolder.id}\nЗаблокирован: ${deal.offer.warrantHolder.isBlocked ? 'Да' : 'Нет'}`}>
                                            <div className="bg-gray-100 px-2 py-1 rounded">
                                                {deal.offer.warrantHolder.id}
                                            </div>
                                        </Tooltip>
                                    ) : (
                                        <div className="bg-gray-100 px-2 py-1 rounded text-red-500">
                                            Ордеродержатель не найден
                                        </div>
                                    )}
                                </td>
                            </tr>
                            {role === 'admin' && (
                                <tr>
                                    <td className="card-label">Реферер</td>
                                    <td className="card-value">
                                        {deal.client?.referrer ? (
                                            <Tooltip content={`ID: ${deal.client.referrer.id}\nЗаблокирован: ${deal.client.referrer.isBlocked ? 'Да' : 'Нет'}`}>
                                                <div className="bg-gray-100 px-2 py-1 rounded">
                                                    {deal.client.referrer.username}
                                                </div>
                                            </Tooltip>
                                        ) : (
                                            'Нет'
                                        )}
                                    </td>
                                </tr>
                            )}
                            <tr>
                                <td className="card-label">Сумма</td>
                                <td className="card-value">{deal.amount}</td>
                            </tr>
                            <tr>
                                <td className="card-label">Фиатная валюта</td>
                                <td className="card-value">{deal.fiatCurrency}</td>
                            </tr>
                            <tr>
                                <td className="card-label">Наценка (%)</td>
                                <td className="card-value">{deal.markupPercent}</td>
                            </tr>
                            <tr>
                                <td className="card-label">Реквизиты клиента</td>
                                <td className="card-value">{deal.clientPaymentDetails || 'Не указаны'}</td>
                            </tr>
                            <tr>
                                <td className="card-label">ID транзакции</td>
                                <td className="card-value">{deal.txId || 'Не указан'}</td>
                            </tr>
                            <tr>
                                <td className="card-label">Подтверждено клиентом</td>
                                <td className="card-value">{deal.clientConfirmed ? 'Да' : 'Нет'}</td>
                            </tr>
                            <tr>
                                <td className="card-label">Создано</td>
                                <td className="card-value">{formatCreatedAt(deal.createdAt)}</td>
                            </tr>
                            {role === 'admin' && statusFilter === 'all' && (
                                <tr>
                                    <td className="card-label">Статус</td>
                                    <td className="card-value">{getStatusName(deal.status)}</td>
                                </tr>
                            )}
                            {hasActions(deal) && (
                                <tr>
                                    <td className="card-label">Действия</td>
                                    <td className="card-value">
                                        <button
                                            onClick={() => onComplete(deal.id)}
                                            className="action-button bg-red-500 hover:bg-red-600"
                                        >
                                            Завершить
                                        </button>
                                    </td>
                                </tr>
                            )}
                            </tbody>
                        </table>
                    </div>
                ))}
            </>
        );
    }

    return (
        <tbody>
        {deals.map((deal) => (
            <tr key={deal.id}>
                <td className="border p-2">{deal.id}</td>
                <td className="border p-2">
                    {deal.client ? (
                        <Tooltip content={`ID: ${deal.client.id}\nИмя: ${deal.client.username}\nЗаблокирован: ${deal.client.isBlocked ? 'Да' : 'Нет'}`}>
                            <div className="bg-gray-100 px-2 py-1 rounded">
                                {deal.client.username}
                            </div>
                        </Tooltip>
                    ) : (
                        <div className="bg-gray-100 px-2 py-1 rounded text-red-500">
                            Клиент не найден
                        </div>
                    )}
                </td>
                <td className="border p-2">
                    {deal.offer ? (
                        <Tooltip content={`ID: ${deal.offer.id}\nТип: ${getTypeName(deal.offer.type)}\nКриптовалюта: ${deal.offer.coin}\nСтатус: ${getStatusName(deal.offer.status)}`}>
                            <div className="bg-gray-100 px-2 py-1 rounded">
                                {deal.offer.id}
                            </div>
                        </Tooltip>
                    ) : (
                        <div className="bg-gray-100 px-2 py-1 rounded text-red-500">
                            Оферта не найдена
                        </div>
                    )}
                </td>
                <td className="border p-2">
                    {deal.offer?.warrantHolder ? (
                        <Tooltip content={`ID: ${deal.offer.warrantHolder.id}\nЗаблокирован: ${deal.offer.warrantHolder.isBlocked ? 'Да' : 'Нет'}`}>
                            <div className="bg-gray-100 px-2 py-1 rounded">
                                {deal.offer.warrantHolder.id}
                            </div>
                        </Tooltip>
                    ) : (
                        <div className="bg-gray-100 px-2 py-1 rounded text-red-500">
                            Ордеродержатель не найден
                        </div>
                    )}
                </td>
                {role === 'admin' && (
                    <td className="border p-2">
                        {deal.client?.referrer ? (
                            <Tooltip content={`ID: ${deal.client.referrer.id}\nЗаблокирован: ${deal.client.referrer.isBlocked ? 'Да' : 'Нет'}`}>
                                <div className="bg-gray-100 px-2 py-1 rounded">
                                    {deal.client.referrer.username}
                                </div>
                            </Tooltip>
                        ) : (
                            'Нет'
                        )}
                    </td>
                )}
                <td className="border p-2">{deal.amount}</td>
                <td className="border p-2">{deal.fiatCurrency}</td>
                <td className="border p-2">{deal.markupPercent}</td>
                <td className="border p-2">{deal.clientPaymentDetails || 'Не указаны'}</td>
                <td className="border p-2">{deal.txId || 'Не указан'}</td>
                <td className="border p-2">{deal.clientConfirmed ? 'Да' : 'Нет'}</td>
                <td className="border p-2">{formatCreatedAt(deal.createdAt)}</td>
                {role === 'admin' && statusFilter === 'all' && (
                    <td className="border p-2">{getStatusName(deal.status)}</td>
                )}
                {hasActions(deal) && (
                    <td className="border p-2">
                        <button
                            onClick={() => onComplete(deal.id)}
                            className="px-2 py-1 rounded text-white bg-red-500 hover:bg-red-600"
                        >
                            Завершить
                        </button>
                    </td>
                )}
            </tr>
        ))}
        </tbody>
    );
};

export default DealsTableBody;