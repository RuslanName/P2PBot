import { Tooltip } from '../Tooltip';
import type { SupportTicketsTableBodyProps } from '../../types';

interface ExtendedSupportTicketsTableBodyProps extends SupportTicketsTableBodyProps {
    isMobile: boolean;
}

const SupportTicketsTableBody: React.FC<ExtendedSupportTicketsTableBodyProps> = ({ tickets, role, statusFilter, onComplete, isMobile }) => {
    const getStatusName = (status: string) => {
        const statusMap: Record<string, string> = {
            open: 'Открыт',
            closed: 'Закрыт'
        };
        return statusMap[status] || status;
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

    const renderDescription = (description: string) => {
        const lines = description.split('\n');
        const firstLine = lines[0] || '';
        const isSingleLine = lines.length === 1;
        const isShortSingleLine = isSingleLine && firstLine.length <= 50;

        if (isShortSingleLine) {
            return <div className="whitespace-pre-wrap">{description}</div>;
        }

        const displayText = firstLine.length <= 50 ? `${firstLine}...` : `${firstLine.slice(0, 50)}...`;
        return (
            <Tooltip content={description}>
                <div className="whitespace-pre-wrap">{displayText}</div>
            </Tooltip>
        );
    };

    const renderScreenshots = (imagesPath: string[]) => {
        const count = imagesPath.length;
        const displayText = count === 0 ? 'Нет фото' : `${count} фото`;

        if (count === 0) {
            return <div className="whitespace-pre-wrap">{displayText}</div>;
        }

        const tooltipContent = (
            <div className="flex flex-col gap-2">
                {imagesPath.map((image, index) => (
                    <img
                        key={index}
                        src={image}
                        alt={`Скриншот ${index + 1}`}
                        className="max-w-[200px] max-h-[200px] object-contain"
                    />
                ))}
            </div>
        );

        return (
            <Tooltip content={tooltipContent}>
                <div className="bg-gray-100 px-2 py-1 rounded">{displayText}</div>
            </Tooltip>
        );
    };

    if (isMobile) {
        return (
            <>
                {tickets.map((ticket) => (
                    <div key={ticket.id} className="card-stack-item">
                        <table className="vertical-table">
                            <tbody>
                            <tr>
                                <td className="card-label">ID</td>
                                <td className="card-value">{ticket.id}</td>
                            </tr>
                            <tr>
                                <td className="card-label">Пользователь</td>
                                <td className="card-value">
                                    {ticket.user ? (
                                        <Tooltip
                                            content={`ID: ${ticket.user.id}\nИмя: ${ticket.user.username}\nЗаблокирован: ${
                                                ticket.user.isBlocked ? 'Да' : 'Нет'
                                            }`}
                                        >
                                            <div className="bg-gray-100 px-2 py-1 rounded">
                                                {ticket.user.username}
                                            </div>
                                        </Tooltip>
                                    ) : (
                                        <div className="bg-gray-100 px-2 py-1 rounded text-red-500">
                                            Пользователь не найден
                                        </div>
                                    )}
                                </td>
                            </tr>
                            <tr>
                                <td className="card-label">Тема</td>
                                <td className="card-value">{ticket.reason}</td>
                            </tr>
                            <tr>
                                <td className="card-label">Описание</td>
                                <td className="card-value">{renderDescription(ticket.description)}</td>
                            </tr>
                            <tr>
                                <td className="card-label">Скриншоты</td>
                                <td className="card-value">{renderScreenshots(ticket.imagesPath)}</td>
                            </tr>
                            <tr>
                                <td className="card-label">Создано</td>
                                <td className="card-value">{formatCreatedAt(ticket.createdAt)}</td>
                            </tr>
                            {role === 'admin' && statusFilter === 'all' && (
                                <tr>
                                    <td className="card-label">Статус</td>
                                    <td className="card-value">{getStatusName(ticket.status)}</td>
                                </tr>
                            )}
                            {role === 'admin' && (statusFilter === 'open' || statusFilter === 'all') && ticket.status === 'open' && (
                                <tr>
                                    <td className="card-label">Действия</td>
                                    <td className="card-value">
                                        <button
                                            onClick={() => onComplete(ticket.id)}
                                            className="action-button bg-red-500 hover:bg-red-600"
                                        >
                                            Закрыть
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
        {tickets.map((ticket) => (
            <tr key={ticket.id}>
                <td className="border p-2">{ticket.id}</td>
                <td className="border p-2">
                    {ticket.user ? (
                        <Tooltip
                            content={`ID: ${ticket.user.id}\nИмя: ${ticket.user.username}\nЗаблокирован: ${
                                ticket.user.isBlocked ? 'Да' : 'Нет'
                            }`}
                        >
                            <div className="bg-gray-100 px-2 py-1 rounded">
                                {ticket.user.username}
                            </div>
                        </Tooltip>
                    ) : (
                        <div className="bg-gray-100 px-2 py-1 rounded text-red-500">
                            Пользователь не найден
                        </div>
                    )}
                </td>
                <td className="border p-2">{ticket.reason}</td>
                <td className="border p-2">{renderDescription(ticket.description)}</td>
                <td className="border p-2">{renderScreenshots(ticket.imagesPath)}</td>
                <td className="border p-2">{formatCreatedAt(ticket.createdAt)}</td>
                {role === 'admin' && statusFilter === 'all' && (
                    <td className="border p-2">{getStatusName(ticket.status)}</td>
                )}
                {role === 'admin' && (statusFilter === 'open' || statusFilter === 'all') && ticket.status === 'open' && (
                    <td className="border p-2">
                        <button
                            onClick={() => onComplete(ticket.id)}
                            className="px-2 py-1 rounded text-white bg-red-500 hover:bg-red-600"
                        >
                            Закрыть
                        </button>
                    </td>
                )}
            </tr>
        ))}
        </tbody>
    );
};

export default SupportTicketsTableBody;