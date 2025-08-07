import { Tooltip } from '../Tooltip';
import type { DealsTableBodyProps } from "../../types";

const DealsTableBody: React.FC<DealsTableBodyProps> = ({ deals, role, statusFilter }) => {
    const getStatusName = (status: string) => {
        const statusMap: Record<string, string> = {
            open: 'Открыт',
            pending: 'В обработке',
            completed: 'Завершен',
            closed: 'Закрыт',
            cancelled: 'Отменен',
            blocked: 'Заблокирован',
        };
        return statusMap[status] || status;
    };

    const getTypeName = (type: string) => {
        return type === 'buy' ? 'Покупка' : 'Продажа';
    };

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
                            Гарант не найден
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
                {role === 'admin' && statusFilter === 'all' && (
                    <td className="border p-2">{getStatusName(deal.status)}</td>
                )}
            </tr>
        ))}
        </tbody>
    );
};

export default DealsTableBody;