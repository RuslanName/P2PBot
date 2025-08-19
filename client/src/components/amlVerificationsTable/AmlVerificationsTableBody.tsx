import { Tooltip } from '../Tooltip';
import type { AmlVerificationsTableBodyProps } from '../../types';

interface ExtendedAmlVerificationsTableBodyProps extends AmlVerificationsTableBodyProps {
    isMobile: boolean;
}

const AmlVerificationsTableBody: React.FC<ExtendedAmlVerificationsTableBodyProps> = ({ verifications, role, statusFilter, onApprove, onReject, isMobile }) => {
    const getStatusName = (status: string) => {
        const statusMap: Record<string, string> = {
            open: 'Открыта',
            rejected: 'Отклонена',
            completed: 'Завершена'
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

    const renderImages = (imagesPath: string[]) => {
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
                        alt={`Документ ${index + 1}`}
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

    const hasActions = (verification: { status: string }) => {
        return (
            (statusFilter === 'open' || (statusFilter === 'all' && verification.status === 'open')) ||
            (statusFilter === 'rejected' || (statusFilter === 'all' && verification.status === 'rejected'))
        );
    };

    if (isMobile) {
        return (
            <>
                {verifications.map((verification) => (
                    <div key={verification.id} className="card-stack-item">
                        <table className="vertical-table">
                            <tbody>
                            <tr>
                                <td className="card-label">ID</td>
                                <td className="card-value">{verification.id}</td>
                            </tr>
                            <tr>
                                <td className="card-label">Пользователь</td>
                                <td className="card-value">
                                    {verification.user ? (
                                        <Tooltip
                                            content={`ID: ${verification.user.id}\nИмя: ${verification.user.username}\nЗаблокирован: ${
                                                verification.user.isBlocked ? 'Да' : 'Нет'
                                            }`}
                                        >
                                            <div className="bg-gray-100 px-2 py-1 rounded">
                                                {verification.user.username}
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
                                <td className="card-label">Причина</td>
                                <td className="card-value">{verification.reason}</td>
                            </tr>
                            <tr>
                                <td className="card-label">Документы</td>
                                <td className="card-value">{renderImages(verification.verificationImagesPath)}</td>
                            </tr>
                            {statusFilter === 'all' && (
                                <tr>
                                    <td className="card-label">Статус</td>
                                    <td className="card-value">{getStatusName(verification.status)}</td>
                                </tr>
                            )}
                            <tr>
                                <td className="card-label">Создано</td>
                                <td className="card-value">{formatCreatedAt(verification.createdAt)}</td>
                            </tr>
                            {role === 'admin' && hasActions(verification) && (
                                <tr>
                                    <td className="card-label">Действия</td>
                                    <td className="card-value">
                                        {(statusFilter === 'open' || (statusFilter === 'all' && verification.status === 'open')) && (
                                            <div className="flex flex-col gap-2">
                                                <button
                                                    onClick={() => onApprove(verification.id)}
                                                    className="action-button bg-green-500 hover:bg-green-600"
                                                >
                                                    Подтвердить
                                                </button>
                                                <button
                                                    onClick={() => onReject(verification.id)}
                                                    className="action-button bg-red-500 hover:bg-red-600"
                                                >
                                                    Отклонить
                                                </button>
                                            </div>
                                        )}
                                        {(statusFilter === 'rejected' || (statusFilter === 'all' && verification.status === 'rejected')) && (
                                            <button
                                                onClick={() => onApprove(verification.id)}
                                                className="action-button bg-green-500 hover:bg-green-600"
                                            >
                                                Подтвердить
                                            </button>
                                        )}
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
        {verifications.map((verification) => (
            <tr key={verification.id}>
                <td className="border p-2">{verification.id}</td>
                <td className="border p-2">
                    {verification.user ? (
                        <Tooltip
                            content={`ID: ${verification.user.id}\nИмя: ${verification.user.username}\nЗаблокирован: ${
                                verification.user.isBlocked ? 'Да' : 'Нет'
                            }`}
                        >
                            <div className="bg-gray-100 px-2 py-1 rounded">
                                {verification.user.username}
                            </div>
                        </Tooltip>
                    ) : (
                        <div className="bg-gray-100 px-2 py-1 rounded text-red-500">
                            Пользователь не найден
                        </div>
                    )}
                </td>
                <td className="border p-2">{verification.reason}</td>
                <td className="border p-2">{renderImages(verification.verificationImagesPath)}</td>
                {statusFilter === 'all' && (
                    <td className="border p-2">{getStatusName(verification.status)}</td>
                )}
                <td className="border p-2">{formatCreatedAt(verification.createdAt)}</td>
                {role === 'admin' && hasActions(verification) && (
                    <td className="border p-2">
                        {(statusFilter === 'open' || (statusFilter === 'all' && verification.status === 'open')) && (
                            <>
                                <button
                                    onClick={() => onApprove(verification.id)}
                                    className="px-2 py-1 rounded text-white bg-green-500 hover:bg-green-600 mr-2"
                                >
                                    Подтвердить
                                </button>
                                <button
                                    onClick={() => onReject(verification.id)}
                                    className="px-2 py-1 rounded text-white bg-red-500 hover:bg-red-600"
                                >
                                    Отклонить
                                </button>
                            </>
                        )}
                        {(statusFilter === 'rejected' || (statusFilter === 'all' && verification.status === 'rejected')) && (
                            <button
                                onClick={() => onApprove(verification.id)}
                                className="px-2 py-1 rounded text-white bg-green-500 hover:bg-green-600"
                            >
                                Подтвердить
                            </button>
                        )}
                    </td>
                )}
            </tr>
        ))}
        </tbody>
    );
};

export default AmlVerificationsTableBody;