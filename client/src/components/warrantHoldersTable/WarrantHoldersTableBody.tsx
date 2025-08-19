import { useState } from 'react';
import axios from 'axios';
import { Tooltip } from '../Tooltip';
import type { WarrantHoldersTableBodyProps } from '../../types';

interface ExtendedWarrantHoldersTableBodyProps extends WarrantHoldersTableBodyProps {
    isMobile: boolean;
    setError: (error: string | null) => void;
}

const WarrantHoldersTableBody: React.FC<ExtendedWarrantHoldersTableBodyProps> = ({ warrantHolders, role, setWarrantHolders, setError, isMobile }) => {
    const [localError, setLocalError] = useState<string | null>(null);

    const handleUpdatePassword = async (id: number) => {
        try {
            const response = await axios.put(`/api/warrant-holders/${id}`, { password: true });
            setWarrantHolders(warrantHolders.map(holder =>
                holder.id === id ? { ...holder, password: response.data.password } : holder
            ));
            setError(null);
            setLocalError(null);
        } catch (error: any) {
            console.error('Error updating password:', error);
            const errorMessage = error.response?.data?.error || 'Ошибка при обновлении пароля';
            setError(errorMessage);
            setLocalError(errorMessage);
        }
    };

    const handleToggleBlock = async (id: number, isBlocked: boolean) => {
        try {
            const response = await axios.put(`/api/warrant-holders/${id}`, {
                isBlocked: !isBlocked,
            });
            setWarrantHolders(warrantHolders.map(holder =>
                holder.id === id ? { ...holder, isBlocked: response.data.isBlocked } : holder
            ));
            setError(null);
            setLocalError(null);
        } catch (error: any) {
            console.error('Error toggling block status:', error);
            const errorMessage = error.response?.data?.error || 'Ошибка при изменении статуса блокировки';
            setError(errorMessage);
            setLocalError(errorMessage);
        }
    };

    const getOfferStatusName = (status: string) => {
        switch (status) {
            case 'open': return 'Открыт';
            case 'closed': return 'Закрыт';
            case 'blocked': return 'Заблокирован';
            default: return status;
        }
    };

    const getOfferTypeName = (type: string) => {
        switch (type) {
            case 'buy': return 'Покупка';
            case 'sell': return 'Продажа';
            default: return type;
        }
    };

    // Проверяем, есть ли доступные действия для ордеродержателя
    const hasActions = () => {
        return role === 'admin';
    };

    if (isMobile) {
        return (
            <>
                {warrantHolders.map((holder) => {
                    const offersContent = (holder.offers || []).map(
                        (offer) =>
                            `ID: ${offer.id}\nТип: ${getOfferTypeName(offer.type)}\nКриптовалюта: ${offer.coin}\nСтатус: ${getOfferStatusName(offer.status)}`
                    ).join('\n\n') || 'Оферты отсутствуют';

                    return (
                        <div key={holder.id} className={`card-stack-item holder-item-${holder.id}`}>
                            <table className="vertical-table">
                                <tbody>
                                <tr>
                                    <td className="card-label">ID</td>
                                    <td className="card-value">{holder.id}</td>
                                </tr>
                                <tr>
                                    <td className="card-label">Пользователь</td>
                                    <td className="card-value">
                                        {holder.user ? (
                                            <a
                                                href={`https://t.me/${holder.user.username}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-blue-500 hover:underline"
                                            >
                                                @{holder.user.username}
                                            </a>
                                        ) : (
                                            'Пользователь не найден'
                                        )}
                                    </td>
                                </tr>
                                <tr>
                                    <td className="card-label">Кошельки</td>
                                    <td className="card-value">
                                        <div className="wallets flex flex-wrap justify-evenly gap-2">
                                            {holder.wallets.map((wallet) => (
                                                <Tooltip
                                                    key={wallet.id}
                                                    content={
                                                        `ID: ${wallet.id}\n` +
                                                        `Криптовалюта: ${wallet.coin}\n` +
                                                        `Адрес: ${wallet.address}\n` +
                                                        `Баланс: ${wallet.balance}\n` +
                                                        `Неподтвержденный баланс: ${wallet.unconfirmedBalance || 0}\n` +
                                                        `На удержании: ${wallet.heldAmount || 0}`
                                                    }
                                                >
                                                    <div className="wallet-item bg-gray-100 px-2 py-1 rounded">
                                                        {wallet.coin}
                                                    </div>
                                                </Tooltip>
                                            ))}
                                        </div>
                                    </td>
                                </tr>
                                <tr>
                                    <td className="card-label">Оферты</td>
                                    <td className="card-value">
                                        <Tooltip content={offersContent}>
                                            <div className="bg-gray-100 px-2 py-1 rounded">
                                                {(holder.offers || []).length} оферты
                                            </div>
                                        </Tooltip>
                                    </td>
                                </tr>
                                {role === 'admin' && (
                                    <tr>
                                        <td className="card-label">Пароль</td>
                                        <td className="card-value">{holder.password}</td>
                                    </tr>
                                )}
                                <tr>
                                    <td className="card-label">Заблокирован</td>
                                    <td className="card-value">{holder.isBlocked ? 'Да' : 'Нет'}</td>
                                </tr>
                                {hasActions() && (
                                    <tr>
                                        <td className="card-label">Действия</td>
                                        <td className="card-value">
                                            <div className="flex flex-col gap-2">
                                                <button
                                                    onClick={() => handleUpdatePassword(holder.id)}
                                                    className="action-button bg-blue-500 hover:bg-blue-600"
                                                    disabled={holder.isBlocked}
                                                >
                                                    Обновить пароль
                                                </button>
                                                <button
                                                    onClick={() => handleToggleBlock(holder.id, holder.isBlocked)}
                                                    className={`action-button ${holder.isBlocked ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'}`}
                                                >
                                                    {holder.isBlocked ? 'Разблокировать' : 'Заблокировать'}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                                </tbody>
                            </table>
                        </div>
                    );
                })}
                {localError && <p className="text-red-500 mt-2">{localError}</p>}
            </>
        );
    }

    return (
        <tbody>
        {warrantHolders.map((holder) => {
            const offersContent = (holder.offers || []).map(
                (offer) =>
                    `ID: ${offer.id}\nТип: ${getOfferTypeName(offer.type)}\nКриптовалюта: ${offer.coin}\nСтатус: ${getOfferStatusName(offer.status)}`
            ).join('\n\n') || 'Оферты отсутствуют';

            return (
                <tr key={holder.id} className={`holder-item-${holder.id}`}>
                    <td className="border p-2">{holder.id}</td>
                    <td className="border p-2">
                        {holder.user ? (
                            <a
                                href={`https://t.me/${holder.user.username}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-500 hover:underline"
                            >
                                @{holder.user.username}
                            </a>
                        ) : (
                            'Пользователь не найден'
                        )}
                    </td>
                    <td className="border p-2">
                        <div className="flex flex-wrap justify-evenly gap-2">
                            {holder.wallets.map((wallet) => (
                                <Tooltip
                                    key={wallet.id}
                                    content={
                                        `ID: ${wallet.id}\n` +
                                        `Криптовалюта: ${wallet.coin}\n` +
                                        `Адрес: ${wallet.address}\n` +
                                        `Баланс: ${wallet.balance}\n` +
                                        `Неподтвержденный баланс: ${wallet.unconfirmedBalance || 0}\n` +
                                        `На удержании: ${wallet.heldAmount || 0}`
                                    }
                                >
                                    <div className="bg-gray-100 px-2 py-1 rounded">
                                        {wallet.coin}
                                    </div>
                                </Tooltip>
                            ))}
                        </div>
                    </td>
                    <td className="border p-2">
                        <Tooltip content={offersContent}>
                            <div className="bg-gray-100 px-2 py-1 rounded">
                                {(holder.offers || []).length} оферты
                            </div>
                        </Tooltip>
                    </td>
                    {role === 'admin' && (
                        <td className="border p-2">{holder.password}</td>
                    )}
                    <td className="border p-2">{holder.isBlocked ? 'Да' : 'Нет'}</td>
                    {hasActions() && (
                        <td className="border p-2">
                            <div className="flex justify-evenly gap-2">
                                <button
                                    onClick={() => handleUpdatePassword(holder.id)}
                                    className="px-2 py-1 rounded text-white bg-blue-500 hover:bg-blue-600"
                                    disabled={holder.isBlocked}
                                >
                                    Обновить пароль
                                </button>
                                <button
                                    onClick={() => handleToggleBlock(holder.id, holder.isBlocked)}
                                    className={`px-2 py-1 rounded text-white ${holder.isBlocked ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'}`}
                                >
                                    {holder.isBlocked ? 'Разблокировать' : 'Заблокировать'}
                                </button>
                            </div>
                        </td>
                    )}
                </tr>
            );
        })}
        </tbody>
    );
};

export default WarrantHoldersTableBody;