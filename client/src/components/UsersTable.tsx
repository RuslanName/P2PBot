import { useEffect, useState } from 'react';
import axios from 'axios';
import { Tooltip } from './Tooltip';

interface User {
    id: number;
    chatId: string;
    username: string;
    firstName: string;
    lastName: string;
    wallets: Wallet[];
}

interface Wallet {
    id: number;
    coin: string;
    address: string;
    balance: number;
    unconfirmedBalance: number;
    heldAmount: number;
}

const UsersTable: React.FC = () => {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const response = await axios.get('/api/users');
                const usersWithWallets = await Promise.all(
                    response.data.map(async (user: User) => {
                        const walletsWithHeld = await Promise.all(
                            user.wallets.map(async (wallet) => {
                                const pendingTransactions = await axios.get(`/api/transactions?userId=${user.id}&coin=${wallet.coin}&status=pending&type=buy`);
                                const heldAmount = pendingTransactions.data.reduce((sum: number, tx: any) => sum + tx.amount, 0);
                                return {
                                    ...wallet,
                                    heldAmount
                                };
                            })
                        );
                        return {
                            ...user,
                            wallets: walletsWithHeld
                        };
                    })
                );
                setUsers(usersWithWallets);
                setLoading(false);
            } catch (error) {
                console.error('Error loading users:', error);
                setLoading(false);
            }
        };
        fetchUsers();
    }, []);

    if (loading) return <p>Загрузка...</p>;

    return (
        <>
            <table className="w-full border-collapse">
                <thead>
                <tr className="bg-gray-200">
                    <th className="border p-2">ID</th>
                    <th className="border p-2">Chat ID</th>
                    <th className="border p-2">Имя пользователя</th>
                    <th className="border p-2">ФИО</th>
                    <th className="border p-2">Кошельки</th>
                </tr>
                </thead>
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
                                            `Адрес: ${wallet.address}\n` +
                                            `Баланс: ${wallet.balance}\n` +
                                            `На обработке: ${wallet.unconfirmedBalance || 0}\n` +
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
                    </tr>
                ))}
                </tbody>
            </table>
        </>
    );
};

export default UsersTable;