import axios from 'axios';
import { Tooltip } from '../Tooltip';
import type { UsersTableBodyProps } from '../../types';

interface ExtendedUsersTableBodyProps extends UsersTableBodyProps {
    isMobile: boolean;
}

const UsersTableBody: React.FC<ExtendedUsersTableBodyProps> = ({ users, role, setUsers, setError, isMobile }) => {
    const handleToggleBlock = async (id: number, isBlocked: boolean) => {
        if (role !== 'admin') {
            setError('Только администратор может блокировать пользователей');
            return;
        }
        try {
            const response = await axios.put(`/api/users/${id}`, {
                isBlocked: !isBlocked,
            });
            setUsers(users.map(user =>
                user.id === id ? { ...user, isBlocked: response.data.isBlocked } : user
            ));
            setError(null);
        } catch (error: any) {
            console.error('Error toggling block status:', error);
            setError(error.response?.data?.error || 'Ошибка при изменении статуса блокировки');
        }
    };

    // Проверяем, есть ли доступные действия для пользователя
    const hasActions = () => {
        return role === 'admin';
    };

    if (isMobile) {
        return (
            <>
                {users.map((user) => (
                    <div key={user.id} className={`card-stack-item user-item-${user.id}`}>
                        <table className="vertical-table">
                            <tbody>
                            <tr>
                                <td className="card-label">ID</td>
                                <td className="card-value">{user.id}</td>
                            </tr>
                            <tr>
                                <td className="card-label">Chat ID</td>
                                <td className="card-value">{user.chatId}</td>
                            </tr>
                            <tr>
                                <td className="card-label">Имя пользователя</td>
                                <td className="card-value">
                                    <a
                                        href={`https://t.me/${user.username}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-500 hover:underline"
                                    >
                                        @{user.username}
                                    </a>
                                </td>
                            </tr>
                            <tr>
                                <td className="card-label">ФИО</td>
                                <td className="card-value">{`${user.firstName} ${user.lastName}`}</td>
                            </tr>
                            <tr>
                                <td className="card-label">Кошельки</td>
                                <td className="card-value">
                                    <div className="wallets flex flex-wrap justify-evenly gap-2">
                                        {user.wallets.map((wallet) => (
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
                                <td className="card-label">Фиатная валюта</td>
                                <td className="card-value">{user.fiatCurrency}</td>
                            </tr>
                            <tr>
                                <td className="card-label">Реферер</td>
                                <td className="card-value">
                                    {user.referrer ? (
                                        <Tooltip content={`ID: ${user.referrer.id}\nЗаблокирован: ${user.referrer.isBlocked ? 'Да' : 'Нет'}`}>
                                            <div className="referrer bg-gray-100 px-2 py-1 rounded">
                                                {user.referrer.username}
                                            </div>
                                        </Tooltip>
                                    ) : (
                                        'Нет'
                                    )}
                                </td>
                            </tr>
                            <tr>
                                <td className="card-label">Кол-во рефералов</td>
                                <td className="card-value">{user.referralCount}</td>
                            </tr>
                            <tr>
                                <td className="card-label">Заблокирован</td>
                                <td className="card-value">{user.isBlocked ? 'Да' : 'Нет'}</td>
                            </tr>
                            {hasActions() && (
                                <tr>
                                    <td className="card-label">Действия</td>
                                    <td className="card-value">
                                        <button
                                            onClick={() => handleToggleBlock(user.id, user.isBlocked)}
                                            className={`action-button ${user.isBlocked ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'}`}
                                        >
                                            {user.isBlocked ? 'Разблокировать' : 'Заблокировать'}
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
        {users.map((user) => (
            <tr key={user.id} className={`user-item-${user.id}`}>
                <td className="border p-2">{user.id}</td>
                <td className="border p-2">{user.chatId}</td>
                <td className="border p-2">
                    <a
                        href={`https://t.me/${user.username}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:underline"
                    >
                        @{user.username}
                    </a>
                </td>
                <td className="border p-2">{`${user.firstName} ${user.lastName}`}</td>
                <td className="border p-2">
                    <div className="flex flex-wrap justify-evenly gap-2">
                        {user.wallets.map((wallet) => (
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
                <td className="border p-2">{user.fiatCurrency}</td>
                <td className="border p-2">
                    {user.referrer ? (
                        <Tooltip content={`ID: ${user.referrer.id}\nЗаблокирован: ${user.referrer.isBlocked ? 'Да' : 'Нет'}`}>
                            <div className="bg-gray-100 px-2 py-1 rounded">
                                {user.referrer.username}
                            </div>
                        </Tooltip>
                    ) : (
                        'Нет'
                    )}
                </td>
                <td className="border p-2">{user.referralCount}</td>
                <td className="border p-2">
                    {user.isBlocked ? 'Да' : 'Нет'}
                </td>
                {hasActions() && (
                    <td className="border p-2">
                        <button
                            onClick={() => handleToggleBlock(user.id, user.isBlocked)}
                            className={`px-2 py-1 rounded text-white ${user.isBlocked ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'}`}
                        >
                            {user.isBlocked ? 'Разблокировать' : 'Заблокировать'}
                        </button>
                    </td>
                )}
            </tr>
        ))}
        </tbody>
    );
};

export default UsersTableBody;