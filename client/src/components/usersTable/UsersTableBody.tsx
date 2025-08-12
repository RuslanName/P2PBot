import axios from 'axios';
import { Tooltip } from '../Tooltip';
import type { UsersTableBodyProps } from '../../types';

const UsersTableBody: React.FC<UsersTableBodyProps> = ({ users, role, setUsers, setError }) => {
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

    return (
        <tbody>
        {users.map((user) => (
            <tr key={user.id}>
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
                {role === 'admin' && (
                    <td className="border p-2">
                        <button
                            onClick={() => handleToggleBlock(user.id, user.isBlocked)}
                            className={`px-2 py-1 rounded text-white ${
                                user.isBlocked
                                    ? 'bg-green-500 hover:bg-green-600'
                                    : 'bg-red-500 hover:bg-red-600'
                            }`}
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